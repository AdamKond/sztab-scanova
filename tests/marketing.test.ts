// Testy metryk marketingowych i kolejki outboundu — czyste funkcje na
// fiksturach w pamięci. Fikstury budujemy fabrykami z sensownymi wartościami
// domyślnymi, żeby każdy test nadpisywał tylko pola istotne dla zachowania.
import { describe, expect, it } from "vitest";
import { OUTBOUND_SEQUENCE } from "@/lib/crm/constants";
import { adsMetrics, adsTotals, cplAlert, outboundQueue } from "@/lib/crm/marketing";
import type { CrmActivity, CrmAdsLog, CrmLead } from "@/lib/crm/types";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function makeLead(overrides: Partial<CrmLead> = {}): CrmLead {
  return {
    id: nextId("lead"),
    name: "Testowa Kawiarnia",
    normalized_name: "testowa kawiarnia",
    category: null,
    city: null,
    district: null,
    address: null,
    instagram: null,
    phone: null,
    email: null,
    www: null,
    google_rating: null,
    locations_count: 1,
    estimated_daily_transactions: null,
    current_loyalty: null,
    decision_maker_name: null,
    decision_maker_role: null,
    source: "teren",
    source_detail: null,
    campaign: null,
    referred_by: null,
    status: "nowy",
    priority: "B",
    qualification_note: null,
    owner: null,
    next_action: null,
    next_action_at: null,
    last_activity_at: null,
    pilot_started_at: null,
    pilot_ends_at: null,
    paid_at: null,
    plan: null,
    monthly_revenue: null,
    churned_at: null,
    lost_reason: null,
    disqualification_reason: null,
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeActivity(overrides: Partial<CrmActivity> = {}): CrmActivity {
  return {
    id: nextId("act"),
    lead_id: null,
    type: "wizyta",
    outcome: null,
    note: null,
    happened_at: "2026-01-01T00:00:00.000Z",
    created_by: "adam@x.pl",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeAdsLog(overrides: Partial<CrmAdsLog> = {}): CrmAdsLog {
  return {
    id: nextId("ads"),
    log_date: "2026-01-01",
    platform: "meta",
    campaign: "kawiarnie",
    spend: 0,
    impressions: 0,
    clicks: 0,
    raw_leads: 0,
    qualified_leads: 0,
    demos: 0,
    pilots: 0,
    paid_customers: 0,
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ----------------------------------------------------------------------------
// adsMetrics
// ----------------------------------------------------------------------------

describe("adsMetrics", () => {
  it("liczy wszystkie wskaźniki na kompletnym wierszu", () => {
    const row = makeAdsLog({
      spend: 100,
      impressions: 1000,
      clicks: 50,
      raw_leads: 10,
      qualified_leads: 4,
      demos: 2,
      paid_customers: 1,
    });
    expect(adsMetrics(row)).toEqual({
      ctr: 0.05, // 50 / 1000
      cpc: 2, // 100 / 50
      cpl: 10, // 100 / 10
      costPerQualified: 25, // 100 / 4
      costPerDemo: 50, // 100 / 2
      cac: 100, // 100 / 1
    });
  });

  it("zerowe mianowniki dają null, nie 0 (UI ma pokazać „—”)", () => {
    const row = makeAdsLog({
      spend: 500,
      impressions: 0,
      clicks: 0,
      raw_leads: 0,
      qualified_leads: 0,
      demos: 0,
      paid_customers: 0,
    });
    const m = adsMetrics(row);
    expect(m).toEqual({
      ctr: null,
      cpc: null,
      cpl: null,
      costPerQualified: null,
      costPerDemo: null,
      cac: null,
    });
    // Wprost: to ma być null, a nie fałszywe „0 zł za leada”.
    expect(m.cpl).not.toBe(0);
    expect(m.ctr).not.toBe(0);
  });

  it("null w mianowniku (impressions/clicks) też daje null", () => {
    const row = makeAdsLog({ spend: 80, impressions: null, clicks: null, raw_leads: 4 });
    const m = adsMetrics(row);
    expect(m.ctr).toBeNull();
    expect(m.cpc).toBeNull();
    expect(m.cpl).toBe(20); // 80 / 4 — reszta wskaźników liczy się normalnie
  });

  it("zerowy licznik przy dodatnim mianowniku daje 0, nie null", () => {
    const row = makeAdsLog({ spend: 0, impressions: 1000, clicks: 20, raw_leads: 5 });
    const m = adsMetrics(row);
    expect(m.cpc).toBe(0);
    expect(m.cpl).toBe(0);
    expect(m.ctr).toBe(0.02);
  });

  it("brak kliknięć przy wyświetleniach daje CTR 0 (clicks ?? 0 w liczniku)", () => {
    const row = makeAdsLog({ spend: 10, impressions: 500, clicks: null });
    expect(adsMetrics(row).ctr).toBe(0);
  });

  it("spend jako string z PostgREST („25.50”) jest koercowany do liczby", () => {
    const row = makeAdsLog({
      spend: "25.50" as unknown as number,
      impressions: 1000,
      clicks: 10,
      raw_leads: 2,
      qualified_leads: 1,
      demos: 5,
      paid_customers: 2,
    });
    expect(adsMetrics(row)).toEqual({
      ctr: 0.01,
      cpc: 2.55, // 25.5 / 10
      cpl: 12.75, // 25.5 / 2
      costPerQualified: 25.5,
      costPerDemo: 5.1, // 25.5 / 5
      cac: 12.75,
    });
  });
});

// ----------------------------------------------------------------------------
// adsTotals
// ----------------------------------------------------------------------------

describe("adsTotals", () => {
  const meta1 = makeAdsLog({
    log_date: "2026-01-01",
    platform: "meta",
    campaign: "kawiarnie",
    spend: "10.00" as unknown as number,
    impressions: 1000,
    clicks: 100,
    raw_leads: 5,
    qualified_leads: 3,
    demos: 2,
    pilots: 1,
    paid_customers: 1,
  });
  const meta2 = makeAdsLog({
    log_date: "2026-01-02",
    platform: "meta",
    campaign: "kawiarnie",
    spend: 20,
    impressions: 2000,
    clicks: 100,
    raw_leads: 5,
    qualified_leads: 1,
  });
  const google1 = makeAdsLog({
    log_date: "2026-01-03",
    platform: "google",
    campaign: "brand",
    spend: 30,
    impressions: null,
    clicks: null,
  });
  const rows = [meta1, meta2, google1];

  it("sumuje wszystkie wiersze i liczy wskaźniki z sum", () => {
    expect(adsTotals(rows)).toEqual({
      spend: 60,
      impressions: 3000,
      clicks: 200,
      rawLeads: 10,
      qualifiedLeads: 4,
      demos: 2,
      pilots: 1,
      paidCustomers: 1,
      ctr: 200 / 3000,
      cpc: 0.3,
      cpl: 6,
      costPerQualified: 15,
      costPerDemo: 30,
      cac: 60,
    });
  });

  it("filtr platformy zawęża sumy", () => {
    const t = adsTotals(rows, { platform: "meta" });
    expect(t.spend).toBe(30);
    expect(t.impressions).toBe(3000);
    expect(t.clicks).toBe(200);
    expect(t.cpc).toBe(0.15);
    expect(t.cpl).toBe(3);
    expect(t.cac).toBe(30);

    const g = adsTotals(rows, { platform: "google" });
    expect(g.spend).toBe(30);
    expect(g.impressions).toBe(0);
    expect(g.ctr).toBeNull();
    expect(g.cpl).toBeNull();
  });

  it("filtr kampanii zawęża sumy", () => {
    const t = adsTotals(rows, { campaign: "kawiarnie" });
    expect(t.spend).toBe(30);
    expect(t.rawLeads).toBe(10);
    expect(adsTotals(rows, { campaign: "brand" }).spend).toBe(30);
    expect(adsTotals(rows, { campaign: "nieistniejaca" }).spend).toBe(0);
  });

  it("campaign: \"\" oznacza „wszystkie kampanie” (wartość pustej opcji <select>)", () => {
    const bezKampanii = makeAdsLog({ log_date: "2026-01-04", campaign: "", spend: 7, raw_leads: 1 });
    const t = adsTotals([...rows, bezKampanii], { campaign: "" });
    // 60 (rows) + 7 (bez kampanii) — pusty filtr nie zawęża niczego.
    expect(t.spend).toBe(67);
    expect(t.rawLeads).toBe(11);
  });

  it("filtr okresu jest obustronnie domknięty", () => {
    const t = adsTotals(rows, { fromDay: "2026-01-02", toDay: "2026-01-03" });
    expect(t.spend).toBe(50);
    expect(t.impressions).toBe(2000);
    expect(t.clicks).toBe(100);
    expect(t.rawLeads).toBe(5);
    expect(t.qualifiedLeads).toBe(1);
    expect(t.demos).toBe(0);
    expect(t.costPerDemo).toBeNull();
    expect(t.cac).toBeNull();
    expect(t.cpl).toBe(10);

    // Granice włącznie: from == to == dzień drugiego wiersza.
    const oneDay = adsTotals(rows, { fromDay: "2026-01-02", toDay: "2026-01-02" });
    expect(oneDay.spend).toBe(20);

    // Sam fromDay / sam toDay.
    expect(adsTotals(rows, { fromDay: "2026-01-03" }).spend).toBe(30);
    expect(adsTotals(rows, { toDay: "2026-01-01" }).spend).toBe(10);
  });

  it("filtry łączą się koniunkcją", () => {
    const t = adsTotals(rows, {
      platform: "meta",
      campaign: "kawiarnie",
      fromDay: "2026-01-01",
      toDay: "2026-01-01",
    });
    expect(t.spend).toBe(10);
    expect(t.paidCustomers).toBe(1);
    expect(t.cac).toBe(10);
  });

  it("pusty zbiór -> zera w sumach i null we wszystkich wskaźnikach", () => {
    const expected = {
      spend: 0,
      impressions: 0,
      clicks: 0,
      rawLeads: 0,
      qualifiedLeads: 0,
      demos: 0,
      pilots: 0,
      paidCustomers: 0,
      ctr: null,
      cpc: null,
      cpl: null,
      costPerQualified: null,
      costPerDemo: null,
      cac: null,
    };
    expect(adsTotals([])).toEqual(expected);
    // Filtr, który nic nie dopuszcza, daje ten sam wynik co pusty zbiór.
    expect(adsTotals(rows, { fromDay: "2027-01-01" })).toEqual(expected);
  });
});

// ----------------------------------------------------------------------------
// cplAlert
// ----------------------------------------------------------------------------

describe("cplAlert", () => {
  const THRESHOLD = 50;
  const STREAK = 3;

  it("trzy KOLEJNE drogie dni -> alert", () => {
    const rows = [
      makeAdsLog({ log_date: "2026-01-05", spend: 100, raw_leads: 1 }), // CPL 100
      makeAdsLog({ log_date: "2026-01-06", spend: 200, raw_leads: 2 }), // CPL 100
      makeAdsLog({ log_date: "2026-01-07", spend: 60, raw_leads: 1 }), // CPL 60
    ];
    expect(cplAlert(rows, "meta", THRESHOLD, STREAK)).toBe(true);
  });

  it("drogie dni rozrzucone po kalendarzu (dziura) -> brak alertu", () => {
    const rows = [
      makeAdsLog({ log_date: "2026-01-01", spend: 100, raw_leads: 1 }),
      makeAdsLog({ log_date: "2026-01-05", spend: 100, raw_leads: 1 }),
      makeAdsLog({ log_date: "2026-01-10", spend: 100, raw_leads: 1 }),
    ];
    expect(cplAlert(rows, "meta", THRESHOLD, STREAK)).toBe(false);
  });

  it("tani dzień w środku przerywa serię", () => {
    const rows = [
      makeAdsLog({ log_date: "2026-01-05", spend: 100, raw_leads: 1 }), // drogi
      makeAdsLog({ log_date: "2026-01-06", spend: 100, raw_leads: 10 }), // CPL 10 — tani
      makeAdsLog({ log_date: "2026-01-07", spend: 100, raw_leads: 1 }), // drogi
      makeAdsLog({ log_date: "2026-01-08", spend: 100, raw_leads: 1 }), // drogi
    ];
    expect(cplAlert(rows, "meta", THRESHOLD, STREAK)).toBe(false);
  });

  it("dzień z wydatkiem i zerem leadów liczy się jako zły (CPL null)", () => {
    const rows = [
      makeAdsLog({ log_date: "2026-01-05", spend: 10, raw_leads: 0 }),
      makeAdsLog({ log_date: "2026-01-06", spend: 10, raw_leads: 0 }),
      makeAdsLog({ log_date: "2026-01-07", spend: 10, raw_leads: 0 }),
    ];
    expect(cplAlert(rows, "meta", THRESHOLD, STREAK)).toBe(true);
  });

  it("dzień bez wydatku nie jest zły i przerywa serię", () => {
    const rows = [
      makeAdsLog({ log_date: "2026-01-05", spend: 100, raw_leads: 1 }),
      makeAdsLog({ log_date: "2026-01-06", spend: 100, raw_leads: 1 }),
      makeAdsLog({ log_date: "2026-01-07", spend: 100, raw_leads: 1 }),
      // Najnowszy dzień: kampania wyłączona, zero wydatku — seria liczona wstecz
      // od najnowszego wpisu urywa się od razu.
      makeAdsLog({ log_date: "2026-01-08", spend: 0, raw_leads: 0 }),
    ];
    expect(cplAlert(rows, "meta", THRESHOLD, STREAK)).toBe(false);
  });

  it("mniej dni niż wymagana seria -> brak alertu", () => {
    const rows = [
      makeAdsLog({ log_date: "2026-01-06", spend: 999, raw_leads: 0 }),
      makeAdsLog({ log_date: "2026-01-07", spend: 999, raw_leads: 0 }),
    ];
    expect(cplAlert(rows, "meta", THRESHOLD, STREAK)).toBe(false);
    // Ta sama historia przy krótszej serii już alarmuje.
    expect(cplAlert(rows, "meta", THRESHOLD, 2)).toBe(true);
  });

  it("kilka kampanii tego samego dnia jest SUMOWANYCH przed oceną (suma ratuje dzień)", () => {
    // Sama kampania „droga” miałaby CPL null (10 zł, 0 leadów), ale dzień jako
    // całość ma CPL 20 zł i nie jest zły.
    const rows = ["2026-01-05", "2026-01-06", "2026-01-07"].flatMap((day) => [
      makeAdsLog({ log_date: day, campaign: "droga", spend: 100, raw_leads: 0 }),
      makeAdsLog({ log_date: day, campaign: "tania", spend: 20, raw_leads: 6 }),
    ]);
    // Suma dnia: 120 zł / 6 leadów = 20 zł CPL <= 50.
    expect(cplAlert(rows, "meta", THRESHOLD, STREAK)).toBe(false);
  });

  it("kilka kampanii tego samego dnia jest SUMOWANYCH przed oceną (suma psuje dzień)", () => {
    // Każda kampania z osobna: 30/1 = 30 i 80/1 = 80. Suma dnia: 110/2 = 55 > 50.
    const rows = ["2026-01-05", "2026-01-06", "2026-01-07"].flatMap((day) => [
      makeAdsLog({ log_date: day, campaign: "a", spend: 30, raw_leads: 1 }),
      makeAdsLog({ log_date: day, campaign: "b", spend: 80, raw_leads: 1 }),
    ]);
    expect(cplAlert(rows, "meta", THRESHOLD, STREAK)).toBe(true);
  });

  it("CPL równy progowi NIE jest zły — alarmuje dopiero powyżej progu", () => {
    const naProgu = ["2026-01-05", "2026-01-06", "2026-01-07"].map((day) =>
      makeAdsLog({ log_date: day, spend: 50, raw_leads: 1 }),
    );
    expect(cplAlert(naProgu, "meta", THRESHOLD, STREAK)).toBe(false);

    const ponadProg = ["2026-01-05", "2026-01-06", "2026-01-07"].map((day) =>
      makeAdsLog({ log_date: day, spend: 50.01, raw_leads: 1 }),
    );
    expect(cplAlert(ponadProg, "meta", THRESHOLD, STREAK)).toBe(true);
  });

  it("liczy tylko wskazaną platformę", () => {
    const rows = [
      makeAdsLog({ log_date: "2026-01-05", platform: "google", spend: 100, raw_leads: 0 }),
      makeAdsLog({ log_date: "2026-01-06", platform: "google", spend: 100, raw_leads: 0 }),
      makeAdsLog({ log_date: "2026-01-07", platform: "google", spend: 100, raw_leads: 0 }),
      makeAdsLog({ log_date: "2026-01-06", platform: "meta", spend: 100, raw_leads: 0 }),
      makeAdsLog({ log_date: "2026-01-07", platform: "meta", spend: 100, raw_leads: 0 }),
    ];
    expect(cplAlert(rows, "google", THRESHOLD, STREAK)).toBe(true);
    expect(cplAlert(rows, "meta", THRESHOLD, STREAK)).toBe(false);
  });

  it("seria przez granicę miesiąca jest ciągła", () => {
    const rows = [
      makeAdsLog({ log_date: "2026-02-27", spend: 100, raw_leads: 1 }),
      makeAdsLog({ log_date: "2026-02-28", spend: 100, raw_leads: 1 }),
      makeAdsLog({ log_date: "2026-03-01", spend: 100, raw_leads: 1 }),
    ];
    expect(cplAlert(rows, "meta", THRESHOLD, STREAK)).toBe(true);
  });

  it("spend jako string z PostgREST jest sumowany liczbowo, nie sklejany", () => {
    const rows = ["2026-01-05", "2026-01-06", "2026-01-07"].flatMap((day) => [
      makeAdsLog({ log_date: day, spend: "30.00" as unknown as number, raw_leads: 1 }),
      makeAdsLog({ log_date: day, spend: "30.00" as unknown as number, raw_leads: 1 }),
    ]);
    // Sklejenie stringów dałoby "030.0030.00" i NaN; poprawna suma to 60/2 = 30 <= 50.
    expect(cplAlert(rows, "meta", THRESHOLD, STREAK)).toBe(false);
    expect(cplAlert(rows, "meta", 29, STREAK)).toBe(true);
  });

  it("pusty dziennik -> brak alertu", () => {
    expect(cplAlert([], "meta", THRESHOLD, STREAK)).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// outboundQueue
// ----------------------------------------------------------------------------

describe("outboundQueue", () => {
  // 2026-01-20 13:00 czasu warszawskiego.
  const now = new Date("2026-01-20T12:00:00Z");

  it("bierze tylko statusy otwarte, pomija zamknięte i płatnych", () => {
    const leads = [
      makeLead({ id: "otwarty", status: "nowy" }),
      makeLead({ id: "followup", status: "followup_pozniej" }),
      makeLead({ id: "oferta", status: "oferta" }),
      makeLead({ id: "utracony", status: "utracony" }),
      makeLead({ id: "zdyskwalifikowany", status: "zdyskwalifikowany" }),
      makeLead({ id: "platny", status: "platny_klient" }),
      makeLead({ id: "churn", status: "churn" }),
    ];
    const ids = outboundQueue(leads, [], now).map((i) => i.lead.id);
    expect(ids.sort()).toEqual(["followup", "oferta", "otwarty"]);
  });

  it("leady w pilocie są wyłączone mimo otwartego statusu (mają check-iny)", () => {
    const leads = [
      makeLead({ id: "pilot-aktywny", status: "pilot_aktywny" }),
      makeLead({ id: "pilot-umowiony", status: "pilot_umowiony" }),
      makeLead({ id: "zwykly", status: "analiza_potrzeb" }),
    ];
    expect(outboundQueue(leads, [], now).map((i) => i.lead.id)).toEqual(["zwykly"]);
  });

  it("lead z PRZYSZŁYM next_action_at wypada; dzisiejszy i przeszły zostaje", () => {
    const leads = [
      makeLead({ id: "przyszly", next_action_at: "2026-01-21T09:00:00Z" }),
      makeLead({ id: "dzis", next_action_at: "2026-01-20T09:00:00Z" }),
      makeLead({ id: "przeszly", next_action_at: "2026-01-10T09:00:00Z" }),
      makeLead({ id: "bez-planu", next_action_at: null }),
    ];
    const ids = outboundQueue(leads, [], now).map((i) => i.lead.id);
    expect(ids.sort()).toEqual(["bez-planu", "dzis", "przeszly"]);
  });

  it("granica dnia liczona po warszawsku, nie po UTC", () => {
    // 2026-01-20T23:30Z to już 2026-01-21 00:30 w Warszawie -> przyszłość.
    const jutroPoWarszawsku = makeLead({ id: "jutro-pl", next_action_at: "2026-01-20T23:30:00Z" });
    // 2026-01-19T23:30Z to 2026-01-20 00:30 w Warszawie -> dziś.
    const dzisPoWarszawsku = makeLead({ id: "dzis-pl", next_action_at: "2026-01-19T23:30:00Z" });
    const ids = outboundQueue([jutroPoWarszawsku, dzisPoWarszawsku], [], now).map((i) => i.lead.id);
    expect(ids).toEqual(["dzis-pl"]);
  });

  it("bez żadnej aktywności sekwencyjnej sugeruje pierwszy krok sekwencji", () => {
    const zIg = makeLead({ id: "z-ig", instagram: "@kawiarnia" });
    const bezIg = makeLead({ id: "bez-ig", instagram: null });
    const items = outboundQueue([zIg, bezIg], [], now);
    const byId = new Map(items.map((i) => [i.lead.id, i]));

    expect(byId.get("z-ig")!.suggestedStep).toBe("ig_dm");
    expect(byId.get("z-ig")!.suggestedStep).toBe(OUTBOUND_SEQUENCE[0]);
    expect(byId.get("z-ig")!.attempts).toBe(0);
    expect(byId.get("z-ig")!.lastTouch).toBeNull();

    // Bez konta na Instagramie sekwencja pomija oba kroki DM.
    expect(byId.get("bez-ig")!.suggestedStep).toBe("telefon");
  });

  it("z Instagramem sekwencja idzie ig_dm -> ig_followup -> telefon -> wizyta", () => {
    const cases: Array<[CrmActivity["type"], string]> = [
      ["ig_dm", "ig_followup"],
      ["ig_followup", "telefon"],
      ["telefon", "wizyta"],
    ];
    for (const [ostatni, oczekiwany] of cases) {
      const lead = makeLead({ instagram: "@x" });
      const items = outboundQueue(
        [lead],
        [makeActivity({ lead_id: lead.id, type: ostatni, happened_at: "2026-01-10T10:00:00Z" })],
        now,
      );
      expect(items[0].suggestedStep).toBe(oczekiwany);
    }
  });

  it("po wizycie zostaje wizyta — dalej decyduje człowiek", () => {
    const lead = makeLead({ instagram: "@x" });
    const items = outboundQueue(
      [lead],
      [makeActivity({ lead_id: lead.id, type: "wizyta", happened_at: "2026-01-10T10:00:00Z" })],
      now,
    );
    expect(items[0].suggestedStep).toBe("wizyta");
  });

  it("lead bez Instagrama po telefonie dostaje wizytę", () => {
    const lead = makeLead({ instagram: null });
    const items = outboundQueue(
      [lead],
      [makeActivity({ lead_id: lead.id, type: "telefon", happened_at: "2026-01-10T10:00:00Z" })],
      now,
    );
    expect(items[0].suggestedStep).toBe("wizyta");
  });

  it("lead bez Instagrama z historycznym DM-em dostaje telefon, nie wizytę", () => {
    // Krok spoza skróconej sekwencji (np. DM, gdy lead stracił Instagrama)
    // zaczyna sekwencję leada od początku — najpierw telefon, dopiero potem
    // jazda w teren.
    const lead = makeLead({ instagram: null });
    const items = outboundQueue(
      [lead],
      [makeActivity({ lead_id: lead.id, type: "ig_dm", happened_at: "2026-01-10T10:00:00Z" })],
      now,
    );
    expect(items[0].suggestedStep).toBe("telefon");
    expect(items[0].attempts).toBe(1);
  });

  it("attempts liczy tylko kroki sekwencji; notatka i demo są ignorowane", () => {
    const lead = makeLead({ id: "L", instagram: "@x" });
    const activities = [
      makeActivity({ lead_id: "L", type: "ig_dm", happened_at: "2026-01-05T10:00:00Z" }),
      makeActivity({ lead_id: "L", type: "ig_followup", happened_at: "2026-01-10T10:00:00Z" }),
      makeActivity({ lead_id: "L", type: "notatka", happened_at: "2026-01-18T10:00:00Z" }),
      makeActivity({ lead_id: "L", type: "demo", happened_at: "2026-01-19T10:00:00Z" }),
    ];
    const item = outboundQueue([lead], activities, now)[0];
    expect(item.attempts).toBe(2);
    // lastTouch to najnowsza aktywność SEKWENCYJNA, nie najnowsza w ogóle.
    expect(item.lastTouch).toBe("2026-01-10T10:00:00Z");
    expect(item.suggestedStep).toBe("telefon");
  });

  it("lastTouch bierze najnowszą aktywność sekwencyjną niezależnie od kolejności wejścia", () => {
    const lead = makeLead({ id: "L2", instagram: "@x" });
    const activities = [
      makeActivity({ lead_id: "L2", type: "telefon", happened_at: "2026-01-12T10:00:00Z" }),
      makeActivity({ lead_id: "L2", type: "ig_dm", happened_at: "2026-01-02T10:00:00Z" }),
    ];
    const item = outboundQueue([lead], activities, now)[0];
    expect(item.lastTouch).toBe("2026-01-12T10:00:00Z");
    expect(item.attempts).toBe(2);
    expect(item.suggestedStep).toBe("wizyta");
  });

  it("bez aktywności sekwencyjnych lastTouch spada na last_activity_at leada", () => {
    const lead = makeLead({
      id: "L3",
      instagram: "@x",
      last_activity_at: "2026-01-15T10:00:00Z",
    });
    const item = outboundQueue(
      [lead],
      [makeActivity({ lead_id: "L3", type: "notatka", happened_at: "2026-01-18T10:00:00Z" })],
      now,
    )[0];
    expect(item.attempts).toBe(0);
    expect(item.lastTouch).toBe("2026-01-15T10:00:00Z");
    expect(item.suggestedStep).toBe("ig_dm");
  });

  it("aktywności bez lead_id oraz cudze aktywności nie wpływają na lead", () => {
    const lead = makeLead({ id: "moj", instagram: "@x" });
    const activities = [
      makeActivity({ lead_id: null, type: "ig_dm", happened_at: "2026-01-10T10:00:00Z" }),
      makeActivity({ lead_id: "obcy", type: "telefon", happened_at: "2026-01-11T10:00:00Z" }),
    ];
    const item = outboundQueue([lead], activities, now)[0];
    expect(item.attempts).toBe(0);
    expect(item.suggestedStep).toBe("ig_dm");
  });

  it("sortuje priorytetem A->D, a wewnątrz priorytetu najdłużej nietykane najpierw", () => {
    const leads = [
      makeLead({ id: "D-nietkniety", priority: "D" }),
      makeLead({ id: "B-nowszy", priority: "B", last_activity_at: "2026-01-15T10:00:00Z" }),
      makeLead({ id: "B-starszy", priority: "B", last_activity_at: "2026-01-05T10:00:00Z" }),
      makeLead({ id: "B-nietkniety", priority: "B" }),
      makeLead({ id: "A-nowszy", priority: "A", last_activity_at: "2026-01-18T10:00:00Z" }),
      makeLead({ id: "C-nietkniety", priority: "C" }),
    ];
    expect(outboundQueue(leads, [], now).map((i) => i.lead.id)).toEqual([
      "A-nowszy",
      "B-nietkniety",
      "B-starszy",
      "B-nowszy",
      "C-nietkniety",
      "D-nietkniety",
    ]);
  });

  it("kolejność w ramach priorytetu bierze pod uwagę aktywności sekwencyjne", () => {
    const stary = makeLead({ id: "stary-kontakt", priority: "A" });
    const swiezy = makeLead({ id: "swiezy-kontakt", priority: "A" });
    const activities = [
      makeActivity({ lead_id: "stary-kontakt", type: "ig_dm", happened_at: "2026-01-02T10:00:00Z" }),
      makeActivity({ lead_id: "swiezy-kontakt", type: "ig_dm", happened_at: "2026-01-19T10:00:00Z" }),
    ];
    expect(outboundQueue([swiezy, stary], activities, now).map((i) => i.lead.id)).toEqual([
      "stary-kontakt",
      "swiezy-kontakt",
    ]);
  });

  it("pusta lista leadów -> pusta kolejka", () => {
    expect(outboundQueue([], [], now)).toEqual([]);
  });
});
