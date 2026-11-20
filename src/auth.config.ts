import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/lib/auth/roles";

/**
 * Configuración edge-safe: se usa tal cual en `src/proxy.ts` y se reutiliza en
 * `src/auth.ts`. No importa el adaptador ni el cliente de base de datos.
 */
export const authConfig = {
  secret: process.env.AUTH_SECRET,
  // Railway termina TLS y detrás del proxy el host original no es confiable.
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    // El guardián de rutas decide el destino: login para invitados, /403 para clientes.
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user.role ?? "customer") as UserRole;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? token.sub ?? "";
        session.user.role = token.role ?? "customer";
      }

      return session;
    },
  },
} satisfies NextAuthConfig;
