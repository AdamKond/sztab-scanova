// Maile — automatyczna zimna wysyłka do lokali. Cron wysyła sam; tu widać
// kolejkę, odpowiedzi, odbicia i ustawienia. Odpowiedź = rozmowa w Rozmowach.

import Topbar from "@/components/shell/Topbar";
import MetricTile from "@/components/ui/MetricTile";
import MailList from "@/components/maile/MailList";
import AddMail from "@/components/maile/AddMail";
import MailSettings from "@/components/maile/MailSettings";
import MailEvents from "@/components/maile/MailEvents";
import { getMailSettings, listMailEvents, listMailQueue, todayStats } from "@/lib/crm/mail/queries";
import { contactedCount, daysOfQueue, effectiveDailyLimit, isSendWindow, mailCounts, warmupFullDay } from "@/lib/crm/mail/plan";
import { mailboxInfos, isMailDryRun } from "@/lib/mail/accounts";
import { warsawToday } from "@/lib/crm/dates";

export default async function MailePage() {
  const now = new Date();
  const [rows, settings, events, today] = await Promise.all([listMailQueue(), getMailSettings(), listMailEvents(120), todayStats(now)]);
  const counts = mailCounts(rows);
  const contacted = contactedCount(rows);
  const replied = counts.odpowiedzial;
  const replyRate = contacted > 0 ? Math.round((1000 * replied) / contacted) / 10 : null;
  const bounceRate = contacted > 0 ? Math.round((1000 * counts.odbil) / contacted) / 10 : null;
  const limit = effectiveDailyLimit(settings, warsawToday(now));
  const mailboxes = mailboxInfos();
  const dryRun = isMailDryRun();
  const inWindow = isSendWindow(settings, now);
  const queueDays = daysOfQueue(rows, limit);

  const state = settings.paused
    ? "WSTRZYMANA"
    : mailboxes.length === 0
      ? "brak skrzynek"
      : dryRun
        ? "NA SUCHO"
        : inWindow
          ? "wysyła"
          : "poza oknem";

  return (
    <>
      <Topbar
        title="Maile"
        subtitle={`${rows.length} adresów. Cron wysyła sam co 15 min w oknie ${settings.send_from_hour}–${settings.send_to_hour} ${settings.weekdays_only ? "w dni robocze" : "codziennie"}. Stan: ${state}.`}
        actions={<AddMail />}
      />

      <div className="anim-in space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <MetricTile
            label="Dziś wysłane"
            value={`${today.sent} / ${limit}`}
            sub={settings.warmup_start && limit < settings.daily_limit ? `rozgrzewka, pełne ${settings.daily_limit} od ${warmupFullDay(settings)}` : `${mailboxes.length} skrzynek`}
            tone={settings.paused ? "warning" : "default"}
          />
          <MetricTile label="W kolejce" value={String(counts.oczekuje)} sub={queueDays !== null && counts.oczekuje ? `starczy na ${queueDays} dni` : "dodaj adresy"} tone={counts.oczekuje < limit * 2 ? "warning" : "default"} />
          <MetricTile label="Odpowiedziało" value={String(replied)} sub={replyRate !== null ? `${replyRate}% z ${contacted} zaczepionych` : "zacznij wysyłać"} tone={replied ? "success" : "default"} />
          <MetricTile label="Odbicia" value={String(counts.odbil)} sub={bounceRate !== null ? `${bounceRate}% (powyżej 3% = zły adres listy)` : undefined} tone={bounceRate !== null && bounceRate > 3 ? "danger" : "default"} />
        </div>

        <MailSettings settings={settings} mailboxes={mailboxes} dryRun={dryRun} />

        <MailList rows={rows} />

        <MailEvents events={events} />
      </div>
    </>
  );
}
