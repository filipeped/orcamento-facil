import { AdminSidebar } from "./AdminSidebar";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-100 flex">
      <AdminSidebar />
      <main className="flex-1 lg:ml-64">
        <div className="pt-16 lg:pt-0 p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
