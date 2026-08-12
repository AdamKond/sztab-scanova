"use client";

// Jedyna ścieżka zmiany statusu w UI. Pola towarzyszące (daty pilota, MRR,
// powody utraty...) pokazujemy zależnie od wybranego etapu — to tylko UX,
// bo serwer (missingForStatus/validateStatusChange w lib/crm/validation.ts)
// i tak weryfikuje wszystko od nowa.

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import { Label, Input, Select, Textarea } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import { ALL_STATUSES, STATUS_LABELS } from "@/lib/crm/constants";
import { changeLeadStatus, type ActionResult } from "@/lib/crm/actions";
import type { CrmLead, LeadStatus } from "@/lib/crm/types";

/** ISO (UTC) -> wartość dla <input type="datetime-local"> w czasie Warszawy. */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

export default function StageSelect({ lead }: { lead: CrmLead }) {
  const router = useRouter();
  const [target, setTarget] = useState<LeadStatus>(lead.status);
  const [state, formAction, isPending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      const result = await changeLeadStatus(lead.id, formData);
      if (result.ok) router.refresh();
      return result;
    },
    null,
  );

  return (
    <Card>
      <h2 className="mb-3 text-[15px] font-semibold text-ink">Etap</h2>
      <form action={formAction} className="space-y-3">
        <div>
          <Label htmlFor="status">Nowy etap</Label>
          <Select
            id="status"
            name="status"
            value={target}
            onChange={(e) => setTarget(e.target.value as LeadStatus)}
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>

        {target === "pilot_aktywny" ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pilot_started_at">Start pilota *</Label>
              <Input
                id="pilot_started_at"
                name="pilot_started_at"
                type="datetime-local"
                defaultValue={isoToLocalInput(lead.pilot_started_at)}
              />
            </div>
            <div>
              <Label htmlFor="pilot_ends_at">Koniec pilota *</Label>
              <Input
                id="pilot_ends_at"
                name="pilot_ends_at"
                type="datetime-local"
                defaultValue={isoToLocalInput(lead.pilot_ends_at)}
              />
            </div>
          </div>
        ) : null}

        {target === "platny_klient" ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="paid_at">Data płatności *</Label>
              <Input
                id="paid_at"
                name="paid_at"
                type="datetime-local"
                defaultValue={isoToLocalInput(lead.paid_at)}
              />
            </div>
            <div>
              <Label htmlFor="plan">Plan *</Label>
              <Input id="plan" name="plan" defaultValue={lead.plan ?? ""} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="monthly_revenue">MRR (zł/mies.) *</Label>
              <Input
                id="monthly_revenue"
                name="monthly_revenue"
                inputMode="decimal"
                defaultValue={lead.monthly_revenue ?? ""}
              />
            </div>
          </div>
        ) : null}

        {target === "utracony" ? (
          <div>
            <Label htmlFor="lost_reason">Powód utraty *</Label>
            <Textarea id="lost_reason" name="lost_reason" defaultValue={lead.lost_reason ?? ""} />
          </div>
        ) : null}

        {target === "zdyskwalifikowany" ? (
          <div>
            <Label htmlFor="disqualification_reason">Powód dyskwalifikacji *</Label>
            <Textarea
              id="disqualification_reason"
              name="disqualification_reason"
              defaultValue={lead.disqualification_reason ?? ""}
            />
          </div>
        ) : null}

        {target === "churn" ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="churned_at">Data rezygnacji *</Label>
              <Input
                id="churned_at"
                name="churned_at"
                type="datetime-local"
                defaultValue={isoToLocalInput(lead.churned_at)}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="lost_reason_churn">Powód rezygnacji *</Label>
              <Textarea id="lost_reason_churn" name="lost_reason" defaultValue={lead.lost_reason ?? ""} />
            </div>
          </div>
        ) : null}

        {state?.error ? (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" variant="primary" disabled={isPending} className="w-full">
          {isPending ? "Zapisywanie…" : "Zmień etap"}
        </Button>
        <p className="text-[12px] text-ink-2">
          Serwer sprawdza wymagane pola ponownie — wybór powyżej to tylko podpowiedź.
        </p>
      </form>
    </Card>
  );
}
