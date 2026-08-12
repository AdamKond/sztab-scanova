// Szkielet aplikacji — server component (bez własnego stanu); interaktywność
// (aktywna ścieżka, szuflada mobile) mieszka w Sidebar/MobileNav.
import Sidebar from "./Sidebar";
import MobileNav, { MobileTopBar } from "./MobileNav";

export default function AppShell({
  userEmail,
  children,
}: {
  userEmail: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop: stały sidebar po lewej */}
      <Sidebar userEmail={userEmail} />

      {/* Mobile: slim top bar z przyciskiem szuflady */}
      <MobileTopBar userEmail={userEmail} />

      <main className="md:pl-[236px]">
        {/* Więcej powietrza na desktopie: gęstość informacji ma wynikać
            z porządku, a nie ze ściśnięcia elementów do siebie. */}
        <div className="mx-auto max-w-[1440px] px-4 py-5 pb-28 md:px-10 md:py-8 md:pb-12">
          {children}
        </div>
      </main>

      {/* Mobile: dolna nawigacja */}
      <MobileNav />
    </div>
  );
}
