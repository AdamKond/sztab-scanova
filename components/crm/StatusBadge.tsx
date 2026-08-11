import Badge from "@/components/ui/Badge";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/crm/constants";
import type { LeadStatus } from "@/lib/crm/types";

// Jedno miejsce mapowania etap -> kolor. Ekrany nie znają palety statusów.
export default function StatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
