import AppShell from "@/components/shell/AppShell";
import { requireStaff } from "@/lib/auth";

// Bez env auth zwraca null zanim dotknie cookies(), więc Next mógłby
// prerenderować sekcję statycznie na buildzie bez konfiguracji — a brama
// autoryzacji MUSI działać przy każdym żądaniu. Stąd twarde wymuszenie.
export const dynamic = "force-dynamic";

// Jedyna brama autoryzacji dla całej sekcji prywatnej: middleware celowo
// nie autoryzuje, a requireStaff() zwraca 404 dla każdego spoza allowlisty —
// sekcja ma dla obcych nie istnieć.
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  return <AppShell userEmail={user.email ?? "—"}>{children}</AppShell>;
}
