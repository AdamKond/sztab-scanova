import { describe, expect, it } from "vitest";
import {
  blitzNicheLabel,
  blitzProgress,
  blitzStage,
  countFollowupsDue,
  followupDmText,
  groupBlitzByNiche,
  senderInitial,
  FOLLOWUP_AFTER_DAYS,
  type CrmDmBlitz,
} from "@/lib/crm/blitz";

function row(over: Partial<CrmDmBlitz>): CrmDmBlitz {
  return {
    id: over.instagram ?? "x",
    name: "Lokal",
    city: "Lublin",
    niche: "pizza",
    instagram: "lokal",
    followers: null,
    dm_text: "Cześć!",
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
  const day = 86_400_000;

  it("niewysłany to todo", () => {
    expect(blitzStage(row({}), now)).toBe("todo");
  });

  it("cisza krótsza niż próg to waiting", () => {
    expect(blitzStage(row({ sent_at: sentAt }), now + (FOLLOWUP_AFTER_DAYS - 1) * day)).toBe(
      "waiting",
    );
  });

  it("cisza równa progowi otwiera follow-up", () => {
    expect(blitzStage(row({ sent_at: sentAt }), now + FOLLOWUP_AFTER_DAYS * day)).toBe(
      "followup_due",
    );
  });

  it("wysłany follow-up wycisza kolejkę", () => {
    expect(
      blitzStage(
        row({ sent_at: sentAt, followup_sent_at: "2026-09-14T10:00:00Z" }),
        now + 10 * day,
      ),
    ).toBe("followed_up");
  });

  it("lead_id wygrywa ze wszystkim — odpowiedź kończy lejek wysyłki", () => {
    expect(blitzStage(row({ sent_at: sentAt, lead_id: "L1" }), now + 30 * day)).toBe("in_crm");
  });
});

describe("countFollowupsDue", () => {
  it("liczy tylko wiersze z otwartym follow-upem", () => {
    const sentAt = "2026-09-10T10:00:00Z";
    const now = Date.parse(sentAt) + (FOLLOWUP_AFTER_DAYS + 1) * 86_400_000;
    expect(
      countFollowupsDue(
        [
          row({ instagram: "a", sent_at: sentAt }),
          row({ instagram: "b" }),
          row({ instagram: "c", sent_at: sentAt, followup_sent_at: sentAt }),
          row({ instagram: "d", sent_at: sentAt, lead_id: "L1" }),
        ],
        now,
      ),
    ).toBe(1);
  });
});

describe("followupDmText", () => {
  it("personalizuje nazwą lokalu", () => {
    expect(followupDmText(row({ name: "Pizza Lover" }))).toContain("Cześć Pizza Lover!");
  });
});

describe("blitzNicheLabel", () => {
  it("tłumaczy znane nisze i przepuszcza nieznane", () => {
    expect(blitzNicheLabel("cukiernia/lody")).toBe("Cukiernie, lody, piekarnie");
    expect(blitzNicheLabel("ramen bar")).toBe("ramen bar");
  });
});
