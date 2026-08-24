/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import {
  FIRE_STATIONS,
  RISK_HEX,
  assessRisk,
  heatColor,
  type FireStation,
  type SensorReading,
} from "@/lib/sensors";

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
  geometry: google.maps.GeometryLibrary;
}

let libsPromise: Promise<MapsLibs> | null = null;

/** Loads the JS API and resolves the concrete library constructors. */
function loadMapsApi(): Promise<MapsLibs> {
  libsPromise ??= (async () => {
    await loadScript();
    const g = window.google!;
    const [maps, core, marker, geometry] = await Promise.all([
      g.maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>,
      g.maps.importLibrary("core") as Promise<google.maps.CoreLibrary>,
      g.maps.importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
      g.maps.importLibrary("geometry") as Promise<google.maps.GeometryLibrary>,
    ]);
    return { maps, core, marker, geometry };
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

function stationIcon(libs: MapsLibs, active: boolean) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
    <rect x="6" y="6" width="18" height="18" rx="4" fill="#2f7fd4" stroke="#12100e" stroke-width="${active ? 3 : 1.5}"/>
    <path d="M15 10l3.4 4.2h-2.2v4.6h-2.4v-4.6h-2.2z" fill="#f4f1ec"/>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new libs.core.Size(30, 30),
    anchor: new libs.core.Point(15, 15),
  };
}

interface Props {
  sensors: SensorReading[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** "heat" colors nodes by raw temperature; "risk" by composite score. */
  layer?: "risk" | "heat";
  /** Encoded polyline of the dispatch route to the selected node. */
  routePolyline?: string | null;
  /** Station dispatching to the selected node (highlighted + straight-line fallback). */
  dispatchStation?: FireStation | null;
  showStations?: boolean;
}

export default function TerrainMap({
  sensors,
  selectedId,
  onSelect,
  layer = "heat",
  routePolyline = null,
  dispatchStation = null,
  showStations = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const libsRef = useRef<MapsLibs | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const circlesRef = useRef<Map<string, google.maps.Circle>>(new Map());
  const stationMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const routeLineRef = useRef<google.maps.Polyline | null>(null);
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
          center: { lat: 47.4, lng: -120.2 },
          zoom: 7,
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
      const heat = layer === "heat";
      const color = !sensor.online
        ? "#7a736c"
        : heat
          ? heatColor(sensor.temperatureF)
          : RISK_HEX[risk.level];
      const active = sensor.id === selectedId;
      const position = { lat: sensor.lat, lng: sensor.lng };

      let marker = markersRef.current.get(sensor.id);
      if (!marker) {
        marker = new libs.marker.Marker({ position, map, title: `${sensor.id} · ${sensor.name}` });
        marker.addListener("click", () => selectRef.current(sensor.id));
        markersRef.current.set(sensor.id, marker);
      }
      marker.setIcon(markerIcon(libs, color, active));
      marker.setZIndex(active ? 999 : Math.round(heat ? sensor.temperatureF : risk.score));

      let circle = circlesRef.current.get(sensor.id);
      const radius = heat
        ? 2600 + Math.max(0, sensor.temperatureF - 70) * 460
        : 1200 + risk.score * 55;
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
      circle.setOptions({
        radius,
        strokeColor: color,
        fillColor: color,
        fillOpacity: heat ? (sensor.online ? 0.3 : 0.1) : 0.16,
      });
    }
  }, [sensors, selectedId, ready, layer]);

  // Fire station markers.
  useEffect(() => {
    const map = mapRef.current;
    const libs = libsRef.current;
    if (!ready || !map || !libs) return;
    for (const station of FIRE_STATIONS) {
      let marker = stationMarkersRef.current.get(station.id);
      if (!marker) {
        marker = new libs.marker.Marker({
          position: { lat: station.lat, lng: station.lng },
          map,
          title: `${station.name} · ${station.city}`,
          zIndex: 500,
        });
        stationMarkersRef.current.set(station.id, marker);
      }
      marker.setMap(showStations ? map : null);
      marker.setIcon(stationIcon(libs, station.id === dispatchStation?.id));
    }
  }, [ready, showStations, dispatchStation]);

  // Dispatch route line: real road path when available, straight line otherwise.
  useEffect(() => {
    const map = mapRef.current;
    const libs = libsRef.current;
    if (!ready || !map || !libs) return;
    const sensor = sensors.find((s) => s.id === selectedId) ?? null;

    let path: google.maps.LatLngLiteral[] = [];
    if (routePolyline) {
      path = libs.geometry.encoding
        .decodePath(routePolyline)
        .map((p) => ({ lat: p.lat(), lng: p.lng() }));
    } else if (sensor && dispatchStation) {
      path = [
        { lat: dispatchStation.lat, lng: dispatchStation.lng },
        { lat: sensor.lat, lng: sensor.lng },
      ];
    }

    if (path.length === 0) {
      routeLineRef.current?.setMap(null);
      return;
    }
    if (!routeLineRef.current) {
      routeLineRef.current = new libs.maps.Polyline({ clickable: false, zIndex: 400 });
    }
    routeLineRef.current.setOptions({
      map,
      path,
      strokeColor: "#2f7fd4",
      strokeOpacity: routePolyline ? 0.95 : 0,
      strokeWeight: 4,
      icons: routePolyline
        ? null
        : [
            {
              icon: { path: "M 0,-1 0,1", strokeOpacity: 0.9, scale: 3 },
              offset: "0",
              repeat: "14px",
            },
          ],
    });
  }, [ready, routePolyline, dispatchStation, selectedId, sensors]);

  useEffect(() => {
    const map = mapRef.current;
    const sensor = sensors.find((s) => s.id === selectedId);
    if (map && sensor) map.panTo({ lat: sensor.lat, lng: sensor.lng });
  }, [selectedId, sensors]);

  return <div ref={containerRef} className="h-full w-full" aria-label="Live topography map" />;
}
