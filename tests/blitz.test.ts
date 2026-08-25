import { describe, expect, it } from "vitest";
import {
  blitzNicheLabel,
  blitzProgress,
  groupBlitzByNiche,
  senderInitial,
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

describe("blitzNicheLabel", () => {
  it("tłumaczy znane nisze i przepuszcza nieznane", () => {
    expect(blitzNicheLabel("cukiernia/lody")).toBe("Cukiernie, lody, piekarnie");
    expect(blitzNicheLabel("ramen bar")).toBe("ramen bar");
  });
});
