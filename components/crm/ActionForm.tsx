"use client";

// Wspólna otoczka formularzy mutacji. Server actions zwracają { error?, ok? } —
// ta otoczka pokazuje polski błąd walidacji przy formularzu, blokuje podwójny
// zapis (disabled w trakcie) i opcjonalnie czyści pola po sukcesie.

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Button from "@/components/ui/Button";
import type { ActionResult } from "@/lib/crm/actions";

// Jak długo wisi potwierdzenie zapisu: dość, by je zauważyć wracając wzrokiem
// do formularza, ale nie tyle, by myliło się z wynikiem kolejnego zapisu.
const SUCCESS_MS = 2500;

// Klasy dokładane na czas błysku — trzymane tu, bo dodaje je i zdejmuje efekt.
const FLASH_CLASSES = ["anim-flash", "rounded-lg"] as const;

// Ptaszka rysujemy inline: jedna ikona nie jest warta zależności, a tak
// dziedziczy currentColor i skaluje się z tekstem.
function CheckMark() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* celowo nierówne ramiona — ptaszek ma wyglądać na postawiony ręką */}
      <path d="M4 10.3c1.6.9 2.9 2 3.9 3.6C9.7 10 12.3 7 16 4.8" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="h-4 w-4 shrink-0 animate-spin"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <circle cx="10" cy="10" r="7" className="opacity-25" />
      {/* sam wycinek okręgu — pełne koło w obrocie wyglądałoby nieruchomo */}
      <path d="M17 10a7 7 0 0 0-7-7" />
    </svg>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending}>
      {pending ? (
        <>
          <Spinner />
          Zapisywanie…
        </>
      ) : (
        children
      )}
    </Button>
  );
}

export default function ActionForm({
  action,
  children,
  className = "",
  resetOnSuccess = false,
  onSuccessMessage,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccessMessage?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => action(formData),
    null,
  );

  // Znacznik czasu zamiast zwykłego boolean-a: dwa udane zapisy pod rząd dają
  // równoważny wynik, a tak każdy z nich odpala animację i timer od nowa.
  const [successAt, setSuccessAt] = useState(0);
  const handledRef = useRef<ActionResult | null>(null);

  useEffect(() => {
    // Reagujemy raz na wynik, nie na każdy re-render formularza.
    if (!state || state === handledRef.current) return;
    handledRef.current = state;
    // Nieudany zapis natychmiast gasi poprzednie potwierdzenie — inaczej obok
    // czerwonego błędu wisiałoby zielone „Zapisano” z poprzedniej próby.
    if (!state.ok) {
      setSuccessAt(0);
      return;
    }
    if (resetOnSuccess) formRef.current?.reset();
    setSuccessAt(Date.now());
  }, [state, resetOnSuccess]);

  useEffect(() => {
    if (!successAt) return;
    const timer = window.setTimeout(() => setSuccessAt(0), SUCCESS_MS);
    const form = formRef.current;
    // Błysk tła zdejmujemy i nakładamy ręcznie, bo przy zapisie tuż po zapisie
    // klasa już siedzi na elemencie i sama z siebie nie odtworzyłaby animacji.
    if (form) {
      form.classList.remove(...FLASH_CLASSES);
      void form.offsetWidth; // wymuszony reflow = restart animacji
      form.classList.add(...FLASH_CLASSES);
    }
    // Sprzątanie przy odmontowaniu i przed kolejnym zapisem — stary timer nie
    // może chować świeżego potwierdzenia.
    return () => {
      window.clearTimeout(timer);
      form?.classList.remove(...FLASH_CLASSES);
    };
  }, [successAt]);

  return (
    <form ref={formRef} action={formAction} className={className}>
      {children}
      {state?.error ? (
        <p role="alert" className="anim-in mt-2 text-[13px] font-medium text-danger">
          {state.error}
        </p>
      ) : null}
      {successAt > 0 ? (
        <p
          // klucz z czasu zapisu — kolejne potwierdzenie ma "podskoczyć" na nowo
          key={successAt}
          role="status"
          className="anim-pop mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-success"
        >
          <CheckMark />
          {onSuccessMessage ?? "Zapisano"}
        </p>
      ) : null}
    </form>
  );
}
