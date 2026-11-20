import Link from "next/link";
import { Boxes, Tags } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listCategories, listProducts } from "@/db/queries/catalog";
import { requireAdmin } from "@/lib/auth/helpers";

export default async function AdminDashboardPage() {
  await requireAdmin();

  const [products, categories] = await Promise.all([
    listProducts({ page: 1, pageSize: 1, includeInactive: true }),
    listCategories({ includeInactive: true }),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="font-heading text-3xl font-bold text-text">Dashboard</h1>
      <p className="mt-2 text-sm text-text-muted">
        Administrá el catálogo desde acá. El resto de los módulos llega en las próximas fases.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-text">
              <Boxes className="size-4 text-primary" aria-hidden /> Productos
            </CardTitle>
            <CardDescription>{products.total} productos cargados</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/productos" className={buttonVariants({ variant: "outline" })}>
              Gestionar productos
            </Link>
          </CardContent>
        </Card>
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-text">
              <Tags className="size-4 text-primary" aria-hidden /> Categorías
            </CardTitle>
            <CardDescription>{categories.length} categorías cargadas</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/categorias" className={buttonVariants({ variant: "outline" })}>
              Gestionar categorías
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border-dashed border-border bg-surface/60">
        <CardHeader>
          <CardTitle className="text-text">Próximamente</CardTitle>
          <CardDescription>
            Pedidos, contabilidad, estadísticas, mercado, clientes y configuración.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="ghost" size="sm" disabled>
            Módulos en construcción
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
