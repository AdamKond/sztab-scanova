import { describe, expect, it } from "vitest";
import {
  blitzCounts,
  blitzNicheLabel,
  blitzProgress,
  blitzStage,
  countFollowupsDue,
  dailyQueue,
  firstDmText,
  followupDmText,
  followupQueue,
  groupBlitzByNiche,
  senderInitial,
  sentTodayBy,
  DAILY_DM_LIMIT,
  FOLLOWUP_AFTER_DAYS,
  type CrmDmBlitz,
} from "@/lib/crm/blitz";
import { warsawDateOf } from "@/lib/crm/dates";

function row(over: Partial<CrmDmBlitz>): CrmDmBlitz {
  return {
    id: over.instagram ?? "x",
    name: "Lokal",
    city: "Lublin",
    niche: "pizza",
    instagram: "lokal",
    followers: null,
    dm_text: "",
    campaign: "dm-ig-2026-08",
    sent_at: null,
    sent_by: null,
    followup_sent_at: null,
    followup_sent_by: null,
    lead_id: null,
    created_at: "2026-08-25T00:00:00Z",
    updated_at: "2026-08-25T00:00:00Z",
    ...over,
  };
}

const DAY = 86_400_000;

describe("groupBlitzByNiche", () => {
  it("grupuje w kolejności uderzenia, nie alfabetycznie", () => {
    const groups = groupBlitzByNiche([
      row({ niche: "restauracja", instagram: "a" }),
      row({ niche: "kawiarnia", instagram: "b" }),
      row({ niche: "pizza", instagram: "c" }),
    ]);
    expect(groups.map((g) => g.niche)).toEqual(["pizza", "kawiarnia", "restauracja"]);
  });

  it("w grupie sortuje po followers malejąco, potem po nazwie", () => {
    const groups = groupBlitzByNiche([
      row({ instagram: "a", name: "Bez obserwujących", followers: null }),
      row({ instagram: "b", name: "Duży", followers: 5000 }),
      row({ instagram: "c", name: "Mały", followers: 100 }),
    ]);
    expect(groups[0].rows.map((r) => r.name)).toEqual(["Duży", "Mały", "Bez obserwujących"]);
  });

  it("nieznana nisza ląduje na końcu z surową etykietą, nie znika", () => {
    const groups = groupBlitzByNiche([
      row({ niche: "food truck", instagram: "a" }),
      row({ niche: "pizza", instagram: "b" }),
    ]);
    expect(groups.map((g) => g.niche)).toEqual(["pizza", "food truck"]);
    expect(groups[1].label).toBe("food truck");
  });

  it("liczy wysłane per grupa", () => {
    const groups = groupBlitzByNiche([
      row({ instagram: "a", sent_at: "2026-08-26T10:00:00Z" }),
      row({ instagram: "b" }),
    ]);
    expect(groups[0].sent).toBe(1);
    expect(groups[0].rows).toHaveLength(2);
  });
});

describe("blitzProgress", () => {
  it("zlicza wysłane i całość", () => {
    expect(
      blitzProgress([row({ instagram: "a", sent_at: "2026-08-26T10:00:00Z" }), row({ instagram: "b" })]),
    ).toEqual({ sent: 1, total: 2 });
  });
  it("pusta lista nie wybucha", () => {
    expect(blitzProgress([])).toEqual({ sent: 0, total: 0 });
  });
});

describe("senderInitial", () => {
  it("zwraca inicjał z e-maila", () => {
    expect(senderInitial("absolusq@gmail.com")).toBe("A");
    expect(senderInitial("oli07kepa@gmail.com")).toBe("O");
  });
  it("null i pusty string nie wybuchają", () => {
    expect(senderInitial(null)).toBeNull();
    expect(senderInitial("")).toBeNull();
  });
});

describe("blitzStage", () => {
  const sentAt = "2026-09-10T10:00:00Z";
  const now = Date.parse(sentAt);

  it("niewysłany to todo", () => {
    expect(blitzStage(row({}), now)).toBe("todo");
  });

  it("cisza krótsza niż próg to waiting", () => {
    expect(blitzStage(row({ sent_at: sentAt }), now + (FOLLOWUP_AFTER_DAYS - 1) * DAY)).toBe("waiting");
  });

  it("cisza równa progowi otwiera follow-up", () => {
    expect(blitzStage(row({ sent_at: sentAt }), now + FOLLOWUP_AFTER_DAYS * DAY)).toBe("followup_due");
  });

  it("wysłany follow-up wycisza kolejkę", () => {
    expect(
      blitzStage(row({ sent_at: sentAt, followup_sent_at: "2026-09-14T10:00:00Z" }), now + 10 * DAY),
    ).toBe("followed_up");
  });

  it("lead_id wygrywa ze wszystkim — odpowiedź kończy lejek wysyłki", () => {
    expect(blitzStage(row({ sent_at: sentAt, lead_id: "L1" }), now + 30 * DAY)).toBe("in_crm");
  });
});

describe("countFollowupsDue / followupQueue / blitzCounts", () => {
  const sentAt = "2026-09-10T10:00:00Z";
  const now = Date.parse(sentAt) + (FOLLOWUP_AFTER_DAYS + 1) * DAY;
  const rows = [
    row({ instagram: "a", sent_at: sentAt }),
    row({ instagram: "b" }),
    row({ instagram: "c", sent_at: sentAt, followup_sent_at: sentAt }),
    row({ instagram: "d", sent_at: sentAt, lead_id: "L1" }),
    row({ instagram: "e", sent_at: "2026-09-09T10:00:00Z" }),
  ];

  it("liczy tylko wiersze z otwartym follow-upem", () => {
    expect(countFollowupsDue(rows, now)).toBe(2);
  });

  it("kolejka follow-upów: najdłużej czekające pierwsze", () => {
    expect(followupQueue(rows, now).map((r) => r.instagram)).toEqual(["e", "a"]);
  });

  it("blitzCounts sumuje się do liczby wierszy", () => {
    const c = blitzCounts(rows, now);
    expect(c.todo + c.waiting + c.followup_due + c.followed_up + c.in_crm).toBe(rows.length);
    expect(c.in_crm).toBe(1);
  });
});

describe("teksty DM", () => {
  it("pierwszy DM: bez linku, z darmowym miesiącem, opiniami Google i pytaniem na końcu", () => {
    const text = firstDmText(row({ niche: "pizza" }));
    expect(text.length).toBeLessThan(800);
    expect(text).not.toMatch(/https?:|\.tech|\.pl\b/);
    expect(text).toMatch(/Adam$/);
    expect(text).toContain("za darmo");
    expect(text).toContain("200");
    expect(text).toContain("Google");
    expect(text).not.toMatch(/Świdnik|Lublin/);
    expect(text).toContain("?");
    expect(text).not.toContain("5 minut");
  });

  it("hook z researchu (dm_text = HOOK: ...) zastępuje hook niszy, reszta bez zmian", () => {
    const plain = firstDmText(row({ niche: "pizza" }));
    const custom = firstDmText(row({ niche: "pizza", dm_text: "HOOK: Wasza neapolitańska to legenda na Czubach." }));
    expect(custom).toContain("Cześć! Wasza neapolitańska to legenda na Czubach. Robimy");
    expect(custom).not.toContain("Piątkowa pizza");
    expect(custom.slice(custom.indexOf("Robimy"))).toBe(plain.slice(plain.indexOf("Robimy")));
    // Stary długi tekst z zasiewu (bez prefiksu) jest ignorowany.
    expect(firstDmText(row({ niche: "pizza", dm_text: "Cześć Pizza Lover! Piątkowa..." }))).toBe(plain);
  });

  it("każda nisza z Bazy ma swój hook, nieznana dostaje ogólny", () => {
    const pizza = firstDmText(row({ niche: "pizza" }));
    const cafe = firstDmText(row({ niche: "kawiarnia" }));
    const unknown = firstDmText(row({ niche: "food truck" }));
    expect(pizza).not.toBe(cafe);
    expect(unknown).toBe(firstDmText(row({ niche: "restauracja" })));
  });

  it("follow-up prosi o jedno słowo i zostawia wyjście", () => {
    const text = followupDmText();
    expect(text).toContain("ok");
    expect(text).toContain("nie będę spamować");
  });
});

describe("kolejka na dziś", () => {
  const me = "absolusq@gmail.com";
  const today = "2026-09-21";
  const nowMs = Date.parse("2026-09-21T09:00:00Z");

  it("sentTodayBy liczy tylko moje z dzisiaj", () => {
    const rows = [
      row({ instagram: "a", sent_at: "2026-09-21T07:00:00Z", sent_by: me }),
      row({ instagram: "b", sent_at: "2026-09-21T07:30:00Z", sent_by: "oli@x.pl" }),
      row({ instagram: "c", sent_at: "2026-09-20T07:00:00Z", sent_by: me }),
      row({ instagram: "d", sent_at: "2026-09-21T08:00:00Z", sent_by: "ABSOLUSQ@gmail.com" }),
    ];
    expect(sentTodayBy(rows, me, today, warsawDateOf).map((r) => r.instagram)).toEqual(["a", "d"]);
  });

  it("dailyQueue dopełnia do limitu w porządku uderzenia", () => {
    const rows = [
      row({ instagram: "done", sent_at: "2026-09-21T07:00:00Z", sent_by: me }),
      row({ instagram: "rest", niche: "restauracja", followers: 9000 }),
      row({ instagram: "pizza-small", niche: "pizza", followers: 100 }),
      row({ instagram: "pizza-big", niche: "pizza", followers: 5000 }),
      row({ instagram: "sent-other", sent_at: "2026-09-19T07:00:00Z", sent_by: "oli@x.pl" }),
    ];
    const q = dailyQueue(rows, nowMs, me, today, warsawDateOf, 3);
    expect(q.done.map((r) => r.instagram)).toEqual(["done"]);
    expect(q.next.map((r) => r.instagram)).toEqual(["pizza-big", "pizza-small"]);
  });

  it("po osiągnięciu limitu nie podsuwa kolejnych", () => {
    const rows = Array.from({ length: DAILY_DM_LIMIT }, (_, i) =>
      row({ instagram: `s${i}`, sent_at: "2026-09-21T07:00:00Z", sent_by: me }),
    ).concat([row({ instagram: "todo" })]);
    const q = dailyQueue(rows, nowMs, me, today, warsawDateOf);
    expect(q.done).toHaveLength(DAILY_DM_LIMIT);
    expect(q.next).toHaveLength(0);
  });
});

describe("blitzNicheLabel", () => {
  it("tłumaczy znane nisze i przepuszcza nieznane", () => {
    expect(blitzNicheLabel("cukiernia/lody")).toBe("Cukiernie, lody, piekarnie");
    expect(blitzNicheLabel("ramen bar")).toBe("ramen bar");
  });
});
