import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BellRing, Flame, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { RateOfRiseChart } from "@/components/RateOfRiseChart";
import {
  DEFAULT_THRESHOLDS,
  SEVERITY_STYLE,
  evaluateAlerts,
  generateRateOfRise,
  generateReadings,
  nearestStation,
  type AlertThresholds,
  type RorPoint,
  type SensorAlert,
  type SensorReading,
} from "@/lib/sensors";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Alert System — WildGuard Washington Sensor Mesh" },
      {
        name: "description",
        content:
          "Threshold-driven wildfire alerts for Washington State crews: alarms trigger only when sensor temperature, humidity, rate of rise or composite risk parameters are breached.",
      },
      { property: "og:title", content: "Alert System — WildGuard Washington Sensor Mesh" },
      {
        property: "og:description",
        content:
          "Live alarm console showing which Raspberry Pi nodes have breached dispatch thresholds, with rate-of-rise trending.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const [sensors, setSensors] = useState<SensorReading[]>([]);
  const [ror, setRor] = useState<RorPoint[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [thresholds, setThresholds] = useState<AlertThresholds>(DEFAULT_THRESHOLDS);
  const [armed, setArmed] = useState(true);

  useEffect(() => {
    const tick = () => {
      setSensors(generateReadings());
      setUpdatedAt(new Date().toLocaleTimeString());
    };
    setRor(generateRateOfRise());
    tick();
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, []);

  const alerts = useMemo(
    () => (armed ? evaluateAlerts(sensors, thresholds) : []),
    [sensors, thresholds, armed],
  );
  const counts = useMemo(
    () => ({
      critical: alerts.filter((a) => a.severity === "critical").length,
      warning: alerts.filter((a) => a.severity === "warning").length,
      watch: alerts.filter((a) => a.severity === "watch").length,
    }),
    [alerts],
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-eyebrow flex items-center gap-2">
            <span className="live-dot" /> Threshold monitor · simulated feed
          </p>
          <h1 className="mt-2 flex items-center gap-3 text-4xl font-semibold md:text-5xl">
            <BellRing className="size-8 text-primary" aria-hidden />
            Alert system
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Nothing sounds until a node breaches a parameter. Alarms are raised the moment
            temperature, humidity, rate of rise or composite risk crosses the values set below.
          </p>
          <nav className="mt-4 flex gap-2">
            <Link
              to="/"
              className="rounded-full border border-border px-3 py-1 font-display text-xs tracking-[0.14em] uppercase text-muted-foreground transition-colors hover:text-foreground"
            >
              Console
            </Link>
            <span className="rounded-full bg-primary px-3 py-1 font-display text-xs tracking-[0.14em] uppercase text-primary-foreground">
              Alerts
            </span>
          </nav>
        </div>
        <div className="panel px-4 py-3 text-right">
          <p className="label-eyebrow">Last evaluation</p>
          <p className="font-mono text-sm tabular-nums">{updatedAt || "syncing…"}</p>
          <button
            type="button"
            onClick={() => setArmed((v) => !v)}
            aria-pressed={armed}
            className={`mt-2 rounded-full px-3 py-1 font-display text-xs tracking-[0.14em] uppercase transition-colors ${
              armed
                ? "bg-risk-low/20 text-risk-low"
                : "border border-border text-muted-foreground"
            }`}
          >
            {armed ? "Armed" : "Silenced"}
          </button>
        </div>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <Tally label="Critical" value={counts.critical} accent="text-risk-extreme" />
        <Tally label="Warning" value={counts.warning} accent="text-risk-high" />
        <Tally label="Watch" value={counts.watch} accent="text-risk-moderate" />
      </section>

      <section className="mt-6 panel p-5">
        <h2 className="flex items-center gap-2 text-xl">
          <Flame className="size-4 text-primary" aria-hidden />
          Rate of rise — fire risk momentum
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          °F gained per hour over the last 12 hours. Crossing the dashed lines is what escalates a
          node from watch to warning to critical.
        </p>
        <RateOfRiseChart data={ror} />
      </section>

      <section className="mt-6 panel p-5">
        <h2 className="flex items-center gap-2 text-xl">
          <SlidersHorizontal className="size-4 text-accent" aria-hidden />
          Trigger parameters
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Tune the dispatch thresholds — alerts re-evaluate instantly.
        </p>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Slider
            label="Temperature at or above"
            unit="°F"
            min={70}
            max={120}
            value={thresholds.temperatureF}
            onChange={(temperatureF) => setThresholds((t) => ({ ...t, temperatureF }))}
          />
          <Slider
            label="Humidity at or below"
            unit="%"
            min={5}
            max={50}
            value={thresholds.humidityPct}
            onChange={(humidityPct) => setThresholds((t) => ({ ...t, humidityPct }))}
          />
          <Slider
            label="Rate of rise at or above"
            unit="°F/h"
            min={1}
            max={15}
            value={thresholds.rorFPerHr}
            onChange={(rorFPerHr) => setThresholds((t) => ({ ...t, rorFPerHr }))}
          />
          <Slider
            label="Composite risk at or above"
            unit="pts"
            min={20}
            max={100}
            value={thresholds.riskScore}
            onChange={(riskScore) => setThresholds((t) => ({ ...t, riskScore }))}
          />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-xl">Active alarms</h2>
        {alerts.length === 0 ? (
          <div className="panel mt-3 flex items-center gap-3 p-6">
            <ShieldCheck className="size-6 text-risk-low" aria-hidden />
            <div>
              <p className="text-sm">
                {armed
                  ? "All nodes within parameters — no alarms raised."
                  : "Alerting is silenced. Re-arm to resume monitoring."}
              </p>
              <p className="text-xs text-muted-foreground">
                Alerts appear here only when a threshold above is met.
              </p>
            </div>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} sensors={sensors} />
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-8 text-xs text-muted-foreground">
        Readings are simulated for demonstration. Connect field Raspberry Pi units to alarm on real
        telemetry.
      </footer>
    </main>
  );
}

function AlertCard({ alert, sensors }: { alert: SensorAlert; sensors: SensorReading[] }) {
  const sensor = sensors.find((s) => s.id === alert.sensorId);
  const station = sensor ? nearestStation(sensor) : null;
  const style = SEVERITY_STYLE[alert.severity];

  return (
    <li
      className="panel p-4"
      style={{ borderLeft: `3px solid var(--color-${style.token})` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-lg tracking-wide">
          <span className="text-muted-foreground">{alert.sensorId}</span> {alert.sensorName}
        </p>
        <span
          className={`rounded-full px-2.5 py-0.5 font-display text-xs tracking-[0.14em] uppercase text-${style.token}`}
          style={{ border: `1px solid var(--color-${style.token})` }}
        >
          {style.label} · {alert.parameter}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{alert.zone}</p>
      <p className="mt-2 text-sm">{alert.message}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 font-mono text-sm tabular-nums sm:grid-cols-4">
        <Cell label="Reading" value={alert.reading} />
        <Cell label="Threshold" value={alert.threshold} />
        <Cell label="Risk score" value={String(alert.riskScore)} />
        <Cell label="Nearest unit" value={station ? station.city : "—"} />
      </dl>
    </li>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised/50 px-3 py-2">
      <dt className="text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

function Tally({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="panel p-5">
      <p className={`label-eyebrow ${accent}`}>{label}</p>
      <p className={`metric-value mt-3 ${accent}`}>{value}</p>
    </div>
  );
}

function Slider({
  label,
  unit,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="label-eyebrow">{label}</span>
      <span className="mt-1 block font-mono text-lg tabular-nums">
        {value} {unit}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--color-primary)]"
      />
    </label>
  );
}
