import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Ingresar" };

type LoginPageProps = { searchParams: Promise<{ next?: string }> };

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <AuthShell
      title="¡Hola de nuevo!"
      description="Ingresá para seguir con tu compra y ver tus pedidos."
      footer={
        <>
          ¿No tenés cuenta?{" "}
          <Link href="/registro" className="font-medium text-primary hover:underline">
            Registrate
          </Link>
        </>
      }
    >
      <Suspense fallback={<p className="text-sm text-text-muted">Cargando…</p>}>
        <LoginFields searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function LoginFields({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  return <LoginForm next={next ?? null} />;
}
