import "server-only";

// Generator hooków i skryptów contentowych (Etap 4). Generuje propozycję —
// NICZEGO nie publikuje automatycznie; człowiek kopiuje do pipeline'u contentu.

import { askClaude } from "./client";

const GENERATOR_SYSTEM = `Jesteś copywriterem krótkich wideo (Reels/TikTok/Shorts) dla SCANOVY —
polskiego systemu utrzymania klientów dla lokali (karty lojalnościowe w Apple/Google Wallet,
NFC/QR, powiadomienia, opinie Google). Odbiorcy contentu to właściciele kawiarni, piekarni,
lunchowni i małych sieci gastro w Polsce.

Piszesz po polsku, konkretnie, bez korpomowy i bez obietnic bez pokrycia.

Format odpowiedzi (Markdown):
## Hook
(1-2 zdania otwierające — pierwsze 3 sekundy wideo; ma zatrzymać scrollowanie)
## Skrypt
(30-60 sekund mówienia, krótkie zdania, podział na ujęcia; na końcu jedno CTA)
## Wariant B hooka
(alternatywny hook w innym tonie)`;

export async function generateContentIdea(input: {
  temat: string;
  grupa: string;
  cel: string;
}): Promise<string> {
  return askClaude({
    system: GENERATOR_SYSTEM,
    prompt: `Temat: ${input.temat}\nGrupa docelowa: ${input.grupa}\nCel materiału: ${input.cel}\n\nNapisz hook i skrypt.`,
    maxTokens: 2000,
  });
}
