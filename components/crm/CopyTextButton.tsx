"use client";

// Kopiowanie gotowego tekstu (np. DM-a z notatek leada) jednym kliknięciem.
// Fallback przez textarea, bo Clipboard API bywa niedostępne poza HTTPS.

import { useState } from "react";

export default function CopyTextButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = document.createElement("textarea");
      t.value = text;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-white transition ${
        copied ? "bg-success" : "bg-sidebar hover:bg-accent-deep"
      }`}
    >
      {copied ? "Skopiowano" : label}
    </button>
  );
}
