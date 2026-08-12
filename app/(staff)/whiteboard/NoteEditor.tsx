"use client";

// Karta tablicy strategii: podgląd + edycja w miejscu.
//
// Dlaczego client component: „Edytuj" ma otwierać formularz TAM, gdzie karta
// stoi, bez przeładowania i bez gubienia pozycji scrolla — a to wymaga stanu.
// Dlaczego własny mini-formatter zamiast biblioteki markdown: treść piszą dwie
// osoby z telefonu i potrzebują wyłącznie nagłówka, punktów i pogrubienia.
// Cała paczka markdown + sanitizer kosztowałaby więcej niż daje, a każdy
// renderer HTML to nowa powierzchnia na XSS. Budujemy elementy Reacta ręcznie,
// więc treść z bazy NIGDY nie staje się HTML-em.

import { Fragment, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Input, Label, Textarea } from "@/components/ui/Field";
import ActionForm, { SubmitButton } from "@/components/crm/ActionForm";
import type { ActionResult } from "@/lib/crm/actions";
import type { CrmNote } from "@/lib/crm/types";

// ----------------------------------------------------------------------------
// Mini-formatter „markdown-ish"
// ----------------------------------------------------------------------------

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "para"; lines: string[] };

/** Dzieli tekst na bloki. Pusta linia kończy akapit/listę — tak jak w markdownie. */
function toBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  // `open` to blok, do którego dopisujemy kolejne linie (lista albo akapit).
  let open: Block | null = null;

  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      open = null;
      continue;
    }

    const heading = /^(#{1,6})\s*(.+)$/.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
      open = null;
      continue;
    }

    const item = /^[-*]\s+(.+)$/.exec(line);
    if (item) {
      if (open?.kind === "list") {
        open.items.push(item[1]);
      } else {
        open = { kind: "list", items: [item[1]] };
        blocks.push(open);
      }
      continue;
    }

    if (open?.kind === "para") {
      open.lines.push(line);
    } else {
      open = { kind: "para", lines: [line] };
      blocks.push(open);
    }
  }

  return blocks;
}

/** `**tekst**` -> <strong>. Reszta leci jako zwykły tekst, nigdy jako HTML. */
function inline(text: string): React.ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((part) => part !== "")
    .map((part, i) =>
      part.length >= 5 && part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );
}

function NoteContent({ md }: { md: string }) {
  const blocks = toBlocks(md);
  if (blocks.length === 0) {
    return (
      <p className="text-[13px] italic text-ink-2">
        Pusta karta — otwórz „Edytuj”, żeby coś tu dopisać.
      </p>
    );
  }

  return (
    <div className="space-y-2.5 text-[13px] leading-relaxed text-ink">
      {blocks.map((block, i) => {
        if (block.kind === "heading") {
          return (
            <p
              key={i}
              className={`font-semibold text-ink ${block.level === 1 ? "text-[14px]" : "text-[13px]"}`}
            >
              {inline(block.text)}
            </p>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={i} className="space-y-1">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2">
                  <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-2" />
                  <span className="min-w-0 whitespace-pre-wrap">{inline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }
        // Zachowujemy łamania linii autora — akapit renderujemy jako pre-wrap.
        return (
          <p key={i} className="whitespace-pre-wrap">
            {inline(block.lines.join("\n"))}
          </p>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Karta
// ----------------------------------------------------------------------------

const CONTROL_CLASSES =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40 md:min-h-0 md:py-1.5";

export default function NoteEditor({
  note,
  updatedLabel,
  isFirst,
  isLast,
  saveAction,
  deleteAction,
  moveUpAction,
  moveDownAction,
}: {
  note: CrmNote;
  /** Względna data zapisu policzona na serwerze — inaczej SSR i klient
   *  mogłyby wyliczyć różne „dziś" i React zgłosiłby błąd hydracji. */
  updatedLabel: string;
  isFirst: boolean;
  isLast: boolean;
  saveAction: (formData: FormData) => Promise<ActionResult>;
  deleteAction: () => Promise<void>;
  moveUpAction: () => Promise<void>;
  moveDownAction: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);

  // ActionForm nie daje callbacku po sukcesie, ale zapis odświeża dane karty
  // (trigger w bazie rusza updated_at). Zmiana tej wartości = zapis przeszedł,
  // więc zamykamy edytor sami, zamiast kazać użytkownikowi klikać „Anuluj".
  const seenUpdatedAt = useRef(note.updated_at);
  useEffect(() => {
    if (seenUpdatedAt.current !== note.updated_at) {
      seenUpdatedAt.current = note.updated_at;
      setEditing(false);
    }
  }, [note.updated_at]);

  // Same inicjały maila wystarczą — w dwuosobowym zespole pełny adres to szum.
  const author = note.updated_by ? note.updated_by.split("@")[0] : "zespół";

  if (editing) {
    return (
      <Card className="anim-in">
        <ActionForm action={saveAction} className="space-y-3">
          <input type="hidden" name="note_id" value={note.id} />
          <div>
            <Label htmlFor={`title-${note.id}`}>Tytuł</Label>
            <Input
              id={`title-${note.id}`}
              name="title"
              defaultValue={note.title}
              required
              maxLength={200}
            />
          </div>
          <div>
            <Label htmlFor={`content-${note.id}`}>Treść</Label>
            <Textarea
              id={`content-${note.id}`}
              name="content_md"
              rows={12}
              defaultValue={note.content_md}
              className="font-mono text-[13px] leading-relaxed"
            />
            <p className="mt-1.5 text-[12px] text-ink-2">
              Formatowanie: <code># nagłówek</code>, <code>- punkt listy</code>,{" "}
              <code>**pogrubienie**</code>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SubmitButton>Zapisz</SubmitButton>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              Anuluj
            </Button>
          </div>
        </ActionForm>
      </Card>
    );
  }

  return (
    <Card className="anim-in">
      <h2 className="text-[15px] font-semibold text-ink">{note.title}</h2>

      <div className="mt-2.5">
        <NoteContent md={note.content_md} />
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <div className="text-[12px] text-ink-2">
          {author} · {updatedLabel}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setEditing(true)} className={CONTROL_CLASSES}>
            Edytuj
          </button>

          <form action={moveUpAction}>
            <button
              type="submit"
              disabled={isFirst}
              title="Przenieś wyżej"
              aria-label={`Przenieś kartę „${note.title}” wyżej`}
              className={CONTROL_CLASSES}
            >
              <span aria-hidden>▲</span>
            </button>
          </form>

          <form action={moveDownAction}>
            <button
              type="submit"
              disabled={isLast}
              title="Przenieś niżej"
              aria-label={`Przenieś kartę „${note.title}” niżej`}
              className={CONTROL_CLASSES}
            >
              <span aria-hidden>▼</span>
            </button>
          </form>

          <ConfirmDialog
            title="Usunąć kartę?"
            description={`Karta „${note.title}” zniknie z tablicy na stałe. Tej operacji nie da się cofnąć.`}
            confirmLabel="Usuń"
            action={deleteAction}
          >
            Usuń
          </ConfirmDialog>
        </div>
      </div>
    </Card>
  );
}
