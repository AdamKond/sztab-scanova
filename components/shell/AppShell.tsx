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
        <div className="mx-auto max-w-[1440px] px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-6">
          {children}
        </div>
      </main>

      {/* Mobile: dolna nawigacja */}
      <MobileNav />
    </div>
  );
}
