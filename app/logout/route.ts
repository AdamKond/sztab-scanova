import { NextResponse } from "next/server";
import { getAuthServerClient } from "@/lib/supabase/auth-server";

// Wylogowanie tylko przez POST. GET-em wylogowałby użytkownika dowolny
// obrazek albo prefetch linku — POST z formularza w sidebarze jest odporny
// na ten scenariusz.

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const supabase = await getAuthServerClient();
    // Klient SSR sam kasuje ciasteczka sesji przez setAll — w route handlerze
    // zapis do `cookies()` jest dozwolony i trafia do tej odpowiedzi.
    await supabase.auth.signOut();
  } catch {
    // Brak konfiguracji albo padnięty Supabase nie może uwięzić użytkownika
    // w aplikacji — i tak odsyłamy go na ekran logowania.
  }

  // 303 wymusza GET na /login; przy 307 przeglądarka powtórzyłaby POST.
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
