// Testy allowlisty SZTAB (isStaffUser / staffEmails). Zero obejść: każdy
// warunek (e-mail potwierdzony, na liście, opcjonalnie właściwe ID) musi
// być spełniony jednocześnie — to jedyna bramka dostępu do prywatnej części.
import { afterEach, describe, expect, it, vi } from "vitest";
import { isStaffUser, staffEmails } from "@/lib/auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("staffEmails", () => {
  it("rozbija listę z env, trimuje i lowercase'uje", () => {
    vi.stubEnv("STAFF_EMAILS", " Adam@X.pl , oliwier@x.pl ,,");
    expect(staffEmails()).toEqual(["adam@x.pl", "oliwier@x.pl"]);
  });

  it("brak zmiennej env -> pusta lista", () => {
    vi.stubEnv("STAFF_EMAILS", undefined);
    expect(staffEmails()).toEqual([]);
  });
});

describe("isStaffUser", () => {
  const confirmedListed = {
    id: "11111111-1111-1111-1111-111111111111",
    email: "adam@x.pl",
    email_confirmed_at: "2026-01-01T00:00:00Z",
  };

  it("brak użytkownika (null/undefined) -> false", () => {
    vi.stubEnv("STAFF_EMAILS", "adam@x.pl");
    expect(isStaffUser(null)).toBe(false);
    expect(isStaffUser(undefined)).toBe(false);
  });

  it("użytkownik bez e-maila -> false", () => {
    vi.stubEnv("STAFF_EMAILS", "adam@x.pl");
    expect(isStaffUser({ id: "1", email: null, email_confirmed_at: "2026-01-01T00:00:00Z" })).toBe(
      false,
    );
    expect(
      isStaffUser({ id: "1", email: "   ", email_confirmed_at: "2026-01-01T00:00:00Z" }),
    ).toBe(false);
  });

  it("e-mail niepotwierdzony -> false, nawet jeśli jest na liście", () => {
    vi.stubEnv("STAFF_EMAILS", "adam@x.pl");
    expect(isStaffUser({ id: "1", email: "adam@x.pl", email_confirmed_at: null })).toBe(false);
  });

  it("e-mail potwierdzony, ale spoza listy -> false", () => {
    vi.stubEnv("STAFF_EMAILS", "oliwier@x.pl");
    expect(isStaffUser(confirmedListed)).toBe(false);
  });

  it("pusta lista STAFF_EMAILS -> false nawet dla poprawnego konta", () => {
    vi.stubEnv("STAFF_EMAILS", "");
    expect(isStaffUser(confirmedListed)).toBe(false);
  });

  it("e-mail potwierdzony i na liście, bez STAFF_USER_IDS -> true", () => {
    vi.stubEnv("STAFF_EMAILS", "adam@x.pl");
    vi.stubEnv("STAFF_USER_IDS", undefined);
    expect(isStaffUser(confirmedListed)).toBe(true);
  });

  it("porównanie e-maila jest niewrażliwe na wielkość liter i białe znaki", () => {
    vi.stubEnv("STAFF_EMAILS", "adam@x.pl");
    expect(
      isStaffUser({
        id: "1",
        email: "  Adam@X.pl  ",
        email_confirmed_at: "2026-01-01T00:00:00Z",
      }),
    ).toBe(true);
  });

  it("STAFF_USER_IDS ustawione na inny UUID -> false mimo poprawnego e-maila", () => {
    vi.stubEnv("STAFF_EMAILS", "adam@x.pl");
    vi.stubEnv("STAFF_USER_IDS", "22222222-2222-2222-2222-222222222222");
    expect(isStaffUser(confirmedListed)).toBe(false);
  });

  it("STAFF_USER_IDS zawiera właściwy UUID -> true", () => {
    vi.stubEnv("STAFF_EMAILS", "adam@x.pl");
    vi.stubEnv(
      "STAFF_USER_IDS",
      "22222222-2222-2222-2222-222222222222,11111111-1111-1111-1111-111111111111",
    );
    expect(isStaffUser(confirmedListed)).toBe(true);
  });

  it("STAFF_USER_IDS porównuje ID niewrażliwie na wielkość liter", () => {
    vi.stubEnv("STAFF_EMAILS", "adam@x.pl");
    vi.stubEnv("STAFF_USER_IDS", "11111111-1111-1111-1111-111111111111");
    expect(
      isStaffUser({
        ...confirmedListed,
        id: "11111111-1111-1111-1111-111111111111".toUpperCase(),
      }),
    ).toBe(true);
  });
});
