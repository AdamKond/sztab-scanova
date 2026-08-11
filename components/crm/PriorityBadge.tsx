import Badge from "@/components/ui/Badge";
import type { LeadPriority } from "@/lib/crm/types";

// A wyróżnione na niebiesko — to leady, na które ma iść czas w pierwszej
// kolejności. D celowo wyszarzone, a nie czerwone: niskie dopasowanie
// to nie jest "ryzyko", tylko niski priorytet.
const TONES = {
  A: "blue",
  B: "neutral",
  C: "slate",
  D: "slate",
} as const;

export default function PriorityBadge({ priority }: { priority: LeadPriority }) {
  return <Badge tone={TONES[priority]}>{priority}</Badge>;
}
