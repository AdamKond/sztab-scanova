import { notFound } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/supabase/auth-server";

// TWARDA ALLOWLISTA.
//
// SZTAB ma dokładnie dwóch użytkowników. Zamiast ról, uprawnień i tabel
// pośrednich trzymamy listę dozwolonych adresów w zmiennych środowiskowych.
// Zaleta: żeby kogoś wpuścić, trzeba mieć dostęp do konfiguracji produkcji —
// samo założenie konta w Supabase Auth nic nie daje.
//
// Zasada nadrzędna: ZERO obejść. Nie ma "superadmina", nie ma flagi
// debugowej, nie ma trybu dev omijającego sprawdzenie. Każde takie
// odstępstwo jest w praktyce backdoorem.

/** Rozbija listę z env na znormalizowane wpisy (bez pustych). */
function parseEnvList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

/** Dozwolone adresy e-mail (STAFF_EMAILS). */
export function staffEmails(): string[] {
  return parseEnvList(process.env.STAFF_EMAILS);
}

/**
 * Dozwolone UUID kont (STAFF_USER_IDS) — druga, mocniejsza warstwa.
 * Pusta lista = warstwa wyłączona (wtedy decyduje sam e-mail).
 */
function staffUserIds(): string[] {
  return parseEnvList(process.env.STAFF_USER_IDS);
}

/**
 * Jedyne miejsce, w którym zapada decyzja "to jest nasz człowiek".
 * Wszystkie warunki muszą być spełnione jednocześnie.
 */
export function isStaffUser(
  user:
    | {
        id: string;
        email?: string | null;
        email_confirmed_at?: string | null;
      }
    | null
    | undefined,
): boolean {
  if (!user) return false;

  const email = user.email?.trim().toLowerCase();
  if (!email) return false;

  // E-mail to atrybut, który użytkownik ustawia sobie sam (rejestracja,
  // updateUser). Bez potwierdzenia ktoś obcy mógłby wpisać nasz adres
  // i wejść na allowlistę. Potwierdzenie jest więc obowiązkowe.
  if (!user.email_confirmed_at) return false;

  const allowedEmails = staffEmails();
  if (allowedEmails.length === 0) return false;
  if (!allowedEmails.includes(email)) return false;

  // Jeśli podano konkretne ID kont, e-mail już nie wystarcza — chroni to
  // przed sytuacją, w której stare konto zostaje skasowane, a ktoś zakłada
  // nowe na ten sam adres.
  const allowedIds = staffUserIds();
  if (allowedIds.length > 0 && !allowedIds.includes(user.id.toLowerCase())) {
    return false;
  }

  return true;
}

/** Zwraca użytkownika tylko wtedy, gdy przechodzi allowlistę. */
export async function getStaffUser(): Promise<User | null> {
  const user = await getCurrentUser();
  return isStaffUser(user) ? user : null;
}

/**
 * Bramka dla layoutów i stron.
 *
 * Świadomie `notFound()` (404), a nie redirect na /login: dla kogoś z zewnątrz
 * ta część aplikacji ma po prostu nie istnieć. Przekierowanie potwierdzałoby,
 * że pod danym adresem coś jest i zapraszało do prób logowania.
 */
export async function requireStaff(): Promise<User> {
  const user = await getStaffUser();
  if (!user) notFound();
  return user;
}

// --- Limit tempa operacji -------------------------------------------------

const RATE_LIMIT_MAX_OPS = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;

// Okno przesuwne w pamięci procesu. Przy dwóch użytkownikach nie ma sensu
// stawiać Redisa — to zabezpieczenie przed zapętloną pętlą w UI albo
// skryptem walącym w Server Action, a nie przed rozproszonym atakiem.
const rateLimitBuckets = new Map<string, number[]>();

function assertWithinRateLimit(key: string): void {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = (rateLimitBuckets.get(key) ?? []).filter(
    (timestamp) => timestamp > windowStart,
  );

  if (recent.length >= RATE_LIMIT_MAX_OPS) {
    // Zapisujemy przyciętą listę, żeby Mapa nie rosła w nieskończoność.
    rateLimitBuckets.set(key, recent);
    throw new Error("RATE_LIMITED");
  }

  recent.push(now);
  rateLimitBuckets.set(key, recent);
}

/**
 * Bramka dla Server Actions i route handlerów.
 *
 * Server Actions to publiczne endpointy HTTP — Next wystawia dla nich stabilne
 * ID, które da się wywołać curl-em bez otwierania naszego UI. Dlatego KAŻDA
 * mutacja zaczyna się od tej funkcji, bez wyjątków.
 *
 * Tu rzucamy wyjątkiem zamiast `notFound()`, bo akcja nie renderuje strony —
 * wywołujący ma dostać czytelny błąd do obsłużenia.
 */
export async function guardStaffAction(): Promise<User> {
  const user = await getStaffUser();
  if (!user) throw new Error("FORBIDDEN");

  // Kluczem jest e-mail, a nie IP: identyfikuje konto, a nie sieć,
  // z której akurat korzysta użytkownik.
  assertWithinRateLimit(user.email?.trim().toLowerCase() ?? user.id);

  return user;
}
