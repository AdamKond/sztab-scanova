"use server";

// Akcje AI (Etap 4). Jak wszystkie mutacje: guardStaffAction() na wejściu.
// AI jest opcjonalne — akcje zwracają czytelny błąd, gdy brakuje klucza.

import { revalidatePath } from "next/cache";
import { guardStaffAction } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";
import {
  getSettings,
  listActivities,
  listGoals,
  listLeads,
  listStageHistory,
} from "@/lib/crm/queries";
import { warsawToday } from "@/lib/crm/dates";
import { clampText } from "@/lib/crm/normalize";
import { isAiConfigured } from "@/lib/ai/client";
import { generateBriefingText } from "@/lib/ai/briefing";
import { generateContentIdea } from "@/lib/ai/generator";

export interface AiResult {
  error?: string;
  ok?: boolean;
  /** Wygenerowany tekst (Markdown) */
  text?: string;
}

export async function generateBriefingAction(): Promise<AiResult> {
  const user = await guardStaffAction();
  if (!isAiConfigured()) {
    return { error: "Brak ANTHROPIC_API_KEY w konfiguracji — odprawa AI jest wyłączona." };
  }

  try {
    const [leads, activities, history, goals, settings] = await Promise.all([
      listLeads(),
      listActivities(),
      listStageHistory(),
      listGoals(),
      getSettings(),
    ]);
    const text = await generateBriefingText({ leads, activities, history, goals, settings });

    // Zapis odprawy: jedna na dzień (upsert po dacie) — audyt + brak
    // wielokrotnego płacenia za ten sam dzień przy odświeżeniu strony.
    const db = getServiceClient();
    const { error } = await db
      .from("crm_briefings")
      .upsert(
        {
          briefing_date: warsawToday(),
          content_md: text,
          created_by: user.email!.toLowerCase(),
        },
        { onConflict: "briefing_date" },
      );
    if (error) return { error: `Odprawa wygenerowana, ale zapis nie wyszedł: ${error.message}` };

    revalidatePath("/ai");
    return { ok: true, text };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nieznany błąd generowania odprawy." };
  }
}

export async function generateContentIdeaAction(formData: FormData): Promise<AiResult> {
  await guardStaffAction();
  if (!isAiConfigured()) {
    return { error: "Brak ANTHROPIC_API_KEY w konfiguracji — generator jest wyłączony." };
  }

  const temat = clampText(formData.get("temat") as string | null, 300);
  const grupa = clampText(formData.get("grupa") as string | null, 200);
  const cel = clampText(formData.get("cel") as string | null, 200);
  if (!temat) return { error: "Temat jest wymagany." };

  try {
    const text = await generateContentIdea({
      temat,
      grupa: grupa ?? "właściciele lokali gastro w Polsce",
      cel: cel ?? "pozyskanie zapytań o demo",
    });
    return { ok: true, text };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nieznany błąd generatora." };
  }
}
