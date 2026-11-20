import { Mail, MessageCircle } from "lucide-react";
import { siteConfig } from "@/config/site";
import { getStorefrontSettings } from "@/server/catalog";

export async function StoreFooter() {
  const settings = await getStorefrontSettings();

  return (
    <footer className="mt-auto border-t border-border bg-surface-muted/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="font-heading text-lg font-extrabold text-primary">{siteConfig.name}</p>
          <p className="mt-2 max-w-xs text-sm text-text-muted">
            Productos elegidos con cariño, envíos a todo el país y retiro en persona.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-text">Contacto</p>
          <ul className="mt-3 space-y-2 text-sm text-text-muted">
            <li className="flex items-center gap-2">
              <Mail className="size-4 text-primary" aria-hidden />
              {settings?.contactEmail ?? "Email: próximamente"}
            </li>
            <li className="flex items-center gap-2">
              <MessageCircle className="size-4 text-primary" aria-hidden />
              {settings?.contactWhatsapp ?? "WhatsApp: próximamente"}
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-text">Medios de pago</p>
          <p className="mt-3 text-sm text-text-muted">Pagá con MercadoPago con tarjeta o dinero en cuenta.</p>
        </div>
      </div>
      <div className="border-t border-border px-4 py-4 text-center text-xs text-text-muted">
        © {new Date().getFullYear()} {siteConfig.name}
      </div>
    </footer>
  );
}
