import Link from "next/link";
import StepBadge from "./StepBadge";
import { STEP_HINTS, stepOf } from "@/lib/crm/steps";
import { daysBetween, daysSince, warsawDateOf } from "@/lib/crm/dates";
import type { CrmLead } from "@/lib/crm/types";

// Wiersz rozmowy — wspólny dla Dziś i listy Rozmów. Server component (bez hooków).
export default function ConversationRow({ lead, today }: { lead: CrmLead; today: string }) {
  const step = stepOf(lead.status);
  const dueDay = lead.next_action_at ? warsawDateOf(lead.next_action_at) : null;
  const overdueDays = dueDay && dueDay < today ? daysBetween(dueDay, today) : 0;
  const quietDays = daysSince(lead.last_activity_at ?? lead.updated_at);

  return (
    <li>
      <Link
        href={`/rozmowy/${lead.id}`}
        className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-canvas"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-[15px] font-semibold text-ink">{lead.name}</span>
            <StepBadge status={lead.status} />
            {overdueDays > 0 ? (
              <span className="text-[12px] font-semibold text-danger">
                {overdueDays} {overdueDays === 1 ? "dzień" : "dni"} po terminie
              </span>
            ) : dueDay === today ? (
              <span className="text-[12px] font-semibold text-accent">dziś</span>
            ) : null}
          </div>
          <div className="mt-0.5 truncate text-[13px] text-ink-2">
            {lead.next_action ?? STEP_HINTS[step]}
            {lead.city ? ` · ${lead.city}` : ""}
            {quietDays > 0 ? ` · cisza ${quietDays} ${quietDays === 1 ? "dzień" : "dni"}` : ""}
          </div>
        </div>
        <span className="shrink-0 text-ink-3" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
      </Link>
    </li>
  );
}
