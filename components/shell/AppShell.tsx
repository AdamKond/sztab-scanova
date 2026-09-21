// Szkielet aplikacji — server component; interaktywność (aktywna ścieżka)
// mieszka w Sidebar/MobileNav.
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
      <Sidebar userEmail={userEmail} />
      <MobileTopBar userEmail={userEmail} />
      <main className="md:pl-[224px]">
        <div className="mx-auto max-w-[1100px] px-4 pb-28 pt-4 md:px-10 md:pb-16 md:pt-10">
          {children}
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
