"use client";

// Mobile: cienki pasek u góry i cztery zakładki na dole — DM-y wysyła się z telefonu.
import { usePathname } from "next/navigation";
import { icons, isActive, navItems } from "./Sidebar";

export function MobileTopBar({ userEmail }: { userEmail: string }) {
  return (
    <div
      className="sticky top-0 z-40 flex h-12 items-center justify-between bg-canvas/85 px-4 backdrop-blur-md md:hidden"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <span className="text-[17px] font-semibold tracking-tight text-ink">Sztab</span>
      <form action="/logout" method="post">
        <button type="submit" className="text-[12px] font-medium text-ink-2" title={userEmail}>
          Wyloguj
        </button>
      </form>
    </div>
  );
}

export default function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-line bg-surface/95 px-1 pt-1 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.4rem)" }}
    >
      {navItems.map((item) => {
        const Icon = icons[item.icon];
        const active = isActive(pathname, item.href);
        return (
          <a
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-12 min-w-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg ${
              active ? "text-accent" : "text-ink-3"
            }`}
          >
            <Icon width={22} height={22} />
            <span className="text-[10.5px] font-medium">{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
