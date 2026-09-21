// Rozmowy — tylko lokale, które odpisały albo z którymi rozmawiamy.
// Kolejność: najpierw te, które czekają na ruch, potem reszta po świeżości.

import Link from "next/link";
import Topbar from "@/components/shell/Topbar";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ConversationRow from "@/components/crm/ConversationRow";
import NewConversation from "@/components/rozmowy/NewConversation";
import { listLeads } from "@/lib/crm/queries";
import { conversationsDue, isClosed, isConversation } from "@/lib/crm/steps";
import { warsawDateOf, warsawToday } from "@/lib/crm/dates";
import type { CrmLead } from "@/lib/crm/types";

type Widok = "aktywne" | "pozniej" | "zamkniete" | "stare";

const WIDOKI: { key: Widok; label: string }[] = [
  { key: "aktywne", label: "Aktywne" },
  { key: "pozniej", label: "Później" },
  { key: "zamkniete", label: "Zamknięte" },
  { key: "stare", label: "Stare importy" },
];

function inWidok(l: CrmLead, w: Widok): boolean {
  switch (w) {
    case "aktywne":
      return isConversation(l) && l.status !== "followup_pozniej";
    case "pozniej":
      return l.status === "followup_pozniej";
    case "zamkniete":
      return isClosed(l);
    case "stare":
      return l.status === "nowy";
  }
}

export default async function RozmowyPage({
  searchParams,
}: {
  searchParams: Promise<{ widok?: string }>;
}) {
  const sp = await searchParams;
  const widok: Widok = (WIDOKI.find((w) => w.key === sp.widok)?.key ?? "aktywne") as Widok;
  const leads = await listLeads();
  const today = warsawToday();

  const counts = Object.fromEntries(WIDOKI.map((w) => [w.key, leads.filter((l) => inWidok(l, w.key)).length])) as Record<Widok, number>;
  const visible = leads.filter((l) => inWidok(l, widok));

  // Aktywne: czekające na ruch u góry, potem po ostatniej zmianie.
  const due = conversationsDue(visible, today, warsawDateOf);
  const dueIds = new Set(due.all.map((l) => l.id));
  const rest = visible.filter((l) => !dueIds.has(l.id)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const ordered = widok === "aktywne" ? [...due.all, ...rest] : visible.sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  return (
    <>
      <Topbar title="Rozmowy" subtitle="Lokale, które odpisały albo z którymi rozmawiamy." actions={<NewConversation />}>
        <div className="flex flex-wrap gap-1.5">
          {WIDOKI.map((w) => {
            if (w.key === "stare" && counts.stare === 0) return null;
            const active = widok === w.key;
            return (
              <Link
                key={w.key}
                href={w.key === "aktywne" ? "/rozmowy" : `/rozmowy?widok=${w.key}`}
                className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                  active ? "bg-ink text-white" : "bg-surface text-ink-2 shadow-card hover:text-ink"
                }`}
              >
                {w.label} <span className={`tabular ${active ? "text-white/70" : "text-ink-3"}`}>{counts[w.key]}</span>
              </Link>
            );
          })}
        </div>
      </Topbar>

      <div className="anim-in">
        <Card>
          {ordered.length === 0 ? (
            <EmptyState
              title={widok === "aktywne" ? "Jeszcze żadnej rozmowy" : "Pusto"}
              hint={
                widok === "aktywne"
                  ? "Rozmowa powstaje, gdy ktoś odpisze na DM (przycisk „Odpowiedział” przy lokalu) albo gdy dodasz ją ręcznie."
                  : undefined
              }
            />
          ) : (
            <ul className="-mx-3">
              {ordered.map((l) => (
                <ConversationRow key={l.id} lead={l} today={today} />
              ))}
            </ul>
          )}
        </Card>
        {widok === "stare" ? (
          <p className="mt-3 text-[12.5px] text-ink-3">
            Leady z importów z sierpnia bez żadnego kontaktu. Te same lokale są w Bazie — gdy odpiszą,
            rozmowa wznowi ten wpis zamiast tworzyć nowy.
          </p>
        ) : null}
      </div>
    </>
  );
}
