"use client";

// Checklista wysyłki: filtry, odhaczanie, kopiowanie DM-a, awans do CRM.
//
// Dlaczego client component: odhaczenie ma być natychmiastowe (optymistyczne),
// a kopiowanie DM-a wymaga schowka przeglądarki. Stan bazowy przychodzi
// z serwera; lokalne nadpisania trzymamy tylko do czasu, aż revalidate
// przyniesie z bazy to samo — wtedy je czyścimy (sprzątanie w renderze,
// zgodnie z reactowym "adjusting state when props change").

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import {
  blitzProgress,
  groupBlitzByNiche,
  senderInitial,
  type CrmDmBlitz,
} from "@/lib/crm/blitz";
import { promoteDmToLead, toggleDmSent } from "@/lib/crm/actions";

type Filter = "all" | "todo" | "done";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Wszystkie" },
  { key: "todo", label: "Do wysłania" },
  { key: "done", label: "Wysłane" },
];

type Override = { sent: boolean; by: string | null };

export default function WysylkaList({ initialRows }: { initialRows: CrmDmBlitz[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [overrides, setOverrides] = useState<Map<string, Override>>(new Map());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Wyczyść nadpisania potwierdzone już przez serwer.
  const stale = [...overrides].filter(([id, o]) => {
    const row = initialRows.find((r) => r.id === id);
    return row ? (row.sent_at !== null) === o.sent : true;
  });
  if (stale.length > 0) {
    const next = new Map(overrides);
    for (const [id] of stale) next.delete(id);
    setOverrides(next);
  }

  const rows = useMemo(
    () =>
      initialRows.map((row) => {
        const o = overrides.get(row.id);
        if (!o) return row;
        return {
          ...row,
          sent_at: o.sent ? row.sent_at ?? new Date().toISOString() : null,
          sent_by: o.sent ? o.by : null,
        };
      }),
    [initialRows, overrides],
  );

  const groups = useMemo(() => groupBlitzByNiche(rows), [rows]);
  const progress = blitzProgress(rows);
  const pct = progress.total === 0 ? 0 : Math.round((100 * progress.sent) / progress.total);

  function onToggle(row: CrmDmBlitz) {
    const sent = row.sent_at === null;
    setError(null);
    setOverrides((prev) => new Map(prev).set(row.id, { sent, by: sent ? "ja" : null }));
    startTransition(async () => {
      const result = await toggleDmSent(row.id);
      if (result.error) {
        setOverrides((prev) => {
          const next = new Map(prev);
          next.delete(row.id);
          return next;
        });
        setError(result.error);
      }
    });
  }

  async function onCopy(row: CrmDmBlitz) {
    try {
      await navigator.clipboard.writeText(row.dm_text);
    } catch {
      const t = document.createElement("textarea");
      t.value = row.dm_text;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopiedId(row.id);
    setTimeout(() => setCopiedId((id) => (id === row.id ? null : id)), 1400);
  }

  function onPromote(row: CrmDmBlitz) {
    if (confirmId !== row.id) {
      setConfirmId(row.id);
      setTimeout(() => setConfirmId((id) => (id === row.id ? null : id)), 3000);
      return;
    }
    setConfirmId(null);
    setError(null);
    startTransition(async () => {
      const result = await promoteDmToLead(row.id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Pasek postępu + filtry */}
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="tabular text-[22px] font-semibold text-ink">
            {progress.sent}
            <span className="text-ink-2"> / {progress.total}</span>
          </span>
          <div className="h-2 w-36 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="ml-auto flex rounded-lg bg-line/60 p-[3px]">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-3 py-1.5 text-[13px] transition ${
                filter === f.key
                  ? "bg-surface font-semibold text-ink shadow-sm"
                  : "font-medium text-ink-2 hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-2.5 text-[13px] text-danger">
          {error}
        </div>
      ) : null}

      {groups.map((group) => {
        const visible = group.rows.filter(
          (r) => filter === "all" || (filter === "done") === (r.sent_at !== null),
        );
        if (visible.length === 0) return null;
        return (
          <section key={group.niche} className="mb-7">
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.09em] text-ink-2">
                {group.label}
              </h2>
              <span className="tabular text-[12px] text-ink-2">
                {group.sent} / {group.rows.length}
              </span>
            </div>
            <Card padding="sm" className="!p-0 overflow-hidden">
              <ul>
                {visible.map((row) => {
                  const sent = row.sent_at !== null;
                  const initial = senderInitial(row.sent_by);
                  return (
                    <li
                      key={row.id}
                      className={`flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0 ${
                        sent ? "bg-canvas/60" : "hover:bg-canvas/40"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onToggle(row)}
                        aria-label={sent ? "Cofnij wysłane" : "Oznacz jako wysłane"}
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition ${
                          sent
                            ? "border-success bg-success text-white"
                            : "border-line bg-surface hover:border-accent"
                        }`}
                      >
                        {sent ? (
                          <svg viewBox="0 0 16 16" className="h-3 w-3 fill-none stroke-current stroke-[3]">
                            <path d="M2.5 8.5 6 12l7.5-8" />
                          </svg>
                        ) : null}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div
                          className={`truncate text-[14px] font-semibold ${
                            sent ? "text-ink-2 line-through decoration-ink-2/50" : "text-ink"
                          }`}
                        >
                          {row.name}
                        </div>
                        <div className="truncate text-[12.5px] text-ink-2">
                          @{row.instagram}
                          {row.city ? ` · ${row.city}` : ""}
                          {row.followers ? ` · ${row.followers.toLocaleString("pl-PL")} obs.` : ""}
                          {initial ? ` · wysłał(a): ${initial}` : ""}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        {row.lead_id ? (
                          <Link
                            href={`/leady/${row.lead_id}`}
                            className="rounded-lg bg-success/10 px-2.5 py-1.5 text-[12.5px] font-semibold text-success"
                          >
                            W CRM →
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onPromote(row)}
                            className={`rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold transition ${
                              confirmId === row.id
                                ? "bg-accent text-white"
                                : "text-ink-2 hover:bg-canvas hover:text-ink"
                            }`}
                          >
                            {confirmId === row.id ? "Na pewno?" : "Odpowiedział?"}
                          </button>
                        )}
                        <a
                          href={`https://instagram.com/${row.instagram}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12.5px] font-semibold text-ink transition hover:bg-canvas"
                        >
                          Profil
                        </a>
                        <button
                          type="button"
                          onClick={() => onCopy(row)}
                          className={`rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-white transition ${
                            copiedId === row.id ? "bg-success" : "bg-sidebar hover:bg-accent-deep"
                          }`}
                        >
                          {copiedId === row.id ? "Skopiowano" : "Kopiuj DM"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        );
      })}
    </div>
  );
}
