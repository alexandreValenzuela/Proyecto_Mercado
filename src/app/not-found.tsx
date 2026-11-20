import Link from "next/link";
import { StatusCard } from "@/components/feedback/status-card";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <StatusCard
      code="404"
      title="No encontramos esa página"
      description="Puede que el enlace haya cambiado o que la página ya no exista. Probá volviendo al inicio."
      action={
        <Link href="/" className={buttonVariants({ size: "lg" })}>
          Volver al inicio
        </Link>
      }
    />
  );
}
