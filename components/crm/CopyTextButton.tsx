"use client";

// Kopiowanie gotowego tekstu jednym kliknięciem.
//
// Dwie drogi: `copySync` (textarea + execCommand) działa natychmiast, w tym
// samym geście, zanim cokolwiek ukradnie fokus — to jedyna droga, gdy zaraz
// po kopiowaniu otwieramy Instagram w nowej karcie. `copyToClipboard` (Clipboard
// API) jest asynchroniczne i odmawia, gdy dokument straci fokus.

import { useState } from "react";
import { buttonClass } from "@/components/ui/Button";

/** Synchroniczne kopiowanie. Zwraca true, gdy przeglądarka potwierdziła. */
export function copySync(text: string): boolean {
  try {
    const t = document.createElement("textarea");
    t.value = text;
    t.setAttribute("readonly", "");
    t.style.position = "fixed";
    t.style.top = "0";
    t.style.left = "0";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.focus();
    t.select();
    // iOS Safari ignoruje select() na readonly — zaznaczamy zakresem.
    t.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    t.remove();
    return ok;
  } catch {
    return false;
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (copySync(text)) return true;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function CopyTextButton({
  text,
  label,
  variant = "secondary",
  size = "sm",
  className = "",
}: {
  text: string;
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className={buttonClass(copied ? "success" : variant, size, className)}
    >
      {copied ? "Skopiowano" : label}
    </button>
  );
}
