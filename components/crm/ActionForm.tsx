"use client";

// Wspólna otoczka formularzy mutacji. Server actions zwracają { error?, ok? } —
// ta otoczka pokazuje polski błąd walidacji przy formularzu, blokuje podwójny
// zapis (disabled w trakcie) i opcjonalnie czyści pola po sukcesie.

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import Button from "@/components/ui/Button";
import type { ActionResult } from "@/lib/crm/actions";

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
      {pending ? "Zapisywanie…" : children}
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

  useEffect(() => {
    if (state?.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={formRef} action={formAction} className={className}>
      {children}
      {state?.error ? (
        <p role="alert" className="mt-2 text-[13px] font-medium text-danger">
          {state.error}
        </p>
      ) : null}
      {state?.ok && onSuccessMessage ? (
        <p className="mt-2 text-[13px] font-medium text-success">{onSuccessMessage}</p>
      ) : null}
    </form>
  );
}
