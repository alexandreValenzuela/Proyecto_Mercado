# Progreso

## 2026-11-19 — Fase 0: base del proyecto

**Qué se hizo**

- Se eliminaron los directorios heredados `backend/` y `frontend/` (esquema multi-vendor y maqueta vacía) por contradecir la especificación de `AGENTS.md`.
- Se creó la app Next.js 16.4.6 en la raíz con TypeScript, App Router, `src/`, ESLint y Tailwind CSS v4.
- Se inicializó shadcn/ui con el preset `base-nova` y se agregaron `button`, `card`, `input`, `label` y `badge`.
- Se definieron los tokens de la paleta "Arcilla y salvia" en `src/app/globals.css` (`@theme inline`), las fuentes Nunito/Inter en `src/app/layout.tsx` y las constantes de marca en `src/config/site.ts`.
- Se agregó `.env.example`, `drizzle.config.ts` (usa `DATABASE_URL_UNPOOLED`), `src/db/client.ts` (cliente Neon/Drizzle perezoso) y `src/db/schema.ts` como placeholder de Fase 1.
- Se crearon los scripts placeholder `seed-demo`, `clean-demo` y `create-admin`; imprimen un aviso y salen con código 0.
- Se escribieron `README.md` y este archivo, y se completaron los casilleros de Fase 0 en `AGENTS.md`.

**Qué falta**

- Fase 1: esquema completo de base de datos, primera migración en Neon, creación de administrador, semillas de configuración y datos demo reales.
- Fases 2 a 10: autenticación, catálogo, carrito, checkout con MercadoPago, administración, contabilidad, estadísticas, estudio de mercado y despliegue.

**Verificación**

- `npm run typecheck`: pasa sin errores.
- `npm run lint`: pasa sin errores.
- `npm run build`: pasa sin errores (Next.js 16.4.6 con Turbopack, rutas `/` y `/_not-found` prerenderizadas).
- Smoke test en servidor de producción: HTTP 200 en `/`, con la marca desde `siteConfig`, el texto "Tienda en construcción" y `lang="es-AR"`.

## 2026-11-19 — Fase 1: base de datos (completa)

**Qué se hizo**

- Se reemplazó `src/db/schema.ts` por el esquema completo: 18 tablas, 4 enums, secuencia `order_number_sequence`, 16 relaciones, FK, checks e índices de filtro.
- Decisión Auth.js: con sesión JWT y providers Credentials + Google no se crean `sessions` ni `verificationTokens` (la documentación oficial las marca opcionales); sí se crea `accounts` con PK compuesta `(provider, provider_account_id)` y `expires_at` integer, con nombres de propiedades TS compatibles con `@auth/drizzle-adapter`.
- Se agregó `scripts/db.mjs` (carga `.env.local`/`.env`, cliente Neon por template tags, `runBatches`, `cleanDemo`) y `bcryptjs` como dependencia para hash de contraseñas.
- `scripts/create-admin.mjs` hace upsert de admin (`ADMIN_EMAIL`/`ADMIN_INITIAL_PASSWORD`) con bcrypt cost 12 y nunca imprime la contraseña.
- `scripts/seed-settings.mjs` carga la fila única de `store_settings` y las 6 categorías de egreso iniciales; quedó cableado antes del seed demo en `db:seed:demo`.
- `scripts/seed-demo.mjs` genera 5 categorías, 16 productos, 28 variantes, 20 clientes en provincias distintas, 180 pedidos en los últimos 90 días con ítems/snapshots/historial/eventos de pago, 32 egresos y 98 visitas. Es re-runnable (borra demo y usa ids deterministas) e incluye `DRY_RUN=1` para validar sin base.
- `scripts/clean-demo.mjs` borra solo datos demo en orden FK inverso, sin tocar datos reales, `store_settings` ni `expense_categories`.
- Se generó y aplicó la primera migración en Neon (`drizzle/0000_even_chat.sql`): 18 tablas, 60 índices, 4 enums y 1 migración registrada.
- Fix aplicado durante la migración: el índice único que garantiza una sola fila en `store_settings` necesitaba `((true))` como expresión; con `true` PostgreSQL fallaba con error de sintaxis. Se corrigió en `schema.ts` (fuente de verdad) y se regeneró la migración. El primer intento dejó DDL huérfano en una BD vacía; se limpió y se reaplicó desde cero sin pérdida de datos.

**Qué falta**

- Ejecutar `db:create-admin` cuando se definan `ADMIN_EMAIL` y `ADMIN_INITIAL_PASSWORD` en `.env.local`; el script está listo y no se ejecutó para no inventar credenciales.
- Fases 2 a 10 según el plan original.

**Verificación**

- `npm run typecheck`: pasa sin errores.
- `npm run lint`: pasa sin errores ni warnings.
- `npm run build`: pasa sin errores.
- `node --check`: pasa en los cinco scripts (incluido el helper compartido).
- `npm run db:generate` / `npm run db:migrate`: migración aplicada en Neon; 18 tablas, 60 índices, 4 enums, 1 migración registrada.
- `npm run db:seed:demo`: 5 categorías, 16 productos, 28 variantes, 20 clientes, 180 pedidos, 351 ítems, 32 egresos, 98 visitas; `store_settings` y 6 categorías de egreso presentes.
- `npm run db:clean-demo`: elimina únicamente datos demo y preserva `store_settings` y `expense_categories`; se volvió a sembrar después de probarlo. Sin stock negativo y 180 pedidos con comisiones en `null`.
- `git status`: sin archivos `.env` reales versionados; solo `.env.example` está trackeado.
