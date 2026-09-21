"use client";

// Dodawanie lokali do Bazy: pojedynczo albo wklejona lista. Nisza decyduje
// o tekście DM-a, więc jest jedynym polem poza Instagramem, które ma znaczenie.

import { useState } from "react";
import ActionForm, { SubmitButton } from "@/components/crm/ActionForm";
import Button from "@/components/ui/Button";
import Card, { CardTitle } from "@/components/ui/Card";
import { Input, Label, Select, Textarea } from "@/components/ui/Field";
import { addLokal, addLokaleBulk } from "@/lib/crm/actions";
import { NICHES } from "@/lib/crm/dm-copy";
import { blitzNicheLabel } from "@/lib/crm/blitz";

export default function AddLokal() {
  const [mode, setMode] = useState<"closed" | "one" | "many">("closed");

  if (mode === "closed") {
    return (
      <div className="flex gap-2">
        <Button variant="primary" onClick={() => setMode("one")}>
          + Lokal
        </Button>
        <Button variant="secondary" onClick={() => setMode("many")}>
          Wklej listę
        </Button>
      </div>
    );
  }

  return (
    <Card className="anim-in w-full">
      <CardTitle action={<Button variant="ghost" size="sm" onClick={() => setMode("closed")}>Zamknij</Button>}>
        {mode === "one" ? "Nowy lokal" : "Wklej listę lokali"}
      </CardTitle>
      {mode === "one" ? (
        <ActionForm action={addLokal} resetOnSuccess onSuccessMessage="Dodano do Bazy" className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="al-ig">Instagram</Label>
            <Input id="al-ig" name="instagram" placeholder="@nazwa albo link" required autoFocus />
          </div>
          <div>
            <Label htmlFor="al-name">Nazwa</Label>
            <Input id="al-name" name="name" placeholder="jak na szyldzie" />
          </div>
          <div>
            <Label htmlFor="al-niche">Nisza (dobiera tekst DM-a)</Label>
            <Select id="al-niche" name="niche" defaultValue="restauracja">
              {NICHES.map((n) => (
                <option key={n} value={n}>
                  {blitzNicheLabel(n)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="al-city">Miasto</Label>
            <Input id="al-city" name="city" defaultValue="Lublin" />
          </div>
          <div>
            <Label htmlFor="al-followers">Obserwujący (opcjonalnie)</Label>
            <Input id="al-followers" name="followers" inputMode="numeric" />
          </div>
          <div className="flex items-end">
            <SubmitButton>Dodaj</SubmitButton>
          </div>
        </ActionForm>
      ) : (
        <ActionForm action={addLokaleBulk} resetOnSuccess onSuccessMessage="Dodano" className="space-y-3">
          <div>
            <Label htmlFor="al-lines">Jedna linia = jeden lokal</Label>
            <Textarea
              id="al-lines"
              name="lines"
              rows={8}
              required
              placeholder={"@pizzalover_pl | Pizza Lover | Lublin | pizza | 13000\n@kawa_na_rogu | Kawa na Rogu | Lublin | kawiarnia"}
            />
            <p className="mt-1.5 text-[12px] text-ink-3">
              Pola oddzielone | (albo ; lub tabulatorem). Wystarczy sam @instagram — reszta opcjonalna.
              Nisze: {NICHES.join(", ")}.
            </p>
          </div>
          <SubmitButton>Dodaj wszystkie</SubmitButton>
        </ActionForm>
      )}
    </Card>
  );
}
