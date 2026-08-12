// Ads — ręczny dziennik reklam. Nie ma tu integracji z Meta/Google Ads API:
// raz dziennie człowiek przepisuje wydatek i wyniki. Dzięki temu koszty
// widzimy obok LEADÓW z CRM-u, a nie obok „konwersji” liczonych przez piksel.
//
// Nazewnictwo pilnowane na siłę: CPL = koszt surowego leada,
// CAC = koszt pozyskania PŁATNEGO KLIENTA. Mieszanie tych pojęć sprawia,
// że reklama wygląda 20× taniej niż jest naprawdę.

import Link from "next/link";
import Topbar from "@/components/shell/Topbar";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import MetricTile from "@/components/ui/MetricTile";
import { Input, Label, Select, Textarea } from "@/components/ui/Field";
import { Table, THead, TH, TR, TD } from "@/components/ui/Table";
import ActionForm, { SubmitButton } from "@/components/crm/ActionForm";
import { ADS_PLATFORMS, ADS_PLATFORM_LABELS } from "@/lib/crm/constants";
import { adsMetrics, adsTotals, cplAlert } from "@/lib/crm/marketing";
import { listAdsLog } from "@/lib/crm/queries";
import { deleteAdsEntry, saveAdsEntry } from "@/lib/crm/actions";
import { addDays, shortDate, warsawToday } from "@/lib/crm/dates";
import type { AdsPlatform, CrmAdsLog } from "@/lib/crm/types";

// Progi alertu CPL. Na razie stałe lokalne — kiedy wejdą progi konfigurowane
// (crm_settings), wystarczy podmienić te dwie wartości na odczyt z ustawień.
const CPL_ALERT_THRESHOLD_PLN = 60;
const CPL_ALERT_STREAK_DAYS = 3;

const plnMoney = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const plnRound = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});

const plainNumber = new Intl.NumberFormat("pl-PL");

const percent1 = new Intl.NumberFormat("pl-PL", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Kwota z groszami; null (pusty mianownik) pokazujemy jako „—”, nie jako 0 zł. */
function money(value: number | null): string {
  return value === null ? "—" : plnMoney.format(value);
}

function pct(value: number | null): string {
  return value === null ? "—" : percent1.format(value);
}

function num(value: number | null): string {
  return value === null ? "—" : plainNumber.format(value);
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const OKRES_OPTIONS = ["30", "90", "wszystko"] as const;
type Okres = (typeof OKRES_OPTIONS)[number];

function isPlatform(v: string | undefined): v is AdsPlatform {
  return v === "meta" || v === "google";
}

/** „trzeci dzień z rzędu” zamiast „3 dzień z rzędu” — komunikat czyta człowiek. */
const ORDINAL_DAY: Record<number, string> = {
  2: "drugi",
  3: "trzeci",
  4: "czwarty",
  5: "piąty",
  6: "szósty",
  7: "siódmy",
};

function streakLabel(days: number): string {
  const ordinal = ORDINAL_DAY[days];
  return ordinal ? `${ordinal} dzień z rzędu` : `${days} dni z rzędu`;
}

export default async function AdsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const platformaRaw = first(sp.platforma);
  const platforma = isPlatform(platformaRaw) ? platformaRaw : "wszystkie";
  const okresRaw = first(sp.okres);
  const okres: Okres = (OKRES_OPTIONS as readonly string[]).includes(okresRaw ?? "")
    ? (okresRaw as Okres)
    : "30";
  const kampania = first(sp.kampania)?.trim() ?? "";

  const rows = await listAdsLog();
  const today = warsawToday();
  // Okres liczymy z dzisiejszym dniem włącznie: „30 dni” to 30 pełnych dni pracy.
  const fromDay = okres === "wszystko" ? null : addDays(today, -(Number(okres) - 1));
  const kampaniaLower = kampania.toLowerCase();

  const filtered = rows.filter((r) => {
    if (platforma !== "wszystkie" && r.platform !== platforma) return false;
    if (fromDay && r.log_date < fromDay) return false;
    // „zawiera” zamiast równości — kampanie nazywamy długo (data, miasto, wariant).
    if (kampaniaLower && !r.campaign.toLowerCase().includes(kampaniaLower)) return false;
    return true;
  });

  const totals = adsTotals(filtered);

  // Alert liczymy na PEŁNYM dzienniku, nie na przefiltrowanym — filtr widoku
  // nie może chować ryzyka przepalanego budżetu.
  const alerts = ADS_PLATFORMS.filter((p) =>
    cplAlert(rows, p, CPL_ALERT_THRESHOLD_PLN, CPL_ALERT_STREAK_DAYS),
  );

  const perPlatform = ADS_PLATFORMS.map((p) => ({
    platform: p,
    totals: adsTotals(filtered, { platform: p }),
  }));

  const okresLabel = fromDay ? `ostatnie ${okres} dni (od ${shortDate(fromDay)})` : "cały dziennik";

  return (
    <>
      <Topbar title="Ads — dziennik reklam">
        <form method="get" className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div>
            <Label htmlFor="platforma" className="sr-only">
              Platforma
            </Label>
            <Select id="platforma" name="platforma" defaultValue={platforma}>
              <option value="wszystkie">Wszystkie platformy</option>
              {ADS_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {ADS_PLATFORM_LABELS[p]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="okres" className="sr-only">
              Okres
            </Label>
            <Select id="okres" name="okres" defaultValue={okres}>
              <option value="30">Ostatnie 30 dni</option>
              <option value="90">Ostatnie 90 dni</option>
              <option value="wszystko">Cały dziennik</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="kampania" className="sr-only">
              Kampania
            </Label>
            <Input
              id="kampania"
              name="kampania"
              placeholder="Kampania zawiera…"
              defaultValue={kampania}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" variant="secondary">
              Filtruj
            </Button>
            <Link href="/ads" className="text-[13px] text-ink-2 hover:text-ink">
              Wyczyść
            </Link>
          </div>
        </form>
      </Topbar>

      <div className="anim-in space-y-6">
        {alerts.map((p) => (
          // Czerwony ton wyłącznie dla ryzyka — tu przepalamy budżet od kilku dni.
          <div
            key={p}
            role="alert"
            className="rounded-xl border border-danger/30 bg-red-50 px-4 py-3 text-[13px] font-medium text-danger"
          >
            CPL na {ADS_PLATFORM_LABELS[p]} powyżej {CPL_ALERT_THRESHOLD_PLN} zł{" "}
            {streakLabel(CPL_ALERT_STREAK_DAYS)} — sprawdź kreacje/targeting.
          </div>
        ))}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <MetricTile
            label="Wydatek"
            value={plnRound.format(totals.spend)}
            sub={okresLabel}
            tone="success"
          />
          <MetricTile
            label="CPL (surowy lead)"
            value={money(totals.cpl)}
            sub={`wydatek / ${plainNumber.format(totals.rawLeads)} zgłoszeń`}
          />
          <MetricTile
            label="Koszt kwalifikowanego"
            value={money(totals.costPerQualified)}
            sub={`wydatek / ${plainNumber.format(totals.qualifiedLeads)} kwalifikowanych`}
          />
          <MetricTile
            label="Koszt demo"
            value={money(totals.costPerDemo)}
            sub={`wydatek / ${plainNumber.format(totals.demos)} demo`}
          />
          <MetricTile
            label="CAC (płatny klient)"
            value={money(totals.cac)}
            sub={`wydatek / ${plainNumber.format(totals.paidCustomers)} płatnych klientów`}
          />
        </div>

        <p className="text-[12px] text-ink-2">
          Legenda: <strong className="font-medium text-ink">CPL</strong> to koszt surowego leada
          (wydatek ÷ zgłoszenia), a <strong className="font-medium text-ink">CAC</strong> to koszt
          pozyskania klienta (wydatek ÷ płatni klienci) — to dwie różne liczby i nigdy ich nie
          mieszamy. Puste mianowniki pokazujemy jako „—”, nie jako 0 zł.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {perPlatform.map(({ platform, totals: t }) => (
            <Card key={platform} padding="sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-[14px] font-semibold text-ink">
                  {ADS_PLATFORM_LABELS[platform]}
                </h2>
                <Badge tone="slate">{okres === "wszystko" ? "cały okres" : `${okres} dni`}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[13px]">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-ink-2">Wydatek</div>
                  <div className="tabular font-semibold text-success">
                    {plnRound.format(t.spend)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-ink-2">CPL</div>
                  <div className="tabular font-semibold text-ink">{money(t.cpl)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-ink-2">CAC</div>
                  <div className="tabular font-semibold text-ink">{money(t.cac)}</div>
                </div>
              </div>
              <p className="mt-1.5 text-[12px] text-ink-2">
                {plainNumber.format(t.rawLeads)} leadów · {plainNumber.format(t.qualifiedLeads)}{" "}
                kwalifikowanych · {plainNumber.format(t.paidCustomers)} płatnych
              </p>
            </Card>
          ))}
        </div>

        <Card>
          <h2 className="mb-1 text-[15px] font-semibold text-ink">+ Wpis dziennika</h2>
          <p className="mb-3 text-[13px] text-ink-2">
            Wpis dla tej samej daty + platformy + kampanii NADPISUJE poprzedni (upsert) — poprawiaj
            liczby bez strachu o duplikaty.
          </p>
          <ActionForm
            action={saveAdsEntry}
            resetOnSuccess
            onSuccessMessage="Wpis zapisany."
            className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6"
          >
            <div>
              <Label htmlFor="log_date">Data *</Label>
              <Input id="log_date" name="log_date" type="date" defaultValue={today} required />
            </div>
            <div>
              <Label htmlFor="platform">Platforma *</Label>
              <Select id="platform" name="platform" defaultValue="meta">
                {ADS_PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {ADS_PLATFORM_LABELS[p]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="col-span-2">
              <Label htmlFor="campaign">Kampania</Label>
              <Input id="campaign" name="campaign" placeholder="np. Lublin — rolka pieczątki" />
            </div>
            <div>
              <Label htmlFor="spend">Wydatek (zł) *</Label>
              <Input
                id="spend"
                name="spend"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                required
              />
            </div>
            <div>
              <Label htmlFor="impressions">Wyświetlenia</Label>
              <Input id="impressions" name="impressions" type="number" min="0" step="1" />
            </div>
            <div>
              <Label htmlFor="clicks">Kliknięcia</Label>
              <Input id="clicks" name="clicks" type="number" min="0" step="1" />
            </div>
            <div>
              <Label htmlFor="raw_leads">Leady (surowe)</Label>
              <Input id="raw_leads" name="raw_leads" type="number" min="0" step="1" />
            </div>
            <div>
              <Label htmlFor="qualified_leads">Kwalifikowane</Label>
              <Input id="qualified_leads" name="qualified_leads" type="number" min="0" step="1" />
            </div>
            <div>
              <Label htmlFor="demos">Demo</Label>
              <Input id="demos" name="demos" type="number" min="0" step="1" />
            </div>
            <div>
              <Label htmlFor="pilots">Piloty</Label>
              <Input id="pilots" name="pilots" type="number" min="0" step="1" />
            </div>
            <div>
              <Label htmlFor="paid_customers">Płatni klienci</Label>
              <Input id="paid_customers" name="paid_customers" type="number" min="0" step="1" />
            </div>
            <div className="col-span-2 md:col-span-4 lg:col-span-6">
              <Label htmlFor="notes">Notatka</Label>
              <Textarea
                id="notes"
                name="notes"
                className="min-h-16"
                placeholder="Co zmieniliśmy tego dnia: kreacja, budżet, grupa odbiorców"
              />
            </div>
            <div className="col-span-2 md:col-span-4 lg:col-span-6">
              <SubmitButton>Zapisz wpis</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <Card>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">
            Dziennik ({filtered.length}{" "}
            {filtered.length === 1 ? "wpis" : filtered.length < 5 ? "wpisy" : "wpisów"})
          </h2>

          {filtered.length === 0 ? (
            <EmptyState
              title="Brak wpisów w tym widoku"
              hint="Zmień filtry albo dodaj pierwszy wpis formularzem powyżej — jeden wiersz na dzień, platformę i kampanię."
            />
          ) : (
            <>
              {/* Desktop: pełna tabela z poziomym scrollem — kolumn jest dużo i
                  ściskanie ich na siłę robi z liczb kaszę. */}
              <div className="hidden md:block">
                <Table className="min-w-[1180px]">
                  <THead>
                    <tr>
                      <TH>Data</TH>
                      <TH>Platforma</TH>
                      <TH>Kampania</TH>
                      <TH className="text-right">Wydatek</TH>
                      <TH className="text-right">Wyśw.</TH>
                      <TH className="text-right">Kliknięcia</TH>
                      <TH className="text-right">CTR</TH>
                      <TH className="text-right">CPC</TH>
                      <TH className="text-right">Leady</TH>
                      <TH className="text-right">Kwalif.</TH>
                      <TH className="text-right">Demo</TH>
                      <TH className="text-right">Piloty</TH>
                      <TH className="text-right">Płatni</TH>
                      <TH className="text-right">CPL</TH>
                      <TH>Notatka</TH>
                      <TH />
                    </tr>
                  </THead>
                  <tbody>
                    {filtered.map((r: CrmAdsLog) => {
                      const m = adsMetrics(r);
                      return (
                        <TR key={r.id}>
                          <TD className="tabular whitespace-nowrap">{shortDate(r.log_date)}</TD>
                          <TD className="whitespace-nowrap">
                            {ADS_PLATFORM_LABELS[r.platform]}
                          </TD>
                          <TD className="max-w-[200px] truncate">{r.campaign || "—"}</TD>
                          <TD className="tabular text-right font-medium text-success">
                            {plnMoney.format(r.spend)}
                          </TD>
                          <TD className="tabular text-right">{num(r.impressions)}</TD>
                          <TD className="tabular text-right">{num(r.clicks)}</TD>
                          <TD className="tabular text-right">{pct(m.ctr)}</TD>
                          <TD className="tabular text-right">{money(m.cpc)}</TD>
                          <TD className="tabular text-right">{r.raw_leads}</TD>
                          <TD className="tabular text-right">{r.qualified_leads}</TD>
                          <TD className="tabular text-right">{r.demos}</TD>
                          <TD className="tabular text-right">{r.pilots}</TD>
                          <TD className="tabular text-right">{r.paid_customers}</TD>
                          <TD
                            className={`tabular text-right ${
                              m.cpl !== null && m.cpl > CPL_ALERT_THRESHOLD_PLN
                                ? "font-semibold text-danger"
                                : ""
                            }`}
                          >
                            {money(m.cpl)}
                          </TD>
                          <TD className="max-w-[220px] truncate text-ink-2">{r.notes ?? "—"}</TD>
                          <TD className="text-right">
                            <form
                              action={async () => {
                                // Goły <form action> oczekuje void — opakowujemy akcję zwracającą ActionResult.
                                "use server";
                                await deleteAdsEntry(r.id);
                              }}
                            >
                              <button
                                type="submit"
                                title="Usuń wpis"
                                className="rounded-lg border border-line bg-surface px-2 py-1 text-[12px] font-medium text-ink-2 hover:bg-canvas hover:text-danger"
                              >
                                Usuń
                              </button>
                            </form>
                          </TD>
                        </TR>
                      );
                    })}
                  </tbody>
                </Table>
              </div>

              {/* Mobile: tylko liczby, na które patrzy się codziennie. */}
              <ul className="space-y-2 md:hidden">
                {filtered.map((r: CrmAdsLog) => {
                  const m = adsMetrics(r);
                  return (
                    <li key={r.id} className="rounded-lg border border-line bg-surface p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="tabular text-[13px] font-medium text-ink">
                            {shortDate(r.log_date)}
                          </span>
                          <Badge tone="slate">{ADS_PLATFORM_LABELS[r.platform]}</Badge>
                        </div>
                        <span className="tabular text-[13px] font-semibold text-success">
                          {plnMoney.format(r.spend)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[13px] text-ink">{r.campaign || "—"}</p>
                      <p className="tabular mt-1 text-[12px] text-ink-2">
                        {r.raw_leads} leadów · {r.qualified_leads} kwalif. · {r.demos} demo ·{" "}
                        {r.paid_customers} płatnych
                      </p>
                      <p className="tabular mt-0.5 text-[12px] text-ink-2">
                        CPL{" "}
                        <span
                          className={
                            m.cpl !== null && m.cpl > CPL_ALERT_THRESHOLD_PLN
                              ? "font-semibold text-danger"
                              : "text-ink"
                          }
                        >
                          {money(m.cpl)}
                        </span>{" "}
                        · CTR {pct(m.ctr)}
                      </p>
                      {r.notes ? <p className="mt-1 text-[12px] text-ink-2">{r.notes}</p> : null}
                      <form
                        className="mt-2"
                        action={async () => {
                          // Goły <form action> oczekuje void — opakowujemy akcję zwracającą ActionResult.
                          "use server";
                          await deleteAdsEntry(r.id);
                        }}
                      >
                        <button
                          type="submit"
                          className="min-h-11 rounded-lg border border-line bg-surface px-3 text-[12px] font-medium text-ink-2 hover:bg-canvas hover:text-danger"
                        >
                          Usuń wpis
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
