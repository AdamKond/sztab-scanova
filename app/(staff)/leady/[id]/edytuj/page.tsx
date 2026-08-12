import { notFound } from "next/navigation";
import Topbar from "@/components/shell/Topbar";
import LeadForm from "@/components/crm/LeadForm";
import { getLead } from "@/lib/crm/queries";
import { updateLead } from "@/lib/crm/actions";

// Lista prowadzących = allowlista dostępu (STAFF_EMAILS), patrz komentarz w
// app/(staff)/leady/nowy/page.tsx.
function owners(): string[] {
  const raw = process.env.STAFF_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export default async function EdytujLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  // .bind domyka id leada — updateLead pozostaje server actionem zgodnym
  // z sygnaturą (formData) => Promise<ActionResult>, której oczekuje LeadForm.
  const action = updateLead.bind(null, id);

  return (
    <>
      <Topbar title={`Edytuj: ${lead.name}`} />
      <LeadForm lead={lead} action={action} submitLabel="Zapisz zmiany" owners={owners()} />
    </>
  );
}
