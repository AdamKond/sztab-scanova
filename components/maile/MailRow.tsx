"use client";

// Jeden adres w kolejce: stan sekwencji, odpowiedź, przyciski.

import { useState, useTransition } from "react";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { MAIL_STATUS_LABELS, type CrmMailRow } from "@/lib/crm/mail/types";
import { markMailReplied, removeMailContact, retryMail, setMailHold, unsubscribeMail } from "@/lib/crm/mail-actions";
import { shortDateTime } from "@/lib/crm/dates";

const TONE: Record<CrmMailRow["status"], "neutral" | "accent" | "success" | "danger" | "warning"> = {
  oczekuje: "neutral",
  wyslany: "accent",
  followup: "accent",
  zamkniety: "neutral",
  odpowiedzial: "success",
  odbil: "danger",
  skarga: "danger",
  wypisany: "warning",
  wstrzymany: "warning",
  blad: "danger",
};

export default function MailRow({ row }: { row: CrmMailRow }) {
  const [confirm, setConfirm] = useState<"reply" | "unsub" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReply, setShowReply] = useState(false);
  const [pending, startTransition] = useTransition();

  function ask(kind: "reply" | "unsub" | "remove", fn: () => Promise<{ error?: string }>) {
    if (confirm !== kind) {
      setConfirm(kind);
      setTimeout(() => setConfirm((c) => (c === kind ? null : c)), 3000);
      return;
    }
    setConfirm(null);
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
    });
  }

  const active = row.status === "oczekuje" || row.status === "wyslany" || row.status === "followup" || row.status === "blad";
  const timeline = [
    row.sent_at ? `#1 ${shortDateTime(row.sent_at)}` : null,
    row.step2_at ? `#2 ${shortDateTime(row.step2_at)}` : null,
    row.step3_at ? `#3 ${shortDateTime(row.step3_at)}` : null,
    row.replied_at ? `odp. ${shortDateTime(row.replied_at)}` : null,
  ].filter(Boolean);

  return (
    <li className="px-3 py-3 first:pt-1 last:pb-1">
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className={`mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
            row.status === "odpowiedzial" ? "bg-success text-white" : row.step > 0 ? "bg-accent-soft text-accent" : "bg-canvas text-ink-3"
          }`}
        >
          {row.status === "odpowiedzial" ? (
            <svg viewBox="0 0 16 16" className="h-3 w-3 fill-none stroke-current stroke-[3]">
              <path d="M2.5 8.5 6 12l7.5-8" />
            </svg>
          ) : (
            row.step
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-[15px] font-semibold text-ink">{row.name}</span>
            <Badge tone={TONE[row.status]}>{MAIL_STATUS_LABELS[row.status]}</Badge>
            {row.niche !== "restauracja" ? <span className="text-[12px] text-ink-3">{row.niche}</span> : null}
          </div>
          <div className="mt-0.5 truncate text-[13px] text-ink-2">
            <span className="select-all">{row.email}</span>
            {row.city ? ` · ${row.city}` : ""}
            {row.www ? (
              <>
                {" · "}
                <a href={row.www} target="_blank" rel="noreferrer" className="hover:text-accent">
                  www
                </a>
              </>
            ) : null}
            {timeline.length ? ` · ${timeline.join(" · ")}` : ""}
            {row.mailbox ? ` · z ${row.mailbox.split("@")[0]}` : ""}
          </div>
          {row.last_error ? <p className="mt-1 text-[12.5px] text-danger">{row.last_error}</p> : null}
          {row.reply_excerpt ? (
            <button type="button" onClick={() => setShowReply((v) => !v)} className="mt-1 text-left text-[12.5px] text-ink-2 hover:text-ink">
              {showReply ? row.reply_excerpt : `„${row.reply_excerpt.slice(0, 90)}${row.reply_excerpt.length > 90 ? "…" : ""}”`}
            </button>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {row.lead_id ? (
              <Link href={`/rozmowy/${row.lead_id}`} className={buttonClass("success", "sm")}>
                Otwórz rozmowę →
              </Link>
            ) : null}
            {!row.lead_id && row.status !== "odbil" && row.status !== "skarga" ? (
              <button type="button" disabled={pending} onClick={() => ask("reply", () => markMailReplied(row.id))} className={buttonClass(confirm === "reply" ? "primary" : "ghost", "sm")}>
                {confirm === "reply" ? "Na pewno odpisał?" : "Odpowiedział"}
              </button>
            ) : null}
            {active ? (
              <button type="button" disabled={pending} onClick={() => startTransition(async () => { const r = await setMailHold(row.id, true); if (r.error) setError(r.error); })} className={buttonClass("ghost", "sm")}>
                Wstrzymaj
              </button>
            ) : null}
            {row.status === "wstrzymany" ? (
              <button type="button" disabled={pending} onClick={() => startTransition(async () => { const r = await setMailHold(row.id, false); if (r.error) setError(r.error); })} className={buttonClass("secondary", "sm")}>
                Wznów
              </button>
            ) : null}
            {row.status === "blad" ? (
              <button type="button" disabled={pending} onClick={() => startTransition(async () => { const r = await retryMail(row.id); if (r.error) setError(r.error); })} className={buttonClass("secondary", "sm")}>
                Ponów
              </button>
            ) : null}
            {row.status !== "wypisany" && row.status !== "odbil" && row.status !== "skarga" && !row.lead_id ? (
              <button type="button" disabled={pending} onClick={() => ask("unsub", () => unsubscribeMail(row.id))} className={buttonClass(confirm === "unsub" ? "danger" : "ghost", "sm")}>
                {confirm === "unsub" ? "Wypisać na stałe?" : "Nie pisać"}
              </button>
            ) : null}
            {!row.sent_at && row.status !== "wypisany" ? (
              <button type="button" disabled={pending} onClick={() => ask("remove", () => removeMailContact(row.id))} className={buttonClass(confirm === "remove" ? "danger" : "ghost", "sm")}>
                {confirm === "remove" ? "Usunąć?" : "Usuń"}
              </button>
            ) : null}
          </div>
          {error ? <p className="mt-2 text-[13px] font-medium text-danger">{error}</p> : null}
        </div>
      </div>
    </li>
  );
}
