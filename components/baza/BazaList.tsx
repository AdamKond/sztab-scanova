"use client";

// Lista Bazy: szukajka, filtr etapu, sekcje po niszach. Wiersze to ten sam
// DmRow co na Dziś — te same przyciski, te same zasady.

import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import DmRow from "./DmRow";
import { blitzStage, groupBlitzByNiche, STAGE_LABELS, type BlitzStage, type CrmDmBlitz } from "@/lib/crm/blitz";

type Filter = "all" | BlitzStage;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Wszystkie" },
  { key: "todo", label: STAGE_LABELS.todo },
  { key: "waiting", label: STAGE_LABELS.waiting },
  { key: "followup_due", label: STAGE_LABELS.followup_due },
  { key: "followed_up", label: STAGE_LABELS.followed_up },
  { key: "in_crm", label: "W rozmowie" },
];

export default function BazaList({ rows, now }: { rows: CrmDmBlitz[]; now: number }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: rows.length, todo: 0, waiting: 0, followup_due: 0, followed_up: 0, in_crm: 0 };
    for (const r of rows) c[blitzStage(r, now)] += 1;
    return c;
  }, [rows, now]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && blitzStage(r, now) !== filter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.instagram.toLowerCase().includes(q) ||
        (r.city ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, filter, query, now]);

  const groups = useMemo(() => groupBlitzByNiche(filtered), [filtered]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj: nazwa, @instagram, miasto"
          className="h-11 w-full rounded-xl bg-surface px-4 text-[15px] text-ink shadow-card placeholder:text-ink-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:max-w-sm"
        />
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                  active ? "bg-ink text-white" : "bg-surface text-ink-2 shadow-card hover:text-ink"
                }`}
              >
                {f.label} <span className={`tabular ${active ? "text-white/70" : "text-ink-3"}`}>{counts[f.key]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {groups.length === 0 ? (
        <Card>
          <p className="text-[14px] text-ink-2">Nic nie pasuje do filtra.</p>
        </Card>
      ) : (
        groups.map((g) => (
          <section key={g.niche}>
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-2">{g.label}</h2>
              <span className="tabular text-[12px] text-ink-3">
                {g.sent} / {g.rows.length} wysłanych
              </span>
            </div>
            <Card padding="sm">
              <ul className="divide-y divide-line/70">
                {g.rows.map((r) => (
                  <DmRow key={r.id} row={r} now={now} showStage allowRemove />
                ))}
              </ul>
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
