// Gęste prymitywy tabeli — nagłówek sticky, wiersze bez animacji na hover (spójnie ze stylem "bez dekoracji").
export function Table({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className={`w-full border-collapse text-[13px] ${className}`}>{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-surface">
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({
  className = "",
  children,
  ...rest
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`border-b border-line px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-ink-2 ${className}`}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TR({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={`border-b border-line transition-none last:border-b-0 hover:bg-canvas ${className}`}
      {...rest}
    >
      {children}
    </tr>
  );
}

export function TD({
  className = "",
  children,
  ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-3 py-2.5 text-ink ${className}`} {...rest}>
      {children}
    </td>
  );
}
