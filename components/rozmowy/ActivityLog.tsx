"use client";

// "Co się wydarzyło" — wpis w mniej niż 10 sekund: typ jednym kliknięciem,
// notatka, opcjonalnie kiedy wrócić. Reszta pól została w starym Sztabie.

import { useEffect, useRef, useState } from "react";
import ActionForm, { SubmitButton } from "@/components/crm/ActionForm";
import { Input, Label, Textarea } from "@/components/ui/Field";
import { addActivity } from "@/lib/crm/actions";
import type { ActivityType } from "@/lib/crm/types";

const TYPES: { type: ActivityType; label: string }[] = [
  { type: "ig_dm", label: "DM" },
  { type: "telefon", label: "Telefon" },
  { type: "wizyta", label: "Wizyta" },
  { type: "demo", label: "Demo" },
  { type: "pilot_checkin", label: "Check-in" },
  { type: "notatka", label: "Notatka" },
];

export default function ActivityLog({ leadId, defaultType = "ig_dm" }: { leadId: string; defaultType?: ActivityType }) {
  const [type, setType] = useState<ActivityType>(defaultType);
  const rootRef = useRef<HTMLDivElement>(null);

  // ActionForm po sukcesie robi natywny form.reset() — synchronizujemy stan
  // kontrolowany nasłuchując zdarzenia "reset" na <form>.
  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const onReset = () => setType(defaultType);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [defaultType]);

  return (
    <ActionForm action={addActivity} resetOnSuccess onSuccessMessage="Zapisano" className="space-y-3">
      <div ref={rootRef}>
        <input type="hidden" name="lead_id" value={leadId} />
        <input type="hidden" name="type" value={type} />
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => setType(t.type)}
              className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                type === t.type ? "bg-ink text-white" : "bg-canvas text-ink-2 hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label htmlFor="al-note">Co się wydarzyło</Label>
        <Textarea id="al-note" name="note" rows={2} placeholder="Krótko: co odpisał, co ustaliliście…" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="al-next">Następny krok (opcjonalnie)</Label>
          <Input id="al-next" name="next_action" placeholder="np. zadzwonić w czwartek" />
        </div>
        <div>
          <Label htmlFor="al-next-at">Kiedy</Label>
          <Input id="al-next-at" name="next_action_at" type="datetime-local" />
        </div>
      </div>
      <SubmitButton size="md">Zapisz</SubmitButton>
    </ActionForm>
  );
}
