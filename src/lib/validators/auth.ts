import { z } from "zod";

/** Esquemas compartidos entre el cliente (react-hook-form) y el servidor. */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Ingresá tu email.")
    .email({ message: "Ingresá un email válido." }),
  password: z.string().min(1, "Ingresá tu contraseña."),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "El nombre debe tener al menos 2 caracteres.")
      .max(80, "El nombre no puede superar los 80 caracteres."),
    email: z
      .string()
      .trim()
      .min(1, "Ingresá tu email.")
      .email({ message: "Ingresá un email válido." }),
    // bcrypt solo usa los primeros 72 bytes; limitar evita contraseñas engañosas.
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres.")
      .max(72, "La contraseña no puede superar los 72 caracteres."),
    confirmPassword: z.string().min(1, "Repetí la contraseña."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden.",
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
