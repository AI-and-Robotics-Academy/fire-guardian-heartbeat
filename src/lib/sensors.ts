// Browser-safe sensor domain model + simulated Raspberry Pi telemetry.
// No module-scope randomness (Worker global scope forbids it) — call the
// factories lazily from render/effects.

export type RiskLevel = "low" | "moderate" | "high" | "extreme";

export interface SensorReading {
  id: string;
  name: string;
  zone: string;
  lat: number;
  lng: number;
  elevationM: number;
  temperatureF: number;
  humidityPct: number;
  /** Degrees F change over the last hour — feeds the composite score. */
  tempTrendFPerHr: number;
  batteryPct: number;
  online: boolean;
  lastSeenSecondsAgo: number;
}

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  label: string;
  drivers: { label: string; contribution: number }[];
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export const toFahrenheit = (c: number) => Math.round((c * 9) / 5 + 32);

/** Composite fire-risk score (0-100) from heat, dryness and rate of change. */
export function assessRisk(reading: SensorReading): RiskAssessment {
  // 14°C ≈ 57°F baseline; 30°C span ≈ 54°F span.
  const heat = clamp01((reading.temperatureF - 57) / 54);
  const dryness = clamp01((62 - reading.humidityPct) / 50);
  // 5°C/hr ≈ 9°F/hr.
  const momentum = clamp01(reading.tempTrendFPerHr / 9);

  const drivers = [
    { label: "Heat", contribution: Math.round(heat * 45) },
    { label: "Dryness", contribution: Math.round(dryness * 35) },
    { label: "Rate of change", contribution: Math.round(momentum * 20) },
  ];

  const score = Math.min(100, drivers.reduce((sum, d) => sum + d.contribution, 0));
  const level: RiskLevel =
    score >= 75 ? "extreme" : score >= 50 ? "high" : score >= 25 ? "moderate" : "low";

  return {
    score,
    level,
    label: { low: "Low", moderate: "Moderate", high: "High", extreme: "Extreme" }[level],
    drivers,
  };
}

export const RISK_TOKEN: Record<RiskLevel, string> = {
  low: "risk-low",
  moderate: "risk-moderate",
  high: "risk-high",
  extreme: "risk-extreme",
};

/** Hex values used for map markers (canvas/SVG can't read CSS tokens). */
export const RISK_HEX: Record<RiskLevel, string> = {
  low: "#3ec7a1",
  moderate: "#f2c14b",
  high: "#f2842b",
  extreme: "#e3452f",
};

interface SensorSeed {
  id: string;
  name: string;
  zone: string;
  lat: number;
  lng: number;
  elevationM: number;
  baseTemp: number;
  baseHumidity: number;
}

const SEEDS: SensorSeed[] = [
  { id: "PI-01", name: "Ridge Crest", zone: "Angeles NF — North", lat: 34.3402, lng: -118.0455, elevationM: 1712, baseTemp: 97, baseHumidity: 14 },
  { id: "PI-02", name: "Chantry Flat", zone: "Angeles NF — South", lat: 34.1955, lng: -118.0233, elevationM: 549, baseTemp: 91, baseHumidity: 22 },
  { id: "PI-03", name: "Big Tujunga", zone: "Angeles NF — West", lat: 34.2925, lng: -118.1893, elevationM: 786, baseTemp: 88, baseHumidity: 27 },
  { id: "PI-04", name: "Mount Wilson", zone: "Summit Relay", lat: 34.2259, lng: -118.0571, elevationM: 1742, baseTemp: 81, baseHumidity: 34 },
  { id: "PI-05", name: "Devil's Canyon", zone: "Angeles NF — Core", lat: 34.2831, lng: -117.9812, elevationM: 1105, baseTemp: 100, baseHumidity: 11 },
  { id: "PI-06", name: "Placerita Creek", zone: "Foothill Edge", lat: 34.3861, lng: -118.4548, elevationM: 432, baseTemp: 84, baseHumidity: 41 },
  { id: "PI-07", name: "Sand Canyon", zone: "Foothill Edge", lat: 34.4113, lng: -118.3711, elevationM: 512, baseTemp: 93, baseHumidity: 19 },
  { id: "PI-08", name: "Monrovia Peak", zone: "Angeles NF — South", lat: 34.2216, lng: -117.9585, elevationM: 1613, baseTemp: 77, baseHumidity: 48 },
];

const jitter = (spread: number) => (Math.random() - 0.5) * spread;

/** Simulated telemetry snapshot from the Pi mesh. */
export function generateReadings(): SensorReading[] {
  return SEEDS.map((seed, i) => {
    const online = !(i === 5 && Math.random() < 0.25);
    return {
      id: seed.id,
      name: seed.name,
      zone: seed.zone,
      lat: seed.lat,
      lng: seed.lng,
      elevationM: seed.elevationM,
      temperatureF: Math.round((seed.baseTemp + jitter(5)) * 10) / 10,
      humidityPct: Math.max(4, Math.round(seed.baseHumidity + jitter(6))),
      tempTrendFPerHr: Math.round((jitter(7) + (seed.baseTemp > 93 ? 4 : 0.7)) * 10) / 10,
      batteryPct: 62 + Math.round(jitter(30)) + 15,
      online,
      lastSeenSecondsAgo: online ? Math.round(Math.random() * 45) : 1420,
    };
  });
}

export interface TrendPoint {
  time: string;
  temperatureF: number;
  humidityPct: number;
  risk: number;
}

/** 24h rolling history for the network average. */
export function generateTrend(): TrendPoint[] {
  return Array.from({ length: 24 }, (_, h) => {
    const hour = (h + 1) % 24;
    const diurnal = Math.sin(((hour - 4) / 24) * Math.PI * 2);
    // 26°C ≈ 79°F baseline; 9°C range ≈ 16°F range.
    const temperatureF = Math.round((79 + diurnal * 16 + jitter(3)) * 10) / 10;
    const humidityPct = Math.max(6, Math.round(32 - diurnal * 16 + jitter(4)));
    const risk = assessRisk({
      ...SEEDS[0]!,
      temperatureF,
      humidityPct,
      tempTrendFPerHr: diurnal * 5.4,
      batteryPct: 90,
      online: true,
      lastSeenSecondsAgo: 5,
    } as SensorReading).score;
    return { time: `${String(hour).padStart(2, "0")}:00`, temperatureF, humidityPct, risk };
  });
}
