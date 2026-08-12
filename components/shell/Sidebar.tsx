"use client";

// Sidebar aplikacji — client component, bo aktywny stan liczymy z usePathname().
import { usePathname } from "next/navigation";
import type { SVGProps } from "react";

/** Prosty, monochromatyczny zestaw ikon liniowych 16px — bez zależności zewnętrznych. */
type IconProps = SVGProps<SVGSVGElement>;

function iconBase(props: IconProps) {
  return {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

function IconCircleDot(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconUsers(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 4.5c1.5.4 2.5 1.8 2.5 3.3s-1 2.9-2.5 3.3" />
      <path d="M18 14c2.2.6 4 2.5 4 5" />
    </svg>
  );
}

function IconFunnel(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M4 5h16l-6 7.5V19l-4 2v-8.5L4 5z" />
    </svg>
  );
}

function IconRocket(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M12 3c3 1.5 5 4.8 5 8.5 0 2-1 4-2 5l-3 2-3-2c-1-1-2-3-2-5 0-3.7 2-7 5-8.5z" />
      <circle cx="12" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <path d="M9 16l-2.5 1.5L7 21l2-1.5" />
      <path d="M15 16l2.5 1.5L17 21l-2-1.5" />
    </svg>
  );
}

function IconCheckSquare(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M8 12l2.5 2.5L16.5 9" />
    </svg>
  );
}

function IconTarget(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconUpload(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M12 15V4" />
      <path d="M7.5 8.5L12 4l4.5 4.5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function IconSettings(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.6 7.3l1.9 1.1M17.5 15.6l1.9 1.1M4.6 16.7l1.9-1.1M17.5 8.4l1.9-1.1M3.5 12h2.2M18.3 12h2.2" />
    </svg>
  );
}

function IconSend(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M21 3L10 14" />
      <path d="M21 3l-7 18-4-7-7-4 18-7z" />
    </svg>
  );
}

function IconSparkles(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M12 4l1.5 4.5L18 10l-4.5 1.5L12 16l-1.5-4.5L6 10l4.5-1.5L12 4z" />
      <path d="M19 15l.7 2.1L21.8 18l-2.1.7L19 21l-.7-2.3-2.1-.7 2.1-.9L19 15z" />
    </svg>
  );
}

function IconFilm(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M8 4.5v15M16 4.5v15M3.5 9h4.5M3.5 15h4.5M16 9h4.5M16 15h4.5" />
    </svg>
  );
}

function IconMegaphone(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M3 11v3l3 .5V10.5L3 11z" />
      <path d="M6 10l12-5v14l-12-5" />
      <path d="M8 15l1 5h2.5l-1-4.6" />
    </svg>
  );
}

function IconHandshake(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M4 7l4-2 4 3 4-3 4 2v7l-4 4-4-3-4 3-4-4V7z" />
      <path d="M12 8l-3 3 2 2 3-3" />
    </svg>
  );
}

function IconBoard(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M12 16v3.5" />
      <path d="M9.5 19.5h5" />
      <path d="M7 8.5h7M7 12h4" />
    </svg>
  );
}

export const icons = {
  "circle-dot": IconCircleDot,
  users: IconUsers,
  funnel: IconFunnel,
  rocket: IconRocket,
  "check-square": IconCheckSquare,
  target: IconTarget,
  upload: IconUpload,
  settings: IconSettings,
  send: IconSend,
  sparkles: IconSparkles,
  film: IconFilm,
  megaphone: IconMegaphone,
  handshake: IconHandshake,
  board: IconBoard,
} as const;

export type IconName = keyof typeof icons;

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

/** Model nawigacji — współdzielony przez Sidebar (desktop) i MobileNav. */
export const navGroups: NavGroup[] = [
  {
    title: "PRACA",
    items: [
      { href: "/", label: "Dziś", icon: "circle-dot" },
      { href: "/whiteboard", label: "Whiteboard", icon: "board" },
      { href: "/leady", label: "Leady", icon: "users" },
      { href: "/outbound", label: "Outbound", icon: "send" },
      { href: "/followup", label: "Follow-up", icon: "check-square" },
      { href: "/ai", label: "Odprawa AI", icon: "sparkles" },
    ],
  },
  {
    title: "ANALIZA",
    items: [
      { href: "/pipeline", label: "Pipeline", icon: "funnel" },
      { href: "/piloty", label: "Piloty i przychód", icon: "rocket" },
      { href: "/cele", label: "Cele", icon: "target" },
    ],
  },
  {
    title: "MARKETING",
    items: [
      { href: "/content", label: "Content", icon: "film" },
      { href: "/ads", label: "Ads", icon: "megaphone" },
      { href: "/partnerzy", label: "Partnerzy", icon: "handshake" },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { href: "/import", label: "Import", icon: "upload" },
      { href: "/ustawienia", label: "Ustawienia", icon: "settings" },
    ],
  },
];

/** Spłaszczona lista wszystkich pozycji — przydatna np. w arkuszu "Więcej" mobile navu. */
export const allNavItems: NavItem[] = navGroups.flatMap((g) => g.items);

function isActive(pathname: string, href: string) {
  // "/" musi być dopasowane dokładnie, inne ścieżki — prefiksem (podstrony też aktywne).
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-[236px] flex-col bg-sidebar border-r border-sidebar-border">
      {/* Brand */}
      <div className="px-4 pt-5 pb-4">
        <div className="text-[15px] font-semibold tracking-wide text-white">SZTAB</div>
        <div className="mt-0.5 text-[10px] uppercase tracking-wider text-sidebar-ink-2">
          SCANOVA
        </div>
      </div>

      {/* Nawigacja */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-2">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-4">
            <div className="px-2 pb-1.5 text-[10px] uppercase tracking-wider text-sidebar-ink-2">
              {group.title}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = icons[item.icon];
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                        active
                          ? "bg-sidebar-active text-white"
                          : "text-sidebar-ink hover:bg-sidebar-hover hover:text-white"
                      }`}
                    >
                      <Icon className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Stopka — użytkownik + wylogowanie, przypięta na dole */}
      <div className="border-t border-sidebar-border px-4 py-3">
        <div className="mb-2 truncate font-mono text-[11px] text-sidebar-ink-2">{userEmail}</div>
        <form action="/logout" method="post">
          <button
            type="submit"
            className="text-[11px] text-sidebar-ink-2 transition-colors hover:text-white"
          >
            Wyloguj
          </button>
        </form>
      </div>
    </aside>
  );
}
