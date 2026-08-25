// Czysta logika ekranu "Wysyłka DM" — masowej kampanii Instagram.
//
// Dlaczego osobny moduł bez "server-only": grupowanie i licznik postępu
// wykonuje też client component (optymistyczne odhaczanie), więc kod musi
// być czystą funkcją bez dostępu do bazy.

export type CrmDmBlitz = {
  id: string;
  name: string;
  city: string | null;
  niche: string;
  instagram: string;
  followers: number | null;
  dm_text: string;
  campaign: string;
  sent_at: string | null;
  sent_by: string | null;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
};

// Kolejność sekcji = kolejność uderzenia: od nisz o najwyższej częstotliwości
// wizyt (pizza piątkowa, kawa codzienna) do ogólnych restauracji.
export const BLITZ_NICHE_ORDER = [
  "pizza",
  "burgery",
  "kebab/street food",
  "kawiarnia",
  "cukiernia/lody",
  "sniadania/brunch",
  "sushi/azja",
  "boba/matcha",
  "vegan",
  "wloska",
  "restauracja",
] as const;

export const BLITZ_NICHE_LABELS: Record<string, string> = {
  pizza: "Pizza",
  burgery: "Burgery",
  "kebab/street food": "Kebab i street food",
  kawiarnia: "Kawiarnie",
  "cukiernia/lody": "Cukiernie, lody, piekarnie",
  "sniadania/brunch": "Śniadania i brunch",
  "sushi/azja": "Sushi i Azja",
  "boba/matcha": "Boba i matcha",
  vegan: "Vegan",
  wloska: "Włoskie",
  restauracja: "Restauracje",
};

export function blitzNicheLabel(niche: string): string {
  return BLITZ_NICHE_LABELS[niche] ?? niche;
}

export type BlitzGroup = {
  niche: string;
  label: string;
  rows: CrmDmBlitz[];
  sent: number;
};

/**
 * Grupuje wpisy po niszy w kolejności uderzenia; w grupie najpierw największe
 * profile (followers malejąco) — social proof liczy się od góry. Nisze spoza
 * znanej listy lądują na końcu zamiast znikać.
 */
export function groupBlitzByNiche(rows: CrmDmBlitz[]): BlitzGroup[] {
  const order = new Map<string, number>(BLITZ_NICHE_ORDER.map((n, i) => [n, i]));
  const byNiche = new Map<string, CrmDmBlitz[]>();
  for (const row of rows) {
    const list = byNiche.get(row.niche);
    if (list) list.push(row);
    else byNiche.set(row.niche, [row]);
  }
  const niches = [...byNiche.keys()].sort(
    (a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99) || a.localeCompare(b, "pl"),
  );
  return niches.map((niche) => {
    const list = byNiche.get(niche)!;
    list.sort(
      (a, b) =>
        (b.followers ?? 0) - (a.followers ?? 0) || a.name.localeCompare(b.name, "pl"),
    );
    return {
      niche,
      label: blitzNicheLabel(niche),
      rows: list,
      sent: list.filter((r) => r.sent_at !== null).length,
    };
  });
}

export function blitzProgress(rows: CrmDmBlitz[]): { sent: number; total: number } {
  return { sent: rows.filter((r) => r.sent_at !== null).length, total: rows.length };
}

/** "A" dla Adama, "O" dla Oliwiera — inicjał z e-maila do plakietki "kto wysłał". */
export function senderInitial(email: string | null): string | null {
  if (!email) return null;
  const first = email.trim()[0];
  return first ? first.toUpperCase() : null;
}
