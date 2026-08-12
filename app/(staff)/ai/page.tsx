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
  const briefing = configured ? await getBriefing(today) : null;

  return (
    <>
      <Topbar title="Odprawa AI" />

      <div className="space-y-4">
        {!configured ? (
          <Card>
            <EmptyState
              title="AI jest wyłączone"
              hint="Dodaj ANTHROPIC_API_KEY do .env.local (i na Vercelu), żeby włączyć odprawę i generator. Cały CRM działa bez tego."
            />
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
