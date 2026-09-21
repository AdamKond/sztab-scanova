import { describe, expect, it } from "vitest";
import { ALL_STATUSES } from "@/lib/crm/constants";
import {
  conversationsDue,
  isClient,
  isClosed,
  isConversation,
  nextMainStep,
  stepOf,
  MAIN_STEPS,
  STEP_STATUS,
} from "@/lib/crm/steps";
import { warsawDateOf } from "@/lib/crm/dates";
import type { CrmLead } from "@/lib/crm/types";

function lead(over: Partial<CrmLead>): CrmLead {
  return {
    id: over.name ?? "x",
    name: "Lokal",
    normalized_name: "lokal",
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
    source: "ig_dm",
    source_detail: null,
    campaign: null,
    referred_by: null,
    status: "proba_kontaktu",
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
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...over,
  };
}

describe("kroki ↔ statusy", () => {
  it("każdy status bazy ma krok", () => {
    for (const s of ALL_STATUSES) expect(stepOf(s)).toBeTruthy();
  });

  it("krok główny wchodzi w status, który mapuje się z powrotem na ten krok", () => {
    for (const step of MAIN_STEPS) expect(stepOf(STEP_STATUS[step])).toBe(step);
  });

  it("nextMainStep idzie po kolei i kończy się na kliencie", () => {
    expect(nextMainStep("odpisal")).toBe("rozmawia");
    expect(nextMainStep("pilot")).toBe("klient");
    expect(nextMainStep("klient")).toBeNull();
    expect(nextMainStep("pozniej")).toBeNull();
  });

  it("rozmowa, klient i zamknięte są rozłączne", () => {
    for (const s of ALL_STATUSES) {
      const l = lead({ status: s });
      expect([isConversation(l), isClient(l), isClosed(l)].filter(Boolean).length).toBeLessThanOrEqual(1);
    }
    expect(isClient(lead({ status: "pilot_aktywny" }))).toBe(true);
    expect(isConversation(lead({ status: "pilot_aktywny" }))).toBe(false);
    expect(isClosed(lead({ status: "churn" }))).toBe(true);
  });
});

describe("conversationsDue", () => {
  const today = "2026-09-21";

  it("zaległe, potem bez daty, potem dzisiejsze; przyszłe pomija", () => {
    const due = conversationsDue(
      [
        lead({ name: "dzis", next_action_at: "2026-09-21T10:00:00Z" }),
        lead({ name: "bez-daty" }),
        lead({ name: "zalegly", next_action_at: "2026-09-18T10:00:00Z" }),
        lead({ name: "jutro", next_action_at: "2026-09-22T10:00:00Z" }),
        lead({ name: "klient", status: "platny_klient" }),
      ],
      today,
      warsawDateOf,
    );
    expect(due.all.map((l) => l.name)).toEqual(["zalegly", "bez-daty", "dzis"]);
  });

  it("„później” bez daty nie wraca samo, z datą wraca w terminie", () => {
    const due = conversationsDue(
      [
        lead({ name: "pozniej-bez", status: "followup_pozniej" }),
        lead({ name: "pozniej-dzis", status: "followup_pozniej", next_action_at: "2026-09-21T08:00:00Z" }),
      ],
      today,
      warsawDateOf,
    );
    expect(due.all.map((l) => l.name)).toEqual(["pozniej-dzis"]);
  });

  it("pilot z zaległym check-inem też jest do ruszenia", () => {
    const due = conversationsDue(
      [lead({ name: "pilot", status: "pilot_aktywny", next_action_at: "2026-09-10T08:00:00Z" })],
      today,
      warsawDateOf,
    );
    expect(due.overdue.map((l) => l.name)).toEqual(["pilot"]);
  });
});
