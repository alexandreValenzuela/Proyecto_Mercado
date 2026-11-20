"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerSchema, type RegisterInput } from "@/lib/validators/auth";
import { registerAction } from "@/server/auth/actions";

export function RegisterForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [emailAlreadyRegistered, setEmailAlreadyRegistered] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: RegisterInput) => {
    setServerMessage(null);
    setEmailAlreadyRegistered(false);

    const result = await registerAction(values, next);
    if (!result.ok) {
      if (result.message) {
        setServerMessage(result.message);
      }

      setEmailAlreadyRegistered(result.emailAlreadyRegistered);

      for (const [field, message] of Object.entries(result.fieldErrors)) {
        if (message) {
          setError(field as keyof RegisterInput, { message });
        }
      }

      return;
    }

    router.push(result.redirectTo);
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {serverMessage ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {serverMessage}
        </p>
      ) : null}

      {emailAlreadyRegistered ? (
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="block">
          <span
            className={buttonVariants({ variant: "outline", size: "lg", className: "w-full" })}
          >
            Ir a iniciar sesión
          </span>
        </Link>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="register-name">Nombre</Label>
          <Input
            id="register-name"
            type="text"
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            {...register("name")}
          />
          {errors.name ? (
            <p role="alert" className="text-xs text-danger">
              {errors.name.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="register-email">Email</Label>
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
          />
          {errors.email ? (
            <p role="alert" className="text-xs text-danger">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="register-password">Contraseña</Label>
          <Input
            id="register-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            {...register("password")}
          />
          {errors.password ? (
            <p role="alert" className="text-xs text-danger">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="register-confirm-password">Repetí la contraseña</Label>
          <Input
            id="register-confirm-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword ? (
            <p role="alert" className="text-xs text-danger">
              {errors.confirmPassword.message}
            </p>
          ) : null}
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creando cuenta…" : "Crear cuenta"}
        </Button>
      </form>
    </div>
  );
}
