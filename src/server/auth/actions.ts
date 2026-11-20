"use server";

import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { AuthError, CredentialsSignin } from "next-auth";
import type { ZodError } from "zod";
import { signIn } from "@/auth";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import type { AuthActionResult, AuthField } from "@/lib/auth/action-types";
import { safeNextPath } from "@/lib/auth/redirect";
import { loginSchema, registerSchema } from "@/lib/validators/auth";
import { mergeGuestCartIntoUserCart } from "@/server/cart/merge";

function fieldErrorsFrom(error: ZodError): Partial<Record<AuthField, string>> {
  const result: Partial<Record<AuthField, string>> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !result[field as AuthField]) {
      result[field as AuthField] = issue.message;
    }
  }

  return result;
}

function failure(
  message: string | null,
  fieldErrors: Partial<Record<AuthField, string>> = {},
  emailAlreadyRegistered = false,
): AuthActionResult {
  return { ok: false, message, fieldErrors, emailAlreadyRegistered };
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? error.code : undefined;
  const message = "message" in error && typeof error.message === "string" ? error.message : "";

  return code === "23505" || message.includes("duplicate key");
}

/** Un fallo en la fusión no debe impedir el ingreso: la cookie queda para reintentar. */
async function mergeGuestCartForEmail(email: string): Promise<void> {
  const [user] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) {
    return;
  }

  try {
    await mergeGuestCartIntoUserCart(user.id);
  } catch (error) {
    console.error("mergeGuestCartIntoUserCart", error);
  }
}

export async function loginAction(input: unknown, next?: string | null): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return failure(null, fieldErrorsFrom(parsed.error));
  }

  const redirectTo = safeNextPath(next);

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      if (error.code === "rate_limit") {
        return failure("Demasiados intentos. Esperá unos minutos y volvé a probar.");
      }

      return failure(null, { password: "El email o la contraseña son incorrectos." });
    }

    if (error instanceof AuthError) {
      return failure("No se pudo iniciar sesión. Intentá de nuevo.");
    }

    throw error;
  }

  await mergeGuestCartForEmail(parsed.data.email.toLowerCase());
  return { ok: true, redirectTo };
}

export async function registerAction(
  input: unknown,
  next?: string | null,
): Promise<AuthActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return failure(null, fieldErrorsFrom(parsed.error));
  }

  const email = parsed.data.email.toLowerCase();
  const redirectTo = safeNextPath(next);
  const db = getDb();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    return failure(null, { email: "Ya existe una cuenta con este email." }, true);
  }

  const passwordHash = await hash(parsed.data.password, 12);

  try {
    await db.insert(users).values({
      name: parsed.data.name,
      email,
      passwordHash,
      // El rol nunca se toma del cliente: el registro público siempre crea customers.
      role: "customer",
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return failure(null, { email: "Ya existe una cuenta con este email." }, true);
    }

    throw error;
  }

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirect: false,
      redirectTo,
    });
  } catch {
    return failure(
      "La cuenta se creó, pero no se pudo iniciar sesión automáticamente. Ingresá con tu email y contraseña.",
    );
  }

  await mergeGuestCartForEmail(email);
  return { ok: true, redirectTo };
}

export async function googleSignInAction(next?: string | null): Promise<void> {
  await signIn("google", { redirectTo: safeNextPath(next) });
}
