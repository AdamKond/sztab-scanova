// Testy pomocników dat — kluczowe są granice stref (Europe/Warsaw vs UTC)
// i granice DST (czas letni/zimowy), bo to najłatwiej popsuć przypadkowym refaktorem.
import { describe, expect, it } from "vitest";
import {
  addDays,
  daysAgoLabel,
  daysBetween,
  daysSince,
  fullDate,
  shortDate,
  shortDateTime,
  warsawDateOf,
  warsawToday,
} from "@/lib/crm/dates";

describe("warsawDateOf", () => {
  it("przesuwa chwilę z lata (CEST, +2) na następny dzień polski", () => {
    // 22:30 UTC + 2h = 00:30 czasu polskiego następnego dnia.
    expect(warsawDateOf("2026-08-09T22:30:00Z")).toBe("2026-08-10");
  });

  it("przesuwa chwilę z zimy (CET, +1) na następny dzień polski", () => {
    // 23:30 UTC + 1h = 00:30 czasu polskiego następnego dnia.
    expect(warsawDateOf("2026-01-15T23:30:00Z")).toBe("2026-01-16");
  });

  it("nie przesuwa dnia, gdy godzina polska nie przekracza północy", () => {
    expect(warsawDateOf("2026-08-09T10:00:00Z")).toBe("2026-08-09");
  });

  it("przyjmuje też obiekt Date, nie tylko string", () => {
    expect(warsawDateOf(new Date("2026-08-09T10:00:00Z"))).toBe("2026-08-09");
  });
});

describe("warsawToday", () => {
  it("zwraca dzień polski dla podanego `now`", () => {
    expect(warsawToday(new Date("2026-08-09T22:30:00Z"))).toBe("2026-08-10");
  });
});

describe("daysBetween", () => {
  it("liczy różnicę w pełnych dniach", () => {
    expect(daysBetween("2026-01-01", "2026-01-05")).toBe(4);
  });

  it("zwraca liczbę ujemną, gdy b jest przed a", () => {
    expect(daysBetween("2026-01-05", "2026-01-01")).toBe(-4);
  });

  it("zwraca 0 dla tego samego dnia", () => {
    expect(daysBetween("2026-01-01", "2026-01-01")).toBe(0);
  });

  it("poprawnie liczy przez granicę zmiany czasu (nie 0.96/1.04 dnia)", () => {
    // Noc z 24 na 25 października 2026 to zmiana z czasu letniego na zimowy.
    expect(daysBetween("2026-10-24", "2026-10-25")).toBe(1);
  });
});

describe("addDays", () => {
  it("dodaje dni w obrębie miesiąca", () => {
    expect(addDays("2026-08-01", 5)).toBe("2026-08-06");
  });

  it("przechodzi przez granicę miesiąca", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("obsługuje wartości ujemne (odejmowanie dni)", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("daysSince", () => {
  it("liczy dni polskie od chwili iso do `now`", () => {
    expect(daysSince("2026-08-01T10:00:00Z", new Date("2026-08-06T10:00:00Z"))).toBe(5);
  });

  it("zwraca 0 dla tej samej chwili", () => {
    const now = new Date("2026-08-06T10:00:00Z");
    expect(daysSince("2026-08-06T10:00:00Z", now)).toBe(0);
  });
});

describe("shortDate / fullDate", () => {
  it("shortDate formatuje YYYY-MM-DD jako DD.MM", () => {
    expect(shortDate("2026-08-12")).toBe("12.08");
  });

  it("shortDate akceptuje pełny ISO i konwertuje na dzień polski", () => {
    expect(shortDate("2026-08-12T10:00:00Z")).toBe("12.08");
  });

  it("fullDate formatuje YYYY-MM-DD jako DD.MM.YYYY", () => {
    expect(fullDate("2026-08-12")).toBe("12.08.2026");
  });

  it("fullDate akceptuje pełny ISO", () => {
    expect(fullDate("2026-08-12T10:00:00Z")).toBe("12.08.2026");
  });
});

describe("shortDateTime", () => {
  it("dokleja godzinę polską do krótkiej daty", () => {
    // 12:30 UTC w sierpniu = 14:30 czasu polskiego (CEST).
    expect(shortDateTime("2026-08-12T12:30:00Z")).toBe("12.08 14:30");
  });
});

describe("daysAgoLabel", () => {
  it("0 dni -> dziś", () => {
    expect(daysAgoLabel(0)).toBe("dziś");
  });

  it("wartości ujemne również traktuje jako dziś", () => {
    expect(daysAgoLabel(-3)).toBe("dziś");
  });

  it("1 dzień -> wczoraj", () => {
    expect(daysAgoLabel(1)).toBe("wczoraj");
  });

  it("więcej dni -> „N dni temu”", () => {
    expect(daysAgoLabel(5)).toBe("5 dni temu");
  });
});
