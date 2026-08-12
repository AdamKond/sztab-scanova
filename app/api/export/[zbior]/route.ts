import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth";
import {
  listActivities,
  listAdsLog,
  listContent,
  listGoals,
  listLeads,
  listPartners,
  listStageHistory,
  listTasks,
} from "@/lib/crm/queries";
import { warsawToday } from "@/lib/crm/dates";

// Eksport danych do CSV (Etap 2). Route handler zamiast server action,
// żeby przeglądarka dostała zwykły plik do pobrania.
// Autoryzacja jak wszędzie: brak dostępu = 404, sekcja nie istnieje.

const EXPORTS = {
  leady: listLeads,
  aktywnosci: listActivities,
  zadania: listTasks,
  cele: listGoals,
  historia: listStageHistory,
  partnerzy: listPartners,
  content: listContent,
  reklamy: listAdsLog,
} as const;

type ExportKey = keyof typeof EXPORTS;

// Poprawny CSV: cudzysłowy podwajane, pole z przecinkiem/nową linią w cudzysłowach.
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h])).join(","));
  }
  // BOM — bez niego Excel na Windows psuje polskie znaki.
  return `﻿${lines.join("\r\n")}`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ zbior: string }> },
) {
  const user = await getStaffUser();
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { zbior } = await params;
  const loader = EXPORTS[zbior as ExportKey];
  if (!loader) {
    return NextResponse.json(
      { error: `Nieznany zbiór. Dostępne: ${Object.keys(EXPORTS).join(", ")}` },
      { status: 400 },
    );
  }

  const rows = (await loader()) as unknown as Record<string, unknown>[];
  const csv = toCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sztab-${zbior}-${warsawToday()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
