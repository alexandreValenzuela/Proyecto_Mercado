import type { Metadata } from "next";
import Link from "next/link";
import { StatusCard } from "@/components/feedback/status-card";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Acceso no permitido" };

export default function ForbiddenPage() {
  return (
    <StatusCard
      code="403"
      title="No tenés acceso a esta sección"
      description="Tu cuenta no tiene permisos para ver esta página. Si creés que es un error, hablá con el equipo de la tienda."
      action={
        <Link href="/" className={buttonVariants({ size: "lg" })}>
          Volver al inicio
        </Link>
      }
    />
  );
}
