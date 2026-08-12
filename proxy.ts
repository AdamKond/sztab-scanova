import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// TO MIDDLEWARE NIE AUTORYZUJE NICZEGO.
//
// Jego jedyne zadanie to odświeżenie tokenu Supabase i przepisanie ciasteczek
// do odpowiedzi — Server Components nie mogą pisać cookies, więc bez tego
// kroku sesja wygasałaby po godzinie i użytkownik byłby losowo wylogowywany.
//
// Bramka dostępu (404 dla obcych) siedzi w requireStaff() z lib/auth.ts,
// wołanym w layoutach i na stronach. Trzymamy ją tam celowo: middleware
// łatwo obejść błędem w matcherze, a decyzja podjęta bezpośrednio przed
// renderem strony nie da się pominąć.

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Bez konfiguracji nie ma czego odświeżać. Aplikacja ma się dać uruchomić
  // i zbudować na świeżym klonie repo, bez .env.local.
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // Najpierw request (żeby dalsze etapy renderu widziały nowy token),
        // potem świeża odpowiedź, potem te same ciasteczka na odpowiedzi.
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Nagłówki od @supabase/ssr wyłączają cache — odpowiedź z Set-Cookie
        // zapisana w CDN podałaby sesję jednego użytkownika drugiemu.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  try {
    // Wywołanie getUser() jest tym, co faktycznie wyzwala odświeżenie tokenu.
    // Musi nastąpić przed zwróceniem odpowiedzi, inaczej nowe ciasteczka
    // nie zdążą do niej trafić.
    await supabase.auth.getUser();
  } catch {
    // Niedostępny Supabase nie może wywalić całej aplikacji na 500 —
    // brak odświeżenia po prostu zakończy sesję.
  }

  return response;
}

export const config = {
  matcher: [
    // Pomijamy zasoby statyczne i health check: nie mają sesji, a każde
    // wywołanie middleware to dodatkowe zapytanie do Auth.
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff|woff2)$).*)",
  ],
};
