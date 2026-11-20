/**
 * Utilidades compartidas por los scripts de base de datos.
 *
 * Las migraciones usan DATABASE_URL_UNPOOLED (conexión directa); los scripts
 * prefieren esa misma URL y aceptan la pooled como respaldo para entornos que
 * solo exponen DATABASE_URL. Todas las consultas usan template tags: los
 * valores viajan como parámetros, nunca interpolados en el SQL.
 */
import { config as loadEnv } from "dotenv";
import { neon } from "@neondatabase/serverless";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export const INITIAL_EXPENSE_CATEGORIES = [
  { name: "Mercadería", color: "#4F7A5A" },
  { name: "Envíos", color: "#E39A78" },
  { name: "Publicidad", color: "#C58A2B" },
  { name: "Servicios", color: "#6F6A63" },
  { name: "Impuestos", color: "#C0504D" },
  { name: "Otros", color: "#B9AFA3" },
];

export function requireEnv(name) {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    throw new Error(
      `Falta ${name}. Copiá .env.example a .env.local y completá la variable antes de continuar.`,
    );
  }

  return value;
}

export function getSql() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

  if (!url || url.trim() === "") {
    throw new Error(
      "Falta DATABASE_URL_UNPOOLED (o DATABASE_URL). Copiá .env.example a .env.local y cargá la URL de Neon.",
    );
  }

  return neon(url);
}

/** Ejecuta constructores de consulta en transacciones pequeñas y no interactivas. */
export async function runBatches(sql, builders, batchSize = 25) {
  for (let offset = 0; offset < builders.length; offset += batchSize) {
    const batch = builders.slice(offset, offset + batchSize);
    await sql.transaction((txn) => batch.map((build) => build(txn)));
  }
}

/**
 * Borra únicamente datos demo, en orden FK inverso.
 *
 * `payment_events`, `carts` y `addresses` no tienen columna is_demo: sus filas
 * demo se identifican por el prefijo `demo_mp_` / `demo_cart_` o por pertenecer
 * a usuarios demo. Nunca se tocan store_settings ni expense_categories.
 */
export async function cleanDemo(sql) {
  await sql.transaction((txn) => [
    txn`DELETE FROM payment_events WHERE external_id LIKE 'demo_mp_%'`,
    txn`DELETE FROM order_status_history WHERE order_id IN (SELECT id FROM orders WHERE is_demo = true)`,
    txn`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE is_demo = true)`,
    txn`DELETE FROM stock_movements
        WHERE order_id IN (SELECT id FROM orders WHERE is_demo = true)
           OR variant_id IN (
             SELECT v.id FROM product_variants v
             INNER JOIN products p ON p.id = v.product_id
             WHERE p.is_demo = true
           )`,
    txn`DELETE FROM product_views WHERE product_id IN (SELECT id FROM products WHERE is_demo = true)`,
    txn`DELETE FROM cart_items
        WHERE cart_id IN (
          SELECT id FROM carts
          WHERE session_token LIKE 'demo_cart_%'
             OR user_id IN (SELECT id FROM users WHERE is_demo = true)
        )
           OR variant_id IN (
             SELECT v.id FROM product_variants v
             INNER JOIN products p ON p.id = v.product_id
             WHERE p.is_demo = true
           )`,
    txn`DELETE FROM carts
        WHERE session_token LIKE 'demo_cart_%'
           OR user_id IN (SELECT id FROM users WHERE is_demo = true)`,
    txn`DELETE FROM addresses WHERE user_id IN (SELECT id FROM users WHERE is_demo = true)`,
    txn`DELETE FROM orders WHERE is_demo = true`,
    txn`DELETE FROM users WHERE is_demo = true`,
    txn`DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE is_demo = true)`,
    txn`DELETE FROM product_variants WHERE product_id IN (SELECT id FROM products WHERE is_demo = true)`,
    txn`DELETE FROM products WHERE is_demo = true`,
    txn`DELETE FROM categories WHERE is_demo = true`,
    txn`DELETE FROM expenses WHERE is_demo = true`,
  ]);
}
