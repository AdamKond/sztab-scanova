import Badge from "@/components/ui/Badge";
import { STEP_LABELS, STEP_TONES, stepOf } from "@/lib/crm/steps";
import type { LeadStatus } from "@/lib/crm/types";

// Jedno miejsce mapowania status -> krok -> kolor. Ekrany nie znają palety statusów.
export default function StepBadge({ status }: { status: LeadStatus }) {
  const step = stepOf(status);
  return <Badge tone={STEP_TONES[step]}>{STEP_LABELS[step]}</Badge>;
}
