// Testy normalizacji danych wejściowych — jedno miejsce, z którego korzystają
// formularze, server actions i import CSV. Sprawdzamy warianty, które w
// praktyce przychodzą od sprzedawców z terenu (spacje, wielkie litery, URL-e).
import { describe, expect, it } from "vitest";
import {
  clampText,
  normalizeDomain,
  normalizeGoogleRating,
  normalizeInstagram,
  normalizeName,
  normalizePhone,
  normalizeWww,
} from "@/lib/crm/normalize";

describe("normalizeName", () => {
  it("przycina, obniża wielkość liter i zwija wielokrotne spacje", () => {
    expect(normalizeName("  Costa   Coffee  ")).toBe("costa coffee");
  });

  it("usuwa końcową interpunkcję", () => {
    expect(normalizeName("Costa Coffee!!")).toBe("costa coffee");
  });

  it("usuwa końcowe myślniki wraz z poprzedzającą spacją, zostawia myślnik w środku", () => {
    expect(normalizeName("Bar - Kawiarnia --")).toBe("bar - kawiarnia");
  });

  it("nie rusza interpunkcji w środku nazwy", () => {
    expect(normalizeName("U Kowalskiego, Sushi & Grill")).toBe("u kowalskiego, sushi & grill");
  });
});

describe("normalizeInstagram", () => {
  it("wyciąga handle z pełnego URL-a", () => {
    expect(normalizeInstagram("https://instagram.com/costacoffee/")).toBe("costacoffee");
  });

  it("wyciąga handle z URL-a z www i query stringiem", () => {
    expect(normalizeInstagram("https://www.instagram.com/costa.coffee?hl=pl")).toBe(
      "costa.coffee",
    );
  });

  it("usuwa wiodące @", () => {
    expect(normalizeInstagram("@CostaCoffee")).toBe("costacoffee");
  });

  it("usuwa końcowy slash bez URL-a", () => {
    expect(normalizeInstagram("costacoffee/")).toBe("costacoffee");
  });

  it("null/undefined/pusty string -> null", () => {
    expect(normalizeInstagram(null)).toBeNull();
    expect(normalizeInstagram(undefined)).toBeNull();
    expect(normalizeInstagram("")).toBeNull();
  });
});

describe("normalizePhone", () => {
  it("dziewięciocyfrowy numer bez prefiksu dostaje +48", () => {
    expect(normalizePhone("512 345 678")).toBe("+48512345678");
  });

  it("prefiks 00 zamienia na +", () => {
    expect(normalizePhone("0048512345678")).toBe("+48512345678");
  });

  it("numer już z +48 zostaje bez zmian", () => {
    expect(normalizePhone("+48512345678")).toBe("+48512345678");
  });

  it("same litery -> null", () => {
    expect(normalizePhone("abc")).toBeNull();
  });

  it("null/undefined -> null", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });
});

describe("normalizeDomain", () => {
  it("usuwa schemat, www i ścieżkę", () => {
    expect(normalizeDomain("https://www.x.pl/menu")).toBe("x.pl");
  });

  it("bez www zostaje subdomena", () => {
    expect(normalizeDomain("https://sub.example.com")).toBe("sub.example.com");
  });

  it("wartość bez kropki (po usunięciu www) -> null", () => {
    expect(normalizeDomain("www.only")).toBeNull();
  });

  it("czysty śmieć bez kropki -> null", () => {
    expect(normalizeDomain("garbage")).toBeNull();
  });

  it("null/undefined -> null", () => {
    expect(normalizeDomain(null)).toBeNull();
    expect(normalizeDomain(undefined)).toBeNull();
  });
});

describe("normalizeWww", () => {
  it("dokleja https:// gdy brak schematu", () => {
    expect(normalizeWww("example.pl")).toBe("https://example.pl");
  });

  it("zostawia istniejący schemat http bez zmian", () => {
    expect(normalizeWww("http://example.pl")).toBe("http://example.pl");
  });

  it("zostawia istniejący schemat https bez zmian", () => {
    expect(normalizeWww("https://example.pl")).toBe("https://example.pl");
  });

  it("null/pusty string -> null", () => {
    expect(normalizeWww(null)).toBeNull();
    expect(normalizeWww("")).toBeNull();
    expect(normalizeWww("   ")).toBeNull();
  });
});

describe("normalizeGoogleRating", () => {
  it("przecinek dziesiętny -> liczba", () => {
    expect(normalizeGoogleRating("4,5")).toBe(4.5);
  });

  it("wartość spoza zakresu 0-5 -> null", () => {
    expect(normalizeGoogleRating("6")).toBeNull();
    expect(normalizeGoogleRating("-1")).toBeNull();
  });

  it("zaokrągla do jednego miejsca po przecinku", () => {
    expect(normalizeGoogleRating("4.567")).toBe(4.6);
  });

  it("0 jest wartością poprawną", () => {
    expect(normalizeGoogleRating("0")).toBe(0);
    expect(normalizeGoogleRating(0)).toBe(0);
  });

  it("null/undefined/pusty string -> null", () => {
    expect(normalizeGoogleRating(null)).toBeNull();
    expect(normalizeGoogleRating(undefined)).toBeNull();
    expect(normalizeGoogleRating("")).toBeNull();
  });

  it("wartość liczbowa przekazana bezpośrednio też działa", () => {
    expect(normalizeGoogleRating(4.5)).toBe(4.5);
  });
});

describe("clampText", () => {
  it("przycina tekst dłuższy niż limit", () => {
    expect(clampText("a".repeat(10), 5)).toBe("aaaaa");
  });

  it("nie rusza tekstu krótszego niż limit", () => {
    expect(clampText("krótki", 100)).toBe("krótki");
  });

  it("przycina białe znaki na brzegach przed sprawdzeniem długości", () => {
    expect(clampText("  spacje  ", 100)).toBe("spacje");
  });

  it("null/undefined/pusty (po trim) -> null", () => {
    expect(clampText(null, 10)).toBeNull();
    expect(clampText(undefined, 10)).toBeNull();
    expect(clampText("   ", 10)).toBeNull();
  });
});
