/**
 * Semilla de configuración no demo: la fila única de store_settings y las
 * categorías de egreso iniciales. Es idempotente y se ejecuta antes del seed
 * demo desde `npm run db:seed:demo`.
 */
import { getSql, INITIAL_EXPENSE_CATEGORIES } from "./db.mjs";

async function main() {
  const sql = getSql();

  await sql.transaction((txn) => [
    txn`
      INSERT INTO store_settings (
        store_name, shipping_flat_cents, free_shipping_threshold_cents,
        pickup_enabled, delivery_enabled, pickup_instructions,
        contact_email, contact_whatsapp, created_at, updated_at
      )
      VALUES (
        'GAO Store', 1200, 25000, true, true,
        'Retiro en local de lunes a viernes, de 10 a 18 h.',
        'contacto@gaostore.local', null, now(), now()
      )
      ON CONFLICT DO NOTHING
    `,
    ...INITIAL_EXPENSE_CATEGORIES.map((category) => txn`
      INSERT INTO expense_categories (name, color, active, created_at, updated_at)
      VALUES (${category.name}, ${category.color}, true, now(), now())
      ON CONFLICT (name) DO NOTHING
    `),
  ]);

  console.log("Configuración inicial lista: store_settings y 6 categorías de egreso.");
}

main().catch((error) => {
  console.error(`No se pudo cargar la configuración inicial: ${error.message}`);
  process.exitCode = 1;
});
