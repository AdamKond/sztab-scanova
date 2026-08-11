import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/auth-server";
import { isStaffUser } from "@/lib/auth";
import { loginAction } from "./actions";

export const metadata: Metadata = {
  title: "SZTAB — logowanie",
  // Strona logowania nie ma prawa pojawić się w wyszukiwarce — im mniej
  // śladów, że cokolwiek tu stoi, tym lepiej.
  robots: {
    index: false,
    follow: false,
  },
};

// Strona jest celowo neutralna: sam wordmark, bez nazwy firmy, bez opisu
// systemu, bez rejestracji i bez resetu hasła. Osoba postronna nie powinna
// dowiedzieć się z niej niczego poza tym, że istnieje formularz logowania.
// Konta zakłada się ręcznie w panelu Supabase.

export default async function LoginPage({
  searchParams,
}: {
  // W Next 16 `searchParams` jest Promisem.
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Stan błędu jedzie w URL zamiast w useActionState, bo dzięki temu strona
  // pozostaje komponentem serwerowym i może eksportować `metadata`.
  const hasError = error === "1";

  const user = await getCurrentUser();
  if (isStaffUser(user)) {
    redirect("/");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#0b0d10] px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold tracking-[0.2em] text-white">
          SZTAB
        </h1>

        <div className="rounded-2xl bg-white p-6 shadow-2xl shadow-black/40">
          <form action={loginAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-sm font-medium text-neutral-800"
              >
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="username"
                autoFocus
                spellCheck={false}
                className="min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/30"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium text-neutral-800"
              >
                Hasło
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/30"
              />
            </div>

            {hasError ? (
              <p
                role="alert"
                className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                Nieprawidłowy e-mail lub hasło.
              </p>
            ) : null}

            <button
              type="submit"
              className="min-h-11 w-full rounded-lg bg-[#2563eb] px-4 text-[15px] font-medium text-white transition-colors hover:bg-[#1d4ed8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"
            >
              Zaloguj się
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
