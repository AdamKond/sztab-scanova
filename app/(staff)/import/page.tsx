import Topbar from "@/components/shell/Topbar";
import Card from "@/components/ui/Card";
import ImportWizard from "./ImportWizard";
import { IMPORT_FIELDS, IMPORT_FIELD_LABELS, MAX_IMPORT_ROWS } from "./types";

// Server component: sam nagłówek, instrukcja i osadzenie kreatora.
// Autoryzację załatwia layout sekcji (requireStaff), a całe parsowanie pliku
// dzieje się w przeglądarce — na serwer trafiają dopiero zmapowane wiersze.

export default function ImportPage() {
  return (
    <>
      <Topbar title="Import leadów" />

      <Card className="anim-in mb-6 space-y-3">
        <p className="text-[14px] text-ink">
          Wgraj plik <strong>CSV</strong> lub <strong>TSV</strong> albo wklej dane prosto
          z arkusza. <strong>Pierwszy wiersz musi zawierać nazwy kolumn</strong> — na ich
          podstawie podpowiemy dopasowanie pól. Jednorazowo przyjmujemy do{" "}
          <strong>{MAX_IMPORT_ROWS} wierszy</strong>.
        </p>

        <div className="text-[13px] text-ink-2">
          <span className="font-medium text-ink">Obsługiwane kolumny:</span>{" "}
          {IMPORT_FIELDS.map((f) => IMPORT_FIELD_LABELS[f]).join(", ")}. Kolumny, których nie
          rozpoznasz w mapowaniu, możesz pominąć — wymagana jest tylko nazwa firmy.
        </div>

        <p className="text-[13px] text-ink-2">
          Import zakłada wyłącznie <strong>nowe leady na starcie lejka</strong> (status „Nowy").
          Etapu, przychodu ani dat pilota nie da się wgrać z pliku — te dane mają powstawać
          z realnej pracy handlowej, a nie z arkusza.
        </p>

        <p className="text-[13px] text-ink-2">
          Zanim cokolwiek zapiszemy, uruchom <strong>sprawdzenie (dry-run)</strong>: pokaże,
          które wiersze są nowe, które dublują istniejące leady, a które wymagają Twojej decyzji.
        </p>
      </Card>

      <ImportWizard />
    </>
  );
}
