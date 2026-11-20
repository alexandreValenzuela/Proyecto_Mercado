import { Suspense, type ReactNode } from "react";
import { StoreFooter } from "@/components/store/store-footer";
import { StoreNavbar } from "@/components/store/store-navbar";

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
      <StoreNavbar />
      {children}
      <Suspense fallback={<FooterFallback />}>
        <StoreFooter />
      </Suspense>
    </div>
  );
}
