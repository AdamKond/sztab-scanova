// Dziś — jedyny ekran, który otwiera się rano. Trzy listy w kolejności
// ważności: odpowiedzi/rozmowy do ruszenia, follow-upy, nowe DM-y.

import Link from "next/link";
import Topbar from "@/components/shell/Topbar";
import Card, { CardTitle } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import MetricTile from "@/components/ui/MetricTile";
import ConversationRow from "@/components/crm/ConversationRow";
import DmRow from "@/components/baza/DmRow";
import { buttonClass } from "@/components/ui/Button";
import { requireStaff } from "@/lib/auth";
import { listDmBlitz, listLeads } from "@/lib/crm/queries";
import { conversationsDue, isClient, isConversation } from "@/lib/crm/steps";
import { dailyQueue, followupQueue, DAILY_DM_LIMIT, FOLLOWUP_AFTER_DAYS } from "@/lib/crm/blitz";
import { fullDate, warsawDateOf, warsawToday } from "@/lib/crm/dates";

const WEEKDAYS = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];

export default async function DzisPage() {
  const user = await requireStaff();
  const [leads, blitz] = await Promise.all([listLeads(), listDmBlitz()]);

  const now = Date.now();
  const today = warsawToday();
  const email = user.email ?? "";

  const due = conversationsDue(leads, today, warsawDateOf);
  const followups = followupQueue(blitz, now);
  const queue = dailyQueue(blitz, now, email, today, warsawDateOf);
  const conversations = leads.filter(isConversation).length;
  const clients = leads.filter(isClient).length;
  const weekday = WEEKDAYS[new Date(now).getDay()];

  return (
    <>
      <Topbar title="Dziś" subtitle={`${weekday}, ${fullDate(today)}`} />

      <div className="anim-in space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <MetricTile
            label="DM-y wysłane dziś"
            value={`${queue.done.length} / ${DAILY_DM_LIMIT}`}
            tone={queue.done.length >= DAILY_DM_LIMIT ? "success" : "default"}
          />
          <MetricTile label="Follow-upy do wysłania" value={String(followups.length)} tone={followups.length ? "warning" : "default"} />
          <MetricTile label="Rozmowy do ruszenia" value={String(due.all.length)} tone={due.overdue.length ? "danger" : "default"} sub={`${conversations} aktywnych rozmów`} />
          <MetricTile label="Piloty i klienci" value={String(clients)} tone={clients ? "success" : "default"} />
        </div>

        <Card>
          <CardTitle count={due.all.length} action={<Link href="/rozmowy" className={buttonClass("ghost", "sm")}>Wszystkie rozmowy →</Link>}>
            Rozmowy do ruszenia
          </CardTitle>
          {due.all.length === 0 ? (
            <EmptyState
              title="Nic nie czeka"
              hint="Gdy ktoś odpisze na DM, kliknij „Odpowiedział” przy lokalu — rozmowa pojawi się tutaj z gotową odpowiedzią."
            />
          ) : (
            <ul className="-mx-3">
              {due.all.map((l) => (
                <ConversationRow key={l.id} lead={l} today={today} />
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle count={followups.length}>Follow-upy po {FOLLOWUP_AFTER_DAYS} dniach ciszy</CardTitle>
          {followups.length === 0 ? (
            <p className="text-[13.5px] text-ink-2">
              Brak. Follow-up wypada automatycznie po {FOLLOWUP_AFTER_DAYS} dniach bez odpowiedzi na pierwszy DM.
            </p>
          ) : (
            <ul className="-mx-3 divide-y divide-line/70">
              {followups.map((r) => (
                <DmRow key={r.id} row={r} now={now} />
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle
            count={queue.done.length + queue.next.length}
            action={<Link href="/baza" className={buttonClass("ghost", "sm")}>Cała Baza →</Link>}
          >
            Nowe DM-y na dziś
          </CardTitle>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${Math.min(100, Math.round((100 * queue.done.length) / DAILY_DM_LIMIT))}%` }}
              />
            </div>
            <span className="tabular text-[13px] font-semibold text-ink-2">
              {queue.done.length} / {DAILY_DM_LIMIT}
            </span>
          </div>
          {queue.done.length + queue.next.length === 0 ? (
            <EmptyState
              title="Baza jest wyczerpana"
              hint="Dodaj nowe lokale w Bazie — wklej listę Instagramów, a kolejka ułoży się sama."
              action={<Link href="/baza" className={buttonClass("primary", "md")}>Dodaj lokale</Link>}
            />
          ) : (
            <ul className="-mx-3 divide-y divide-line/70">
              {queue.done.map((r) => (
                <DmRow key={r.id} row={r} now={now} />
              ))}
              {queue.next.map((r) => (
                <DmRow key={r.id} row={r} now={now} />
              ))}
            </ul>
          )}
          <p className="mt-4 text-[12.5px] text-ink-3">
            Limit {DAILY_DM_LIMIT} DM-ów dziennie z jednego konta, rozłożonych na cały dzień — za więcej
            Instagram blokuje pisanie na tydzień. Pierwsza wiadomość bez linku.
          </p>
        </Card>
      </div>
    </>
  );
}
