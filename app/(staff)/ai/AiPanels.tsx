"use client";

// Panele AI: odprawa dnia + generator hooków. Klienckie, bo useActionState
// (pending + wynik). Wynik renderujemy jako zwykły tekst preformatowany —
// świadomie bez parsera Markdown (zero zależności, zero XSS).

import { useActionState } from "react";
import Button from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Field";
import { generateBriefingAction, generateContentIdeaAction, type AiResult } from "./actions";

function AiText({ text }: { text: string }) {
  return (
    <pre className="mt-3 max-h-[600px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-canvas p-4 font-sans text-[14px] leading-relaxed text-ink">
      {text}
    </pre>
  );
}

export function BriefingPanel({ existing }: { existing: string | null }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: AiResult | null) => generateBriefingAction(),
    null,
  );
  const text = state?.text ?? existing;

  return (
    <div>
      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Generuję…" : existing ? "Wygeneruj ponownie" : "Wygeneruj odprawę"}
        </Button>
        <span className="text-[12px] text-ink-2">
          Odprawa to sugestia AI, nie fakt — decyzje podejmujesz Ty.
        </span>
      </form>
      {state?.error ? (
        <p role="alert" className="mt-2 text-[13px] font-medium text-danger">
          {state.error}
        </p>
      ) : null}
      {text ? <AiText text={text} /> : null}
    </div>
  );
}

export function GeneratorPanel() {
  const [state, formAction, pending] = useActionState(
    async (_prev: AiResult | null, formData: FormData) => generateContentIdeaAction(formData),
    null,
  );

  return (
    <div>
      <form action={formAction} className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <Label htmlFor="temat">Temat *</Label>
          <Input
            id="temat"
            name="temat"
            required
            placeholder="np. papierowe pieczątki gubią klientów"
          />
        </div>
        <div>
          <Label htmlFor="grupa">Grupa docelowa</Label>
          <Input id="grupa" name="grupa" placeholder="właściciele kawiarni" />
        </div>
        <div>
          <Label htmlFor="cel">Cel</Label>
          <Input id="cel" name="cel" placeholder="zapytania o demo" />
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="primary" disabled={pending} className="w-full">
            {pending ? "Piszę…" : "Napisz hook i skrypt"}
          </Button>
        </div>
      </form>
      {state?.error ? (
        <p role="alert" className="mt-2 text-[13px] font-medium text-danger">
          {state.error}
        </p>
      ) : null}
      {state?.text ? (
        <>
          <AiText text={state.text} />
          <p className="mt-2 text-[12px] text-ink-2">
            Nic nie publikuje się samo — skopiuj hook do zakładki Content, jeśli wchodzi do
            pipeline'u.
          </p>
        </>
      ) : null}
    </div>
  );
}
