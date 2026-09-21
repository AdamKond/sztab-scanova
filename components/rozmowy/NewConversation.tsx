"use client";

// "+ Nowa rozmowa" spoza Bazy: ktoś zadzwonił, wizyta w terenie, polecenie.
// Po zapisie przechodzimy prosto do karty rozmowy.

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Input, Label, Select, Textarea } from "@/components/ui/Field";
import { createConversation, type ActionResult } from "@/lib/crm/actions";
import { NICHES } from "@/lib/crm/dm-copy";
import { blitzNicheLabel } from "@/lib/crm/blitz";

const SOURCES = [
  { value: "teren", label: "Wizyta w terenie" },
  { value: "telefon", label: "Telefon" },
  { value: "polecenie", label: "Polecenie" },
  { value: "ig_dm", label: "Sam napisał na Instagramie" },
  { value: "inne", label: "Inne" },
];

export default function NewConversation() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      const result = await createConversation(formData);
      if (result.ok && result.id) router.push(`/rozmowy/${result.id}`);
      return result;
    },
    null,
  );

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        + Nowa rozmowa
      </Button>
    );
  }

  return (
    <Card className="anim-in w-full">
      <form action={formAction} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="nc-name">Nazwa lokalu</Label>
            <Input id="nc-name" name="name" required autoFocus />
          </div>
          <div>
            <Label htmlFor="nc-source">Skąd</Label>
            <Select id="nc-source" name="source" defaultValue="teren">
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="nc-category">Rodzaj</Label>
            <Select id="nc-category" name="category" defaultValue="restauracja">
              {NICHES.map((n) => (
                <option key={n} value={n}>
                  {blitzNicheLabel(n)}
                </option>
              ))}
              <option value="inne">Inne</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="nc-instagram">Instagram</Label>
            <Input id="nc-instagram" name="instagram" placeholder="@nazwa" />
          </div>
          <div>
            <Label htmlFor="nc-phone">Telefon</Label>
            <Input id="nc-phone" name="phone" inputMode="tel" />
          </div>
          <div>
            <Label htmlFor="nc-city">Miasto</Label>
            <Input id="nc-city" name="city" defaultValue="Lublin" />
          </div>
          <div>
            <Label htmlFor="nc-dm">Z kim rozmawiasz</Label>
            <Input id="nc-dm" name="decision_maker_name" placeholder="imię właściciela / managera" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="nc-notes">Notatka</Label>
            <Textarea id="nc-notes" name="notes" rows={2} />
          </div>
        </div>
        {state?.error ? (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {state.error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "Zapisywanie…" : "Dodaj rozmowę"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Anuluj
          </Button>
        </div>
      </form>
    </Card>
  );
}
