"use client";

// Dolny pasek nawigacji na mobile — client, bo trzyma stan arkusza "Więcej" i aktywną ścieżkę.
import { useState } from "react";
import { usePathname } from "next/navigation";
import { icons, allNavItems, navGroups, type NavItem } from "./Sidebar";

const PRIMARY_ITEMS: NavItem[] = [
  { href: "/", label: "Dziś", icon: "circle-dot" },
  { href: "/leady", label: "Leady", icon: "users" },
];
const SECONDARY_ITEMS: NavItem[] = [
  { href: "/followup", label: "Follow-up", icon: "check-square" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = icons[item.icon];
  return (
    <a
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md ${
        active ? "text-white" : "text-sidebar-ink-2"
      }`}
    >
      <Icon />
      <span className="text-[10px]">{item.label}</span>
    </a>
  );
}

/**
 * Slim górny pasek na mobile: marka + przycisk otwierający pełną nawigację
 * jako wysuwaną szufladę (osobny stan od dolnego arkusza "Więcej").
 */
export function MobileTopBar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-sidebar-border bg-sidebar px-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Otwórz menu"
          className="flex min-h-11 min-w-11 items-center justify-center text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-[15px] font-semibold tracking-wide text-white">SZTAB</span>
        <span className="min-w-11" />
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Zamknij menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-[80%] max-w-[300px] flex-col bg-sidebar">
            <div className="px-4 pt-5 pb-4">
              <div className="text-[15px] font-semibold tracking-wide text-white">SZTAB</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wider text-sidebar-ink-2">
                SCANOVA
              </div>
            </div>
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
                            onClick={() => setOpen(false)}
                            className={`flex min-h-11 items-center gap-2 rounded-md px-2.5 text-[14px] ${
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
            <div className="border-t border-sidebar-border px-4 py-3">
              <div className="mb-2 truncate font-mono text-[11px] text-sidebar-ink-2">{userEmail}</div>
              <form action="/logout" method="post">
                <button type="submit" className="min-h-11 text-[11px] text-sidebar-ink-2 hover:text-white">
                  Wyloguj
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Pozycje, które nie mieszczą się na pasku — trafiają do arkusza "Więcej".
  const shown = new Set(["/", "/leady", "/followup"]);
  const restItems = allNavItems.filter((i) => !shown.has(i.href));

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-sidebar-border bg-sidebar px-1 py-1 md:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.25rem)" }}
      >
        <NavLink item={PRIMARY_ITEMS[0]} active={isActive(pathname, PRIMARY_ITEMS[0].href)} />
        <NavLink item={PRIMARY_ITEMS[1]} active={isActive(pathname, PRIMARY_ITEMS[1].href)} />

        {/* Centralny przycisk szybkiego dodawania */}
        <a
          href="/?szybki=1"
          aria-label="Szybkie dodanie"
          className="flex min-h-11 min-w-11 flex-1 items-center justify-center"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white shadow-[0_1px_2px_rgba(0,0,0,.04)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
        </a>

        <NavLink item={SECONDARY_ITEMS[0]} active={isActive(pathname, SECONDARY_ITEMS[0].href)} />

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-sidebar-ink-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
          </svg>
          <span className="text-[10px]">Więcej</span>
        </button>
      </nav>

      {/* Arkusz "Więcej" — pozostałe pozycje nawigacji + wylogowanie */}
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Zamknij"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-xl border-t border-line bg-surface p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line" />
            <ul className="space-y-0.5">
              {restItems.map((item) => {
                const Icon = icons[item.icon];
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 items-center gap-2.5 rounded-md px-2.5 text-[14px] ${
                        active ? "bg-canvas text-ink" : "text-ink"
                      }`}
                    >
                      <Icon />
                      {item.label}
                    </a>
                  </li>
                );
              })}
            </ul>
            <form action="/logout" method="post" className="mt-2 border-t border-line pt-2">
              <button type="submit" className="flex min-h-11 w-full items-center px-2.5 text-[14px] text-ink-2">
                Wyloguj
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
