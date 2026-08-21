import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@/lib/sensors";

export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-temp)" stopOpacity={0.45} />
            <stop offset="100%" stopColor="var(--color-temp)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="humFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-humidity)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-humidity)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="time"
          interval={3}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
          stroke="var(--color-border)"
        />
        <YAxis
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
          stroke="var(--color-border)"
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: "0.5rem",
            color: "var(--color-popover-foreground)",
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="temperatureC"
          name="Temp °C"
          stroke="var(--color-temp)"
          strokeWidth={2}
          fill="url(#tempFill)"
        />
        <Area
          type="monotone"
          dataKey="humidityPct"
          name="Humidity %"
          stroke="var(--color-humidity)"
          strokeWidth={2}
          fill="url(#humFill)"
        />
        <Line
          type="monotone"
          dataKey="risk"
          name="Risk score"
          stroke="var(--color-risk-extreme)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
