import { Ruler } from "lucide-react";
import { useUnits, type UnitSystem } from "@/lib/units";

const OPTIONS: { value: UnitSystem; label: string; hint: string }[] = [
  { value: "imperial", label: "°F / mi", hint: "Imperial units" },
  { value: "metric", label: "°C / km", hint: "Metric units" },
];

export function UnitToggle() {
  const { system, setSystem } = useUnits();

  return (
    <div className="flex items-center gap-2">
      <span className="label-eyebrow inline-flex items-center gap-1.5 text-muted-foreground">
        <Ruler className="size-3" aria-hidden />
        Units
      </span>
      <div
        role="group"
        aria-label="Measurement system"
        className="flex items-center gap-1 rounded-full border border-border bg-surface-raised p-1"
      >
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            title={opt.hint}
            aria-pressed={system === opt.value}
            onClick={() => setSystem(opt.value)}
            className={`rounded-full px-3 py-1 font-mono text-xs tabular-nums transition-colors ${
              system === opt.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
