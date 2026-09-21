// Przycisk z wariantami — jedyny akcent to niebieski; czerwony tylko dla akcji niszczących.
type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  secondary: "bg-canvas text-ink hover:bg-line/70",
  ghost: "bg-transparent text-ink-2 hover:bg-canvas hover:text-ink",
  danger: "bg-danger-soft text-danger hover:bg-danger/15",
  success: "bg-success text-white hover:bg-success/90",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-[14px]",
  lg: "h-11 px-5 text-[15px]",
};

export const buttonClass = (variant: Variant = "secondary", size: Size = "md", extra = "") =>
  `inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${extra}`;

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
  return <button disabled={disabled} className={buttonClass(variant, size, className)} {...rest} />;
}
