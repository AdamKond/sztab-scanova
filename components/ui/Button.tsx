// Przycisk z wariantami — jedyny akcent to niebieski; czerwony tylko dla akcji niszczących.
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover border border-transparent",
  secondary: "bg-surface text-ink border border-line hover:bg-canvas",
  ghost: "bg-transparent text-ink border border-transparent hover:bg-canvas",
  danger: "bg-white text-danger border border-danger/30 hover:bg-red-50",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[13px]",
  md: "min-h-11 px-4 text-[14px]",
};

export default function Button({
  variant = "secondary",
  size = "md",
  className = "",
  disabled,
  ...rest
}: {
  variant?: Variant;
  size?: Size;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    />
  );
}
