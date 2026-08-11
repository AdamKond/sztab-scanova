"use server";

import { redirect } from "next/navigation";
import { getAuthServerClient } from "@/lib/supabase/auth-server";

// Uwaga: ta akcja NIE sprawdza allowlisty. Zalogowanie się to za mało —
// o dostępie do CRM decyduje requireStaff() na poziomie layoutu. Dzięki temu
// konto spoza allowlisty może mieć poprawne hasło i i tak zobaczy 404.

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=1");
  }

  // Świadomie bez try/catch wokół redirect: `redirect()` działa przez wyjątek,
  // złapanie go zamieniłoby przekierowanie w cichy błąd.
  const supabase = await getAuthServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Jeden komunikat dla wszystkich przypadków (zły e-mail, złe hasło,
    // konto nieistniejące) — rozróżnianie ich zdradza, które adresy istnieją.
    redirect("/login?error=1");
  }

  redirect("/");
}
