"use client";

// Kolejka nowych DM-ów na Dziś: cel dzienny (30), filtry po niszy i mieście,
// „więcej” gdy chcecie pisać dalej. Wysłane dziś zostają na górze, żeby dało
// się wrócić do profilu albo cofnąć pomyłkę.

import { useMemo, useState } from "react";
import Link from "next/link";
import DmRow from "@/components/baza/DmRow";
import EmptyState from "@/components/ui/EmptyState";
import { buttonClass } from "@/components/ui/Button";
import { blitzNicheLabel, BLITZ_NICHE_ORDER, DAILY_DM_LIMIT, type CrmDmBlitz } from "@/lib/crm/blitz";

const STEP = 30;

export default function DmQueue({ done, todo, now }: { done: CrmDmBlitz[]; todo: CrmDmBlitz[]; now: number }) {
  const [niche, setNiche] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [extra, setExtra] = useState(0);

  const niches = useMemo(() => {
    const present = new Set(todo.map((r) => r.niche));
    const known = BLITZ_NICHE_ORDER.filter((n) => present.has(n));
    const other = [...present].filter((n) => !(BLITZ_NICHE_ORDER as readonly string[]).includes(n)).sort();
    return [...known, ...other];
  }, [todo]);

  const cities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of todo) if (r.city) counts.set(r.city, (counts.get(r.city) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [todo]);

  const filtered = useMemo(
    () => todo.filter((r) => (!niche || r.niche === niche) && (!city || r.city === city)),
    [todo, niche, city],
  );

  const target = DAILY_DM_LIMIT + extra;
  const room = Math.max(0, target - done.length);
  const next = filtered.slice(0, room);
  const remaining = filtered.length - next.length;
  const pct = Math.min(100, Math.round((100 * done.length) / target));

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
      active ? "bg-ink text-white" : "bg-canvas text-ink-2 hover:text-ink"
    }`;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas">
          <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <span className="tabular text-[13px] font-semibold text-ink-2">
          {done.length} / {target}
        </span>
      </div>

      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setNiche(null)} className={chip(niche === null)}>
            Wszystkie nisze
          </button>
          {niches.map((n) => (
            <button key={n} type="button" onClick={() => setNiche(n === niche ? null : n)} className={chip(niche === n)}>
              {blitzNicheLabel(n)}
            </button>
          ))}
        </div>
        {cities.length > 1 ? (
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setCity(null)} className={chip(city === null)}>
              Wszystkie miasta
            </button>
            {cities.map((c) => (
              <button key={c} type="button" onClick={() => setCity(c === city ? null : c)} className={chip(city === c)}>
                {c}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {done.length + next.length === 0 ? (
        filtered.length === 0 && todo.length > 0 ? (
          <EmptyState title="Nic nie pasuje do filtra" hint="Zmień niszę albo miasto." />
        ) : (
          <EmptyState
            title="Baza jest wyczerpana"
            hint="Dodaj nowe lokale w Bazie — wklej listę Instagramów, a kolejka ułoży się sama."
            action={<Link href="/baza" className={buttonClass("primary", "md")}>Dodaj lokale</Link>}
          />
        )
      ) : (
        <ul className="-mx-3 divide-y divide-line/70">
          {done.map((r) => (
            <DmRow key={r.id} row={r} now={now} />
          ))}
          {next.map((r) => (
            <DmRow key={r.id} row={r} now={now} />
          ))}
        </ul>
      )}

      {remaining > 0 ? (
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={() => setExtra((e) => e + STEP)} className={buttonClass("secondary", "md")}>
            Pokaż {Math.min(STEP, remaining)} więcej
          </button>
          <span className="text-[13px] text-ink-3">jeszcze {remaining} w kolejce</span>
        </div>
      ) : null}

      <p className="mt-4 text-[12.5px] text-ink-3">
        Bezpiecznie: ok. {DAILY_DM_LIMIT} DM-ów dziennie z jednego konta, rozłożonych na cały dzień — za dużo naraz
        i Instagram blokuje pisanie na tydzień. Pierwsza wiadomość bez linku.
      </p>
    </div>
  );
}
