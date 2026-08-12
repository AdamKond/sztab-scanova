// Testy walidacji: guardy słownikowe, reguły przejść statusów i parsowanie
// pól formularzy (kwoty, daty lokalne Warszawy).
import { describe, expect, it } from "vitest";
import {
  isActivityOutcome,
  isActivityType,
  isCurrentLoyalty,
  isGoalMetric,
  isLeadPriority,
  isLeadSource,
  isLeadStatus,
  isTaskPriority,
  isTaskStatus,
  missingForStatus,
  parseMoney,
  parsePositiveInt,
  validateStatusChange,
  warsawLocalToIso,
} from "@/lib/crm/validation";
import type { CrmLead } from "@/lib/crm/types";

describe("guardy typów słownikowych", () => {
  it("isLeadStatus akceptuje tylko znane statusy", () => {
    expect(isLeadStatus("nowy")).toBe(true);
    expect(isLeadStatus("platny_klient")).toBe(true);
    expect(isLeadStatus("nieznany")).toBe(false);
    expect(isLeadStatus(123)).toBe(false);
  });

  it("isLeadPriority / isLeadSource / isCurrentLoyalty", () => {
    expect(isLeadPriority("A")).toBe(true);
    expect(isLeadPriority("E")).toBe(false);
    expect(isLeadSource("teren")).toBe(true);
    expect(isLeadSource("ulica")).toBe(false);
    expect(isCurrentLoyalty("wallet")).toBe(true);
    expect(isCurrentLoyalty("karta")).toBe(false);
  });

  it("isActivityType / isActivityOutcome", () => {
    expect(isActivityType("wizyta")).toBe(true);
    expect(isActivityType("sms")).toBe(false);
    expect(isActivityOutcome("pilot_start")).toBe(true);
    expect(isActivityOutcome("sukces")).toBe(false);
  });

  it("isTaskStatus / isTaskPriority / isGoalMetric", () => {
    expect(isTaskStatus("zrobione")).toBe(true);
    expect(isTaskStatus("w trakcie")).toBe(false);
    expect(isTaskPriority("wysoki")).toBe(true);
    expect(isTaskPriority("pilny")).toBe(false);
    expect(isGoalMetric("mrr")).toBe(true);
    expect(isGoalMetric("przychod")).toBe(false);
  });
});

describe("missingForStatus", () => {
  it("pilot_aktywny: obie daty wymagane", () => {
    const missing = missingForStatus("pilot_aktywny", {});
    expect(missing).toHaveLength(2);
    expect(missing).toContain("Data startu pilota jest wymagana.");
    expect(missing).toContain("Data końca pilota jest wymagana.");
  });

  it("pilot_aktywny: koniec przed startem to jedyny błąd, gdy obie daty podane", () => {
    const missing = missingForStatus("pilot_aktywny", {
      pilot_started_at: "2026-01-10T00:00:00Z",
      pilot_ends_at: "2026-01-01T00:00:00Z",
    });
    expect(missing).toEqual(["Koniec pilota nie może być przed jego startem."]);
  });

  it("pilot_aktywny: poprawne daty przechodzą bez błędów", () => {
    const missing = missingForStatus("pilot_aktywny", {
      pilot_started_at: "2026-01-01T00:00:00Z",
      pilot_ends_at: "2026-01-10T00:00:00Z",
    });
    expect(missing).toEqual([]);
  });

  it("platny_klient: paid_at, plan i mrr>0 wymagane", () => {
    const missing = missingForStatus("platny_klient", {});
    expect(missing).toContain("Data płatności jest wymagana.");
    expect(missing).toContain("Plan abonamentowy jest wymagany.");
    expect(missing).toContain("Miesięczny przychód (MRR) jest wymagany.");
  });

  it("platny_klient: mrr = 0 to błąd „większy od zera”, nie „wymagany”", () => {
    const missing = missingForStatus("platny_klient", {
      paid_at: "2026-01-01T00:00:00Z",
      plan: "Standard",
      monthly_revenue: 0,
    });
    expect(missing).toEqual(["Miesięczny przychód musi być większy od zera."]);
  });

  it("platny_klient: mrr ujemny również odrzucony", () => {
    const missing = missingForStatus("platny_klient", {
      paid_at: "2026-01-01T00:00:00Z",
      plan: "Standard",
      monthly_revenue: -5,
    });
    expect(missing).toEqual(["Miesięczny przychód musi być większy od zera."]);
  });

  it("platny_klient: komplet danych przechodzi", () => {
    const missing = missingForStatus("platny_klient", {
      paid_at: "2026-01-01T00:00:00Z",
      plan: "Standard",
      monthly_revenue: 199,
    });
    expect(missing).toEqual([]);
  });

  it("utracony: powód wymagany, sam biały znak się nie liczy", () => {
    expect(missingForStatus("utracony", {})).toEqual(["Powód utraty jest wymagany."]);
    expect(missingForStatus("utracony", { lost_reason: "   " })).toEqual([
      "Powód utraty jest wymagany.",
    ]);
    expect(missingForStatus("utracony", { lost_reason: "za drogo" })).toEqual([]);
  });

  it("zdyskwalifikowany: powód dyskwalifikacji wymagany", () => {
    expect(missingForStatus("zdyskwalifikowany", {})).toEqual([
      "Powód dyskwalifikacji jest wymagany.",
    ]);
    expect(
      missingForStatus("zdyskwalifikowany", { disqualification_reason: "za mała firma" }),
    ).toEqual([]);
  });

  it("churn: data rezygnacji i powód wymagane", () => {
    const missing = missingForStatus("churn", {});
    expect(missing).toHaveLength(2);
    expect(missing).toContain("Data rezygnacji jest wymagana.");
    expect(missing).toContain("Powód rezygnacji jest wymagany.");
  });

  it("statusy bez reguł (np. nowy) nie generują braków", () => {
    expect(missingForStatus("nowy", {})).toEqual([]);
  });
});

describe("validateStatusChange", () => {
  const baseLead: Pick<
    CrmLead,
    | "pilot_started_at"
    | "pilot_ends_at"
    | "paid_at"
    | "plan"
    | "monthly_revenue"
    | "churned_at"
    | "lost_reason"
    | "disqualification_reason"
  > = {
    pilot_started_at: null,
    pilot_ends_at: null,
    paid_at: null,
    plan: null,
    monthly_revenue: null,
    churned_at: null,
    lost_reason: null,
    disqualification_reason: null,
  };

  it("scala pola istniejącego leada, gdy formularz nie nadpisuje ich", () => {
    const lead = {
      ...baseLead,
      pilot_started_at: "2026-01-01T00:00:00Z",
      pilot_ends_at: "2026-01-10T00:00:00Z",
    };
    // Formularz nie przysyła żadnych zmian dla dat pilota — mają być wzięte z leada.
    expect(validateStatusChange(lead, "pilot_aktywny", {})).toEqual([]);
  });

  it("jawne null w updates nadpisuje istniejącą wartość leada (czyszczenie pola)", () => {
    const lead = {
      ...baseLead,
      pilot_started_at: "2026-01-01T00:00:00Z",
      pilot_ends_at: "2026-01-10T00:00:00Z",
    };
    const missing = validateStatusChange(lead, "pilot_aktywny", { pilot_ends_at: null });
    expect(missing).toContain("Data końca pilota jest wymagana.");
  });

  it("updates mogą uzupełnić brakujące pole leada", () => {
    const lead = { ...baseLead, plan: "Standard", monthly_revenue: 199 };
    const missing = validateStatusChange(lead, "platny_klient", {
      paid_at: "2026-01-05T00:00:00Z",
    });
    expect(missing).toEqual([]);
  });
});

describe("parseMoney", () => {
  it("przecinek dziesiętny", () => {
    expect(parseMoney("129,99")).toBe(129.99);
  });

  it("kropka dziesiętna", () => {
    expect(parseMoney("129.99")).toBe(129.99);
  });

  it("spacje jako separator tysięcy są usuwane", () => {
    expect(parseMoney("1 200,50")).toBe(1200.5);
  });

  it("wartość ujemna -> null", () => {
    expect(parseMoney("-5")).toBeNull();
  });

  it("pusty string / null -> null", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney(null)).toBeNull();
  });

  it("śmieciowy tekst -> null", () => {
    expect(parseMoney("abc")).toBeNull();
  });
});

describe("parsePositiveInt", () => {
  it("dodatnia liczba całkowita", () => {
    expect(parsePositiveInt("5")).toBe(5);
  });

  it("zero jest dozwolone", () => {
    expect(parsePositiveInt("0")).toBe(0);
  });

  it("liczba ujemna -> null", () => {
    expect(parsePositiveInt("-1")).toBeNull();
  });

  it("liczba niecałkowita -> null", () => {
    expect(parsePositiveInt("3.5")).toBeNull();
  });

  it("pusty string / null -> null", () => {
    expect(parsePositiveInt("")).toBeNull();
    expect(parsePositiveInt(null)).toBeNull();
  });
});

describe("warsawLocalToIso", () => {
  it("lato (CEST, +2): datetime-local -> ISO UTC", () => {
    expect(warsawLocalToIso("2026-07-01T12:00")).toBe("2026-07-01T10:00:00.000Z");
  });

  it("zima (CET, +1): datetime-local -> ISO UTC", () => {
    expect(warsawLocalToIso("2026-01-15T12:00")).toBe("2026-01-15T11:00:00.000Z");
  });

  it("sama data (bez godziny) -> północ warszawska w UTC", () => {
    // 00:00 czasu polskiego w sierpniu (CEST, +2) to 22:00 UTC dnia poprzedniego.
    expect(warsawLocalToIso("2026-08-12")).toBe("2026-08-11T22:00:00.000Z");
  });

  it("pusty string / null -> null", () => {
    expect(warsawLocalToIso("")).toBeNull();
    expect(warsawLocalToIso(null)).toBeNull();
  });

  it("nierozpoznany format -> null", () => {
    expect(warsawLocalToIso("nie-data")).toBeNull();
  });
});
