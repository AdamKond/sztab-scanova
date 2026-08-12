import Link from "next/link";
import Topbar from "@/components/shell/Topbar";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import MetricTile from "@/components/ui/MetricTile";
import { Input, Label, Select, Textarea } from "@/components/ui/Field";
import ActionForm, { SubmitButton } from "@/components/crm/ActionForm";
import StatusBadge from "@/components/crm/StatusBadge";
import TemplatePicker from "./TemplatePicker";
import { deleteTemplate, addActivity, saveTemplate } from "@/lib/crm/actions";
import { listActivities, listLeads, listTemplates } from "@/lib/crm/queries";
import { outboundQueue, type OutboundItem } from "@/lib/crm/marketing";
import {
  ACTIVITY_LABELS,
  OUTCOMES,
  OUTCOME_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  TEMPLATE_CHANNELS,
  TEMPLATE_CHANNEL_LABELS,
} from "@/lib/crm/constants";
import { daysAgoLabel, daysSince } from "@/lib/crm/dates";
import type { CrmTemplate, LeadPriority } from "@/lib/crm/types";

// Ekran "Outbound" to kolejka ręcznej roboty: kto dziś dostaje zaczepkę i jaki
// ruch jest następny w sekwencji DM → follow-up → telefon → wizyta.
// Szablony są WYŁĄCZNIE do skopiowania — aplikacja nie ma kanału wysyłki i
// celowo go nie dostanie (masowa automatyczna wysyłka pali konto na IG).

/** Ile prób z sekwencji już poszło — sugerowany ruch to próba nr attempts+1. */
function attemptLabel(attempts: number): string {
  return `${attempts + 1}. próba`;
}

export default async function OutboundPage() {
  const [leads, activities, templates] = await Promise.all([
    listLeads(),
    listActivities(),
    listTemplates(),
  ]);

  const queue = outboundQueue(leads, activities);
  const byPriority = new Map<LeadPriority, OutboundItem[]>(PRIORITIES.map((p) => [p, []]));
  for (const item of queue) byPriority.get(item.lead.priority)!.push(item);

  const noAttempts = queue.filter((i) => i.attempts === 0).length;
  const manyAttempts = queue.filter((i) => i.attempts >= 3).length;
  const priorityACount = byPriority.get("A")!.length;

  const activeTemplates = templates.filter((t) => t.active);
  const inactiveTemplates = templates.filter((t) => !t.active);
  // Kroki sekwencji z szablonów — numer kroku jest dowolną liczbą 1..9,
  // więc grupujemy po tym, co realnie jest w bazie, a nie po sztywnej liście.
  const templateSteps = [...new Set(activeTemplates.map((t) => t.step))].sort((a, b) => a - b);

  function TemplateFields({ template }: { template?: CrmTemplate }) {
    const key = template?.id ?? "new";
    return (
      <>
        <div>
          <Label htmlFor={`tpl-name-${key}`}>Nazwa *</Label>
          <Input
            id={`tpl-name-${key}`}
            name="name"
            required
            maxLength={240}
            defaultValue={template?.name}
            placeholder="np. DM 1 — kawiarnia, otwarcie rozmowy"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor={`tpl-channel-${key}`}>Kanał</Label>
            <Select id={`tpl-channel-${key}`} name="channel" defaultValue={template?.channel ?? "ig_dm"}>
              {TEMPLATE_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {TEMPLATE_CHANNEL_LABELS[c]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`tpl-step-${key}`}>Krok sekwencji</Label>
            <Input
              id={`tpl-step-${key}`}
              name="step"
              type="number"
              min="1"
              max="9"
              step="1"
              defaultValue={template?.step ?? 1}
            />
          </div>
        </div>
        <div>
          <Label htmlFor={`tpl-body-${key}`}>Treść *</Label>
          <Textarea
            id={`tpl-body-${key}`}
            name="body"
            rows={5}
            required
            defaultValue={template?.body}
            placeholder="Cześć! Widziałem, że prowadzicie…"
          />
        </div>
      </>
    );
  }

  function TemplateItem({ template, muted = false }: { template: CrmTemplate; muted?: boolean }) {
    return (
      <details className={`rounded-lg border border-line ${muted ? "bg-canvas" : "bg-surface"}`}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2.5">
          <span className={`min-w-0 flex-1 truncate text-[14px] font-medium ${muted ? "text-ink-2" : "text-ink"}`}>
            {template.name}
          </span>
          <Badge tone="slate">{TEMPLATE_CHANNEL_LABELS[template.channel]}</Badge>
        </summary>

        <div className="border-t border-line px-3 py-3">
          <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-ink-2">
            {template.body}
          </pre>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TemplatePicker body={template.body} />

            <details>
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-line px-3 text-[13px] font-medium text-ink hover:bg-canvas md:min-h-0 md:py-1.5">
                Edytuj
              </summary>
              <div className="mt-2">
                <ActionForm action={saveTemplate} className="space-y-2.5">
                  <input type="hidden" name="template_id" value={template.id} />
                  <TemplateFields template={template} />
                  <SubmitButton size="sm">Zapisz szablon</SubmitButton>
                </ActionForm>
              </div>
            </details>

            <ConfirmDialog
              title="Usunąć szablon?"
              description={`Szablon „${template.name}” zniknie z listy podpowiedzi. Tej operacji nie da się cofnąć.`}
              confirmLabel="Usuń"
              action={async () => {
                // Goły <form action> oczekuje void — opakowujemy akcję zwracającą ActionResult.
                "use server";
                await deleteTemplate(template.id);
              }}
            >
              Usuń
            </ConfirmDialog>
          </div>
        </div>
      </details>
    );
  }

  function QueueRow({ item }: { item: OutboundItem }) {
    const { lead, suggestedStep, lastTouch, attempts } = item;
    return (
      <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/leady/${lead.id}`}
            className="min-w-0 max-w-full truncate text-[14px] font-medium text-ink hover:text-accent"
          >
            {lead.name}
          </Link>
          <StatusBadge status={lead.status} />
          <Badge tone="blue">{ACTIVITY_LABELS[suggestedStep]}</Badge>
          <span className="text-[12px] text-ink-2">{attemptLabel(attempts)}</span>
          <span className="text-[12px] text-ink-2">
            · ostatni kontakt: {lastTouch === null ? "nigdy" : daysAgoLabel(daysSince(lastTouch))}
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {lead.phone ? (
            <a
              href={`tel:${lead.phone}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-line px-2.5 text-[12px] font-medium text-ink hover:bg-canvas md:min-h-0 md:py-1.5"
            >
              {lead.phone}
            </a>
          ) : null}
          {lead.instagram ? (
            <a
              href={`https://instagram.com/${lead.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-lg border border-line px-2.5 text-[12px] font-medium text-ink hover:bg-canvas md:min-h-0 md:py-1.5"
            >
              @{lead.instagram}
            </a>
          ) : null}
          {!lead.phone && !lead.instagram ? (
            <span className="text-[12px] text-ink-2">Brak telefonu i Instagrama — zostaje wizyta.</span>
          ) : null}
        </div>

        {/* „Zrobione” loguje dokładnie ten krok, który system podpowiedział —
            typ jest ukryty, żeby wpis szedł jednym kliknięciem. Ustawienie
            terminu wyprowadza leada z kolejki (ma plan, nie potrzebuje podpowiedzi). */}
        <ActionForm
          action={addActivity}
          resetOnSuccess
          onSuccessMessage="Zapisano."
          className="mt-2 flex flex-wrap items-end gap-2 border-t border-line pt-2"
        >
          <input type="hidden" name="lead_id" value={lead.id} />
          <input type="hidden" name="type" value={suggestedStep} />
          <div className="min-w-[10rem] flex-1">
            <Label htmlFor={`out-outcome-${lead.id}`} className="mb-1 text-[12px]">
              Wynik
            </Label>
            <Select id={`out-outcome-${lead.id}`} name="outcome" defaultValue="">
              <option value="">— brak —</option>
              {OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {OUTCOME_LABELS[o]}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[9rem] flex-1">
            <Label htmlFor={`out-next-${lead.id}`} className="mb-1 text-[12px]">
              Następny krok — kiedy
            </Label>
            <Input id={`out-next-${lead.id}`} name="next_action_at" type="date" />
          </div>
          <SubmitButton>Zrobione</SubmitButton>
        </ActionForm>
      </div>
    );
  }

  function PriorityGroup({ priority }: { priority: LeadPriority }) {
    const items = byPriority.get(priority)!;
    // A i B otwarte domyślnie — to jest robota na dziś. C/D zwinięte, żeby
    // długi ogon „może kiedyś” nie spychał priorytetów poniżej ekranu.
    const openByDefault = priority === "A" || priority === "B";
    return (
      <details open={openByDefault} className="rounded-xl border border-line bg-surface p-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2">
          <span className="text-[14px] font-semibold text-ink">{PRIORITY_LABELS[priority]}</span>
          <Badge tone={priority === "A" ? "blue" : "neutral"}>{items.length}</Badge>
        </summary>
        <div className="mt-3 space-y-2">
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[13px] text-ink-2">
              Brak leadów w tym priorytecie
            </div>
          ) : (
            items.map((item) => <QueueRow key={item.lead.id} item={item} />)
          )}
        </div>
      </details>
    );
  }

  return (
    <>
      <Topbar title="Outbound" />

      <div className="space-y-4">
        <Card padding="sm">
          <p className="text-[13px] text-ink-2">
            <span className="font-medium text-ink">System niczego nie wysyła sam.</span> Podpowiada
            tylko następny ruch w sekwencji i szablon wiadomości — wysyła człowiek, ze swojego konta,
            po dopasowaniu treści do lokalu.
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricTile label="W kolejce" value={String(queue.length)} />
          <MetricTile label="Priorytet A" value={String(priorityACount)} />
          <MetricTile
            label="Bez żadnej próby"
            value={String(noAttempts)}
            sub="jeszcze nikt nie zaczepił"
          />
          <MetricTile
            label="3+ prób"
            value={String(manyAttempts)}
            sub="rozważ zmianę kanału albo odpuszczenie"
            tone={manyAttempts > 0 ? "danger" : "default"}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {queue.length === 0 ? (
              <Card>
                <EmptyState
                  title="Kolejka jest pusta"
                  hint="Każdy otwarty lead ma zaplanowany przyszły krok albo lista leadów jest pusta. Dodaj leady lub zdejmij terminy z tych, którymi chcesz zająć się dziś."
                />
              </Card>
            ) : (
              PRIORITIES.map((p) => <PriorityGroup key={p} priority={p} />)
            )}
          </div>

          <div className="space-y-3">
            <Card padding="sm">
              <h2 className="mb-1 text-[14px] font-semibold text-ink">Szablony wiadomości</h2>
              <p className="mb-3 text-[12px] text-ink-2">
                Kopiuj, dopasuj do lokalu, wyślij ręcznie. Kroki odpowiadają sekwencji: 1 = pierwszy
                kontakt, 2 = follow-up, dalej telefon i wizyta.
              </p>

              {activeTemplates.length === 0 ? (
                <EmptyState
                  title="Brak szablonów"
                  hint="Dodaj pierwszy szablon niżej — wtedy pierwsza wiadomość nie powstaje od zera przy każdym leadzie."
                />
              ) : (
                <div className="space-y-3">
                  {templateSteps.map((step) => (
                    <div key={step}>
                      <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-2">
                        Krok {step}
                      </h3>
                      <div className="space-y-2">
                        {activeTemplates
                          .filter((t) => t.step === step)
                          .map((t) => (
                            <TemplateItem key={t.id} template={t} />
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {inactiveTemplates.length > 0 ? (
                <details className="mt-3">
                  <summary className="min-h-11 cursor-pointer text-[13px] font-medium text-ink-2">
                    Nieaktywne ({inactiveTemplates.length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {inactiveTemplates.map((t) => (
                      <TemplateItem key={t.id} template={t} muted />
                    ))}
                  </div>
                </details>
              ) : null}
            </Card>

            <Card padding="sm">
              <details>
                <summary className="min-h-11 cursor-pointer text-[14px] font-semibold text-ink">
                  + Nowy szablon
                </summary>
                <div className="mt-3">
                  <ActionForm
                    action={saveTemplate}
                    resetOnSuccess
                    onSuccessMessage="Szablon zapisany."
                    className="space-y-2.5"
                  >
                    <TemplateFields />
                    <SubmitButton>Zapisz szablon</SubmitButton>
                  </ActionForm>
                </div>
              </details>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
