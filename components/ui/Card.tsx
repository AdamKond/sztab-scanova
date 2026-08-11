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
  const pad = padding === "sm" ? "p-3" : "p-4 md:p-5";
  return (
    <div
      className={`rounded-xl border border-line bg-surface ${pad} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
