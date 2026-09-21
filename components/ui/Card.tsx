// Podstawowy kontener treści — biała karta z miękkim cieniem zamiast obramowania.
export default function Card({
  padding = "md",
  className = "",
  children,
  ...rest
}: {
  padding?: "none" | "sm" | "md";
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const pad = padding === "none" ? "" : padding === "sm" ? "p-4" : "p-5 md:p-6";
  return (
    <div className={`rounded-2xl bg-surface shadow-card ${pad} ${className}`} {...rest}>
      {children}
    </div>
  );
}

/** Nagłówek sekcji wewnątrz karty: tytuł + opcjonalny licznik / akcja po prawej. */
export function CardTitle({
  children,
  count,
  action,
}: {
  children: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-tight text-ink">
        {children}
        {count !== undefined ? (
          <span className="tabular rounded-full bg-canvas px-2 py-0.5 text-[12px] font-semibold text-ink-2">
            {count}
          </span>
        ) : null}
      </h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
