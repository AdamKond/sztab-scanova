// Testy metryk sprzedażowych — czyste funkcje na fiksturach w pamięci.
// Fikstury budujemy fabrykami z sensownymi wartościami domyślnymi, żeby
// każdy test nadpisywał tylko pola istotne dla sprawdzanego zachowania.
import { describe, expect, it } from "vitest";
import { FUNNEL_ORDER } from "@/lib/crm/constants";
import {
  activitiesByPerson,
  average,
  computeMrr,
  conversionBetween,
  daysToPaid,
  followupBuckets,
  goalProgress,
  leadsWithoutNextStep,
  lossReasons,
  median,
  pilotsEndingSoon,
  pilotsNeedingCheckin,
  reachedAtLeast,
  resultsBySource,
  staleLeads,
  stageConversions,
  stuckLeads,
  timeInStages,
  winRate,
} from "@/lib/crm/metrics";
import type {
  CrmActivity,
  CrmLead,
  CrmStageHistory,
  SalesGoal,
} from "@/lib/crm/types";

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

function makeHistory(overrides: Partial<CrmStageHistory> = {}): CrmStageHistory {
  return {
    id: nextId("hist"),
    lead_id: "lead-1",
    from_status: null,
    to_status: "nowy",
    changed_by: null,
    changed_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeGoal(overrides: Partial<SalesGoal> = {}): SalesGoal {
  return {
    id: nextId("goal"),
    name: "Cel testowy",
    metric: "aktywnosci",
    target_value: 1,
    starts_on: "2026-01-01",
    ends_on: "2026-01-31",
    owner: null,
    active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("median / average", () => {
  it("pusta tablica -> null", () => {
    expect(median([])).toBeNull();
    expect(average([])).toBeNull();
  });

  it("median dla nieparzystej liczby elementów", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("median dla parzystej liczby elementów to średnia dwóch środkowych", () => {
    expect(median([1, 3])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });

  it("average liczy średnią arytmetyczną", () => {
    expect(average([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("computeMrr", () => {
  it("liczy MRR wyłącznie płatnych klientów, pomija churn", () => {
    const leads = [
      makeLead({ status: "platny_klient", monthly_revenue: 100 }),
      // PostgREST potrafi zwrócić numeric jako string — computeMrr musi to skoerować.
      makeLead({ status: "platny_klient", monthly_revenue: "50" as unknown as number }),
      makeLead({ status: "churn", monthly_revenue: 200 }),
      makeLead({ status: "nowy", monthly_revenue: null }),
    ];
    expect(computeMrr(leads)).toBe(150);
  });

  it("pusta lista leadów -> 0", () => {
    expect(computeMrr([])).toBe(0);
  });
});

describe("reachedAtLeast", () => {
  it("lead przeskakujący etap liczy się jako osiągnięcie etapów pominiętych", () => {
    const history = [
      makeHistory({ lead_id: "A", to_status: "nowy", changed_at: "2026-01-01T00:00:00Z" }),
      makeHistory({
        lead_id: "A",
        from_status: "nowy",
        to_status: "demo_umowione",
        changed_at: "2026-01-05T00:00:00Z",
      }),
    ];
    const reached = reachedAtLeast(history);
    expect(reached.get("nowy")?.has("A")).toBe(true);
    expect(reached.get("proba_kontaktu")?.has("A")).toBe(true);
    expect(reached.get("kontakt_zdecydentem")?.has("A")).toBe(true);
    expect(reached.get("analiza_potrzeb")?.has("A")).toBe(true);
    expect(reached.get("demo_umowione")?.has("A")).toBe(true);
    expect(reached.get("demo_wykonane")?.has("A")).toBe(false);
  });

  it("wpisy statusów spoza lejka nie budują zasięgu", () => {
    const history = [
      makeHistory({ lead_id: "B", to_status: "nowy", changed_at: "2026-01-01T00:00:00Z" }),
      makeHistory({
        lead_id: "B",
        from_status: "nowy",
        to_status: "utracony",
        changed_at: "2026-01-02T00:00:00Z",
      }),
    ];
    const reached = reachedAtLeast(history);
    expect(reached.get("nowy")?.has("B")).toBe(true);
    expect(reached.get("proba_kontaktu")?.has("B")).toBe(false);
  });
});

describe("stageConversions", () => {
  it("null gdy brak danych (pusta historia)", () => {
    const rows = stageConversions([]);
    expect(rows).toHaveLength(FUNNEL_ORDER.length - 1);
    for (const row of rows) {
      expect(row.fromCount).toBe(0);
      expect(row.toCount).toBe(0);
      expect(row.rate).toBeNull();
    }
  });

  it("liczy współczynnik konwersji między sąsiednimi etapami", () => {
    const history = [
      makeHistory({ lead_id: "A", to_status: "nowy" }),
      makeHistory({ lead_id: "B", to_status: "nowy" }),
      makeHistory({ lead_id: "A", from_status: "nowy", to_status: "proba_kontaktu" }),
    ];
    const rows = stageConversions(history);
    const nowyToProba = rows.find((r) => r.from === "nowy" && r.to === "proba_kontaktu");
    expect(nowyToProba).toEqual({
      from: "nowy",
      to: "proba_kontaktu",
      fromCount: 2,
      toCount: 1,
      rate: 0.5,
    });
  });
});

describe("conversionBetween", () => {
  it("liczy konwersję demo_wykonane -> pilot_aktywny", () => {
    const history = [
      makeHistory({ lead_id: "A", to_status: "demo_wykonane" }),
      makeHistory({ lead_id: "B", to_status: "demo_wykonane" }),
      makeHistory({ lead_id: "A", from_status: "demo_wykonane", to_status: "pilot_aktywny" }),
    ];
    expect(conversionBetween(history, "demo_wykonane", "pilot_aktywny")).toEqual({
      fromCount: 2,
      toCount: 1,
      rate: 0.5,
    });
  });

  it("brak leadów w mianowniku -> rate null", () => {
    expect(conversionBetween([], "demo_wykonane", "pilot_aktywny")).toEqual({
      fromCount: 0,
      toCount: 0,
      rate: null,
    });
  });
});

describe("timeInStages", () => {
  it("bieżący (otwarty) etap liczy czas do parametru `now`", () => {
    const history = [
      makeHistory({ lead_id: "A", to_status: "nowy", changed_at: "2026-01-01T00:00:00Z" }),
      makeHistory({
        lead_id: "A",
        from_status: "nowy",
        to_status: "proba_kontaktu",
        changed_at: "2026-01-03T00:00:00Z",
      }),
    ];
    const now = new Date("2026-01-08T00:00:00Z");
    const rows = timeInStages(history, now);
    const nowyRow = rows.find((r) => r.status === "nowy")!;
    expect(nowyRow.count).toBe(1);
    expect(nowyRow.avgDays).toBe(2);
    const probaRow = rows.find((r) => r.status === "proba_kontaktu")!;
    expect(probaRow.count).toBe(1);
    expect(probaRow.avgDays).toBe(5);
  });

  it("etap bez żadnych wpisów -> count 0, avg/median null", () => {
    const rows = timeInStages([]);
    for (const row of rows) {
      expect(row.count).toBe(0);
      expect(row.avgDays).toBeNull();
      expect(row.medianDays).toBeNull();
    }
  });
});

describe("daysToPaid", () => {
  it("liczy dni od pierwszego wpisu historii do wejścia w platny_klient", () => {
    const history = [
      makeHistory({ lead_id: "A", to_status: "nowy", changed_at: "2026-01-01T00:00:00Z" }),
      makeHistory({
        lead_id: "A",
        from_status: "oferta",
        to_status: "platny_klient",
        changed_at: "2026-01-11T00:00:00Z",
      }),
      // Lead B nigdy nie zapłacił — nie powinien pojawić się w wyniku.
      makeHistory({ lead_id: "B", to_status: "nowy", changed_at: "2026-01-01T00:00:00Z" }),
    ];
    expect(daysToPaid(history)).toEqual([10]);
  });

  it("brak płacących leadów -> pusta tablica", () => {
    expect(daysToPaid([])).toEqual([]);
  });
});

describe("winRate", () => {
  it("mianownik to won+lost+churned; zdyskwalifikowany nie liczy się", () => {
    const history = [
      makeHistory({ lead_id: "A", to_status: "platny_klient", changed_at: "2026-02-01T10:00:00Z" }),
      makeHistory({ lead_id: "B", to_status: "utracony", changed_at: "2026-02-02T10:00:00Z" }),
      makeHistory({ lead_id: "C", to_status: "churn", changed_at: "2026-02-03T10:00:00Z" }),
      makeHistory({
        lead_id: "D",
        to_status: "zdyskwalifikowany",
        changed_at: "2026-02-04T10:00:00Z",
      }),
    ];
    expect(winRate(history)).toEqual({ won: 1, lost: 1, churned: 1, rate: 1 / 3 });
  });

  it("filtruje po okresie (dzień warszawski)", () => {
    const history = [
      makeHistory({ lead_id: "A", to_status: "platny_klient", changed_at: "2026-02-01T10:00:00Z" }),
      makeHistory({ lead_id: "B", to_status: "utracony", changed_at: "2026-02-02T10:00:00Z" }),
      makeHistory({ lead_id: "C", to_status: "churn", changed_at: "2026-02-03T10:00:00Z" }),
    ];
    expect(winRate(history, "2026-02-01", "2026-02-02")).toEqual({
      won: 1,
      lost: 1,
      churned: 0,
      rate: 0.5,
    });
  });

  it("pusta historia -> rate null", () => {
    expect(winRate([])).toEqual({ won: 0, lost: 0, churned: 0, rate: null });
  });
});

describe("staleLeads", () => {
  const now = new Date("2026-01-20T12:00:00Z");

  it("pomija leady z przyszłym next_action_at, liczy tylko otwarte, fallback na created_at", () => {
    const stale1 = makeLead({
      id: "stale-created",
      status: "nowy",
      last_activity_at: null,
      created_at: "2026-01-10T00:00:00Z",
    });
    const fresh = makeLead({
      id: "fresh",
      status: "nowy",
      last_activity_at: "2026-01-18T00:00:00Z",
    });
    const futureFollowup = makeLead({
      id: "future-followup",
      status: "nowy",
      next_action_at: "2026-01-25T00:00:00Z",
      last_activity_at: "2026-01-01T00:00:00Z",
    });
    const closed = makeLead({
      id: "closed",
      status: "utracony",
      last_activity_at: "2026-01-01T00:00:00Z",
    });
    const stale2 = makeLead({
      id: "stale-activity",
      status: "proba_kontaktu",
      last_activity_at: "2026-01-05T00:00:00Z",
    });

    const result = staleLeads([stale1, fresh, futureFollowup, closed, stale2], 5, now);
    expect(result.map((l) => l.id)).toEqual(["stale-activity", "stale-created"]);
  });
});

describe("leadsWithoutNextStep", () => {
  it("tylko otwarte leady bez zaplanowanego next_action_at", () => {
    const withStep = makeLead({ id: "with", status: "nowy", next_action_at: "2026-01-25T00:00:00Z" });
    const withoutStep = makeLead({ id: "without", status: "nowy", next_action_at: null });
    const closedWithout = makeLead({ id: "closed", status: "utracony", next_action_at: null });
    const result = leadsWithoutNextStep([withStep, withoutStep, closedWithout]);
    expect(result.map((l) => l.id)).toEqual(["without"]);
  });
});

describe("followupBuckets", () => {
  const now = new Date("2026-01-20T12:00:00Z");

  it("dzieli na zaległe i dzisiejsze, pomija przyszłe i zamknięte leady", () => {
    const overdue = makeLead({
      id: "overdue",
      status: "nowy",
      next_action_at: "2026-01-15T00:00:00Z",
    });
    const today = makeLead({
      id: "today",
      status: "nowy",
      next_action_at: "2026-01-20T06:00:00Z",
    });
    const future = makeLead({
      id: "future",
      status: "nowy",
      next_action_at: "2026-01-25T00:00:00Z",
    });
    const closed = makeLead({
      id: "closed",
      status: "utracony",
      next_action_at: "2026-01-15T00:00:00Z",
    });
    const noNextAction = makeLead({ id: "none", status: "nowy", next_action_at: null });

    const result = followupBuckets([overdue, today, future, closed, noNextAction], now);
    expect(result.overdue.map((l) => l.id)).toEqual(["overdue"]);
    expect(result.today.map((l) => l.id)).toEqual(["today"]);
  });
});

describe("pilotsEndingSoon", () => {
  const now = new Date("2026-01-20T12:00:00Z");

  it("obejmuje piloty kończące się w oknie ORAZ już przeterminowane (ujemne)", () => {
    const soon = makeLead({
      id: "soon",
      status: "pilot_aktywny",
      pilot_ends_at: "2026-01-25T00:00:00Z",
    });
    const overdue = makeLead({
      id: "overdue",
      status: "pilot_aktywny",
      pilot_ends_at: "2026-01-10T00:00:00Z",
    });
    const far = makeLead({
      id: "far",
      status: "pilot_aktywny",
      pilot_ends_at: "2026-02-10T00:00:00Z",
    });
    const notPilot = makeLead({
      id: "not-pilot",
      status: "platny_klient",
      pilot_ends_at: "2026-01-21T00:00:00Z",
    });
    const noEndDate = makeLead({ id: "no-end", status: "pilot_aktywny", pilot_ends_at: null });

    const result = pilotsEndingSoon([soon, overdue, far, notPilot, noEndDate], 7, now);
    expect(result.map((l) => l.id)).toEqual(["overdue", "soon"]);
  });
});

describe("pilotsNeedingCheckin", () => {
  const now = new Date("2026-01-20T12:00:00Z");

  it("aktywność pilot_checkin resetuje zegar; bez check-inu liczy od startu pilota", () => {
    const withRecentCheckin = makeLead({
      id: "A",
      status: "pilot_aktywny",
      pilot_started_at: "2026-01-01T00:00:00Z",
    });
    const withoutCheckin = makeLead({
      id: "B",
      status: "pilot_aktywny",
      pilot_started_at: "2026-01-01T00:00:00Z",
    });
    const activities = [
      makeActivity({
        lead_id: "A",
        type: "pilot_checkin",
        happened_at: "2026-01-05T00:00:00Z",
      }),
      // Wpis późniejszy powinien wygrać jako "ostatni" check-in.
      makeActivity({
        lead_id: "A",
        type: "pilot_checkin",
        happened_at: "2026-01-18T00:00:00Z",
      }),
    ];
    const result = pilotsNeedingCheckin([withRecentCheckin, withoutCheckin], activities, 7, now);
    expect(result.map((l) => l.id)).toEqual(["B"]);
  });
});

describe("resultsBySource", () => {
  it("agreguje lejek i MRR per źródło", () => {
    const leadTerenContact = makeLead({ id: "L1", source: "teren", status: "kontakt_zdecydentem" });
    const leadTerenPaid = makeLead({
      id: "L2",
      source: "teren",
      status: "platny_klient",
      monthly_revenue: 300,
    });
    const leadIgDemo = makeLead({ id: "L3", source: "ig_dm", status: "demo_wykonane" });
    const leadIgNew = makeLead({ id: "L4", source: "ig_dm", status: "nowy" });

    const history = [
      makeHistory({ lead_id: "L1", to_status: "nowy" }),
      makeHistory({ lead_id: "L1", from_status: "nowy", to_status: "kontakt_zdecydentem" }),
      makeHistory({ lead_id: "L2", to_status: "nowy" }),
      makeHistory({ lead_id: "L2", from_status: "nowy", to_status: "kontakt_zdecydentem" }),
      makeHistory({ lead_id: "L2", from_status: "kontakt_zdecydentem", to_status: "demo_wykonane" }),
      makeHistory({ lead_id: "L2", from_status: "demo_wykonane", to_status: "pilot_aktywny" }),
      makeHistory({ lead_id: "L2", from_status: "pilot_aktywny", to_status: "platny_klient" }),
      makeHistory({ lead_id: "L3", to_status: "nowy" }),
      makeHistory({ lead_id: "L3", from_status: "nowy", to_status: "demo_wykonane" }),
      makeHistory({ lead_id: "L4", to_status: "nowy" }),
    ];

    const rows = resultsBySource(
      [leadTerenContact, leadTerenPaid, leadIgDemo, leadIgNew],
      history,
    );
    const teren = rows.find((r) => r.source === "teren")!;
    const igDm = rows.find((r) => r.source === "ig_dm")!;

    expect(teren).toEqual({
      source: "teren",
      total: 2,
      decisionMakerContacts: 2,
      demosDone: 1,
      pilots: 1,
      paid: 1,
      mrr: 300,
    });
    // L3 osiągnął demo_wykonane, co licząc "co najmniej" pociąga za sobą kontakt_zdecydentem.
    expect(igDm).toEqual({
      source: "ig_dm",
      total: 2,
      decisionMakerContacts: 1,
      demosDone: 1,
      pilots: 0,
      paid: 0,
      mrr: 0,
    });
  });
});

describe("activitiesByPerson", () => {
  it("filtruje po okresie i grupuje po zlowercase'owanym e-mailu", () => {
    const activities = [
      makeActivity({ created_by: "Adam@X.pl", type: "wizyta", happened_at: "2026-01-05T10:00:00Z" }),
      makeActivity({ created_by: "adam@x.pl", type: "telefon", happened_at: "2026-01-06T10:00:00Z" }),
      makeActivity({ created_by: "oliwier@x.pl", type: "wizyta", happened_at: "2026-01-10T10:00:00Z" }),
      // Poza okresem — nie powinien być liczony.
      makeActivity({ created_by: "adam@x.pl", type: "wizyta", happened_at: "2026-02-01T10:00:00Z" }),
    ];
    const rows = activitiesByPerson(activities, "2026-01-01", "2026-01-31");
    expect(rows).toEqual([
      { person: "adam@x.pl", total: 2, byType: { wizyta: 1, telefon: 1 } },
      { person: "oliwier@x.pl", total: 1, byType: { wizyta: 1 } },
    ]);
  });
});

describe("lossReasons", () => {
  it("zlicza powody utraty (utracony+churn) i dyskwalifikacji osobno", () => {
    const leads = [
      makeLead({ status: "utracony", lost_reason: "za drogo" }),
      makeLead({ status: "utracony", lost_reason: "za drogo" }),
      makeLead({ status: "churn", lost_reason: "za drogo" }),
      makeLead({ status: "utracony", lost_reason: null }),
      makeLead({ status: "zdyskwalifikowany", disqualification_reason: "zła lokalizacja" }),
    ];
    const result = lossReasons(leads);
    expect(result.lost).toEqual([{ reason: "za drogo", count: 3 }]);
    expect(result.disqualified).toEqual([{ reason: "zła lokalizacja", count: 1 }]);
  });
});

describe("goalProgress", () => {
  it("aktywnosci: liczy aktywności w okresie z pominięciem notatek", () => {
    const activities = [
      makeActivity({ type: "wizyta", happened_at: "2026-01-05T00:00:00Z" }),
      makeActivity({ type: "notatka", happened_at: "2026-01-06T00:00:00Z" }),
      makeActivity({ type: "telefon", happened_at: "2026-01-07T00:00:00Z" }),
      makeActivity({ type: "wizyta", happened_at: "2026-02-05T00:00:00Z" }),
    ];
    const goal = makeGoal({ metric: "aktywnosci", target_value: 4 });
    const result = goalProgress(goal, { leads: [], activities, history: [] });
    expect(result.actual).toBe(2);
    expect(result.progress).toBe(0.5);
  });

  it("kontakty_z_decydentem: unikalne leady wchodzące w etap w okresie", () => {
    const history = [
      makeHistory({ lead_id: "A", to_status: "kontakt_zdecydentem", changed_at: "2026-01-05T00:00:00Z" }),
      makeHistory({ lead_id: "B", to_status: "kontakt_zdecydentem", changed_at: "2026-01-06T00:00:00Z" }),
      // Duplikat tego samego leada nie powinien liczyć się podwójnie.
      makeHistory({ lead_id: "A", to_status: "kontakt_zdecydentem", changed_at: "2026-01-20T00:00:00Z" }),
    ];
    const goal = makeGoal({ metric: "kontakty_z_decydentem", target_value: 2 });
    const result = goalProgress(goal, { leads: [], activities: [], history });
    expect(result.actual).toBe(2);
    expect(result.progress).toBe(1);
  });

  it("demo: unikalne leady wchodzące w demo_wykonane w okresie", () => {
    const history = [
      makeHistory({ lead_id: "A", to_status: "demo_wykonane", changed_at: "2026-01-05T00:00:00Z" }),
    ];
    const goal = makeGoal({ metric: "demo", target_value: 2 });
    const result = goalProgress(goal, { leads: [], activities: [], history });
    expect(result.actual).toBe(1);
    expect(result.progress).toBe(0.5);
  });

  it("piloty: unikalne leady wchodzące w pilot_aktywny w okresie", () => {
    const history = [
      makeHistory({ lead_id: "A", to_status: "pilot_aktywny", changed_at: "2026-01-05T00:00:00Z" }),
    ];
    const goal = makeGoal({ metric: "piloty", target_value: 1 });
    const result = goalProgress(goal, { leads: [], activities: [], history });
    expect(result.actual).toBe(1);
    expect(result.progress).toBe(1);
  });

  it("platni_klienci: unikalne leady wchodzące w platny_klient w okresie", () => {
    const history = [
      makeHistory({ lead_id: "A", to_status: "platny_klient", changed_at: "2026-01-05T00:00:00Z" }),
    ];
    const goal = makeGoal({ metric: "platni_klienci", target_value: 4 });
    const result = goalProgress(goal, { leads: [], activities: [], history });
    expect(result.actual).toBe(1);
    expect(result.progress).toBe(0.25);
  });

  it("mrr: bieżące MRR, niezależnie od okresu celu", () => {
    const leads = [makeLead({ status: "platny_klient", monthly_revenue: 300 })];
    const goal = makeGoal({ metric: "mrr", target_value: 500 });
    const result = goalProgress(goal, { leads, activities: [], history: [] });
    expect(result.actual).toBe(300);
    expect(result.progress).toBe(0.6);
  });

  it("target 0 -> progress null (bez dzielenia przez zero)", () => {
    const goal = makeGoal({ metric: "aktywnosci", target_value: 0 });
    const result = goalProgress(goal, { leads: [], activities: [], history: [] });
    expect(result.progress).toBeNull();
  });
});

describe("stuckLeads", () => {
  it("zwraca leady zalegające ponad próg, posortowane malejąco po dniach", () => {
    const now = new Date("2026-01-20T12:00:00Z");
    const leadOld = makeLead({ id: "old", status: "nowy", created_at: "2025-12-01T00:00:00Z" });
    const leadStuck = makeLead({ id: "stuck", status: "nowy", created_at: "2026-01-01T00:00:00Z" });
    const leadFresh = makeLead({ id: "fresh", status: "nowy", created_at: "2026-01-15T00:00:00Z" });
    const leadClosed = makeLead({ id: "closed", status: "utracony", created_at: "2025-01-01T00:00:00Z" });

    const history = [
      makeHistory({ lead_id: "old", to_status: "nowy", changed_at: "2025-12-01T00:00:00Z" }),
      makeHistory({ lead_id: "stuck", to_status: "nowy", changed_at: "2026-01-01T00:00:00Z" }),
      makeHistory({ lead_id: "fresh", to_status: "nowy", changed_at: "2026-01-15T00:00:00Z" }),
    ];

    const result = stuckLeads([leadOld, leadStuck, leadFresh, leadClosed], history, 14, now);
    expect(result.map((r) => r.lead.id)).toEqual(["old", "stuck"]);
    expect(result[0].daysInStage).toBeGreaterThan(result[1].daysInStage);
  });
});
