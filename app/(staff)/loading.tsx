import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";

/**
 * Ekran przejściowy dla całej sekcji prywatnej.
 *
 * Bez tego Next czeka z nawigacją, aż serwer policzy całą stronę — klik
 * wygląda jak zawieszenie. Z granicą ładowania przejście jest natychmiastowe,
 * a dane dolatują chwilę później.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Card key={i}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-16" />
          </Card>
        ))}
      </div>
      <Card>
        <Skeleton className="h-4 w-40" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}
