import Link from "next/link";
import Topbar from "@/components/shell/Topbar";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { Input, Label, Textarea } from "@/components/ui/Field";
import ActionForm, { SubmitButton } from "@/components/crm/ActionForm";
import StatusBadge from "@/components/crm/StatusBadge";
import { savePartner, togglePartnerActive } from "@/lib/crm/actions";
import { listLeads, listPartners } from "@/lib/crm/queries";
import type { CrmLead, CrmPartner } from "@/lib/crm/types";

// Partnerzy = osoby, które polecają nas dalej (właściciele lokali, agencje,
// dostawcy POS). Ekran ma odpowiadać na jedno pytanie: który partner realnie
// przynosi płacących klientów, a który tylko obiecuje.

const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});

export default async function PartnerzyPage() {
  const [partners, leads] = await Promise.all([listPartners(), listLeads()]);

  // Leady z poleceń pogrupowane po partnerze — jedno przejście zamiast filtra
  // po tablicy dla każdej karty (przy kilkuset leadach to już różnica).
  const referredByPartner = new Map<string, CrmLead[]>();
  for (const lead of leads) {
    if (!lead.partner_id) continue;
    const bucket = referredByPartner.get(lead.partner_id);
    if (bucket) bucket.push(lead);
    else referredByPartner.set(lead.partner_id, [lead]);
  }

  function PartnerFields({ partner }: { partner?: CrmPartner }) {
    const key = partner?.id ?? "new";
    return (
      <>
        <div className="md:col-span-2">
          <Label htmlFor={`p-name-${key}`}>Nazwa partnera *</Label>
          <Input
            id={`p-name-${key}`}
            name="name"
            required
            maxLength={240}
            defaultValue={partner?.name}
            placeholder="np. MUSI — Lublin"
          />
        </div>
        <div>
          <Label htmlFor={`p-contact-${key}`}>Osoba kontaktowa</Label>
          <Input
            id={`p-contact-${key}`}
            name="contact_name"
            defaultValue={partner?.contact_name ?? ""}
            placeholder="np. Michał, właściciel"
          />
        </div>
        <div>
          <Label htmlFor={`p-phone-${key}`}>Telefon</Label>
          <Input id={`p-phone-${key}`} name="phone" type="tel" defaultValue={partner?.phone ?? ""} />
        </div>
        <div>
          <Label htmlFor={`p-email-${key}`}>E-mail</Label>
          <Input id={`p-email-${key}`} name="email" type="email" defaultValue={partner?.email ?? ""} />
        </div>
        <div>
          <Label htmlFor={`p-ig-${key}`}>Instagram</Label>
          <Input
            id={`p-ig-${key}`}
            name="instagram"
            defaultValue={partner?.instagram ?? ""}
            placeholder="nazwa_konta"
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor={`p-commission-${key}`}>Zasady prowizji</Label>
          <Input
            id={`p-commission-${key}`}
            name="commission_note"
            defaultValue={partner?.commission_note ?? ""}
            placeholder="np. 20% pierwszego miesiąca za płacącego klienta"
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor={`p-notes-${key}`}>Notatki</Label>
          <Textarea
            id={`p-notes-${key}`}
            name="notes"
            rows={2}
            defaultValue={partner?.notes ?? ""}
            placeholder="Kogo zna, czego oczekuje, kiedy się odzywać…"
          />
        </div>
      </>
    );
  }

  function PartnerCard({ partner }: { partner: CrmPartner }) {
    const referred = (referredByPartner.get(partner.id) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "pl"));
    const paid = referred.filter((l) => l.status === "platny_klient");
    // MRR z poleceń liczymy WYŁĄCZNIE z płatnych klientów — pilot nie jest
    // przychodem, więc nie może podbijać wartości partnera.
    const referralMrr = paid.reduce((sum, l) => sum + (l.monthly_revenue ?? 0), 0);

    return (
      <Card className={partner.active ? undefined : "bg-canvas"}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={`min-w-0 flex-1 truncate text-[15px] font-semibold ${partner.active ? "text-ink" : "text-ink-2"}`}>
            {partner.name}
          </h3>
          <Badge tone={partner.active ? "green" : "slate"}>
            {partner.active ? "aktywny" : "nieaktywny"}
          </Badge>
        </div>

        {partner.contact_name ? (
          <p className="mt-0.5 text-[13px] text-ink-2">{partner.contact_name}</p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {partner.phone ? (
            <a
              href={`tel:${partner.phone}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-line px-2.5 text-[12px] font-medium text-ink hover:bg-canvas md:min-h-0 md:py-1.5"
            >
              {partner.phone}
            </a>
          ) : null}
          {partner.email ? (
            <a
              href={`mailto:${partner.email}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-line px-2.5 text-[12px] font-medium text-ink hover:bg-canvas md:min-h-0 md:py-1.5"
            >
              {partner.email}
            </a>
          ) : null}
          {partner.instagram ? (
            <a
              href={`https://instagram.com/${partner.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-lg border border-line px-2.5 text-[12px] font-medium text-ink hover:bg-canvas md:min-h-0 md:py-1.5"
            >
              @{partner.instagram}
            </a>
          ) : null}
        </div>

        {partner.commission_note ? (
          <p className="mt-2 text-[13px] text-ink">
            <span className="text-ink-2">Prowizja:</span> {partner.commission_note}
          </p>
        ) : null}
        {partner.notes ? (
          <p className="mt-1 whitespace-pre-wrap text-[13px] text-ink-2">{partner.notes}</p>
        ) : null}

        <div className="mt-3 border-t border-line pt-2">
          <p className="text-[13px] text-ink-2">
            <span className="tabular font-medium text-ink">{referred.length}</span> poleconych ·{" "}
            <span className="tabular font-medium text-ink">{paid.length}</span> płatnych · MRR z
            poleceń: <span className="tabular font-medium text-success">{pln.format(referralMrr)}</span>
          </p>

          {referred.length === 0 ? (
            <p className="mt-1.5 text-[12px] text-ink-2">
              Brak poleconych leadów. Przypięcie robi się z karty leada — pole „Partner”.
            </p>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {referred.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/leady/${l.id}`}
                    className="min-w-0 max-w-full truncate text-[13px] font-medium text-ink hover:text-accent"
                  >
                    {l.name}
                  </Link>
                  <StatusBadge status={l.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <details>
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-line px-3 text-[13px] font-medium text-ink hover:bg-canvas md:min-h-0 md:py-1.5">
              Edytuj
            </summary>
            <div className="mt-2">
              <ActionForm
                action={savePartner}
                onSuccessMessage="Zapisano."
                className="grid grid-cols-1 gap-2.5 md:grid-cols-2"
              >
                <input type="hidden" name="partner_id" value={partner.id} />
                <PartnerFields partner={partner} />
                <div className="md:col-span-2">
                  <SubmitButton size="sm">Zapisz partnera</SubmitButton>
                </div>
              </ActionForm>
            </div>
          </details>

          <form
            action={async () => {
              // Goły <form action> oczekuje void — opakowujemy akcję zwracającą ActionResult.
              "use server";
              await togglePartnerActive(partner.id);
            }}
          >
            <button
              type="submit"
              className="min-h-11 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink hover:bg-canvas md:min-h-0 md:py-1.5"
            >
              {partner.active ? "Dezaktywuj" : "Aktywuj"}
            </button>
          </form>
        </div>
      </Card>
    );
  }

  const active = partners.filter((p) => p.active);
  const inactive = partners.filter((p) => !p.active);

  return (
    <>
      <Topbar title="Partnerzy" />

      <div className="anim-in space-y-6">
        <p className="text-[13px] text-ink-2">
          Partnerzy polecają nas dalej za prowizję. Leada przypina się do partnera{" "}
          <span className="font-medium text-ink">z karty leada</span> (pole „Partner”) — tutaj widać
          efekt: ile poleceń i ile z nich płaci.
        </p>

        <Card>
          <h2 className="mb-3 text-[14px] font-semibold text-ink">+ Nowy partner</h2>
          <ActionForm
            action={savePartner}
            resetOnSuccess
            onSuccessMessage="Partner dodany."
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
          >
            <PartnerFields />
            <div className="md:col-span-2">
              <SubmitButton>Zapisz partnera</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        {partners.length === 0 ? (
          <Card>
            <EmptyState
              title="Brak partnerów"
              hint="Dodaj pierwszego partnera — np. właścicieli MUSI albo Kago, którzy polecają nas znajomym z branży. Prowizję zapisz od razu, żeby nie było niedomówień przy pierwszej wypłacie."
            />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {active.map((p) => (
                <PartnerCard key={p.id} partner={p} />
              ))}
            </div>

            {inactive.length > 0 ? (
              <details>
                <summary className="min-h-11 cursor-pointer text-[14px] font-semibold text-ink">
                  Nieaktywni ({inactive.length})
                </summary>
                <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {inactive.map((p) => (
                    <PartnerCard key={p.id} partner={p} />
                  ))}
                </div>
              </details>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
