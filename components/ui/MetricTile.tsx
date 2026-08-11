// Zwarty kafelek statystyki — do rzędów KPI na pulpicie / w analizie.
type Tone = "default" | "success" | "danger";

const VALUE_TONE_CLASSES: Record<Tone, string> = {
  default: "text-ink",
  success: "text-success",
  danger: "text-danger",
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
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-2">{label}</div>
      <div className={`tabular mt-1 text-[24px] font-semibold leading-none ${VALUE_TONE_CLASSES[tone]}`}>
        {value}
      </div>
      {sub ? <div className="mt-1.5 text-[12px] text-ink-2">{sub}</div> : null}
    </div>
  );
}
