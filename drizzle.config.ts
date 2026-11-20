import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Las migraciones usan la conexión directa (unpooled) de Neon.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const url = process.env.DATABASE_URL_UNPOOLED;

if (!url) {
  throw new Error(
    "Falta DATABASE_URL_UNPOOLED. Copiá .env.example a .env.local y cargá la URL directa de Neon.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
