"use client";

// Kopiowanie treści szablonu do schowka. Świadomie NIE wysyłamy niczego z
// aplikacji — człowiek wkleja wiadomość w Instagramie/mailu i decyduje, co
// zmienić. Dzięki temu nie ma ryzyka masowej wysyłki „przez przypadek”.

import { useEffect, useRef, useState } from "react";

export default function TemplatePicker({
  body,
  label = "Kopiuj",
}: {
  body: string;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "ok" | "error">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Czyścimy timer przy odmontowaniu — inaczej setState po zniknięciu karty.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function flash(next: "ok" | "error") {
    setState(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState("idle"), 2000);
  }

  async function copy() {
    try {
      // clipboard API bywa niedostępne poza HTTPS — wtedy pokazujemy błąd
      // zamiast udawać sukces (użytkownik musiałby zaznaczyć tekst ręcznie).
      if (!navigator.clipboard) throw new Error("brak clipboard API");
      await navigator.clipboard.writeText(body);
      flash("ok");
    } catch {
      flash("error");
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink hover:bg-canvas md:min-h-0 md:py-1.5"
      >
        {label}
      </button>
      {state === "ok" ? (
        <span className="text-[12px] font-medium text-success">Skopiowano</span>
      ) : null}
      {state === "error" ? (
        <span className="text-[12px] font-medium text-danger">Zaznacz i skopiuj ręcznie</span>
      ) : null}
    </span>
  );
}
