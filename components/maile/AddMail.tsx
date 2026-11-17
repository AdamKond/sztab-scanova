"use client";

// Dodawanie adresów do kolejki: pojedynczo albo wklejona lista / CSV z research.

import { useState } from "react";
import ActionForm, { SubmitButton } from "@/components/crm/ActionForm";
import Button from "@/components/ui/Button";
import Card, { CardTitle } from "@/components/ui/Card";
import { Input, Label, Select, Textarea } from "@/components/ui/Field";
import { addMailContact, addMailContactsBulk } from "@/lib/crm/mail-actions";
import { NICHES } from "@/lib/crm/dm-copy";
import { blitzNicheLabel } from "@/lib/crm/blitz";

export default function AddMail() {
  const [mode, setMode] = useState<"closed" | "one" | "many">("closed");

  if (mode === "closed") {
    return (
      <div className="flex gap-2">
        <Button variant="primary" onClick={() => setMode("one")}>
          + Adres
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
        {mode === "one" ? "Nowy adres" : "Wklej listę adresów"}
      </CardTitle>
      {mode === "one" ? (
        <ActionForm action={addMailContact} resetOnSuccess onSuccessMessage="Dodano do kolejki" className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="am-email">E-mail lokalu</Label>
            <Input id="am-email" name="email" type="email" placeholder="kontakt@lokal.pl" required autoFocus />
          </div>
          <div>
            <Label htmlFor="am-name">Nazwa</Label>
            <Input id="am-name" name="name" placeholder="jak na szyldzie" required />
          </div>
          <div>
            <Label htmlFor="am-niche">Nisza (ustawia kalkulator w linku)</Label>
            <Select id="am-niche" name="niche" defaultValue="restauracja">
              {NICHES.map((n) => (
                <option key={n} value={n}>
                  {blitzNicheLabel(n)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="am-city">Miasto</Label>
            <Input id="am-city" name="city" defaultValue="Lublin" />
          </div>
          <div>
            <Label htmlFor="am-www">WWW (opcjonalnie)</Label>
            <Input id="am-www" name="www" placeholder="lokal.pl" />
          </div>
          <div>
            <Label htmlFor="am-campaign">Kampania (opcjonalnie)</Label>
            <Input id="am-campaign" name="campaign" placeholder="mail-2026-11" />
          </div>
          <div className="flex items-end">
            <SubmitButton>Dodaj</SubmitButton>
          </div>
        </ActionForm>
      ) : (
        <ActionForm action={addMailContactsBulk} resetOnSuccess onSuccessMessage="Dodano" className="space-y-3">
          <div>
            <Label htmlFor="am-lines">Jedna linia = jeden lokal (albo cały CSV z nagłówkiem email,nazwa,miasto…)</Label>
            <Textarea
              id="am-lines"
              name="lines"
              rows={8}
              required
              placeholder={"kontakt@pizzalover.pl | Pizza Lover | Lublin | pizza | pizzalover.pl\nbiuro@kawanarogu.pl | Kawa na Rogu | Lublin | kawiarnia"}
            />
            <p className="mt-1.5 text-[12px] text-ink-3">
              Pola oddzielone | (albo ; lub tabulatorem): e-mail | nazwa | miasto | nisza | www | notatka. Wystarczy sam adres. Duplikaty i adresy z czarnej listy są pomijane. Nisze: {NICHES.join(", ")}.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56">
              <Label htmlFor="am-campaign2">Kampania (opcjonalnie)</Label>
              <Input id="am-campaign2" name="campaign" placeholder="mail-2026-11" />
            </div>
            <SubmitButton>Dodaj wszystkie</SubmitButton>
          </div>
        </ActionForm>
      )}
    </Card>
  );
}
