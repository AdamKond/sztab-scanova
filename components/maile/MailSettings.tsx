"use client";

// Panel sterowania wysyłką: pauza, limity, rozgrzewka, wariant, test.

import { useState, useTransition } from "react";
import ActionForm, { SubmitButton } from "@/components/crm/ActionForm";
import Button from "@/components/ui/Button";
import Card, { CardTitle } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Field";
import { checkMailboxes, runMailNow, sendMailTest, setMailPaused, updateMailSettings } from "@/lib/crm/mail-actions";
import type { CrmMailSettings, MailboxInfo } from "@/lib/crm/mail/types";

export default function MailSettings({ settings, mailboxes, dryRun }: { settings: CrmMailSettings; mailboxes: MailboxInfo[]; dryRun: boolean }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ error?: string; info?: string }>) {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setErr(r.error);
      else setMsg(r.info ?? "Gotowe");
    });
  }

  return (
    <Card>
      <CardTitle
        action={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
              {open ? "Zwiń" : "Ustawienia"}
            </Button>
            <Button variant={settings.paused ? "primary" : "danger"} size="sm" disabled={pending} onClick={() => run(() => setMailPaused(!settings.paused))}>
              {settings.paused ? "Włącz wysyłkę" : "Wstrzymaj wysyłkę"}
            </Button>
          </div>
        }
      >
        {settings.paused ? "Wysyłka wstrzymana" : "Wysyłka włączona"}
      </CardTitle>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
        <span>
          Limit: <b className="text-ink">{settings.daily_limit}/dzień</b>
          {settings.warmup_start ? ` (rozgrzewka od ${settings.warmup_start}: start ${settings.warmup_start_limit}, +${settings.warmup_step}/dzień)` : ""}
        </span>
        <span>
          Sekwencja: mail → follow-up po <b className="text-ink">{settings.followup_after_days} dn.</b> → ostatni po <b className="text-ink">{settings.last_after_days} dn.</b>
        </span>
        <span>
          Wariant: <b className="text-ink">{settings.variant === "pytanie" ? "pytanie o film (bez linku)" : "oferta z linkiem"}</b>
        </span>
        <span>
          Skrzynki:{" "}
          {mailboxes.length === 0 ? (
            <b className="text-danger">brak (MAIL_ACCOUNTS)</b>
          ) : (
            mailboxes.map((m) => `${m.email} (${m.dailyCap}/dz.)`).join(", ")
          )}
        </span>
        {dryRun ? <b className="text-warning">Tryb NA SUCHO (MAIL_DRY_RUN) — nic nie wychodzi</b> : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(runMailNow)}>
          Uruchom teraz
        </Button>
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(checkMailboxes)}>
          Sprawdź skrzynki
        </Button>
        <ActionForm action={sendMailTest} onSuccessMessage="Wysłano" className="flex flex-wrap items-center gap-2">
          <Input name="to" type="email" placeholder="test na mój adres…" className="h-8 w-56 text-[13px]" required />
          <input type="hidden" name="name" value="Pizzeria Testowa" />
          <SubmitButton variant="ghost" size="sm">
            Wyślij test
          </SubmitButton>
        </ActionForm>
      </div>
      {msg ? <p className="mt-2 text-[13px] font-medium text-success">{msg}</p> : null}
      {err ? <p className="mt-2 text-[13px] font-medium text-danger">{err}</p> : null}

      {open ? (
        <ActionForm action={updateMailSettings} onSuccessMessage="Zapisano" className="anim-in mt-5 grid gap-3 border-t border-line/70 pt-5 sm:grid-cols-3">
          <div>
            <Label htmlFor="ms-limit">Limit dzienny (wszystkie skrzynki)</Label>
            <Input id="ms-limit" name="daily_limit" inputMode="numeric" defaultValue={settings.daily_limit} />
          </div>
          <div>
            <Label htmlFor="ms-f">Follow-up po (dni)</Label>
            <Input id="ms-f" name="followup_after_days" inputMode="numeric" defaultValue={settings.followup_after_days} />
          </div>
          <div>
            <Label htmlFor="ms-l">Ostatni mail po (dni)</Label>
            <Input id="ms-l" name="last_after_days" inputMode="numeric" defaultValue={settings.last_after_days} />
          </div>
          <div>
            <Label htmlFor="ms-from">Wysyłka od godziny</Label>
            <Input id="ms-from" name="send_from_hour" inputMode="numeric" defaultValue={settings.send_from_hour} />
          </div>
          <div>
            <Label htmlFor="ms-to">Do godziny</Label>
            <Input id="ms-to" name="send_to_hour" inputMode="numeric" defaultValue={settings.send_to_hour} />
          </div>
          <div className="flex items-end pb-3">
            <label className="flex items-center gap-2 text-[14px] text-ink">
              <input type="checkbox" name="weekdays_only" defaultChecked={settings.weekdays_only} className="h-4 w-4" />
              tylko dni robocze
            </label>
          </div>
          <div>
            <Label htmlFor="ms-ws">Rozgrzewka od dnia (puste = bez)</Label>
            <Input id="ms-ws" name="warmup_start" type="date" defaultValue={settings.warmup_start ?? ""} />
          </div>
          <div>
            <Label htmlFor="ms-wsl">Start rozgrzewki (maili/dzień)</Label>
            <Input id="ms-wsl" name="warmup_start_limit" inputMode="numeric" defaultValue={settings.warmup_start_limit} />
          </div>
          <div>
            <Label htmlFor="ms-wst">Przyrost dzienny</Label>
            <Input id="ms-wst" name="warmup_step" inputMode="numeric" defaultValue={settings.warmup_step} />
          </div>
          <div>
            <Label htmlFor="ms-var">Wariant maila #1</Label>
            <Select id="ms-var" name="variant" defaultValue={settings.variant}>
              <option value="pytanie">pytanie o film (bez linku, bezpieczniej)</option>
              <option value="oferta">oferta z linkiem na /restauracje</option>
            </Select>
          </div>
          <div className="flex items-end sm:col-span-2">
            <SubmitButton>Zapisz ustawienia</SubmitButton>
          </div>
        </ActionForm>
      ) : null}
    </Card>
  );
}
