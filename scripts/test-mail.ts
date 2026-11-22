// Wysyła mail testowy (krok 1, 2 albo 3) na podany adres, dokładnie tak, jak
// zrobi to cron — z pierwszej skrzynki w MAIL_ACCOUNTS (.env.local).
//
//   npx tsx scripts/test-mail.ts adres@gmail.com [--wariant=oferta|pytanie] [--krok=1|2|3] [--nazwa="Pizzeria Testowa"]
//
// Nie dotyka bazy ani kolejki. Temat ma przedrostek [TEST].

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { firstSubjectFor, renderMail, type MailContext } from "../lib/crm/mail/copy";

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const to = args.find((a) => !a.startsWith("--"));
  if (!to || !to.includes("@")) {
    console.error('Użycie: npx tsx scripts/test-mail.ts adres@gmail.com [--wariant=oferta|pytanie] [--krok=1|2|3] [--nazwa="..."]');
    process.exit(1);
  }
  const variant = args.find((a) => a.startsWith("--wariant="))?.slice(10) === "pytanie" ? "pytanie" : "oferta";
  const step = (Number(args.find((a) => a.startsWith("--krok="))?.slice(7) ?? "1") || 1) as 1 | 2 | 3;
  const name = args.find((a) => a.startsWith("--nazwa="))?.slice(8) ?? "Pizzeria Testowa";

  const accounts = JSON.parse(process.env.MAIL_ACCOUNTS ?? "[]") as { email: string; pass: string; name?: string }[];
  const acc = accounts[0];
  if (!acc) throw new Error("Brak MAIL_ACCOUNTS w .env.local");
  const senderName = acc.name ?? "Adam Kondracki";

  const ctx: MailContext = {
    name,
    city: "Lublin",
    niche: "pizza",
    senderName,
    senderEmail: acc.email,
    phone: process.env.MAIL_PHONE?.trim() || null,
    unsubscribeUrl: `${process.env.NEXT_PUBLIC_SZTAB_URL ?? "https://sztab-scanova.vercel.app"}/api/mail/wypisz?e=test&t=test`,
  };
  const first = firstSubjectFor(variant, name, "test");
  const r = renderMail(step, variant, ctx, first);

  const t = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: acc.email, pass: acc.pass } });
  const info = await t.sendMail({
    from: { name: senderName, address: acc.email },
    to,
    subject: `[TEST] ${r.subject}`,
    text: r.text,
    html: r.html,
    messageId: `<${randomUUID()}@${acc.email.split("@")[1]}>`,
    headers: { "List-Unsubscribe": `<${ctx.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
  console.log(`Wysłano z ${acc.email} do ${to}: „${r.subject}” (wariant ${variant}, krok ${step}, ${r.html ? "HTML+tekst" : "tekst"}) — ${info.messageId}`);
}

main().catch((err) => {
  console.error("Błąd:", err instanceof Error ? err.message : err);
  process.exit(1);
});
