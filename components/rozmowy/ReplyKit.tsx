"use client";

// Gotowe odpowiedzi w rozmowie: jedno kliknięcie kopiuje, drugie pokazuje tekst.
// Nawiasy kwadratowe [dzień], [godzina], [cena] podmienia się przed wysłaniem.

import { useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { copyToClipboard } from "@/components/crm/CopyTextButton";
import { REPLIES } from "@/lib/crm/dm-copy";

export default function ReplyKit() {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function onCopy(key: string, text: string) {
    await copyToClipboard(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1400);
  }

  return (
    <ul className="-mx-2 divide-y divide-line/70">
      {REPLIES.map((r) => {
        const open = openKey === r.key;
        return (
          <li key={r.key} className="px-2 py-2.5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setOpenKey(open ? null : r.key)}
                className="min-w-0 flex-1 text-left"
                aria-expanded={open}
              >
                <div className="text-[14px] font-semibold text-ink">{r.label}</div>
                <div className="truncate text-[12.5px] text-ink-2">{r.when}</div>
              </button>
              <button
                type="button"
                onClick={() => onCopy(r.key, r.text)}
                className={buttonClass(copiedKey === r.key ? "success" : "secondary", "sm")}
              >
                {copiedKey === r.key ? "Skopiowano" : "Kopiuj"}
              </button>
            </div>
            {open ? (
              <p className="anim-in mt-2 rounded-xl bg-canvas p-3 text-[13.5px] leading-relaxed text-ink">
                {r.text}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
