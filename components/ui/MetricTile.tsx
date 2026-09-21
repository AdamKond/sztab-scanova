// Kafelek liczby: duża wartość, mała etykieta. Do rzędu statystyk na Dziś i Klientach.
type Tone = "default" | "success" | "danger" | "warning" | "accent";

const VALUE_TONE_CLASSES: Record<Tone, string> = {
  default: "text-ink",
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
  accent: "text-accent",
};

export default function MetricTile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-card md:p-5">
      <div className="text-[12px] font-medium text-ink-2">{label}</div>
      <div
        className={`tabular mt-1.5 text-[28px] font-semibold leading-none tracking-tight ${VALUE_TONE_CLASSES[tone]}`}
      >
        {value}
      </div>
      {sub ? <div className="mt-1.5 text-[12px] text-ink-3">{sub}</div> : null}
    </div>
  );
}
