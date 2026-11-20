import {
  BarChart3,
  Boxes,
  CircleDollarSign,
  ClipboardList,
  LayoutDashboard,
  Map,
  Settings,
  Tags,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { siteConfig } from "@/config/site";

const sections = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, available: true },
  { href: "/admin/productos", label: "Productos", icon: Boxes, available: true },
  { href: "/admin/categorias", label: "Categorías", icon: Tags, available: true },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList, available: true },
  { href: "/admin/contabilidad", label: "Contabilidad", icon: CircleDollarSign, available: true },
  { href: "/admin/estadisticas", label: "Estadísticas", icon: BarChart3, available: true },
  { href: "/admin/mercado", label: "Mercado", icon: Map, available: true },
  { href: "#", label: "Clientes", icon: UsersRound, available: false },
  { href: "#", label: "Configuración", icon: Settings, available: false },
] as const;

export function AdminSidebar() {
  return (
    <aside className="w-full shrink-0 bg-sidebar text-sidebar-foreground lg:w-64">
      <div className="px-5 py-5">
        <Link href="/admin" className="font-heading text-xl font-extrabold">
          {siteConfig.name}
        </Link>
        <p className="mt-1 text-xs text-sidebar-foreground/70">Panel de administración</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-4 lg:flex-col lg:overflow-visible" aria-label="Navegación del panel">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.label}
              href={section.href}
              aria-disabled={!section.available}
              title={section.available ? undefined : "Próximamente"}
              className={`inline-flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:w-full ${
                section.available ? "" : "text-sidebar-foreground/50"
              }`}
            >
              <Icon className="size-4" aria-hidden />
              <span className="whitespace-nowrap">{section.label}</span>
              {!section.available ? (
                <span className="ml-auto hidden text-[10px] uppercase tracking-wide lg:inline">Pronto</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
