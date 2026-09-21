// Nagłówek widoku: duży tytuł, opcjonalny podtytuł i akcje po prawej.
export default function Topbar({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-6 md:mb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[28px] font-semibold tracking-tight text-ink md:text-[34px]">
            {title}
          </h1>
          {subtitle ? <p className="mt-1 text-[14px] text-ink-2">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </header>
  );
}
