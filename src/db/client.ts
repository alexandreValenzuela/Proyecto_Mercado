import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Database = ReturnType<typeof createDatabase>;

let database: Database | undefined;

function createDatabase() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "Falta DATABASE_URL. Copiá .env.example a .env.local y cargá la URL pooled de Neon.",
    );
  }

  // Cliente HTTP de Neon: no abre conexiones persistentes ni valida credenciales
  // hasta que se ejecuta la primera consulta.
  return drizzle({ client: neon(connectionString), schema });
}

/**
 * Devuelve el cliente de Drizzle de forma perezosa.
 * No conecta ni falla al importar el módulo, así `next build` funciona sin variables de entorno.
 */
export function getDb(): Database {
  if (!database) {
    database = createDatabase();
  }

  return database;
}
