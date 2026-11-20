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

## 2026-11-19 — Fase 4: carrito (completa)

**Qué se hizo**

- Identidad del carrito: cookie httpOnly `cart_token` (30 días, `sameSite: lax`, `secure` en producción) para invitados y `session.user.id` para usuarios. La cookie se crea solo en mutaciones, nunca durante el render. `getCartIdentity()` resuelve la identidad sin escribir cookies en lectura.
- `src/db/queries/cart.ts` centraliza todo el acceso: find-or-create con tolerancia a carreras, ítems con relaciones anidadas (variante → producto → imagen), y queries de ownership que filtran por `(itemId, cartId)` para impedir tocar carritos ajenos.
- Mutaciones en `src/server/cart/actions.ts` (`addToCart`, `updateCartItem`, `removeCartItem`): validación Zod en servidor, precio y stock recalculados desde la BD, cap de cantidad al stock disponible y `revalidatePath` para refrescar el contador. `getCartSummary()` recalcula el subtotal desde la BD, guarda un snapshot de precios en cookie para avisar cambios y expone advertencias de stock/precio.
- Fusión invitado → usuario en `src/server/cart/merge.ts`: transacción única con `FOR UPDATE`, suma de cantidades capeadas por stock, borrado del carrito invitado y limpieza de cookie. Idempotente; aviso de una sola vez si se perdió cantidad por stock. Se invoca desde login/registro (Credentials) y desde el evento `signIn` de Auth.js (Google), con manejo de errores que no bloquea el ingreso.
- UI: `/carrito` con estado vacío, resumen, advertencias y enlace "Continuar al pago" a `/checkout` (ruta de Fase 5, hoy 404); filas editables con react-hook-form + `zodResolver`; integración real del botón "Agregar al carrito" en el detalle de producto; contador navegable en el navbar. Todo en español rioplatense y mobile-first.
- Fix de PPR: `auth()` genera un token CSRF aleatorio vía `crypto.getRandomValues()` en cada llamada sin cookie; al pasar el navbar a leer sesión eso rompía el prerender del shell con `cacheComponents: true`. Se agregó `await connection()` en `getCartSummary()` (el navbar y `/carrito` ya tenían `<Suspense>`), confirmado por la doc actual de Next.js 16.

**Qué falta**

- `/checkout` es Fase 5: el enlace "Continuar al pago" lleva a una ruta que todavía no existe (404 esperado).
- El merge depende de `DATABASE_URL` con pool WebSocket para la transacción (`getTransactionalDb()`), ya usada en Fase 3; no se probó end-to-end contra la BD por la restricción de no mutar datos en esta sesión.
- El directo de Google usa el evento `signIn`; si en el futuro se migra a un flujo que no lo dispare, hay que mover el merge al callback.

**Verificación**

- Documentación verificada vía Context7: `cookies()` async y escribible solo en Server Actions/Route Handlers, `revalidatePath`, `onConflictDoUpdate` de Drizzle, `zodResolver` con Zod 4 y `connection()` para PPR.
- `npm run typecheck`, `npm run lint` y `npm run build`: pasan sin errores. `next build` reporta `/carrito` como Partial Prerender.
- Smoke de base de datos (solo lectura): 0 carritos y 0 ítems (sin mutaciones), 16 productos demo, 28 variantes demo, 20 clientes demo y 180 pedidos demo intactos.
- Smoke HTTP en servidor de producción: 200 en `/carrito` (estado vacío y contador "Carrito, 0 productos"), `/` (contador presente) y `/producto/camiseta-basica-algodon` (botón real, sin placeholder). `/checkout` devuelve 404 por Fase 5. Log del servidor sin errores de prerender.
- No se ejecutaron comandos que modifiquen la base, no se crearon archivos de credenciales y no se hicieron commits.

## 2026-11-19 — Fase 5: checkout, pagos y pedidos (implementada; prueba en vivo pendiente)

**Qué se hizo**

- Se instaló `mercadopago@3.6.2` (SDK oficial) y se verificó su API actual vía Context7 + los propios `.d.ts` del paquete: `Preference.create`, `Payment.get` y `WebhookSignatureValidator.validate`. Integración elegida: **Checkout Pro** con redirección; `sandbox_init_point` con token `TEST-` y `init_point` en producción.
- `src/lib/mercadopago.ts`: cliente perezoso, validación de `MP_ACCESS_TOKEN`/`APP_URL` en el punto de uso (nunca al importar, para que el build ande sin credenciales), `notification_url = ${APP_URL}/api/webhooks/mercadopago`, `external_reference = order.id`, `back_urls` con `order` y `status`, y `auto_return: approved`.
- `src/server/checkout/order-service.ts`: `createPendingOrder()` crea pedido + ítems con snapshots + historial en UNA transacción, leyendo configuración, carrito, precios, costos, stock e dirección desde la BD (nunca acepta importes del cliente). `createPreferenceForOrder()` reutiliza el mismo pedido para el alta y para "Reintentar pago", sin duplicarlo.
- Webhook `/api/webhooks/mercadopago`: valida la firma `x-signature` con el SDK antes de leer el body, ignora notificaciones que no son de pago, consulta siempre el pago a la API de MP (nunca confía en el cuerpo), registra el evento con idempotencia por `(provider, external_id, action)` y, en una sola transacción, pasa el pedido a `paid`, escribe `paid_at`/`mp_payment_id`/`payment_method`, descuenta stock con `stock_movements` tipo `sale` sin permitir negativo, vacía el carrito y registra el historial. Rechazados/cancelados/expirados dejan el pedido en `pending_payment` para permitir reintento.
- Convención para stock insuficiente al aprobar: como el esquema no tiene columna de revisión manual y no se agregó migración, se marca `orders.mp_status` con el prefijo `MANUAL_REVIEW:` y el detalle del pedido lo muestra como advertencia. El panel admin deberá leer ese prefijo.
- Direcciones: CRUD completo en `/cuenta/direcciones` (`src/db/queries/addresses.ts` + `src/server/account/address-actions.ts`), siempre filtrado por `session.user.id`, con una sola predeterminada por usuario y reasignación al eliminar.
- UI: `/checkout` (envío/retiro, dirección guardada o nueva, resumen en vivo), `/checkout/resultado` (aprobado/pendiente/rechazado, mostrando además el estado real de la BD y avisando que el webhook manda), `/cuenta/pedidos` y `/cuenta/pedidos/[id]` con ítems, dirección congelada, pago, línea de tiempo y botón "Reintentar pago". Textos en español rioplatense y marca tomada de `siteConfig`.

**Qué falta**

- Probar el flujo completo en vivo con el túnel y los usuarios de prueba de MercadoPago: la preferencia real, la redirect a la URL de sandbox, el webhook firmado y el descuento de stock. No se hizo porque no hay URL pública ni se permiten llamadas reales a la API en esta sesión.
- La URL pública del webhook en desarrollo: con `APP_URL=http://localhost:3000` todo cae en localhost; hay que apuntarla al túnel (ngrok/cloudflared) y registrar esa URL en el panel de MP.
- Confirmar los usuarios de prueba (comprador/vendedor) del panel de desarrolladores; la tarjeta sandbox de prueba quedó fuera de cualquier archivo.
- Mostrar el prefijo `MANUAL_REVIEW:` en el panel admin de pedidos (Fase 6) y decidir si se agrega una columna dedicada en una migración futura.

**Verificación**

- Documentación verificada vía Context7 (SDK de MercadoPago, validación de firma y Next.js 16) y contrastada contra los tipos instalados; `mercadopago@3.6.2` es `latest`.
- `npm run typecheck`, `npm run lint` y `npm run build`: pasan sin errores. Fix de build: `export const runtime = "nodejs"` es incompatible con `cacheComponents`, se removió (los route handlers ya son Node.js por defecto).
- Fix de PPR: `auth()` usa `crypto.getRandomValues()` y rompía el prerender de `/checkout` y `/checkout/resultado`; se agregó `await connection()` antes de `requireUser()` en todas las pantallas de cuenta y checkout. Log del servidor sin errores de prerender tras el fix.
- Smoke local de firma (sin credenciales ni red): una firma HMAC-SHA256 válida es aceptada y una con secreto distinto se rechaza con `InvalidWebhookSignatureError`.
- Smoke de base de datos (solo lectura): 1 fila de `store_settings`, 180 pedidos, 351 ítems, 346 entradas de historial, 166 eventos de pago, 20 direcciones, 28 variantes, secuencia `order_number_sequence` en 360; columnas `mp_status`, `mp_payment_id`, `mp_preference_id`, `paid_at` y `shipping_address` presentes.
- Smoke HTTP en servidor de producción: 200 en `/checkout`, `/checkout/resultado`, `/catalogo` y `/carrito`; 307 a login en `/cuenta/direcciones` y `/cuenta/pedidos`; 401 en el webhook sin firma. Sin 500 ni errores en el log.
- No se ejecutaron comandos que modifiquen la base, no se leyeron ni imprimieron credenciales, no se llamó a la API real de MercadoPago y no se hicieron commits.

## 2026-11-19 — Fase 6: gestión de pedidos admin (completa)

**Qué se hizo**

- Se agregó `/admin/pedidos` con filtros por estado, rango de fechas y texto libre (número de pedido, nombre o email del cliente), paginación de 12 por página y orden por más reciente. La tabla muestra número, cliente, fecha, total en ARS, estado, medio de pago y una alerta de "Revisión manual" cuando `mp_status` tiene el prefijo `MANUAL_REVIEW:`.
- Se agregó `/admin/pedidos/[id]` con cliente, dirección congelada, ítems con snapshots, información de pago (`mp_status`, `mp_payment_id`, `payment_method`, `paid_at`, `cancelled_at`), línea de tiempo con el usuario que cambió cada estado y movimientos de stock asociados. El aviso de revisión manual muestra el valor completo de `mp_status`.
- Nuevas queries de panel en `src/db/queries/orders.ts`: `listAdminOrders` y `getAdminOrderDetail`. Ambas llaman a `requireAdmin()` además del proxy; el texto libre escapa comodines ILIKE y las fechas se interpretan en hora Argentina (-03:00).
- Reglas de transición centralizadas en `src/lib/admin/orders.ts`: `paid → preparing → shipped → delivered`. `pending_payment` solo avanza por webhook; `delivered` y `cancelled` son terminales. La UI ofrece solo las transiciones válidas y el servidor las valida de nuevo con Zod.
- `src/server/admin/orders.ts` implementa `changeOrderStatusAction` y `cancelOrderAction` en transacciones con `FOR UPDATE`. El cambio de estado escribe `order_status_history` con `changed_by = session.user.id`. La cancelación solo se permite desde `pending_payment`, `paid`, `preparing` o `shipped`, devuelve stock con movimientos `cancellation` en la misma transacción, setea `cancelled_at` y es idempotente (pedido bloqueado + guarda de devoluciones previas).
- Decisión de stock: si existen movimientos `sale` del pedido se devuelve exactamente lo descontado (cubre descuentos parciales por stock insuficiente); si no existen —pedidos demo— se usa la cantidad de los ítems para estados pagos. Así se cumple la regla de devolución sin depender de que el seed haya generado movimientos de venta.
- Se conectó el enlace "Pedidos" del sidebar y se agregó un `loading.tsx` para la ruta del listado.

**Qué falta**

- Probar el recorrido completo con un pago sandbox real: el webhook es el único que genera el estado `paid`, por lo que las transiciones posteriores no se ejercitaron end-to-end en esta sesión.
- Según crezca el volumen, conviene mover los filtros a índices compuestos y revisar el tamaño de página.

**Verificación**

- Documentación actual verificada vía Context7: `db.transaction()` de Drizzle y `searchParams` async / `revalidatePath` en Server Actions de Next.js 16. No se agregaron dependencias.
- `npm run typecheck`, `npm run lint` y `npm run build`: pasan sin errores. `next build` reporta `/admin/pedidos` y `/admin/pedidos/[id]` como Partial Prerender.
- Smoke de base de datos (solo lectura): 180 pedidos, 351 ítems, 346 entradas de historial, 166 eventos de pago, 0 pedidos en revisión manual, 0 movimientos de cancelación y 0 variantes con stock negativo. Los datos demo quedaron intactos.
- Smoke HTTP en servidor de producción: `/admin/pedidos` y `/admin/pedidos/<id>` redirigen 307 a `/login?next=…` sin sesión; el servidor se detuvo al finalizar.
- `git status`: solo archivos de código del panel de pedidos, `PROGRESS.md` y `AGENTS.md`. No se crearon credenciales, no se mutó la base, no se llamó a MercadoPago y no se hicieron commits.
