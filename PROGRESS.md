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

## 2026-11-19 — Fase 2: autenticación y roles (completa)

**Qué se hizo**

- Se instalaron `next-auth@5.0.0-beta.32` (v5: `latest` del registro sigue siendo v4), `@auth/drizzle-adapter@1.11.3`, `zod@4.6.7`, `react-hook-form@7.92.0` y `@hookform/resolvers@7.0.7`.
- Se separó la configuración edge-safe (`src/auth.config.ts`: providers, `pages`, `authorized`, callbacks JWT/sesión) de la instancia completa (`src/auth.ts`: adaptador Drizzle sobre `users`/`accounts`, Credentials con bcrypt, sesión JWT). El rol viaja en el token y se expone como `session.user.role`.
- Se agregó el route handler `/api/auth/[...nextauth]`, los helpers `requireUser()`/`requireAdmin()` como punto único de verificación en servidor y el guardián `src/proxy.ts` para `/admin/*` y `/cuenta/*` (Next.js 16 reemplazó `middleware.ts` por `proxy.ts`).
- `/registro` y `/login` usan esquemas Zod compartidos con el cliente, errores por campo sin perder los datos del formulario, rol forzado a `customer`, checkeo de email duplicado y autologin tras el registro. Google queda configurado por `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`.
- `next` se valida con `safeNextPath` (solo rutas relativas del mismo origen) y se respeta tras login/registro. El proveedor Credentials limita intentos por IP + email y por IP en memoria, con código `rate_limit` traducido a un mensaje en español.
- Se agregaron páginas `/403`, `/404`, `not-found.tsx` y un boundary `error.tsx` con acción de reintento.

**Qué falta**

- Completar `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` para probar el ingreso con Google; con las variables vacías el build y las páginas funcionan igual.
- Ejecutar `db:create-admin` cuando se definan las credenciales del administrador (no se hizo para no inventarlas).
- La fusión del carrito invitado al loguearse/registrarse corresponde a Fase 4 y todavía no está implementada.
- El limitador es por proceso: en Railway con varias instancias habría que moverlo a un store compartido. Las páginas `/admin/*` se crean en Fase 3 (por ahora el guardián ya las protege).

**Verificación**

- `npm run typecheck`: pasa sin errores.
- `npm run lint`: pasa sin errores ni warnings.
- `npm run build`: pasa; `next build` muestra `ƒ Proxy (Middleware)` y `/login` y `/registro` como Partial Prerender.
- Smoke test en servidor de producción: HTTP 200 en `/login`, `/registro`, `/403` y `/api/auth/providers` (Google y Credentials presentes); `/404` devuelve 404 con la página amigable; `/cuenta/pedidos` y `/admin` redirigen 307 a `/login?next=…` sin sesión.
- Smoke test con JWT sintético: un `customer` que intenta `/admin` recibe 307 a `/403`; un `admin` pasa el guardián (responde 404 porque las páginas del panel son Fase 3). Ningún servidor quedó escuchando y no se ejecutaron comandos que modifiquen la base.

## 2026-11-19 — Fase 3: catálogo y administración de productos (completa)

**Qué se hizo**

- Se creó `src/db/queries/catalog.ts`: listado compartido público/admin con precio efectivo, stock total y "más vendidos" calculado solo desde ítems de pedidos pagados; detalle con categoría, imágenes y variantes; helpers de existencia/slug e historial de stock.
- Se agregaron `src/lib/money.ts` (`formatMoney`, `parsePriceToCents`, `centsToInput`) y `src/lib/validators/catalog.ts` con Zod para queries, productos, categorías, variantes, imágenes, ajustes de stock y visitas.
- Se creó `src/db/transaction.ts` con un pool WebSocket de Neon para transacciones interactivas: el cliente HTTP de `client.ts` no las soporta y no se agregó ninguna dependencia nueva. El ajuste de stock usa `FOR UPDATE` y nunca permite stock negativo.
- Storefront: layout con navbar y footer responsive, inicio con destacados calculados y categorías, `/catalogo` con búsqueda, filtros, orden y paginación, y `/producto/[slug]` con galería, selector de variantes, estados de stock y registro de visitas (cookie httpOnly `visitor_token`, máximo una por producto/hora).
- El botón "Agregar al carrito" queda visible pero deshabilitado con un aviso: el carrito es Fase 4. No simula éxito ni persiste nada.
- Administración: layout con sidebar y topbar, dashboard, CRUD de categorías y productos (variantes + imágenes), ajuste de stock con `stock_movements` e historial por variante. Todas las actions y queries verifican `requireAdmin()` además del proxy.
- Cloudinary: subida firmada directa con SHA-1 sobre parámetros ordenados + API secret usando `node:crypto`. Las credenciales se validan en el punto de uso, así que con las variables vacías el build sigue funcionando.
- Se agregaron `remotePatterns` para `res.cloudinary.com` y `placehold.co` en `next.config.ts`.

**Qué falta**

- Las credenciales de Cloudinary siguen vacías: la subida de imágenes muestra un error claro hasta configurarlas en `.env.local`. Lo mismo vale para Google y MercadoPago en sus fases.
- Con `cacheComponents`, `notFound()` dentro del boundary de streaming responde HTTP 200 con la UI de "no encontrado" (soft 404). La UX es correcta; si se quiere un 404 real se debería mover la resolución del slug fuera de Suspense.
- Fase 4 (carrito) y el resto de las fases según el plan.

**Verificación**

- `npm run typecheck`, `npm run lint` y `npm run build`: pasan sin errores. `next build` reporta todas las rutas como Partial Prerender.
- Fix de build: con `cacheComponents: true`, el footer asíncrono del layout store y el `requireAdmin()` del layout admin bloqueaban el prerender; ambos se envolvieron en `<Suspense>` con fallback y `params` se resuelve dentro del boundary en `/producto/[slug]`.
- Smoke de base de datos (solo lectura): 5 categorías, 16 productos activos, 28 variantes activas y 1 fila de `store_settings`; top por ventas reales coherente y detalle/filtro de `camiseta-basica-algodon` correctos.
- Smoke HTTP en servidor de producción: 200 en `/`, `/catalogo`, `/catalogo?q=camiseta`, `/producto/camiseta-basica-algodon`, `/login` y `/registro`; `/admin` redirige 307 a login sin sesión. El inicio renderiza productos reales con imágenes.
- No se ejecutaron comandos que modifiquen la base, no se crearon archivos de credenciales y no se hicieron commits.
