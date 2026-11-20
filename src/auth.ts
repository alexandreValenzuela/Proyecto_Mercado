import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { getDb } from "@/db/client";
import { accounts, users } from "@/db/schema";
import {
  assertLoginAttemptAllowed,
  clearLoginAttempts,
  getRequestIp,
} from "@/lib/auth/rate-limit";
import { loginSchema } from "@/lib/validators/auth";

/** Instancia completa: adaptador Drizzle + Credentials + la config edge-safe. */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
  }),
  session: { strategy: "jwt" },
  providers: [
    ...authConfig.providers,
    Credentials({
      name: "Email y contraseña",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const ip = getRequestIp(request);
        assertLoginAttemptAllowed(ip, parsed.data.email);

        const [user] = await getDb()
          .select()
          .from(users)
          .where(eq(users.email, parsed.data.email))
          .limit(1);

        // Los usuarios sin password_hash no pueden ingresar con credenciales.
        if (!user?.passwordHash) {
          return null;
        }

        const passwordMatches = await compare(parsed.data.password, user.passwordHash);
        if (!passwordMatches) {
          return null;
        }

        clearLoginAttempts(ip, parsed.data.email);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
});
