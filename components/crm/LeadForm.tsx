"use client";

// Formularz tworzenia/edycji leada — wspólny dla /leady/nowy i /leady/[id]/edytuj.
// Status NIE jest tu edytowalny — jedyna ścieżka zmiany statusu to StageSelect
// (changeLeadStatus), bo tylko ona egzekwuje reguły przejść.

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import { Label, Input, Select, Textarea } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import {
  CATEGORY_SUGGESTIONS,
  CURRENT_LOYALTY_LABELS,
  CURRENT_LOYALTY_OPTIONS,
  PRIORITIES,
  PRIORITY_LABELS,
  SOURCES,
  SOURCE_LABELS,
} from "@/lib/crm/constants";
import { LIMITS } from "@/lib/crm/validation";
import type { ActionResult } from "@/lib/crm/actions";
import type { CrmLead } from "@/lib/crm/types";

/**
 * ISO (UTC) -> wartość dla <input type="datetime-local"> w czasie Warszawy.
 * Bez tego pole pokazywałoby godzinę serwera zamiast godziny, którą wpisał
 * człowiek w Polsce.
 */
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-[15px] font-semibold text-ink">{children}</h2>;
}

export default function LeadForm({
  lead,
  action,
  submitLabel,
  owners,
}: {
  lead?: CrmLead;
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  owners: string[];
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => action(formData),
    null,
  );

  useEffect(() => {
    if (!state?.ok) return;
    if (state.id) {
      // Utworzono nowego leada — przejdź od razu na jego kartę.
      router.push(`/leady/${state.id}`);
    } else if (lead) {
      // Edycja istniejącego leada — odśwież dane i wróć na kartę.
      router.refresh();
      router.push(`/leady/${lead.id}`);
    }
  }, [state, lead, router]);

  return (
    <form action={formAction} className="space-y-4">
      <Card>
        <SectionTitle>Firma</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Nazwa *</Label>
            <Input
              id="name"
              name="name"
              required
              maxLength={LIMITS.name}
              defaultValue={lead?.name ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="category">Kategoria</Label>
            <Input
              id="category"
              name="category"
              list="category-suggestions"
              defaultValue={lead?.category ?? ""}
            />
            <datalist id="category-suggestions">
              {CATEGORY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <Label htmlFor="city">Miasto</Label>
            <Input id="city" name="city" defaultValue={lead?.city ?? ""} />
          </div>
          <div>
            <Label htmlFor="district">Dzielnica</Label>
            <Input id="district" name="district" defaultValue={lead?.district ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="address">Adres</Label>
            <Input id="address" name="address" defaultValue={lead?.address ?? ""} />
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>Kontakt</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" name="phone" type="tel" defaultValue={lead?.phone ?? ""} />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" defaultValue={lead?.email ?? ""} />
          </div>
          <div>
            <Label htmlFor="instagram">Instagram</Label>
            <Input id="instagram" name="instagram" defaultValue={lead?.instagram ?? ""} />
          </div>
          <div>
            <Label htmlFor="www">WWW</Label>
            <Input id="www" name="www" defaultValue={lead?.www ?? ""} />
          </div>
          <div>
            <Label htmlFor="google_rating">Ocena Google</Label>
            <Input
              id="google_rating"
              name="google_rating"
              type="number"
              min={0}
              max={5}
              step={0.1}
              defaultValue={lead?.google_rating ?? ""}
            />
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>Kwalifikacja ICP</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="locations_count">Liczba lokali</Label>
            <Input
              id="locations_count"
              name="locations_count"
              type="number"
              min={1}
              defaultValue={lead?.locations_count ?? 1}
            />
          </div>
          <div>
            <Label htmlFor="estimated_daily_transactions">Transakcje dziennie (szac.)</Label>
            <Input
              id="estimated_daily_transactions"
              name="estimated_daily_transactions"
              type="number"
              min={0}
              defaultValue={lead?.estimated_daily_transactions ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="current_loyalty">Obecny program lojalnościowy</Label>
            <Select id="current_loyalty" name="current_loyalty" defaultValue={lead?.current_loyalty ?? ""}>
              <option value="">— nie wiadomo —</option>
              {CURRENT_LOYALTY_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {CURRENT_LOYALTY_LABELS[o]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="priority">Priorytet</Label>
            <Select id="priority" name="priority" defaultValue={lead?.priority ?? "B"}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="decision_maker_name">Decydent — imię i nazwisko</Label>
            <Input
              id="decision_maker_name"
              name="decision_maker_name"
              defaultValue={lead?.decision_maker_name ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="decision_maker_role">Decydent — rola</Label>
            <Input
              id="decision_maker_role"
              name="decision_maker_role"
              defaultValue={lead?.decision_maker_role ?? ""}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="qualification_note">Notatka kwalifikacyjna</Label>
            <Textarea
              id="qualification_note"
              name="qualification_note"
              maxLength={LIMITS.note}
              defaultValue={lead?.qualification_note ?? ""}
            />
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>Źródło</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="source">Źródło</Label>
            <Select id="source" name="source" defaultValue={lead?.source ?? "teren"}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="source_detail">Szczegół źródła</Label>
            <Input id="source_detail" name="source_detail" defaultValue={lead?.source_detail ?? ""} />
          </div>
          <div>
            <Label htmlFor="campaign">Kampania</Label>
            <Input id="campaign" name="campaign" defaultValue={lead?.campaign ?? ""} />
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>Prowadzący</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="owner">Prowadzący</Label>
            <Select id="owner" name="owner" defaultValue={lead?.owner ?? owners[0] ?? ""}>
              {owners.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>Następny krok</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="next_action">Następny krok</Label>
            <Input id="next_action" name="next_action" defaultValue={lead?.next_action ?? ""} />
          </div>
          <div>
            <Label htmlFor="next_action_at">Termin</Label>
            <Input
              id="next_action_at"
              name="next_action_at"
              type="datetime-local"
              defaultValue={isoToLocalInput(lead?.next_action_at)}
            />
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>Notatki</SectionTitle>
        <Textarea name="notes" maxLength={LIMITS.notes} defaultValue={lead?.notes ?? ""} />
      </Card>

      {state?.error ? (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Zapisywanie…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
