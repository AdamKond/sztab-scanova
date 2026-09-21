import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";

/**
 * Ekran przejściowy dla całej sekcji prywatnej — przejście między ekranami
 * jest natychmiastowe, dane dolatują chwilę później.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="mb-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} padding="sm">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-16" />
          </Card>
        ))}
      </div>
      <Card>
        <Skeleton className="h-5 w-48" />
        <div className="mt-5 space-y-4">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}
