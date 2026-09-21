import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/auth-server";
import { isStaffUser } from "@/lib/auth";
import { loginAction } from "./actions";

export const metadata: Metadata = {
  title: "Sztab — logowanie",
  robots: {
    index: false,
    follow: false,
  },
};

// Strona jest celowo neutralna: sam wordmark, bez nazwy firmy, bez opisu
// systemu, bez rejestracji i bez resetu hasła. Konta zakłada się ręcznie
// w panelu Supabase.

const FIELD =
  "h-11 w-full rounded-xl bg-[#f5f5f7] px-3.5 text-[15px] text-[#1d1d1f] outline-none placeholder:text-[#aeaeb2] focus:ring-2 focus:ring-[#0071e3]";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const hasError = error === "1";

  const user = await getCurrentUser();
  if (isStaffUser(user)) {
    redirect("/");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f5f5f7] px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-[28px] font-semibold tracking-tight text-[#1d1d1f]">Sztab</h1>

        <div className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)]">
          <form action={loginAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-[13px] font-medium text-[#6e6e73]">
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
                className={FIELD}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-[13px] font-medium text-[#6e6e73]">
                Hasło
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className={FIELD}
              />
            </div>

            {hasError ? (
              <p role="alert" className="rounded-xl bg-[#fdecee] px-3 py-2 text-[13px] font-medium text-[#d70015]">
                Nieprawidłowy e-mail lub hasło.
              </p>
            ) : null}

            <button
              type="submit"
              className="h-11 w-full rounded-xl bg-[#0071e3] px-4 text-[15px] font-medium text-white transition-colors hover:bg-[#0077ed] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3]"
            >
              Zaloguj się
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
