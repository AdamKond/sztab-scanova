import { NextResponse } from "next/server";
import { getAuthServerClient } from "@/lib/supabase/auth-server";

// Standardowa wymiana kodu PKCE na sesję. Przy logowaniu hasłem ten endpoint
// nie jest używany, ale trzymamy go, żeby włączenie magic linku albo
// zaproszenia e-mail nie wymagało zmian w warstwie auth.

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    try {
      const supabase = await getAuthServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}/`);
      }
    } catch {
      // Każdy problem kończy się tak samo — patrz niżej.
    }
  }

  // Nieudana wymiana kodu nie tłumaczy się użytkownikowi: to ten sam
  // neutralny ekran logowania co przy złym haśle.
  return NextResponse.redirect(`${origin}/login?error=1`);
}
