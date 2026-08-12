import "server-only";

// Klient Anthropic — WYŁĄCZNIE po stronie serwera. AI jest opcjonalne:
// bez ANTHROPIC_API_KEY cały CRM działa, a funkcje AI są ukryte w UI.

import Anthropic from "@anthropic-ai/sdk";

// Model konfigurowalny bez deployu; domyślnie Opus 5 (decyzja użytkownika:
// jakość ważniejsza niż koszt — odprawa generuje się raz dziennie).
export const AI_MODEL = process.env.SZTAB_AI_MODEL ?? "claude-opus-5";

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!isAiConfigured()) {
    throw new Error("Brak ANTHROPIC_API_KEY — funkcje AI są wyłączone.");
  }
  if (!cached) cached = new Anthropic();
  return cached;
}

/**
 * Wywołanie modelu z domyślnym fallbackiem serwerowym: klasyfikatory
 * bezpieczeństwa Opusa 5 mogą odmówić (stop_reason "refusal") — wtedy API
 * samo ponawia zapytanie na modelu zastępczym zamiast zwracać odmowę.
 * Zwraca czysty tekst albo rzuca polskim błędem.
 */
export async function askClaude(options: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  const client = getAnthropic();
  const response = await client.beta.messages.create({
    model: AI_MODEL,
    max_tokens: options.maxTokens ?? 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    system: options.system,
    messages: [{ role: "user", content: options.prompt }],
  });

  // Odmowa całego łańcucha (model + fallback) — nie czytamy content na ślepo.
  if (response.stop_reason === "refusal") {
    throw new Error("Model odmówił wygenerowania odpowiedzi. Spróbuj zmienić treść.");
  }

  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("Model zwrócił pustą odpowiedź.");
  return text;
}
