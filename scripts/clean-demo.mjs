/**
 * Elimina únicamente los datos demo (is_demo = true o prefijos demo_*).
 * No toca datos reales, store_settings ni expense_categories.
 *
 * Uso: npm run db:clean-demo
 */
import { cleanDemo, getSql } from "./db.mjs";

async function main() {
  const sql = getSql();
  await cleanDemo(sql);
  console.log("Datos demo eliminados. Los datos reales y la configuración se mantuvieron intactos.");
}

main().catch((error) => {
  console.error(`No se pudo limpiar los datos demo: ${error.message}`);
  process.exitCode = 1;
});
