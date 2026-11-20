import type { Session } from "next-auth";
import { auth } from "@/auth";

export type AuthorizationFailure = "unauthenticated" | "forbidden";

export class AuthorizationError extends Error {
  constructor(public readonly reason: AuthorizationFailure) {
    super(
      reason === "unauthenticated"
        ? "Se requiere iniciar sesión."
        : "Se requieren permisos de administrador.",
    );
    this.name = "AuthorizationError";
  }
}

export type AuthenticatedSession = Session & { user: NonNullable<Session["user"]> };

/**
 * Punto único de aplicación de permisos en el servidor.
 * Cada server action, route handler y query del admin debe llamar a
 * `requireAdmin()`; `src/proxy.ts` es solo una primera barrera y no alcanza.
 * Los helpers lanzan para que cada caller decida entre redirigir o devolver 403.
 */
export async function requireUser(): Promise<AuthenticatedSession> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthorizationError("unauthenticated");
  }

  return session as AuthenticatedSession;
}

export async function requireAdmin(): Promise<AuthenticatedSession> {
  const session = await requireUser();
  if (session.user.role !== "admin") {
    throw new AuthorizationError("forbidden");
  }

  return session;
}
