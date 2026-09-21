import Link from "next/link";
import Card from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";

// Wewnątrz sekcji prywatnej: nie ma takiej rozmowy (skasowana albo zły link).
export default function NotFound() {
  return (
    <Card className="mx-auto max-w-md text-center">
      <h1 className="text-[20px] font-semibold tracking-tight text-ink">Nie ma takiej strony</h1>
      <p className="mt-2 text-[14px] text-ink-2">Rozmowa mogła zostać usunięta albo link jest niepełny.</p>
      <Link href="/" className={buttonClass("primary", "md", "mt-5")}>
        Wróć na Dziś
      </Link>
    </Card>
  );
}
