// Stan pusty — mówi, co zrobić dalej, zamiast samego "brak danych".
export default function EmptyState({
  title,
  hint,
  action,
  tone = "default",
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  tone?: "default" | "success";
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl px-6 py-10 text-center ${
        tone === "success" ? "bg-success-soft" : "bg-canvas"
      }`}
    >
      <div className={`text-[14px] font-semibold ${tone === "success" ? "text-success" : "text-ink"}`}>
        {title}
      </div>
      {hint ? <div className="mt-1 max-w-sm text-[13px] text-ink-2">{hint}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
