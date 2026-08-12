import "server-only";

// Odprawa AI przez płatne API Anthropica (Etap 4).
//
// Sama budowa danych żyje w lib/crm/briefing-payload.ts — jest czysta, więc
// korzysta z niej też scripts/odprawa.ts, który pozwala wygenerować odprawę
// w Claude Code (subskrypcja), bez kredytów API.

import { buildBriefingPayload, BRIEFING_SYSTEM, type BriefingData } from "@/lib/crm/briefing-payload";
import { askClaude } from "./client";

export { buildBriefingPayload, BRIEFING_SYSTEM };
export type { BriefingData };

/** Generuje treść odprawy (Markdown). Wywołujący zapisuje ją do crm_briefings. */
export async function generateBriefingText(data: BriefingData): Promise<string> {
  const payload = buildBriefingPayload(data);
  return askClaude({
    system: BRIEFING_SYSTEM,
    prompt: `Dane na dziś:\n\n${payload}\n\nNapisz odprawę.`,
    maxTokens: 3000,
  });
}
