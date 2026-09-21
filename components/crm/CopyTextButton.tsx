"use client";

// Kopiowanie gotowego tekstu jednym kliknięciem. Fallback przez textarea,
// bo Clipboard API bywa niedostępne poza HTTPS.

import { useState } from "react";
import { buttonClass } from "@/components/ui/Button";

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const t = document.createElement("textarea");
    t.value = text;
    t.setAttribute("readonly", "");
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    document.execCommand("copy");
    t.remove();
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
