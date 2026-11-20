import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { siteConfig } from "@/config/site";
import { getStoreSettings } from "@/db/queries/orders";

export const metadata: Metadata = {
  title: "Nosotros",
  description: `Conocé ${siteConfig.name}, el proyecto conjunto con GAO que conecta el emprendimiento con la contabilidad y el mercado.`,
};

export default async function AboutPage() {
  const settings = await getStoreSettings();
  const pickupAvailable = Boolean(settings?.pickupEnabled && settings.pickupInstructions);
  const hasContact = Boolean(
    settings?.contactEmail || settings?.contactWhatsapp || pickupAvailable,
  );

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <section className="max-w-3xl">
        <Badge variant="secondary" className="w-fit bg-primary-soft text-primary">
          Sobre {siteConfig.name}
        </Badge>
        <h1 className="mt-4 font-heading text-3xl font-bold text-text sm:text-4xl">
          Un lugar para vender, aprender y entender el negocio
        </h1>
        <p className="mt-4 text-base leading-relaxed text-text-muted">
          {siteConfig.name} es una tienda online pensada para un emprendimiento chico. Acá podés
          descubrir productos, hacer tu pedido y seguirlo hasta que llega, mientras detrás se ordena
          toda la información del negocio.
        </p>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2" aria-label="Nuestra historia">
        <Card className="border-border bg-surface shadow-sm">
          <CardContent className="space-y-2">
            <p className="font-heading text-lg font-bold text-text">Trabajo conjunto con GAO</p>
            <p className="text-sm leading-relaxed text-text-muted">
              Este proyecto nace de la colaboración con GAO. Las herramientas contables y de análisis
              se construyeron con datos reales de las ventas, para que cada decisión tenga contexto.
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-surface shadow-sm">
          <CardContent className="space-y-2">
            <p className="font-heading text-lg font-bold text-text">Por qué este nombre</p>
            <p className="text-sm leading-relaxed text-text-muted">
              Elegimos {siteConfig.name} porque describe lo que hacemos: somos el punto que conecta
              tres mundos, el emprendimiento, la contabilidad y el mercado. La tienda, los números y
              las decisiones dejan de estar separados.
            </p>
          </CardContent>
        </Card>
      </section>

      {hasContact ? (
        <section className="mt-10" aria-labelledby="nosotros-contacto">
          <h2 id="nosotros-contacto" className="font-heading text-2xl font-bold text-text">
            Contacto
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {settings?.contactEmail ? (
              <li className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-sm text-text-muted">
                <Mail className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 break-words">{settings.contactEmail}</span>
              </li>
            ) : null}
            {settings?.contactWhatsapp ? (
              <li className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-sm text-text-muted">
                <MessageCircle className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 break-words">{settings.contactWhatsapp}</span>
              </li>
            ) : null}
            {pickupAvailable && settings?.pickupInstructions ? (
              <li className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-sm text-text-muted sm:col-span-2">
                <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 break-words">{settings.pickupInstructions}</span>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      <div className="mt-10">
        <Link href="/catalogo" className={buttonVariants({ size: "lg" })}>
          Ver el catálogo
        </Link>
      </div>
    </main>
  );
}
