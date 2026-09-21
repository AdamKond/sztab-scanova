"use client";

// Jeden lokal w kolejce DM. Główny przycisk robi trzy rzeczy naraz:
// kopiuje tekst, otwiera profil na Instagramie i odhacza wysyłkę.
//
// Kolejność w handlerze jest celowa: najpierw schowek (musi ruszyć w geście
// użytkownika, zanim okno straci fokus), potem window.open synchronicznie
// (blokery wyskakujących okien wymagają gestu), na końcu zapis w tle.

import { useState, useTransition } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { copyToClipboard } from "@/components/crm/CopyTextButton";
import {
  blitzStage,
  firstDmText,
  followupDmText,
  senderInitial,
  STAGE_LABELS,
  type CrmDmBlitz,
} from "@/lib/crm/blitz";
import { promoteDmToLead, removeLokal, setDmFollowup, setDmSent } from "@/lib/crm/actions";
import { shortDateTime } from "@/lib/crm/dates";

const STAGE_TONE = {
  todo: "neutral",
  waiting: "neutral",
  followup_due: "warning",
  followed_up: "neutral",
  in_crm: "success",
} as const;

export default function DmRow({
  row,
  now,
  showStage = false,
  allowRemove = false,
}: {
  row: CrmDmBlitz;
  now: number;
  /** W Bazie pokazujemy etap; na Dziś sekcja już o nim mówi. */
  showStage?: boolean;
  allowRemove?: boolean;
}) {
  const [local, setLocal] = useState<CrmDmBlitz>(row);
  const [prevRow, setPrevRow] = useState(row);
  // Gdy serwer przyniesie świeższy wiersz, lokalne nadpisanie ustępuje.
  if (row !== prevRow) {
    setPrevRow(row);
    setLocal(row);
  }
  const [copied, setCopied] = useState(false);
  const [showText, setShowText] = useState(false);
  const [confirm, setConfirm] = useState<"reply" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const stage = blitzStage(local, now);
  const followupMode = stage === "followup_due" || stage === "followed_up";
  const text = followupMode ? followupDmText() : firstDmText(local);
  const sent = local.sent_at !== null;
  const followedUp = local.followup_sent_at !== null;
  const igUrl = `https://instagram.com/${local.instagram}`;

  function flashCopied() {
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  function onSend() {
    setError(null);
    void copyToClipboard(text);
    window.open(igUrl, "_blank", "noopener");
    flashCopied();
    const nowIso = new Date().toISOString();
    if (followupMode) {
      setLocal((l) => ({ ...l, followup_sent_at: nowIso, followup_sent_by: "ja" }));
      startTransition(async () => {
        const r = await setDmFollowup(local.id, true);
        if (r.error) {
          setLocal(row);
          setError(r.error);
        }
      });
    } else {
      setLocal((l) => ({ ...l, sent_at: nowIso, sent_by: "ja" }));
      startTransition(async () => {
        const r = await setDmSent(local.id, true);
        if (r.error) {
          setLocal(row);
          setError(r.error);
        }
      });
    }
  }

  function onUndo() {
    setError(null);
    if (followedUp) {
      setLocal((l) => ({ ...l, followup_sent_at: null, followup_sent_by: null }));
      startTransition(async () => {
        const r = await setDmFollowup(local.id, false);
        if (r.error) setError(r.error);
      });
    } else {
      setLocal((l) => ({ ...l, sent_at: null, sent_by: null }));
      startTransition(async () => {
        const r = await setDmSent(local.id, false);
        if (r.error) setError(r.error);
      });
    }
  }

  function onReplied() {
    if (confirm !== "reply") {
      setConfirm("reply");
      setTimeout(() => setConfirm((c) => (c === "reply" ? null : c)), 3000);
      return;
    }
    setConfirm(null);
    setError(null);
    startTransition(async () => {
      const r = await promoteDmToLead(local.id);
      if (r.error) setError(r.error);
      else if (r.id) setLocal((l) => ({ ...l, lead_id: r.id! }));
    });
  }

  function onRemove() {
    if (confirm !== "remove") {
      setConfirm("remove");
      setTimeout(() => setConfirm((c) => (c === "remove" ? null : c)), 3000);
      return;
    }
    setConfirm(null);
    startTransition(async () => {
      const r = await removeLokal(local.id);
      if (r.error) setError(r.error);
    });
  }

  const doneThisStep = followupMode ? followedUp : sent;

  return (
    <li className="px-3 py-3 first:pt-1 last:pb-1">
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className={`mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
            local.lead_id
              ? "bg-success text-white"
              : doneThisStep
                ? "bg-success text-white"
                : followupMode
                  ? "bg-warning-soft text-warning"
                  : "bg-canvas text-ink-3"
          }`}
        >
          {local.lead_id || doneThisStep ? (
            <svg viewBox="0 0 16 16" className="h-3 w-3 fill-none stroke-current stroke-[3]">
              <path d="M2.5 8.5 6 12l7.5-8" />
            </svg>
          ) : followupMode ? (
            "2"
          ) : (
            "1"
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`truncate text-[15px] font-semibold ${doneThisStep && !local.lead_id ? "text-ink-2" : "text-ink"}`}>
              {local.name}
            </span>
            {showStage ? <Badge tone={STAGE_TONE[stage]}>{STAGE_LABELS[stage]}</Badge> : null}
          </div>
          <div className="mt-0.5 truncate text-[13px] text-ink-2">
            <a href={igUrl} target="_blank" rel="noreferrer" className="hover:text-accent">
              @{local.instagram}
            </a>
            {local.city ? ` · ${local.city}` : ""}
            {local.followers ? ` · ${local.followers.toLocaleString("pl-PL")} obs.` : ""}
            {sent && local.sent_at ? (
              <span>
                {" "}
                · DM {shortDateTime(local.sent_at)}
                {senderInitial(local.sent_by) ? ` (${senderInitial(local.sent_by)})` : ""}
              </span>
            ) : null}
            {followedUp && local.followup_sent_at ? ` · follow-up ${shortDateTime(local.followup_sent_at)}` : ""}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {local.lead_id ? (
              <Link href={`/rozmowy/${local.lead_id}`} className={buttonClass("success", "sm")}>
                Otwórz rozmowę →
              </Link>
            ) : doneThisStep ? (
              <>
                <button type="button" onClick={onReplied} className={buttonClass(confirm === "reply" ? "primary" : "secondary", "sm")}>
                  {confirm === "reply" ? "Na pewno odpisał?" : "Odpowiedział"}
                </button>
                <button type="button" onClick={onUndo} className={buttonClass("ghost", "sm")}>
                  Cofnij
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={onSend} className={buttonClass(copied ? "success" : "primary", "sm")}>
                  {copied ? "Skopiowano, otwieram IG" : followupMode ? "Wyślij follow-up" : "Wyślij DM"}
                </button>
                <button type="button" onClick={onReplied} className={buttonClass(confirm === "reply" ? "primary" : "ghost", "sm")}>
                  {confirm === "reply" ? "Na pewno?" : "Odpowiedział"}
                </button>
              </>
            )}
            {!local.lead_id ? (
              <button
                type="button"
                onClick={() => setShowText((v) => !v)}
                className={buttonClass("ghost", "sm")}
                aria-expanded={showText}
              >
                {showText ? "Ukryj tekst" : "Tekst"}
              </button>
            ) : null}
            {allowRemove && !local.lead_id ? (
              <button type="button" onClick={onRemove} className={buttonClass(confirm === "remove" ? "danger" : "ghost", "sm")}>
                {confirm === "remove" ? "Usunąć?" : "Usuń"}
              </button>
            ) : null}
          </div>

          {showText ? (
            <div className="anim-in mt-2 rounded-xl bg-canvas p-3 text-[13.5px] leading-relaxed text-ink">
              {text}
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => {
                    void copyToClipboard(text);
                    flashCopied();
                  }}
                  className={buttonClass("secondary", "sm")}
                >
                  {copied ? "Skopiowano" : "Kopiuj sam tekst"}
                </button>
              </div>
            </div>
          ) : null}

          {error ? <p className="mt-2 text-[13px] font-medium text-danger">{error}</p> : null}
        </div>
      </div>
    </li>
  );
}
