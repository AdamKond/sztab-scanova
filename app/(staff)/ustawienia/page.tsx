import Link from "next/link";
import Topbar from "@/components/shell/Topbar";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { Input, Label } from "@/components/ui/Field";
import ActionForm, { SubmitButton } from "@/components/crm/ActionForm";
import { staffEmails } from "@/lib/auth";
import { getSettings } from "@/lib/crm/queries";
import { updateSettings } from "@/lib/crm/actions";

export default async function UstawieniaPage() {
  const settings = await getSettings();
  const emails = staffEmails();

  return (
    <>
      <Topbar title="Ustawienia" />

      <div className="anim-in space-y-6">
        <Card>
          <h2 className="mb-1 text-[14px] font-semibold text-ink">Progi operacyjne</h2>
          <p className="mb-4 text-[13px] text-ink-2">
            Progi decydują, kiedy lead lub pilot pojawia się jako wymagający uwagi w widokach Dziś
            i Piloty i przychód.
          </p>
          <ActionForm action={updateSettings} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="stale_after_days">Stygnięcie leada (dni)</Label>
              <Input
                id="stale_after_days"
                name="stale_after_days"
                type="number"
                min="1"
                step="1"
                defaultValue={settings.stale_after_days}
                required
              />
              <p className="mt-1 text-[12px] text-ink-2">Po ilu dniach bez aktywności lead stygnie.</p>
            </div>
            <div>
              <Label htmlFor="stage_stuck_after_days">Zaleganie w etapie (dni)</Label>
              <Input
                id="stage_stuck_after_days"
                name="stage_stuck_after_days"
                type="number"
                min="1"
                step="1"
                defaultValue={settings.stage_stuck_after_days}
                required
              />
              <p className="mt-1 text-[12px] text-ink-2">
                Po ilu dniach w etapie lead zalega w Pipeline.
              </p>
            </div>
            <div>
              <Label htmlFor="pilot_ending_soon_days">Pilot kończący się (dni przed końcem)</Label>
              <Input
                id="pilot_ending_soon_days"
                name="pilot_ending_soon_days"
                type="number"
                min="1"
                step="1"
                defaultValue={settings.pilot_ending_soon_days}
                required
              />
              <p className="mt-1 text-[12px] text-ink-2">
                Ile dni przed końcem pilot jest „kończący się”.
              </p>
            </div>
            <div>
              <Label htmlFor="pilot_checkin_after_days">Brak check-inu pilota (dni)</Label>
              <Input
                id="pilot_checkin_after_days"
                name="pilot_checkin_after_days"
                type="number"
                min="1"
                step="1"
                defaultValue={settings.pilot_checkin_after_days}
                required
              />
              <p className="mt-1 text-[12px] text-ink-2">
                Po ilu dniach bez check-inu pilot wymaga uwagi.
              </p>
            </div>
            <div className="md:col-span-2">
              <SubmitButton>Zapisz progi</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <Card>
          <h2 className="mb-1 text-[14px] font-semibold text-ink">Dostęp</h2>
          <p className="mb-3 text-[13px] text-ink-2">
            Zmiana wymaga edycji zmiennych środowiskowych — celowo, żeby dostępu nie dało się nadać
            z UI.
          </p>
          {emails.length === 0 ? (
            <p className="text-[13px] text-ink-2">Brak skonfigurowanych adresów (STAFF_EMAILS).</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {emails.map((email) => (
                <Badge key={email} tone="neutral">
                  {email}
                </Badge>
              ))}
            </div>
          )}
          <p className="mt-3 text-[12px] text-ink-2">
            Dodatkowo konta są przypinane po UUID zmienną STAFF_USER_IDS — sam adres e-mail nie
            wystarczy, jeśli ta zmienna jest ustawiona.
          </p>
        </Card>

        <Card>
          <h2 className="mb-3 text-[14px] font-semibold text-ink">System</h2>
          <dl className="space-y-2.5 text-[13px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-2">Konfiguracja Supabase</dt>
              <dd className="font-mono text-[12px] text-ink">supabase/README.md</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-2">Stan systemu</dt>
              <dd>
                <Link href="/api/health" target="_blank" className="font-medium text-accent hover:underline">
                  /api/health
                </Link>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-2">Wersja aplikacji</dt>
              <dd className="font-medium text-ink">Etap 1</dd>
            </div>
          </dl>
        </Card>
      </div>
    </>
  );
}
