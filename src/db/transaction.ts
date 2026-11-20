import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

let transactionDb: ReturnType<typeof createTransactionDb> | undefined;

function createTransactionDb() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "Falta DATABASE_URL. Copiá .env.example a .env.local y cargá la URL pooled de Neon.",
    );
  }

  // El driver HTTP de `client.ts` no soporta transacciones interactivas.
  // Este cliente WebSocket (mismo paquete Neon, sin dependencias nuevas) se usa
  // solo cuando una operación debe ser atómica (stock + movimiento, CRUD completo).
  const pool = new Pool({ connectionString });
  return drizzle({ client: pool, schema });
}

/** Cliente Drizzle con soporte para `db.transaction()`. Lazy para no romper el build. */
export function getTransactionalDb() {
  if (!transactionDb) {
    transactionDb = createTransactionDb();
  }
  return transactionDb;
}
