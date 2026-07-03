import { Sidebar, MobileNav } from "@/components/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <MobileNav />
        <main className="mx-auto w-full max-w-6xl px-6 py-8 md:px-10">{children}</main>
      </div>
    </div>
  );
}
