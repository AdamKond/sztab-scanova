// Podstawowy kontener treści — biała karta na jasnym tle roboczym.
export default function Card({
  padding = "md",
  className = "",
  children,
  ...rest
}: {
  padding?: "sm" | "md";
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const pad = padding === "sm" ? "p-4" : "p-5 md:p-6";
  return (
    <div
      className={`rounded-xl border border-line bg-surface ${pad} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
