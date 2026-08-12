// Whiteboard — tablica strategii. Tu mieszka to, od czego zaczęliśmy:
// po co jest SZTAB, kogo szukamy i czego nie robimy. Treść siedzi w bazie,
// nie w repo, bo ustalenia zmieniają się w trakcie pracy i obie osoby mają
// móc je poprawić z telefonu, bez deployu.

import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { Input, Label, Textarea } from "@/components/ui/Field";
import Topbar from "@/components/shell/Topbar";
import ActionForm, { SubmitButton } from "@/components/crm/ActionForm";
import { listNotes } from "@/lib/crm/queries";
import { deleteNote, moveNote, saveNote } from "@/lib/crm/actions";
import { daysAgoLabel, daysSince } from "@/lib/crm/dates";
import NoteEditor from "./NoteEditor";

export default async function WhiteboardPage({
  searchParams,
}: {
  searchParams: Promise<{ nowa?: string }>;
}) {
  const sp = await searchParams;
  const notes = await listNotes();
  // Formularz nowej karty trzymamy w URL-u, a nie w stanie klienta — dzięki
  // temu „+ Nowa karta" z topbara działa bez ani jednej linijki JS i przeżywa
  // odświeżenie strony.
  const creating = sp.nowa === "1";

  return (
    <>
      <Topbar
        title="Whiteboard"
        actions={
          <Link href={creating ? "/whiteboard" : "/whiteboard?nowa=1"}>
            <Button variant={creating ? "secondary" : "primary"}>
              {creating ? "× Zamknij" : "+ Nowa karta"}
            </Button>
          </Link>
        }
      />

      <div className="space-y-5">
        <p className="text-[13px] text-ink-2">
          Tablica strategii — wspólne ustalenia zespołu. Kolejność kart ustawiacie ręcznie:
          najważniejsze rzeczy na górze.
        </p>

        {creating ? (
          <Card className="anim-in">
            <h2 className="mb-3 text-[14px] font-semibold text-ink">Nowa karta</h2>
            <ActionForm
              action={saveNote}
              resetOnSuccess
              onSuccessMessage="Karta dodana na końcu tablicy."
              className="space-y-3"
            >
              <div>
                <Label htmlFor="new-title">Tytuł *</Label>
                <Input
                  id="new-title"
                  name="title"
                  required
                  maxLength={200}
                  autoFocus
                  placeholder="np. Hipotezy do sprawdzenia w tym tygodniu"
                />
              </div>
              <div>
                <Label htmlFor="new-content">Treść</Label>
                <Textarea
                  id="new-content"
                  name="content_md"
                  rows={12}
                  className="font-mono text-[13px] leading-relaxed"
                  placeholder={"# Nagłówek\n\n- punkt listy\n- kolejny punkt\n\n**Ważne** zdanie."}
                />
                <p className="mt-1.5 text-[12px] text-ink-2">
                  Formatowanie: <code># nagłówek</code>, <code>- punkt listy</code>,{" "}
                  <code>**pogrubienie**</code>.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SubmitButton>Dodaj kartę</SubmitButton>
                <Link href="/whiteboard">
                  <Button type="button" variant="secondary">
                    Anuluj
                  </Button>
                </Link>
              </div>
            </ActionForm>
          </Card>
        ) : null}

        {notes.length === 0 ? (
          <Card>
            <EmptyState
              title="Tablica jest pusta"
              hint="Zacznijcie od jednej karty: po co jest SZTAB, kogo szukamy, czego nie robimy."
              action={
                <Link href="/whiteboard?nowa=1">
                  <Button variant="primary">+ Nowa karta</Button>
                </Link>
              }
            />
          </Card>
        ) : (
          // items-start: karty mają różną długość i nie powinny rozciągać się
          // do wysokości najwyższej w rzędzie — stąd efekt „prawie masonry".
          <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
            {notes.map((note, index) => (
              <NoteEditor
                key={note.id}
                note={note}
                updatedLabel={daysAgoLabel(daysSince(note.updated_at))}
                isFirst={index === 0}
                isLast={index === notes.length - 1}
                saveAction={saveNote}
                deleteAction={async () => {
                  // Goły `action` formularza oczekuje void — opakowujemy akcje
                  // zwracające ActionResult.
                  "use server";
                  await deleteNote(note.id);
                }}
                moveUpAction={async () => {
                  "use server";
                  await moveNote(note.id, "up");
                }}
                moveDownAction={async () => {
                  "use server";
                  await moveNote(note.id, "down");
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
