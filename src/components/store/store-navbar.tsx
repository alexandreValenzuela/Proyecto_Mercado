import { Shield, ShoppingBag, UserRound } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { auth } from "@/auth";
import { siteConfig } from "@/config/site";
import { getCartSummary } from "@/server/cart/actions";

const desktopLinks = [
  { href: "/", label: "Inicio" },
  { href: "/catalogo", label: "Catálogo" },
];

const mobileLinks = [
  ...desktopLinks,
  { href: "/nosotros", label: "Nosotros" },
  { href: "/carrito", label: "Carrito" },
  { href: "/cuenta/pedidos", label: "Mis pedidos" },
  { href: "/cuenta/direcciones", label: "Mis direcciones" },
  { href: "/cuenta/perfil", label: "Mi perfil" },
];

export async function StoreNavbar() {
  // auth() genera un valor aleatorio de CSRF: con PPR hay que diferir a request time.
  await connection();
  const [{ itemCount }, session] = await Promise.all([getCartSummary(), auth()]);
  const isAdmin = session?.user?.role === "admin";
  const visibleMobileLinks = isAdmin
    ? [...mobileLinks, { href: "/admin", label: "Panel de administración" }]
    : mobileLinks;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="font-heading text-xl font-extrabold tracking-tight text-primary">
          {siteConfig.name}
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-text-muted sm:flex">
          {desktopLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-primary">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          {isAdmin && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
              aria-label="Panel de administración"
            >
              <Shield className="size-5" aria-hidden />
              <span className="hidden md:inline">Admin</span>
            </Link>
          )}
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-text-muted transition-colors hover:bg-primary-soft hover:text-primary"
            aria-label="Mi cuenta"
          >
            <UserRound className="size-5" aria-hidden />
            <span className="hidden md:inline">Mi cuenta</span>
          </Link>
          <Link
            href="/carrito"
            className="inline-flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-text-muted transition-colors hover:bg-primary-soft hover:text-primary"
            aria-label={`Carrito, ${itemCount} ${itemCount === 1 ? "producto" : "productos"}`}
          >
            <ShoppingBag className="size-5" aria-hidden />
            <span className="hidden md:inline">Carrito</span>
            <span className="rounded-full bg-primary-soft px-1.5 text-xs text-primary">{itemCount}</span>
          </Link>

          <details className="relative sm:hidden">
            <summary className="cursor-pointer list-none rounded-xl px-2.5 py-2 text-sm font-medium text-primary [&::-webkit-details-marker]:hidden">
              Menú
            </summary>
            <nav className="absolute right-0 top-full mt-2 flex w-48 flex-col gap-1 rounded-xl border border-border bg-surface p-2 shadow-lg">
              {visibleMobileLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-2 text-sm text-text hover:bg-primary-soft hover:text-primary"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
