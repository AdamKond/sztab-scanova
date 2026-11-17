"use client";

// Lista kolejki mailowej: szukajka + filtr statusu. Wiersze = MailRow.

import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import MailRow from "./MailRow";
import { MAIL_STATUS_LABELS, type CrmMailRow, type MailStatus } from "@/lib/crm/mail/types";

type Filter = "all" | "active" | MailStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Wszystkie" },
  { key: "oczekuje", label: MAIL_STATUS_LABELS.oczekuje },
  { key: "active", label: "W sekwencji" },
  { key: "odpowiedzial", label: MAIL_STATUS_LABELS.odpowiedzial },
  { key: "zamkniety", label: MAIL_STATUS_LABELS.zamkniety },
  { key: "odbil", label: MAIL_STATUS_LABELS.odbil },
  { key: "wypisany", label: MAIL_STATUS_LABELS.wypisany },
  { key: "blad", label: MAIL_STATUS_LABELS.blad },
  { key: "wstrzymany", label: MAIL_STATUS_LABELS.wstrzymany },
];

const PAGE = 150;

function matches(r: CrmMailRow, f: Filter): boolean {
  if (f === "all") return true;
  if (f === "active") return r.status === "wyslany" || r.status === "followup";
  return r.status === f;
}

export default function MailList({ rows }: { rows: CrmMailRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);

  const counts = useMemo(() => {
    const c = {} as Record<Filter, number>;
    for (const f of FILTERS) c[f.key] = rows.filter((r) => matches(r, f.key)).length;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (!matches(r, filter)) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.email.includes(q) ||
        (r.city ?? "").toLowerCase().includes(q) ||
        r.niche.includes(q) ||
        r.campaign.includes(q)
      );
    });
    // Najświeższy ruch na górze: odpowiedzi i wysyłki, potem reszta po dacie dodania.
    return list.sort((a, b) => (b.last_step_at ?? b.replied_at ?? "").localeCompare(a.last_step_at ?? a.replied_at ?? "") || b.created_at.localeCompare(a.created_at));
  }, [rows, filter, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE);
          }}
          placeholder="Szukaj: nazwa, e-mail, miasto, nisza, kampania"
          className="h-11 w-full rounded-xl bg-surface px-4 text-[15px] text-ink shadow-card placeholder:text-ink-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:max-w-sm"
        />
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            if (counts[f.key] === 0 && f.key !== "all") return null;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setFilter(f.key);
                  setShown(PAGE);
                }}
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

      {filtered.length === 0 ? (
        <Card>
          <p className="text-[14px] text-ink-2">{rows.length === 0 ? "Kolejka jest pusta. Dodaj adresy przyciskiem u góry albo skryptem scripts/import-maile.ts." : "Nic nie pasuje do filtra."}</p>
        </Card>
      ) : (
        <Card padding="sm">
          <ul className="divide-y divide-line/70">
            {filtered.slice(0, shown).map((r) => (
              <MailRow key={r.id} row={r} />
            ))}
          </ul>
          {filtered.length > shown ? (
            <button type="button" onClick={() => setShown((s) => s + PAGE)} className="mt-3 w-full rounded-xl bg-canvas py-2 text-[13px] font-semibold text-ink-2 hover:text-ink">
              Pokaż więcej ({filtered.length - shown} jeszcze)
            </button>
          ) : null}
        </Card>
      )}
    </div>
  );
}
