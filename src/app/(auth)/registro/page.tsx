import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Crear cuenta" };

type RegisterPageProps = { searchParams: Promise<{ next?: string }> };

export default function RegisterPage({ searchParams }: RegisterPageProps) {
  return (
    <AuthShell
      title="Creá tu cuenta"
      description="Es rápido y te permite seguir tus pedidos desde cualquier lugar."
      footer={
        <>
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Ingresá
          </Link>
        </>
      }
    >
      <Suspense fallback={<p className="text-sm text-text-muted">Cargando…</p>}>
        <RegisterFields searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function RegisterFields({ searchParams }: RegisterPageProps) {
  const { next } = await searchParams;
  return <RegisterForm next={next ?? null} />;
}
