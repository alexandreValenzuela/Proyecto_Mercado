export type AuthField = "name" | "email" | "password" | "confirmPassword";

export type AuthActionResult =
  | { ok: true; redirectTo: string }
  | {
      ok: false;
      message: string | null;
      fieldErrors: Partial<Record<AuthField, string>>;
      emailAlreadyRegistered: boolean;
    };
