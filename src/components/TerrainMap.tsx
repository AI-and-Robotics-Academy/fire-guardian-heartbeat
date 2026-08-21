/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { RISK_HEX, assessRisk, type SensorReading } from "@/lib/sensors";

declare global {
  interface Window {
    google?: typeof google;
    __wildguardMapReady?: () => void;
  }
}

const SCRIPT_ID = "wildguard-google-maps";

interface MapsLibs {
  maps: google.maps.MapsLibrary;
  core: google.maps.CoreLibrary;
  marker: google.maps.MarkerLibrary;
}

let libsPromise: Promise<MapsLibs> | null = null;

/** Loads the JS API and resolves the concrete library constructors. */
function loadMapsApi(): Promise<MapsLibs> {
  libsPromise ??= (async () => {
    await loadScript();
    const g = window.google!;
    const [maps, core, marker] = await Promise.all([
      g.maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>,
      g.maps.importLibrary("core") as Promise<google.maps.CoreLibrary>,
      g.maps.importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
    ]);
    return { maps, core, marker };
  })();
  return libsPromise;
}

function loadScript(): Promise<void> {
  if (window.google?.maps) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("maps load failed")));
      return;
    }
    const key = import.meta.env['VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY'];
    const channel = import.meta.env['VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID'];
    if (!key) {
      reject(new Error("Google Maps browser key is not configured"));
      return;
    }
    window.__wildguardMapReady = () => resolve();
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__wildguardMapReady${
      channel ? `&channel=${channel}` : ""
    }`;
    script.onerror = () => reject(new Error("maps load failed"));
    document.head.appendChild(script);
  });
}

function markerIcon(libs: MapsLibs, color: string, active: boolean) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
    <circle cx="17" cy="17" r="12" fill="${color}" fill-opacity="0.22"/>
    <circle cx="17" cy="17" r="7" fill="${color}" stroke="#12100e" stroke-width="${active ? 3 : 1.5}"/>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new libs.core.Size(34, 34),
    anchor: new libs.core.Point(17, 17),
  };
}

interface Props {
  sensors: SensorReading[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function TerrainMap({ sensors, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const libsRef = useRef<MapsLibs | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const circlesRef = useRef<Map<string, google.maps.Circle>>(new Map());
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadMapsApi()
      .then((libs) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        libsRef.current = libs;
        mapRef.current = new libs.maps.Map(containerRef.current, {
          center: { lat: 34.28, lng: -118.13 },
          zoom: 10,
          mapTypeId: "terrain",
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: true,
          mapTypeControlOptions: {
            mapTypeIds: ["terrain", "satellite", "hybrid"],
          },
        });
        setReady(true);
      })
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const libs = libsRef.current;
    if (!ready || !map || !libs) return;

    for (const sensor of sensors) {
      const risk = assessRisk(sensor);
      const color = sensor.online ? RISK_HEX[risk.level] : "#7a736c";
      const active = sensor.id === selectedId;
      const position = { lat: sensor.lat, lng: sensor.lng };

      let marker = markersRef.current.get(sensor.id);
      if (!marker) {
        marker = new libs.marker.Marker({ position, map, title: `${sensor.id} · ${sensor.name}` });
        marker.addListener("click", () => selectRef.current(sensor.id));
        markersRef.current.set(sensor.id, marker);
      }
      marker.setIcon(markerIcon(libs, color, active));
      marker.setZIndex(active ? 999 : Math.round(risk.score));

      let circle = circlesRef.current.get(sensor.id);
      const radius = 1200 + risk.score * 55;
      if (!circle) {
        circle = new libs.maps.Circle({
          map,
          center: position,
          radius,
          strokeWeight: 1,
          strokeOpacity: 0.5,
          fillOpacity: 0.16,
          clickable: false,
        });
        circlesRef.current.set(sensor.id, circle);
      }
      circle.setOptions({ radius, strokeColor: color, fillColor: color });
    }
  }, [sensors, selectedId, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const sensor = sensors.find((s) => s.id === selectedId);
    if (map && sensor) map.panTo({ lat: sensor.lat, lng: sensor.lng });
  }, [selectedId, sensors]);

  return <div ref={containerRef} className="h-full w-full" aria-label="Live topography map" />;
}
