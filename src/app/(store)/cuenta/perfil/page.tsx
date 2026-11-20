import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ProfileForm } from "@/components/store/profile-form";
import { Card, CardContent } from "@/components/ui/card";
import { AuthorizationError, requireUser } from "@/lib/auth/helpers";
import { getProfileForUser } from "@/server/account/profile";

export const metadata: Metadata = { title: "Mi perfil" };

function ProfileSkeleton() {
  return <div className="h-80 animate-pulse rounded-2xl bg-surface-muted" />;
}

async function ProfileContent() {
  await connection();
  let userId: string;
  try {
    userId = (await requireUser()).user.id;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect("/login?next=/cuenta/perfil");
    }
    throw error;
  }

  const profile = await getProfileForUser(userId);
  if (!profile) {
    redirect("/login?next=/cuenta/perfil");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card className="border-border bg-surface shadow-sm">
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-text-muted">Nombre</p>
            <p className="font-heading text-lg font-bold text-text">{profile.name}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-text-muted">Email</p>
            <p className="break-all text-sm text-text">{profile.email}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-text-muted">Teléfono</p>
            <p className="text-sm text-text">{profile.phone ?? "No cargaste un teléfono."}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-surface shadow-sm">
        <CardContent>
          <h2 className="mb-5 font-heading text-xl font-bold text-text">Editar mis datos</h2>
          <ProfileForm
            initial={{
              name: profile.name,
              phone: profile.phone ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-text sm:text-4xl">Mi perfil</h1>
        <p className="mt-2 text-text-muted">Revisá y actualizá tus datos personales.</p>
      </div>
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileContent />
      </Suspense>
    </main>
  );
}
