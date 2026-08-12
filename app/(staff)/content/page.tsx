// Content — tablica statusów materiałów (pomysł → opublikowane) plus ręczne
// wyniki. Świadomie NIE pobieramy metryk z TikToka/IG: żadnego scrapowania ani
// integracji, człowiek wpisuje liczby raz na jakiś czas. Lepiej mieć rzadkie,
// prawdziwe dane niż kruchy scraper, który cicho przestaje działać.

import Topbar from "@/components/shell/Topbar";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import MetricTile from "@/components/ui/MetricTile";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Input, Label, Select, Textarea } from "@/components/ui/Field";
import ActionForm, { SubmitButton } from "@/components/crm/ActionForm";
import {
  CONTENT_CHANNELS,
  CONTENT_CHANNEL_LABELS,
  CONTENT_FORMATS,
  CONTENT_FORMAT_LABELS,
  CONTENT_STATUSES,
  CONTENT_STATUS_LABELS,
} from "@/lib/crm/constants";
import { listContent } from "@/lib/crm/queries";
import { changeContentStatus, deleteContent, saveContent } from "@/lib/crm/actions";
import { addDays, shortDate, warsawToday } from "@/lib/crm/dates";
import type { ContentStatus, CrmContent } from "@/lib/crm/types";

// Zwarty zapis dużych liczb: 12500 → "12,5 tys.". Pełne "12 500" rozpycha kartę
// w kolumnie, a przy zasięgach interesuje nas rząd wielkości, nie jedności.
const compactNumber = new Intl.NumberFormat("pl-PL", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const plainNumber = new Intl.NumberFormat("pl-PL");

/** Polska odmiana liczebnika: 1 lead / 2 leady / 5 leadów. */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Kolumny tablicy = wszystkie statusy poza archiwum (archiwum jest zwinięte). */
const BOARD_STATUSES: ContentStatus[] = CONTENT_STATUSES.filter((s) => s !== "archiwum");

// Ton kolumny/etykiety statusu. Zielony zarezerwowany dla pieniędzy, więc
// "opublikowane" dostaje fiolet, a nie zieleń — publikacja to nie przychód.
const STATUS_TONES: Record<ContentStatus, "neutral" | "blue" | "amber" | "violet" | "slate"> = {
  pomysl: "neutral",
  zaakceptowane: "blue",
  do_nagrania: "amber",
  nagrane: "amber",
  opublikowane: "violet",
  archiwum: "slate",
};

/** Linia wyników — pomijamy metryki puste i zerowe, żeby nie robić szumu. */
function resultLine(item: CrmContent): string | null {
  const parts: string[] = [];
  if (item.views) parts.push(`${compactNumber.format(item.views)} wyśw.`);
  if (item.comments) parts.push(`${item.comments} kom.`);
  if (item.saves) parts.push(`${item.saves} zapis.`);
  if (item.inquiries)
    parts.push(
      `${item.inquiries} ${plural(item.inquiries, "zapytanie", "zapytania", "zapytań")}`,
    );
  if (item.leads) parts.push(`${item.leads} ${plural(item.leads, "lead", "leady", "leadów")}`);
  if (item.demos) parts.push(`${item.demos} demo`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function ContentCard({ item }: { item: CrmContent }) {
  const wynik = resultLine(item);
  return (
    <div className="rounded-lg border border-line bg-surface p-2.5">
      <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink">
        {item.hook ?? "(bez hooka)"}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <Badge tone="slate">{CONTENT_CHANNEL_LABELS[item.channel]}</Badge>
        <Badge tone="neutral">{CONTENT_FORMAT_LABELS[item.format]}</Badge>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-ink-2">
        {item.planned_date ? <span>plan {shortDate(item.planned_date)}</span> : null}
        {item.published_date ? <span>publ. {shortDate(item.published_date)}</span> : null}
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent hover:underline"
          >
            link
          </a>
        ) : null}
      </div>

      {wynik ? <p className="tabular mt-1.5 text-[12px] text-ink">{wynik}</p> : null}

      {/* Zmiana statusu bez wchodzenia w edycję — najczęstszy ruch na tablicy.
          Przejście na „opublikowane” ustawia datę publikacji po stronie serwera. */}
      <ActionForm
        action={changeContentStatus.bind(null, item.id)}
        className="mt-2 flex flex-wrap items-center gap-1.5"
      >
        <Label htmlFor={`status-${item.id}`} className="sr-only">
          Zmień status materiału
        </Label>
        <Select
          id={`status-${item.id}`}
          name="status"
          defaultValue={item.status}
          className="min-h-9 flex-1 px-2 text-[12px]"
        >
          {CONTENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CONTENT_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <SubmitButton size="sm" variant="secondary">
          Ustaw
        </SubmitButton>
      </ActionForm>

      <details className="mt-2">
        <summary className="cursor-pointer list-none text-[12px] font-medium text-ink-2 hover:text-ink">
          Edytuj / wyniki
        </summary>

        <ActionForm action={saveContent} className="mt-2 space-y-2">
          <input type="hidden" name="content_id" value={item.id} />

          <div>
            <Label htmlFor={`hook-${item.id}`}>Hook</Label>
            <Input
              id={`hook-${item.id}`}
              name="hook"
              defaultValue={item.hook ?? ""}
              required
              className="min-h-9 text-[13px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor={`channel-${item.id}`}>Kanał</Label>
              <Select
                id={`channel-${item.id}`}
                name="channel"
                defaultValue={item.channel}
                className="min-h-9 px-2 text-[13px]"
              >
                {CONTENT_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {CONTENT_CHANNEL_LABELS[c]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`format-${item.id}`}>Format</Label>
              <Select
                id={`format-${item.id}`}
                name="format"
                defaultValue={item.format}
                className="min-h-9 px-2 text-[13px]"
              >
                {CONTENT_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {CONTENT_FORMAT_LABELS[f]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`edit-status-${item.id}`}>Status</Label>
              <Select
                id={`edit-status-${item.id}`}
                name="status"
                defaultValue={item.status}
                className="min-h-9 px-2 text-[13px]"
              >
                {CONTENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CONTENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`planned-${item.id}`}>Plan nagrania</Label>
              <Input
                id={`planned-${item.id}`}
                name="planned_date"
                type="date"
                defaultValue={item.planned_date ?? ""}
                className="min-h-9 text-[13px]"
              />
            </div>
            <div>
              <Label htmlFor={`published-${item.id}`}>Data publikacji</Label>
              <Input
                id={`published-${item.id}`}
                name="published_date"
                type="date"
                defaultValue={item.published_date ?? ""}
                className="min-h-9 text-[13px]"
              />
            </div>
            <div>
              <Label htmlFor={`url-${item.id}`}>Link</Label>
              <Input
                id={`url-${item.id}`}
                name="url"
                type="url"
                placeholder="https://"
                defaultValue={item.url ?? ""}
                className="min-h-9 text-[13px]"
              />
            </div>
          </div>

          <div>
            <Label htmlFor={`script-${item.id}`}>Skrypt (Markdown)</Label>
            <Textarea
              id={`script-${item.id}`}
              name="script_md"
              defaultValue={item.script_md ?? ""}
              className="min-h-20 text-[13px]"
            />
          </div>

          {/* Legenda poza siatką — jako element grida zajmowałaby całą komórkę. */}
          <fieldset>
            <legend className="mb-1 text-[12px] font-medium text-ink-2">
              Wyniki — wpisujemy ręcznie
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["views", "Wyświetlenia", item.views],
                  ["comments", "Komentarze", item.comments],
                  ["saves", "Zapisy", item.saves],
                  ["inquiries", "Zapytania", item.inquiries],
                  ["leads", "Leady", item.leads],
                  ["demos", "Demo", item.demos],
                ] as const
              ).map(([name, label, value]) => (
                <div key={name}>
                  <Label htmlFor={`${name}-${item.id}`} className="text-[12px]">
                    {label}
                  </Label>
                  <Input
                    id={`${name}-${item.id}`}
                    name={name}
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    defaultValue={value ?? ""}
                    className="min-h-9 px-2 text-[13px]"
                  />
                </div>
              ))}
            </div>
          </fieldset>

          <SubmitButton size="sm">Zapisz materiał</SubmitButton>
        </ActionForm>

        <div className="mt-2">
          <ConfirmDialog
            title="Usunąć materiał?"
            description={`„${item.hook ?? "(bez hooka)"}” zniknie razem ze skryptem i wynikami. Tej operacji nie da się cofnąć — jeśli materiał tylko odpadł z planu, przenieś go do archiwum.`}
            confirmLabel="Usuń"
            action={async () => {
              // Goły <form action> oczekuje void — opakowujemy akcję zwracającą ActionResult.
              "use server";
              await deleteContent(item.id);
            }}
          >
            Usuń
          </ConfirmDialog>
        </div>
      </details>
    </div>
  );
}

export default async function ContentPage() {
  const items = await listContent();

  const today = warsawToday();
  // „Ostatnie 30 dni” liczymy z dzisiejszym włącznie — 30 pełnych dni pracy,
  // nie 31. Ta sama konwencja co w oknach okresu na ekranie reklam.
  const from30 = addDays(today, -29);

  const byStatus = new Map<ContentStatus, CrmContent[]>();
  for (const s of CONTENT_STATUSES) byStatus.set(s, []);
  for (const item of items) byStatus.get(item.status)?.push(item);

  // W pipeline = wszystko, co jeszcze wymaga pracy: bez archiwum i bez publikacji.
  const inPipeline = items.filter(
    (i) => i.status !== "archiwum" && i.status !== "opublikowane",
  ).length;

  const published30 = items.filter(
    (i) => i.published_date !== null && i.published_date >= from30 && i.published_date <= today,
  );
  const views30 = published30.reduce((sum, i) => sum + (i.views ?? 0), 0);
  const leads30 = published30.reduce((sum, i) => sum + (i.leads ?? 0), 0);

  const archived = byStatus.get("archiwum") ?? [];

  return (
    <>
      <Topbar title="Content" />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricTile
            label="W pipeline"
            value={String(inPipeline)}
            sub="Pomysły, akceptacje, nagrania — bez archiwum"
          />
          <MetricTile
            label="Opublikowane (30 dni)"
            value={String(published30.length)}
            sub={`Od ${shortDate(from30)}`}
          />
          <MetricTile
            label="Wyświetlenia (30 dni)"
            value={views30 > 0 ? compactNumber.format(views30) : "—"}
            sub={views30 > 0 ? `${plainNumber.format(views30)} łącznie` : "Brak wpisanych wyników"}
          />
          <MetricTile
            label="Leady z contentu (30 dni)"
            value={String(leads30)}
            sub="Zgłoszenia przypisane ręcznie do materiałów"
          />
        </div>

        <Card>
          <h2 className="mb-1 text-[15px] font-semibold text-ink">+ Nowy materiał</h2>
          <p className="mb-3 text-[13px] text-ink-2">
            Wyniki wpisujemy ręcznie — żadnego scrapowania. Materiał startuje jako pomysł, status
            przesuwasz na tablicy poniżej.
          </p>
          <ActionForm
            action={saveContent}
            resetOnSuccess
            onSuccessMessage="Materiał dodany do kolumny Pomysł."
            className="grid grid-cols-1 gap-3 md:grid-cols-4"
          >
            <div className="md:col-span-2">
              <Label htmlFor="new-hook">Hook *</Label>
              <Input
                id="new-hook"
                name="hook"
                required
                placeholder="Pierwsze zdanie, które zatrzymuje kciuk"
              />
            </div>
            <div>
              <Label htmlFor="new-channel">Kanał</Label>
              <Select id="new-channel" name="channel" defaultValue="reels">
                {CONTENT_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {CONTENT_CHANNEL_LABELS[c]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="new-format">Format</Label>
              <Select id="new-format" name="format" defaultValue="rolka">
                {CONTENT_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {CONTENT_FORMAT_LABELS[f]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="new-planned">Plan nagrania</Label>
              <Input id="new-planned" name="planned_date" type="date" />
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="new-script">Skrypt (Markdown)</Label>
              <Textarea
                id="new-script"
                name="script_md"
                placeholder="Hook, 3 punkty, CTA — wystarczy szkic"
              />
            </div>
            <div className="md:col-span-4">
              <SubmitButton>Dodaj materiał</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        {items.length === 0 ? (
          <EmptyState
            title="Pusta tablica contentu"
            hint="Dodaj pierwszy pomysł formularzem powyżej. Jeden hook = jedna karta."
          />
        ) : (
          // Na desktopie 5 kolumn = lejek produkcji od lewej do prawej;
          // na mobile te same sekcje jedna pod drugą (kanban na telefonie
          // wymusza poziome przewijanie i gubi karty).
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            {BOARD_STATUSES.map((status) => {
              const column = byStatus.get(status) ?? [];
              return (
                <section key={status} className="rounded-xl border border-line bg-canvas p-2">
                  <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
                    <Badge tone={STATUS_TONES[status]}>{CONTENT_STATUS_LABELS[status]}</Badge>
                    <span className="tabular text-[12px] font-medium text-ink-2">
                      {column.length}
                    </span>
                  </div>
                  {column.length === 0 ? (
                    <p className="px-0.5 py-3 text-[12px] text-ink-2">Pusto</p>
                  ) : (
                    <div className="space-y-2">
                      {column.map((item) => (
                        <ContentCard key={item.id} item={item} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        <details className="rounded-xl border border-line bg-surface p-3">
          <summary className="cursor-pointer text-[14px] font-medium text-ink">
            Archiwum ({archived.length})
          </summary>
          <p className="mt-1 text-[13px] text-ink-2">
            Materiały odłożone lub odrzucone. Trzymamy je zamiast kasować — wracają jako punkt
            wyjścia do nowych hooków.
          </p>
          {archived.length === 0 ? (
            <p className="mt-2 text-[13px] text-ink-2">Archiwum puste.</p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3 lg:grid-cols-5">
              {archived.map((item) => (
                <ContentCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </details>
      </div>
    </>
  );
}
