// Prymitywy formularzy — zawsze z widocznym Labelem (żadnych etykiet tylko-w-placeholderze).
const FIELD_CLASSES =
  "min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-[14px] text-ink placeholder:text-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function Label({
  className = "",
  ...rest
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`mb-1.5 block text-[13px] font-medium text-ink ${className}`}
      {...rest}
    />
  );
}

export function Input({
  className = "",
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD_CLASSES} ${className}`} {...rest} />;
}

export function Select({
  className = "",
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${FIELD_CLASSES} ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({
  className = "",
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`${FIELD_CLASSES} min-h-24 py-2.5 ${className}`}
      {...rest}
    />
  );
}
