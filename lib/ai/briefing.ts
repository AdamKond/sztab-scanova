import "server-only";

// Odprawa AI (Etap 4). Zasada prywatności ze specyfikacji: do Anthropic NIE
// wysyłamy numerów telefonów, prywatnych e-maili, pełnych notatek, sekretów
// ani danych klientów końcowych lokali. Payload budujemy WYŁĄCZNIE z pól
// jawnie wymienionych poniżej — nazwa firmy, etap, priorytet, następny krok
// i zagregowane liczby.

import {
  ACTIVITY_LABELS,
  GOAL_METRIC_LABELS,
  STATUS_LABELS,
} from "@/lib/crm/constants";
import { daysBetween, warsawDateOf, warsawToday, addDays } from "@/lib/crm/dates";
import {
  computeMrr,
  followupBuckets,
  goalProgress,
  pilotsEndingSoon,
  pilotsNeedingCheckin,
  funnelCounts,
} from "@/lib/crm/metrics";
import type {
  CrmActivity,
  CrmLead,
  CrmSettings,
  CrmStageHistory,
  SalesGoal,
} from "@/lib/crm/types";
import { askClaude } from "./client";

export interface BriefingData {
  leads: CrmLead[];
  activities: CrmActivity[];
  history: CrmStageHistory[];
  goals: SalesGoal[];
  settings: CrmSettings;
}

/** Buduje odczłowieczony (bez danych kontaktowych) opis stanu sprzedaży. */
export function buildBriefingPayload(data: BriefingData, now: Date = new Date()): string {
  const today = warsawToday(now);
  const yesterday = addDays(today, -1);
  const lines: string[] = [];

  // Wczorajsze wyniki — tylko agregaty.
  const yesterdayActivities = data.activities.filter(
    (a) => warsawDateOf(a.happened_at) === yesterday,
  );
  const byType = new Map<string, number>();
  for (const a of yesterdayActivities) {
    byType.set(ACTIVITY_LABELS[a.type], (byType.get(ACTIVITY_LABELS[a.type]) ?? 0) + 1);
  }
  lines.push(`## Wczoraj (${yesterday})`);
  lines.push(
    byType.size === 0
      ? "Brak zarejestrowanych aktywności."
      : [...byType.entries()].map(([label, n]) => `${label}: ${n}`).join(", "),
  );
  const yesterdayTransitions = data.history.filter(
    (h) => warsawDateOf(h.changed_at) === yesterday && h.from_status !== null,
  );
  if (yesterdayTransitions.length > 0) {
    lines.push(
      `Zmiany etapów: ${yesterdayTransitions
        .map((h) => `${STATUS_LABELS[h.from_status!]} → ${STATUS_LABELS[h.to_status]}`)
        .join("; ")}`,
    );
  }

  // Lejek — stan obecny (liczby).
  const counts = funnelCounts(data.leads);
  lines.push("\n## Lejek (liczba leadów w etapie)");
  lines.push(
    [...counts.entries()].map(([status, n]) => `${STATUS_LABELS[status]}: ${n}`).join(", "),
  );
  lines.push(`MRR: ${computeMrr(data.leads).toFixed(0)} zł`);

  // Leady A/B z terminem na dziś albo zaległe — nazwa, etap, następny krok.
  const buckets = followupBuckets(data.leads, now);
  const priorityAB = (l: CrmLead) => l.priority === "A" || l.priority === "B";
  const describeLead = (l: CrmLead, extra: string) =>
    `- ${l.name} [${l.priority}] (${STATUS_LABELS[l.status]}) — następny krok: ${
      l.next_action ?? "brak"
    }${extra}`;
  lines.push("\n## Follow-upy A/B zaległe");
  const overdue = buckets.overdue.filter(priorityAB);
  lines.push(
    overdue.length === 0
      ? "Brak."
      : overdue
          .map((l) =>
            describeLead(l, ` (${daysBetween(warsawDateOf(l.next_action_at!), today)} dni po terminie)`),
          )
          .join("\n"),
  );
  lines.push("\n## Follow-upy A/B na dziś");
  const todayList = buckets.today.filter(priorityAB);
  lines.push(todayList.length === 0 ? "Brak." : todayList.map((l) => describeLead(l, "")).join("\n"));

  // Piloty zbliżające się do decyzji + bez opieki.
  const ending = pilotsEndingSoon(data.leads, data.settings.pilot_ending_soon_days, now);
  lines.push("\n## Piloty blisko decyzji");
  lines.push(
    ending.length === 0
      ? "Brak."
      : ending
          .map(
            (l) =>
              `- ${l.name} — koniec pilota ${warsawDateOf(l.pilot_ends_at!)} (za ${daysBetween(
                today,
                warsawDateOf(l.pilot_ends_at!),
              )} dni)`,
          )
          .join("\n"),
  );
  const quiet = pilotsNeedingCheckin(
    data.leads,
    data.activities,
    data.settings.pilot_checkin_after_days,
    now,
  );
  if (quiet.length > 0) {
    lines.push(`Piloty bez check-inu: ${quiet.map((l) => l.name).join(", ")}`);
  }

  // Aktywne cele z postępem.
  const activeGoals = data.goals.filter(
    (g) => g.active && g.starts_on <= today && g.ends_on >= today,
  );
  lines.push("\n## Aktywne cele");
  lines.push(
    activeGoals.length === 0
      ? "Brak aktywnych celów."
      : activeGoals
          .map((g) => {
            const p = goalProgress(g, data);
            return `- ${g.name} (${GOAL_METRIC_LABELS[g.metric]}): ${p.actual} / ${g.target_value}, zostało ${daysBetween(today, g.ends_on)} dni`;
          })
          .join("\n"),
  );

  return lines.join("\n");
}

const BRIEFING_SYSTEM = `Jesteś doświadczonym szefem sprzedaży w SCANOVIE — polskim systemie
utrzymania klientów dla lokali gastronomicznych (karty lojalnościowe w Apple/Google Wallet).
Zespół sprzedaży to dwie osoby: Adam i Oliwier. Piszesz krótką poranną odprawę po polsku,
na podstawie WYŁĄCZNIE przekazanych danych — niczego nie zmyślasz. Jeśli danych brakuje,
mówisz to wprost.

Format odpowiedzi (Markdown, zwięźle, bez lania wody):
## 3 priorytety dnia
(ponumerowane, konkretne — co zrobić i dlaczego właśnie to)
## Follow-upy
(konkretne firmy z uzasadnieniem, dlaczego dziś)
## Ryzyko lejka
(JEDNO najważniejsze ryzyko widoczne w danych)
## Eksperyment
(JEDNA rekomendacja eksperymentu do przetestowania w tym tygodniu)

Priorytetem są rozmowy z decydentami, piloty i płatni klienci — nie liczba aktywności.`;

/** Generuje treść odprawy (Markdown). Wywołujący zapisuje ją do crm_briefings. */
export async function generateBriefingText(data: BriefingData): Promise<string> {
  const payload = buildBriefingPayload(data);
  return askClaude({
    system: BRIEFING_SYSTEM,
    prompt: `Dane na dziś:\n\n${payload}\n\nNapisz odprawę.`,
    maxTokens: 3000,
  });
}
