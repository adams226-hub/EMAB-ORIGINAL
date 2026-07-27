import { getCurrentProfile } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MobileSidebar } from "@/components/layout/MobileSidebar";
import { MobileNavProvider } from "@/components/layout/MobileNavContext";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  return (
    <MobileNavProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar role={profile.role} />
        <MobileSidebar role={profile.role} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header fullName={profile.full_name} role={profile.role} storeName={profile.store_name} />
          <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </MobileNavProvider>
  );
}
