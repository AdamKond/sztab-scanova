import Topbar from "@/components/shell/Topbar";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

export default function DzisPage() {
  return (
    <>
      <Topbar title="Dziś" />
      <Card>
        <EmptyState
          title="Pulpit w budowie"
          hint="Widok dnia (zadania, follow-upy, szybkie akcje) pojawi się w Etapie 1."
        />
      </Card>
    </>
  );
}
