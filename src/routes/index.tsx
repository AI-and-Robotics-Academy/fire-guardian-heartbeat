import { createFileRoute, ClientOnly, Link } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Activity, BellRing, Droplets, Flame, Navigation, Radio, Satellite, Thermometer } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  getResponseRoute,
  type ResponseRoute,
} from "@/lib/response-route.functions";
import { RiskBadge } from "@/components/RiskBadge";
import { SensorRow } from "@/components/SensorRow";
import { TrendChart } from "@/components/TrendChart";
import { RateOfRiseChart } from "@/components/RateOfRiseChart";
import {
  HEAT_BANDS,
  assessRisk,
  generateReadings,
  distanceKm,
  evaluateAlerts,
  generateRateOfRise,
  generateTrend,
  nearestStation,
  type FireStation,
  type RorPoint,
  type SensorReading,
  type TrendPoint,
} from "@/lib/sensors";
import { UnitToggle } from "@/components/UnitToggle";
import {
  formatDistanceFromKm,
  formatElevation,
  formatRate,
  formatTemp,
  rateUnit,
  rateValue,
  tempUnit,
  tempValue,
  useUnits,
  type UnitSystem,
} from "@/lib/units";

const TerrainMap = lazy(() => import("@/components/TerrainMap"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WildGuard — Washington Wildfire Sensor Console" },
      {
        name: "description",
        content:
          "Live Raspberry Pi telemetry for Washington State wildfire crews: temperature, humidity, composite fire-risk scoring and terrain mapping across Cascade and eastern Washington zones.",
      },
      { property: "og:title", content: "WildGuard — Washington Wildfire Sensor Console" },
      {
        property: "og:description",
        content:
          "Monitor temperature, humidity and composite fire risk from Raspberry Pi sensors across Washington State on a live topography map.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  // Initialize empty to avoid SSR hydration mismatch from random telemetry.
  const [sensors, setSensors] = useState<SensorReading[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [ror, setRor] = useState<RorPoint[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [layer, setLayer] = useState<"heat" | "risk">("heat");
  const [showStations, setShowStations] = useState(true);
  const [route, setRoute] = useState<ResponseRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const fetchRoute = useServerFn(getResponseRoute);

  useEffect(() => {
    const tick = () => {
      setSensors(generateReadings());
      setUpdatedAt(new Date().toLocaleTimeString());
    };
    setTrend(generateTrend());
    setRor(generateRateOfRise());
    tick();
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, []);

  const online = sensors.filter((s) => s.online);
  const network = useMemo(() => {
    if (online.length === 0) return null;
    const avgTemp = online.reduce((a, s) => a + s.temperatureF, 0) / online.length;
    const avgHum = online.reduce((a, s) => a + s.humidityPct, 0) / online.length;
    const avgRor = online.reduce((a, s) => a + s.tempTrendFPerHr, 0) / online.length;
    const scores = online.map((s) => assessRisk(s));
    const worst = scores.reduce((a, b) => (b.score > a.score ? b : a));
    return { avgTemp, avgHum, avgRor, worst, peak: worst.score };
  }, [online]);

  const activeAlerts = useMemo(() => evaluateAlerts(sensors).length, [sensors]);

  const selected = sensors.find((s) => s.id === selectedId) ?? null;
  const station: FireStation | null = selected ? nearestStation(selected) : null;

  // One routing request per selected node; cached by node id for the session.
  const routeCache = useRef<Map<string, ResponseRoute>>(new Map());
  useEffect(() => {
    if (!selectedId || !selected || !station) {
      setRoute(null);
      return;
    }
    const cached = routeCache.current.get(selectedId);
    if (cached) {
      setRoute(cached);
      return;
    }
    let cancelled = false;
    setRouteLoading(true);
    fetchRoute({
      data: {
        originLat: station.lat,
        originLng: station.lng,
        destLat: selected.lat,
        destLng: selected.lng,
      },
    })
      .then((result) => {
        routeCache.current.set(selectedId, result);
        if (!cancelled) setRoute(result);
      })
      .catch(() => {
        if (!cancelled)
          setRoute({
            polyline: null,
            distanceMeters: null,
            durationSeconds: null,
            error: "Routing unavailable",
          });
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Only re-run when the selected node changes, not on every telemetry tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);
  const ranked = [...sensors].sort((a, b) => assessRisk(b).score - assessRisk(a).score);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-eyebrow flex items-center gap-2">
            <span className="live-dot" /> Live sensor mesh · simulated feed
          </p>
          <h1 className="mt-2 flex items-center gap-3 text-4xl font-semibold md:text-5xl">
            <Flame className="size-8 text-primary" aria-hidden />
            WildGuard
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Wildfire prevention and early detection for Washington State crews — Raspberry Pi
            temperature and humidity nodes across the Cascades and eastern shrub-steppe, composite
            risk scoring, and live topography.
          </p>
          <nav className="mt-4 flex gap-2">
            <span className="rounded-full bg-primary px-3 py-1 font-display text-xs tracking-[0.14em] uppercase text-primary-foreground">
              Console
            </span>
            <Link
              to="/alerts"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 font-display text-xs tracking-[0.14em] uppercase text-muted-foreground transition-colors hover:text-foreground"
            >
              <BellRing className="size-3" aria-hidden />
              Alerts
              {activeAlerts > 0 && (
                <span className="rounded-full bg-risk-extreme px-1.5 font-mono text-[0.65rem] text-background">
                  {activeAlerts}
                </span>
              )}
            </Link>
          </nav>

        </div>
        <div className="panel px-4 py-3 text-right">
          <p className="label-eyebrow">Last packet</p>
          <p className="font-mono text-sm tabular-nums">{updatedAt || "syncing…"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {online.length}/{sensors.length} nodes reporting
          </p>
        </div>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Thermometer className="size-4" />}
          label="Avg temperature"
          value={network ? `${network.avgTemp.toFixed(1)}°F` : "—"}
          accent="text-temp"
          note="Across reporting nodes"
        />
        <StatCard
          icon={<Droplets className="size-4" />}
          label="Avg humidity"
          value={network ? `${Math.round(network.avgHum)}%` : "—"}
          accent="text-humidity"
          note="Relative humidity"
        />
        <StatCard
          icon={<Activity className="size-4" />}
          label="Peak risk score"
          value={network ? String(network.peak) : "—"}
          accent="text-primary"
          note={network ? `Level: ${network.worst.label}` : "Awaiting telemetry"}
        />
        <StatCard
          icon={<Radio className="size-4" />}
          label="Mesh health"
          value={`${Math.round((online.length / Math.max(1, sensors.length)) * 100)}%`}
          accent="text-risk-low"
          note="Nodes online"
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <h2 className="flex items-center gap-2 text-xl">
              <Satellite className="size-4 text-accent" aria-hidden />
              Live topography
            </h2>
            <div className="flex items-center gap-1 rounded-full border border-border bg-surface-raised p-1">
              {(["heat", "risk"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setLayer(mode)}
                  aria-pressed={layer === mode}
                  className={`rounded-full px-3 py-1 font-display text-xs tracking-[0.14em] uppercase transition-colors ${
                    layer === mode
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {mode === "heat" ? "Heat" : "Risk"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowStations((v) => !v)}
              aria-pressed={showStations}
              className={`inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 font-display text-xs tracking-[0.14em] uppercase transition-colors ${
                showStations
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Navigation className="size-3" aria-hidden />
              Stations
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-2">
            {layer === "heat" ? (
              <>
                <span className="label-eyebrow mr-1">Surface temperature</span>
                {HEAT_BANDS.slice().reverse().map((band) => (
                  <span
                    key={band.label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 font-mono text-[0.7rem] tabular-nums"
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: band.hex }}
                      aria-hidden
                    />
                    {band.label}
                  </span>
                ))}
              </>
            ) : (
              <>
                <span className="label-eyebrow mr-1">Composite risk</span>
                <RiskBadge level="low" label="Low" />
                <RiskBadge level="moderate" label="Moderate" />
                <RiskBadge level="high" label="High" />
                <RiskBadge level="extreme" label="Extreme" />
              </>
            )}
          </div>
          <div className="h-[460px] w-full bg-surface-raised">
            <ClientOnly fallback={<MapSkeleton />}>
              <Suspense fallback={<MapSkeleton />}>
                <TerrainMap
                  sensors={sensors}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  layer={layer}
                  routePolyline={route?.polyline ?? null}
                  dispatchStation={station}
                  showStations={showStations}
                />
              </Suspense>
            </ClientOnly>
          </div>
        </div>

        <div className="panel flex max-h-[529px] flex-col overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-xl">Nodes by risk</h2>
            <p className="text-xs text-muted-foreground">Tap a node to center the map</p>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {ranked.map((sensor) => (
              <SensorRow
                key={sensor.id}
                sensor={sensor}
                selected={sensor.id === selectedId}
                onSelect={() => setSelectedId(sensor.id)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 panel p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl">Rate of rise — fire risk momentum</h2>
            <p className="text-xs text-muted-foreground">
              °F gained per hour across the mesh. Sustained fast rise is the earliest ignition
              signal; crossing the dashed lines escalates a node to warning or critical.
            </p>
          </div>
          <p className="font-mono text-sm tabular-nums">
            <span className="label-eyebrow mr-2">Now</span>
            {network ? `${network.avgRor.toFixed(1)} °F/h avg` : "—"}
          </p>
        </div>
        <div className="mt-3">
          <RateOfRiseChart data={ror} />
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="panel p-5">
          <h2 className="text-xl">24-hour network trend</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Temperature, humidity and composite risk over the last day
          </p>
          <TrendChart data={trend} />
        </div>


        <div className="panel p-5">
          <h2 className="text-xl">{selected ? `${selected.id} · ${selected.name}` : "Node detail"}</h2>
          {selected ? (
            <>
              <SensorDetail sensor={selected} />
              <DispatchPanel
                sensor={selected}
                station={station}
                route={route}
                loading={routeLoading}
              />
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Select a node from the map or list to inspect its readings and risk drivers.
            </p>
          )}
        </div>
      </section>

      <footer className="mt-8 text-xs text-muted-foreground">
        Readings shown are simulated for demonstration. Connect field Raspberry Pi units to stream
        real telemetry.
      </footer>
    </main>
  );
}

function SensorDetail({ sensor }: { sensor: SensorReading }) {
  const risk = assessRisk(sensor);
  return (
    <div className="mt-3 space-y-4">
      <div className="flex items-center justify-between">
        <span className="metric-value text-primary">{risk.score}</span>
        <RiskBadge level={risk.level} label={risk.label} />
      </div>
      <dl className="grid grid-cols-2 gap-3 font-mono text-sm tabular-nums">
        <Detail label="Temperature" value={`${sensor.temperatureF.toFixed(1)} °F`} />
        <Detail label="Humidity" value={`${sensor.humidityPct} %`} />
        <Detail label="Elevation" value={`${sensor.elevationM} m`} />
        <Detail label="Battery" value={`${Math.min(100, sensor.batteryPct)} %`} />
        <Detail label="Trend" value={`${sensor.tempTrendFPerHr.toFixed(1)} °F/h`} />
        <Detail label="Last seen" value={`${sensor.lastSeenSecondsAgo}s ago`} />
      </dl>
      <div className="space-y-2">
        <p className="label-eyebrow">Risk drivers</p>
        {risk.drivers.map((d) => (
          <div key={d.label}>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{d.label}</span>
              <span className="font-mono">{d.contribution}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, d.contribution * 2.2)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DispatchPanel({
  sensor,
  station,
  route,
  loading,
}: {
  sensor: SensorReading;
  station: FireStation | null;
  route: ResponseRoute | null;
  loading: boolean;
}) {
  if (!station) return null;
  const straightKm = distanceKm(sensor, station);
  const miles = route?.distanceMeters
    ? route.distanceMeters / 1609.34
    : straightKm * 0.621371;
  const eta = route?.durationSeconds ? Math.round(route.durationSeconds / 60) : null;

  return (
    <div className="mt-5 border-t border-border pt-4">
      <p className="label-eyebrow flex items-center gap-2 text-accent">
        <Navigation className="size-3.5" aria-hidden />
        Nearest response unit
      </p>
      <p className="mt-2 text-sm">{station.name}</p>
      <p className="text-xs text-muted-foreground">{station.city}, WA</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 font-mono text-sm tabular-nums">
        <Detail
          label={route?.distanceMeters ? "Road distance" : "Direct distance"}
          value={`${miles.toFixed(1)} mi`}
        />
        <Detail label="Drive ETA" value={eta ? `${eta} min` : loading ? "…" : "—"} />
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        {loading
          ? "Calculating response route…"
          : route?.polyline
            ? "Blue line shows the fastest road route to this node."
            : `Straight-line bearing shown${route?.error ? ` — ${route.error}` : ""}.`}
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised/50 px-3 py-2">
      <dt className="text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  note,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  accent: string;
}) {
  return (
    <div className="panel p-5">
      <p className={`label-eyebrow flex items-center gap-2 ${accent}`}>
        {icon}
        {label}
      </p>
      <p className={`metric-value mt-3 ${accent}`}>{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
      Loading terrain…
    </div>
  );
}
