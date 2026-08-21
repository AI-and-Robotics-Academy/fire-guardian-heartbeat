import { RISK_TOKEN, type RiskLevel } from "@/lib/sensors";
import { cn } from "@/lib/utils";

const RING: Record<RiskLevel, string> = {
  low: "border-risk-low/40 bg-risk-low/12 text-risk-low",
  moderate: "border-risk-moderate/40 bg-risk-moderate/12 text-risk-moderate",
  high: "border-risk-high/45 bg-risk-high/14 text-risk-high",
  extreme: "border-risk-extreme/50 bg-risk-extreme/16 text-risk-extreme",
};

export function RiskBadge({
  level,
  label,
  className,
}: {
  level: RiskLevel;
  label: string;
  className?: string;
}) {
  return (
    <span
      data-risk={RISK_TOKEN[level]}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-display text-xs tracking-[0.14em] uppercase",
        RING[level],
        className,
      )}
    >
      {label}
    </span>
  );
}
