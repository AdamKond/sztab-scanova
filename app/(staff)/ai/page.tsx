import Topbar from "@/components/shell/Topbar";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { isAiConfigured } from "@/lib/ai/client";
import { getBriefing } from "@/lib/crm/queries";
import { fullDate, warsawToday } from "@/lib/crm/dates";
import { BriefingPanel, GeneratorPanel } from "./AiPanels";

// Ekran AI (Etap 4): odprawa dnia + generator hooków. AI jest opcjonalne —
// bez klucza pokazujemy jawny stan wyłączenia zamiast udawać, że działa.
export default async function AiPage() {
  const configured = isAiConfigured();
  const today = warsawToday();
  // Odprawę czytamy ZAWSZE — może ją zapisać skrypt scripts/odprawa.ts
  // (tryb bez płatnego API), więc brak klucza nie znaczy brak odprawy.
  const briefing = await getBriefing(today);

  return (
    <>
      <Topbar title="Odprawa AI" />

      <div className="anim-in space-y-6">
        {!configured ? (
          <Card>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-semibold text-ink">
                Odprawa dnia — {fullDate(today)}
              </h2>
              <span className="rounded-md border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                sugestia AI
              </span>
            </div>
            {briefing ? (
              <pre className="mt-3 max-h-[600px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-canvas p-4 font-sans text-[14px] leading-relaxed text-ink">
                {briefing.content_md}
              </pre>
            ) : (
              <EmptyState
                title="Brak odprawy na dziś"
                hint="Generowanie w aplikacji wymaga ANTHROPIC_API_KEY. Bez kredytów zrobisz to w Claude Code: uruchom „npx tsx scripts/odprawa.ts”, poproś o napisanie odprawy, a potem „npx tsx scripts/odprawa.ts --zapisz odprawa.md”. Odprawa pojawi się tutaj."
              />
            )}
          </Card>
        ) : (
          <>
            <Card>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <h2 className="text-[15px] font-semibold text-ink">
                  Odprawa dnia — {fullDate(today)}
                </h2>
                <span className="rounded-md border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                  sugestia AI
                </span>
              </div>
              <p className="mb-3 text-[13px] text-ink-2">
                Do modelu trafiają wyłącznie zagregowane liczby, nazwy firm, etapy i następne
                kroki — bez telefonów, e-maili i notatek.
              </p>
              <BriefingPanel existing={briefing?.content_md ?? null} />
            </Card>

            <Card>
              <h2 className="mb-1 text-[15px] font-semibold text-ink">
                Generator hooków i skryptów
              </h2>
              <p className="mb-3 text-[13px] text-ink-2">
                Propozycja do ręcznej obróbki — nic nie publikuje się automatycznie.
              </p>
              <GeneratorPanel />
            </Card>
          </>
        )}
      </div>
    </>
  );
}
