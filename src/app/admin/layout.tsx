import { Suspense, type ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { requireAdmin } from "@/lib/auth/helpers";

/** El shell autenticado se resuelve dentro de Suspense para no bloquear el prerender. */
async function AdminShell({ children }: { children: ReactNode }) {
  // El proxy es solo la primera barrera: acá se verifica el rol en el servidor.
  const session = await requireAdmin();

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar user={session.user} />
        <div className="flex-1 bg-background">{children}</div>
      </div>
    </div>
  );
}

function AdminShellFallback() {
  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <div className="h-16 bg-sidebar lg:h-full lg:w-64" />
      <div className="flex flex-1 flex-col">
        <div className="h-16 border-b border-border bg-surface" />
        <div className="flex-1 bg-background p-6">
          <div className="h-8 w-56 animate-pulse rounded-xl bg-surface-muted" />
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AdminShellFallback />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
