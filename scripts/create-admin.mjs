/**
 * Crea (o actualiza) el usuario administrador inicial.
 *
 * Uso: npm run db:create-admin
 * Las credenciales se leen de ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD en
 * .env.local o .env. La contraseña nunca se imprime ni se guarda en claro.
 */
import bcrypt from "bcryptjs";
import { getSql, requireEnv } from "./db.mjs";

async function main() {
  const email = requireEnv("ADMIN_EMAIL").trim().toLowerCase();
  const password = requireEnv("ADMIN_INITIAL_PASSWORD");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("ADMIN_EMAIL no tiene un formato de correo válido.");
  }

  if (password.length < 8) {
    throw new Error("ADMIN_INITIAL_PASSWORD debe tener al menos 8 caracteres.");
  }

  const sql = getSql();
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await sql`SELECT id, role FROM users WHERE email = ${email}`;

  if (existing.length > 0) {
    await sql`
      UPDATE users
      SET role = 'admin', password_hash = ${passwordHash}, updated_at = now()
      WHERE id = ${existing[0].id}
    `;
    console.log(`Administrador actualizado correctamente: ${email}`);
    return;
  }

  await sql`
    INSERT INTO users (name, email, email_verified, role, password_hash, is_demo, created_at, updated_at)
    VALUES ('Administrador', ${email}, now(), 'admin', ${passwordHash}, false, now(), now())
  `;
  console.log(`Administrador creado correctamente: ${email}`);
}

main().catch((error) => {
  console.error(`No se pudo crear el administrador: ${error.message}`);
  process.exitCode = 1;
});
