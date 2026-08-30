import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ROR_THRESHOLDS, type RorPoint } from "@/lib/sensors";
import { rateValue, useUnits } from "@/lib/units";

export function RateOfRiseChart({ data }: { data: RorPoint[] }) {
  const { system } = useUnits();
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const series = data.map((p) => ({
    ...p,
    ror: round1(rateValue(p.rorFPerHr, system)),
    peak: round1(rateValue(p.peakFPerHr, system)),
  }));
  const warning = round1(rateValue(ROR_THRESHOLDS.warning, system));
  const critical = round1(rateValue(ROR_THRESHOLDS.critical, system));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="rorFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-risk-high)" stopOpacity={0.5} />
            <stop offset="100%" stopColor="var(--color-risk-high)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="time"
          interval={1}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
          stroke="var(--color-border)"
        />
        <YAxis
          unit="°/h"
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
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <ReferenceLine
          y={warning}
          stroke="var(--color-risk-high)"
          strokeDasharray="5 4"
          label={{
            value: `Warning ${warning}°/h`,
            fill: "var(--color-risk-high)",
            fontSize: 10,
            position: "insideTopLeft",
          }}
        />
        <ReferenceLine
          y={critical}
          stroke="var(--color-risk-extreme)"
          strokeDasharray="5 4"
          label={{
            value: `Critical ${critical}°/h`,
            fill: "var(--color-risk-extreme)",
            fontSize: 10,
            position: "insideTopLeft",
          }}
        />
        <Area
          type="monotone"
          dataKey="ror"
          name="Mesh avg rise"
          stroke="var(--color-risk-high)"
          strokeWidth={2}
          fill="url(#rorFill)"
        />
        <Line
          type="monotone"
          dataKey="peak"
          name="Fastest node"
          stroke="var(--color-risk-extreme)"
          strokeWidth={1.5}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
