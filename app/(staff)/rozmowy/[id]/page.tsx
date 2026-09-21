// Karta rozmowy: krok i co dalej, gotowe odpowiedzi, co się wydarzyło, kontakt.

import { notFound } from "next/navigation";
import Topbar from "@/components/shell/Topbar";
import Card, { CardTitle } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Field";
import ActionForm, { SubmitButton } from "@/components/crm/ActionForm";
import StepBadge from "@/components/crm/StepBadge";
import StepBar from "@/components/rozmowy/StepBar";
import ReplyKit from "@/components/rozmowy/ReplyKit";
import ActivityLog from "@/components/rozmowy/ActivityLog";
import { buttonClass } from "@/components/ui/Button";
import { getBlitzForLead, getLead, listActivities, listStageHistory } from "@/lib/crm/queries";
import { setNextAction, updateLeadBasics, updateLeadNotes } from "@/lib/crm/actions";
import { ACTIVITY_LABELS, SOURCE_LABELS } from "@/lib/crm/constants";
import { STEP_LABELS, stepOf } from "@/lib/crm/steps";
import { blitzNicheLabel } from "@/lib/crm/blitz";
import { daysBetween, fullDate, shortDateTime, warsawDateOf, warsawToday } from "@/lib/crm/dates";

/** ISO (UTC) -> wartość dla <input type="datetime-local"> w czasie Warszawy. */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

function person(email: string | null): string {
  return email ? email.split("@")[0] : "—";
}

export default async function RozmowaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  const [activities, history, blitz] = await Promise.all([
    listActivities(id),
    listStageHistory(id),
    getBlitzForLead(id),
  ]);

  const today = warsawToday();
  const step = stepOf(lead.status);
  const pilotDaysLeft = lead.pilot_ends_at ? daysBetween(today, warsawDateOf(lead.pilot_ends_at)) : null;

  const meta = [
    lead.category ? blitzNicheLabel(lead.category) : null,
    lead.city,
    lead.decision_maker_name ? `rozmawiasz z: ${lead.decision_maker_name}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Topbar
        title={lead.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StepBadge status={lead.status} />
            {meta ? <span>{meta}</span> : null}
          </span>
        }
        actions={
          <>
            {lead.instagram ? (
              <a href={`https://instagram.com/${lead.instagram}`} target="_blank" rel="noreferrer" className={buttonClass("secondary", "md")}>
                Instagram
              </a>
            ) : null}
            {lead.phone ? (
              <a href={`tel:${lead.phone}`} className={buttonClass("secondary", "md")}>
                Zadzwoń
              </a>
            ) : null}
          </>
        }
      />

      <div className="anim-in grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card>
            <CardTitle>Krok</CardTitle>
            <StepBar lead={lead} />
            {step === "pilot" && pilotDaysLeft !== null ? (
              <p className="mt-3 text-[13px] text-ink-2">
                Pilot {lead.pilot_started_at ? fullDate(lead.pilot_started_at) : "—"} –{" "}
                {lead.pilot_ends_at ? fullDate(lead.pilot_ends_at) : "—"} ·{" "}
                {pilotDaysLeft >= 0 ? (
                  <span className={pilotDaysLeft <= 7 ? "font-semibold text-warning" : ""}>
                    {pilotDaysLeft} dni do decyzji
                  </span>
                ) : (
                  <span className="font-semibold text-danger">po terminie — czas na decyzję</span>
                )}
              </p>
            ) : null}
            {step === "klient" ? (
              <p className="mt-3 text-[13px] text-ink-2">
                Płaci od {lead.paid_at ? fullDate(lead.paid_at) : "—"} · {lead.plan ?? "—"} ·{" "}
                {lead.monthly_revenue != null ? `${lead.monthly_revenue} zł/mies.` : "—"}
              </p>
            ) : null}
            {lead.lost_reason ? <p className="mt-3 text-[13px] text-ink-2">Powód: {lead.lost_reason}</p> : null}
          </Card>

          <Card>
            <CardTitle>Gotowe odpowiedzi</CardTitle>
            <ReplyKit />
            {blitz?.sent_at ? (
              <p className="mt-3 text-[12.5px] text-ink-3">
                Pierwszy DM poszedł {shortDateTime(blitz.sent_at)}
                {blitz.followup_sent_at ? `, follow-up ${shortDateTime(blitz.followup_sent_at)}` : ""}.
              </p>
            ) : null}
          </Card>

          <Card>
            <CardTitle>Co się wydarzyło</CardTitle>
            <ActivityLog leadId={lead.id} defaultType={step === "pilot" ? "pilot_checkin" : "ig_dm"} />
            {activities.length > 0 ? (
              <ul className="mt-5 space-y-3 border-t border-line/70 pt-4">
                {activities.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-3" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                        <span className="font-semibold text-ink">{ACTIVITY_LABELS[a.type]}</span>
                        <span className="text-ink-3">
                          {shortDateTime(a.happened_at)} · {person(a.created_by)}
                        </span>
                      </div>
                      {a.note ? <p className="mt-0.5 whitespace-pre-wrap text-[13.5px] text-ink">{a.note}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardTitle>Następny krok</CardTitle>
            <ActionForm action={setNextAction.bind(null, lead.id)} className="space-y-3">
              <div>
                <Label htmlFor="next_action">Co</Label>
                <Input id="next_action" name="next_action" defaultValue={lead.next_action ?? ""} />
              </div>
              <div>
                <Label htmlFor="next_action_at">Kiedy</Label>
                <Input id="next_action_at" name="next_action_at" type="datetime-local" defaultValue={isoToLocalInput(lead.next_action_at)} />
              </div>
              <SubmitButton size="sm" variant="secondary">Zapisz</SubmitButton>
            </ActionForm>
            <p className="mt-3 text-[12px] text-ink-3">Bez daty rozmowa jest na Dziś od razu. Z datą — wraca tego dnia.</p>
          </Card>

          <Card>
            <CardTitle>Notatki</CardTitle>
            <ActionForm action={updateLeadNotes.bind(null, lead.id)} className="space-y-2">
              <Textarea name="notes" defaultValue={lead.notes ?? ""} rows={5} />
              <SubmitButton size="sm" variant="secondary">Zapisz notatki</SubmitButton>
            </ActionForm>
          </Card>

          <Card>
            <CardTitle>Kontakt</CardTitle>
            <ActionForm action={updateLeadBasics.bind(null, lead.id)} className="space-y-3">
              <div>
                <Label htmlFor="c-name">Nazwa</Label>
                <Input id="c-name" name="name" defaultValue={lead.name} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="c-ig">Instagram</Label>
                  <Input id="c-ig" name="instagram" defaultValue={lead.instagram ?? ""} />
                </div>
                <div>
                  <Label htmlFor="c-phone">Telefon</Label>
                  <Input id="c-phone" name="phone" inputMode="tel" defaultValue={lead.phone ?? ""} />
                </div>
                <div>
                  <Label htmlFor="c-city">Miasto</Label>
                  <Input id="c-city" name="city" defaultValue={lead.city ?? ""} />
                </div>
                <div>
                  <Label htmlFor="c-cat">Rodzaj</Label>
                  <Input id="c-cat" name="category" defaultValue={lead.category ?? ""} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="c-dm">Z kim rozmawiasz</Label>
                  <Input id="c-dm" name="decision_maker_name" defaultValue={lead.decision_maker_name ?? ""} />
                </div>
              </div>
              <SubmitButton size="sm" variant="secondary">Zapisz</SubmitButton>
            </ActionForm>
            <div className="mt-4 space-y-0.5 border-t border-line/70 pt-3 text-[12px] text-ink-3">
              <div>Źródło: {SOURCE_LABELS[lead.source]}{lead.source_detail ? ` · ${lead.source_detail}` : ""}</div>
              <div>Prowadzi: {person(lead.owner)} · od {fullDate(lead.created_at)}</div>
              {history.length > 1 ? (
                <div>
                  Historia:{" "}
                  {history.map((h) => STEP_LABELS[stepOf(h.to_status)]).join(" → ")}
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
