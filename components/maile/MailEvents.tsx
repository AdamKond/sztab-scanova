// Dziennik zdarzeń wysyłki — ostatnie wpisy, bez interakcji.

import Card, { CardTitle } from "@/components/ui/Card";
import { shortDateTime } from "@/lib/crm/dates";
import type { CrmMailEvent } from "@/lib/crm/mail/types";

const KIND_LABEL: Record<string, string> = {
  wyslano: "wysłano",
  blad: "błąd",
  odbicie: "odbicie",
  odpowiedz: "ODPOWIEDŹ",
  autoodpowiedz: "autoodpowiedź",
  wypisanie: "wypisanie",
  skarga: "skarga",
  cron: "cron",
  test: "test",
  nieznany: "obcy mail",
};

const KIND_CLASS: Record<string, string> = {
  odpowiedz: "text-success",
  blad: "text-danger",
  odbicie: "text-danger",
  skarga: "text-danger",
  wypisanie: "text-warning",
};

export default function MailEvents({ events }: { events: CrmMailEvent[] }) {
  const visible = events.filter((e) => e.kind !== "nieznany");
  if (visible.length === 0) return null;
  return (
    <Card padding="sm">
      <div className="px-2 pt-1">
        <CardTitle count={visible.length}>Dziennik</CardTitle>
      </div>
      <ul className="max-h-80 divide-y divide-line/70 overflow-y-auto px-2 text-[13px]">
        {visible.map((e) => (
          <li key={e.id} className="flex gap-3 py-1.5">
            <span className="tabular w-24 shrink-0 text-ink-3">{shortDateTime(e.created_at)}</span>
            <span className={`w-24 shrink-0 font-semibold ${KIND_CLASS[e.kind] ?? "text-ink-2"}`}>
              {KIND_LABEL[e.kind] ?? e.kind}
              {e.step ? ` #${e.step}` : ""}
            </span>
            <span className="min-w-0 flex-1 truncate text-ink">
              {e.email}
              {e.detail ? <span className="text-ink-2"> · {e.detail}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
