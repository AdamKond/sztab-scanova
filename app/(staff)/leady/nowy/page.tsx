import Topbar from "@/components/shell/Topbar";
import Card from "@/components/ui/Card";
import LeadForm from "@/components/crm/LeadForm";
import { createLead } from "@/lib/crm/actions";

// Lista prowadzących = allowlista dostępu (STAFF_EMAILS) — SZTAB ma dokładnie
// dwóch użytkowników, więc "prowadzący" to po prostu wybór spośród nich,
// bez osobnej tabeli kont. Env server-only, więc czytamy w server komponencie.
function owners(): string[] {
  const raw = process.env.STAFF_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export default function NowyLeadPage() {
  return (
    <>
      <Topbar title="Nowy lead" />
      <LeadForm action={createLead} submitLabel="Utwórz leada" owners={owners()} />
    </>
  );
}
