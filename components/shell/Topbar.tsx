// Nagłówek widoku — server component. `children` to opcjonalny wiersz filtrów pod tytułem.
export default function Topbar({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    // top-12 na mobile, żeby nie chować się pod sticky MobileTopBar (h-12); na desktopie top-0.
    <div className="sticky top-12 z-30 -mx-4 mb-4 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur-sm md:top-0 md:-mx-6 md:px-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[20px] font-semibold text-ink md:text-[22px]">{title}</h1>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
