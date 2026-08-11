// Stan pusty — mówi użytkownikowi, co zrobić dalej, zamiast samej informacji "brak danych".
export default function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line px-6 py-12 text-center">
      <div className="text-[14px] font-medium text-ink">{title}</div>
      {hint ? <div className="mt-1 max-w-sm text-[13px] text-ink-2">{hint}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
