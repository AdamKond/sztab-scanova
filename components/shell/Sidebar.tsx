"use client";

// Nawigacja — cztery ekrany, nic więcej. Client component, bo aktywny stan
// liczymy z usePathname().
import { usePathname } from "next/navigation";
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function iconBase(props: IconProps) {
  return {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

function IconToday(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </svg>
  );
}

function IconChat(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V16H6.5A2.5 2.5 0 0 1 4 13.5v-7z" />
    </svg>
  );
}

function IconStar(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8L12 3.5z" />
    </svg>
  );
}

function IconGrid(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export const icons = {
  today: IconToday,
  chat: IconChat,
  star: IconStar,
  grid: IconGrid,
} as const;

export type IconName = keyof typeof icons;

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
};

/** Model nawigacji — współdzielony przez Sidebar (desktop) i MobileNav. */
export const navItems: NavItem[] = [
  { href: "/", label: "Dziś", icon: "today" },
  { href: "/rozmowy", label: "Rozmowy", icon: "chat" },
  { href: "/klienci", label: "Klienci", icon: "star" },
  { href: "/baza", label: "Baza", icon: "grid" },
];

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-[224px] flex-col px-4 py-6 md:flex">
      <div className="px-3 pb-6">
        <div className="text-[19px] font-semibold tracking-tight text-ink">Sztab</div>
        <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">
          Scanova
        </div>
      </div>

      <nav className="flex-1">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = icons[item.icon];
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <a
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-10 items-center gap-2.5 rounded-xl px-3 text-[14px] font-medium transition-colors ${
                    active
                      ? "bg-surface text-ink shadow-card"
                      : "text-ink-2 hover:bg-surface/60 hover:text-ink"
                  }`}
                >
                  <Icon className={active ? "text-accent" : "text-ink-3"} />
                  <span>{item.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-3 pt-4">
        <div className="mb-1.5 truncate text-[12px] text-ink-3">{userEmail}</div>
        <form action="/logout" method="post">
          <button type="submit" className="text-[12px] font-medium text-ink-2 hover:text-ink">
            Wyloguj
          </button>
        </form>
      </div>
    </aside>
  );
}
