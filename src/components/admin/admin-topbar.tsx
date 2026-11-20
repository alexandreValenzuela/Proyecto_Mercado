import { LogOut } from "lucide-react";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export function AdminTopbar({ user }: { user: { name?: string | null; email?: string | null } }) {
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3 sm:px-6">
      <div>
        <p className="font-heading text-sm font-bold text-text">Panel</p>
        <p className="text-xs text-text-muted">Gestión de la tienda</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-text">{user.name ?? "Administrador"}</p>
          <p className="text-xs text-text-muted">{user.email}</p>
        </div>
        <form action={logout}>
          <Button type="submit" variant="outline" size="sm" title="Cerrar sesión">
            <LogOut className="size-4" aria-hidden />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
