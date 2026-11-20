import { Suspense, type ReactNode } from "react";
import { StoreFooter } from "@/components/store/store-footer";
import { StoreNavbar } from "@/components/store/store-navbar";
import { siteConfig } from "@/config/site";

/** El navbar lee cookies para el contador, así que necesita su propio boundary. */
function NavbarFallback() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <span className="font-heading text-xl font-extrabold tracking-tight text-primary">
          {siteConfig.name}
        </span>
        <div className="flex items-center gap-3">
          <span className="h-5 w-20 animate-pulse rounded-lg bg-surface-muted" />
          <span className="size-6 animate-pulse rounded-lg bg-surface-muted" />
        </div>
      </div>
    </header>
  );
}

/** Footer de reserva: mantiene la estructura mientras streaming la info de contacto. */
function FooterFallback() {
  return (
    <footer className="mt-auto border-t border-border bg-surface-muted/60">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="h-24 animate-pulse rounded-xl bg-surface-muted" />
      </div>
    </footer>
  );
}

export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <Suspense fallback={<NavbarFallback />}>
        <StoreNavbar />
      </Suspense>
      {children}
      <Suspense fallback={<FooterFallback />}>
        <StoreFooter />
      </Suspense>
    </div>
  );
}
