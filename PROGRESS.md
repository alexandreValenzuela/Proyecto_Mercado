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

## 2026-11-19 — Fase 7: contabilidad (completa)

**Qué se hizo**

- Se agregó `src/server/accounting/queries.ts` con funciones puras que reciben un rango de fechas: balance del período, costo de ventas y margen bruto, egresos por categoría, movimientos unificados y listados de egresos/categorías. Cada query llama a `requireAdmin()` además del proxy.
- Los ingresos se derivan de pedidos en `paid`, `preparing`, `shipped` y `delivered`, usando `paid_at` como fecha contable; `cancelled` y `pending_payment` quedan excluidos. El día contable se calcula en SQL con `AT TIME ZONE 'America/Argentina/Buenos_Aires'`. Los límites del rango usan `-03:00` porque Argentina no tiene horario de verano.
- El margen bruto es ingresos menos `SUM(unit_cost_cents * quantity)` de los ítems vendidos, absoluto y en porcentaje. Cuando algún ítem vendido no tiene costo, se muestra la advertencia "Margen incompleto" en lugar de asumir costo 0. Los campos de comisión siguen sin usarse.
- `/admin/contabilidad` muestra KPIs del período (día, semana, mes, año o rango libre), balance, costo de ventas, margen, gráfico de egresos por categoría y tabla unificada de ingresos/egresos ordenable por fecha con enlaces al pedido.
- `/admin/contabilidad/egresos` y `/admin/contabilidad/categorias` implementan el CRUD: alta, edición y baja de egresos (hard delete) y alta, edición y desactivación de categorías (baja lógica para no romper egresos existentes). Importes escritos en pesos y convertidos a centavos en el servidor, con Zod y `requireAdmin()` en cada action.
- Se conectó el enlace "Contabilidad" del sidebar, se agregó un `loading.tsx` y se instaló `recharts@3.11.0` (ya figuraba en el stack aprobado; sin nuevas dependencias fuera de `AGENTS.md`).
- Se actualizaron los casilleros de Fase 7 en `AGENTS.md`.

**Qué falta**

- Conectar los KPIs de contabilidad con el dashboard general (Fase 8) si se decide reutilizar las mismas funciones.
- Probar en vivo la creación/edición de egresos con una sesión de administrador; en esta sesión no se crearon credenciales ni se mutó la base.
- Los egresos demo siguen marcados como `is_demo = true` y `db:clean-demo` continúa borrándolos sin tocar las 6 categorías reales.

**Verificación**

- Documentación actual verificada vía Context7: `sql<T>` y agregados de Drizzle, componentes de Recharts 3 y Server Actions / `searchParams` async de Next.js 16.
- `npm run typecheck`, `npm run lint` y `npm run build`: pasan sin errores. `next build` reporta las tres rutas nuevas como Partial Prerender.
- Smoke de base de datos (solo lectura): 180 pedidos (158 con estados de ingreso y 22 excluidos), 158 pedidos con `paid_at` para calcular ingresos, 9.631.300 centavos de ingresos versus 1.279.700 centavos de pedidos excluidos, 32 egresos demo por 1.649.755 centavos, 6 categorías reales, 308 ítems vendidos y 0 con costo faltante. Las consultas con `AT TIME ZONE` devuelven días de noviembre de 2026 coherentes con los datos sembrados.
- Smoke HTTP en servidor de producción: `/admin/contabilidad`, `/admin/contabilidad/egresos` y `/admin/contabilidad/categorias` redirigen 307 a `/login?next=…` sin sesión; el servidor se detuvo y el puerto quedó libre.
- `git status`: solo código de contabilidad, `package.json`/`package-lock.json` por Recharts, `PROGRESS.md`, `AGENTS.md` y el enlace del sidebar. No se crearon credenciales, no se mutó la base, no se llamó a MercadoPago y no se hicieron commits.

## 2026-11-20 — Fase 8: dashboard y estadísticas (completa)

**Qué se hizo**

- Se reemplazó el placeholder de `/admin` por KPIs reales (ventas de hoy y del mes, ticket promedio, variación contra el mes anterior alineado por día, pedidos por atender y stock bajo), gráfico de ventas de los últimos 30 días con la serie anterior, tabla de últimos pedidos y alertas de stock con enlace a cada producto.
- Se agregó `/admin/estadisticas` con filtros de período (día, semana, mes) y granularidad (días, semanas, meses), comparativa contra el bloque anterior, ventas agrupadas, pedidos por estado, top productos por unidades e ingresos, menor rotación, categorías más vendidas y más rentables, métodos de pago, clientes nuevos vs. recurrentes y stock bajo. Incluye `loading.tsx` y un error boundary reutilizable para todo `/admin`.
- Nuevas consultas puras en `src/server/analytics/queries.ts`: reciben rangos de fechas, agrupan en `America/Argentina/Buenos_Aires` con `AT TIME ZONE`, reutilizan `INCOME_STATUSES` de contabilidad y llaman a `requireAdmin()` en cada función pública. Los estados que cuentan como venta siguen siendo `paid`, `preparing`, `shipped` y `delivered`, con `paid_at` como fecha contable.
- Decisiones de negocio: "pedidos por atender" son los ya pagados que esperan transición del admin (`paid`, `preparing`, `shipped`), no los `pending_payment` que esperan al cliente. La variación mensual compara el mes en curso contra igual cantidad de días del mes anterior; sin ventas previas muestra "Sin base de comparación" en vez de infinito. El margen por producto/categoría usa costos snapshot y marca "Margen incompleto" cuando algún ítem no tiene costo cargado.
- Se agregaron utilidades puras de período en `src/lib/analytics/periods.ts`, validación Zod de `searchParams` en `src/lib/validators/analytics.ts` y componentes Recharts en `src/components/admin/analytics`. Se conectó el enlace "Estadísticas" del sidebar. No se agregaron dependencias: Recharts 3.11.0 ya estaba instalado.
- Actualización de la documentación: se marcaron los tres casilleros verificados de Fase 8 en `AGENTS.md`.

**Qué falta**

- Los hallazgos automáticos, mapa de calor, embudo y abandono de carrito siguen en Fase 9 (no se tocaron).
- Con datos reales conviene revisar los índices de `orders(status, paid_at)` y `order_items(variant_id)` si crece el volumen; con 180 pedidos demo no hace falta.
- `next start` sigue emitiendo el aviso preexistente de Next.js sobre `crypto.getRandomValues()` al prerenderizar rutas admin (también aparece en `/admin/contabilidad`, que no se modificó). No rompe el render: las rutas responden 200 y muestran los datos.

**Verificación**

- Documentación actual verificada vía Context7: agregados y expresiones `sql` de Drizzle, componentes de Recharts 3 y `searchParams`/`connection()` de Next.js 16.
- `npm run typecheck`, `npm run lint` y `npm run build`: pasan sin errores. El build reporta `/admin` y `/admin/estadisticas` como Partial Prerender.
- Fix verificado en HTTP: la expresión de agrupación de fechas usa un único objeto `SQL` reutilizado en `SELECT` y `GROUP BY`, porque Drizzle bindea cada plantilla por separado y Postgres rechazaba la consulta con $1 y $8 distintos. Sin ese fix las rutas respondían 200 pero el contenido streams fallaba y faltaban las secciones del dashboard.
- Smoke de base de datos (solo lectura): 180 pedidos, 158 con estados de ingreso y 22 excluidos (`cancelled`/`pending_payment`), 9.631.300 centavos de ingresos, 49 pedidos pagados en los últimos 30 días por 2.708.600 centavos, 0 ítems vendidos sin costo. Las unidades por categoría, los métodos de pago y los segmentos de clientes cuadran con los totales del período.
- Smoke HTTP en servidor de producción: `/admin`, `/admin/estadisticas` y sus variantes `period=week&granularity=week` y `period=day&granularity=month` responden 200 con sesión admin, muestran importes ARS y las secciones esperadas; sin sesión redirigen 307 a `/login?next=…`. Se verificó además `/admin/contabilidad` como control del aviso de prerender preexistente. Servidor detenido al finalizar.
- `git status`: solo código del dashboard/estadísticas, `PROGRESS.md` y `AGENTS.md`. No se crearon credenciales, no se mutó la base, no se llamó a MercadoPago y no se hicieron commits.

## 2026-11-20 — Fix (Fase 5): detección de entorno de MercadoPago

**Qué se hizo**

- Se corrigió la elección de la URL de Checkout Pro en `src/lib/mercadopago.ts`: ahora se usa `preference.sandbox_init_point ?? preference.init_point`, sin mirar el prefijo del access token. MercadoPago devuelve `sandbox_init_point` solo con credenciales en modo Test, así que la misma regla funciona con tokens legacy `TEST-` y con los modernos `APP_USR-`.
- `isSandboxAccessToken` queda como heurística de mejor esfuerzo: reconoce ambos prefijos y su comentario aclara que el prefijo NO distingue Test de Producción con credenciales modernas. Se quitó el campo `sandbox` de la configuración porque no tenía ningún otro uso y era una trampa para lectores futuros.

**Por qué**

- Los access tokens de prueba actuales empiezan con `APP_USR-`, igual que los de producción. Con la lógica anterior (`TEST-` ⇒ sandbox) esas credenciales elegían `init_point` y mandaban al usuario al sitio de producción. Se confirmó con el SDK v3: una preferencia creada con el token de prueba devolvió `init_point` y `sandbox_init_point`.

**Verificación**

- Script inline de Node (sin red ni credenciales): la heurística acepta `TEST-` y `APP_USR-`, rechaza prefijos ajenos; la selección elige `sandbox_init_point` cuando está presente, `init_point` como fallback y falla si no hay ninguno.
- `npm run typecheck`, `npm run lint` y `npm run build`: pasan sin errores.
- `git diff --check`: limpio; el diff del fix es de 16 altas y 9 bajas en un solo archivo.

### Corrección del fix anterior (misma fecha)

La nota de arriba quedó **sin efecto**: `sandbox_init_point` NO es señal de credenciales de Test. MP devuelve `init_point` **y** `sandbox_init_point` con el mismo par de credenciales. Tampoco sirve el prefijo: la documentación oficial de credenciales de prueba dice textual que «El prefijo del *Access Token* de prueba puede variar dependiendo de la solución que estés integrando». Las credenciales provistas por el usuario son **de Test** y esa es la fuente autoritativa para este proyecto.

Queda documentado como observación sin resolver: un card token creado con el access token informó `live_mode: true` y `POST /v1/payments` con la tarjeta `APRO` respondió 401 `Unauthorized use of live credentials` incluso con el SDK oficial y con `x-test-scope: sandbox`. No se determinó la causa; no se reclamó que fueran credenciales de producción.

Estado final: `src/lib/mercadopago.ts` elige la URL según `MP_ENVIRONMENT`, con **default `test`** (⇒ `sandbox_init_point`) y `production` como opt-in explícito (⇒ `init_point`). Se quitó `isSandboxAccessToken` porque ningún prefijo permite distinguir el entorno de forma confiable. Documentado en `.env.example` y `README.md`. La prueba real de pago con tarjeta de test sigue pendiente: el bloqueo está en la creación del pago vía API, no en la elección de la URL de checkout.

## 2026-11-20 — Fase 9: estudio de mercado (completa)

**Qué se hizo**

- Se agregó `/admin/mercado` con KPIs, hallazgos, compras por provincia y ciudad (tabla + gráfico de barras), día de la semana y franja horaria (barras + mapa de calor de 7 × 6), embudo de conversión, abandono de carrito, visitados vs. comprados y recompra/valor por cliente. Incluye `loading.tsx`; los errores los cubre el boundary existente de `/admin`.
- Nuevas consultas puras en `src/server/analytics/market.ts`: reciben rangos o fechas explícitas, no leen sesión/cookies/headers y devuelven datos serializables. Reutilizan `INCOME_STATUSES` y `dayBoundary`; agrupan fechas con `AT TIME ZONE 'America/Argentina/Buenos_Aires'`. Todo porcentaje con denominador cero devuelve `null` y se muestra como "—".
- Reglas deterministas en `src/server/analytics/market-findings.ts`: provincia dominante, retiro, día/franja pico, producto con visitas y baja conversión, carritos abandonados y recompra. Con datos escasos dicen explícitamente que no alcanzan, en vez de inventar conclusiones.
- El abandono de carrito se define como carrito con ítems sin actividad en 24 h y sin pedido posterior; el valor es una estimación con precios vigentes, marcada como tal. Los carritos demo no se descartan: se muestran con la etiqueta "(demo)" para no ocultar filas legítimas.
- Se conectó el enlace "Mercado" del sidebar y se marcaron los cuatro casilleros de Fase 9 en `AGENTS.md`. No se agregaron dependencias ni se tocó el esquema.

**Qué falta**

- Con datos reales conviene revisar los índices de `orders(status, paid_at)`, `product_views(created_at)` y `cart_items(cart_id)` si crece el volumen.
- Los carritos de invitado no se pueden vincular a un pedido con el esquema actual: siempre cuentan como abandonados si quedan con ítems. Para distinguirlos haría falta una columna `cart_id` en `orders` (migración futura).
- Clientes y configuración del admin siguen en Fase 10; no se agregaron acá.

**Verificación**

- `npm run typecheck`: pasa sin errores.
- `npm run lint`: pasa sin errores ni warnings (se quitó un import de tipo sin usar detectado en el primer pasaje).
- `npm run build`: pasa sin errores; `/admin/mercado` figura como Partial Prerender.
- `git diff --check`: limpio (exit 0; solo avisos de conversión LF → CRLF por la config de Git en el working copy).
- Smoke de base de datos (solo lectura, funciones reales ejecutadas con `tsx` sobre el rango acotado 2026-08-01 a 2026-11-20): 20 provincias, 20 ciudades, 28 pedidos de retiro, 7 días con ventas, 5 franjas con ventas, 42 celdas de calor, 98 visitas, 0 carritos con ítems, 180 pedidos creados, 158 pagados, 0 carritos abandonados, 8 productos en el ranking, 20 clientes (20 recurrentes) y 7 hallazgos. Chequeo recursivo: ningún `NaN`/`Infinity`.
- Smoke HTTP en servidor de producción: `/admin/mercado` y `?period=week` redirigen 307 a `/login?next=…` sin sesión; con JWT admin sintético responden 200 y contienen todas las secciones (hallazgos, provincias, embudo, abandono, mapa de calor, recompra), sin caer en el boundary de error. Servidor detenido y puerto libre.
- `git status --short`: solo código de Fase 9, el enlace del sidebar, `PROGRESS.md` y `AGENTS.md`. No se crearon credenciales, no se mutó la base, no se llamó a MercadoPago, no se tocó código `TEST-` ni se hicieron commits.

## 2026-11-20 — Fase 10: cierre funcional (clientes, configuración y documentación)

**Qué se hizo**

- `/admin/clientes`: listado paginado con búsqueda por nombre o email (Zod en `src/lib/validators/customers.ts`), cantidad de pedidos y total gastado calculados solo con estados de ingreso (`paid`, `preparing`, `shipped`, `delivered`), etiqueta Demo y enlace al detalle. El detalle muestra datos de contacto, direcciones guardadas e historial de pedidos con estado y enlace a `/admin/pedidos/[id]`. Incluye `loading.tsx` y `Suspense`.
- `src/db/queries/customers.ts`: `listAdminCustomers` y `getAdminCustomerDetail` llaman a `requireAdmin()` como primera instrucción. La agregación se hace en una subconsulta con LEFT JOIN para no multiplicar filas; se seleccionan columnas explícitas, así que nunca se expone `passwordHash`. No se creó `src/server/admin/customers.ts` porque no hacía falta lógica adicional.
- `/admin/configuracion`: `storeSettingsFormSchema` valida importes en centavos como strings enteros no negativos (umbral vacío = `null`), emails opcionales y booleanos; `updateStoreSettings` vuelve a exigir admin y actualiza la fila única (la crea si todavía no se sembró); `updateStoreSettingsAction` reporta errores por campo y revalida `/admin/configuracion`, `/`, `/catalogo`, `/checkout` y `/carrito`. El formulario cliente usa `useActionState` con `Input`/`Label`/`Button` y el patrón hidden input + checkbox para los booleanos. Incluye `loading.tsx`.
- Se conectaron las entradas "Clientes" y "Configuración" del sidebar; no se tocó ningún otro ítem.
- `README.md`: se sacó el texto de Fase 0/placeholders y quedó documentado el ciclo completo (instalación, todas las variables incluido `MP_ENVIRONMENT`, administrador, semillas, prueba de Checkout Pro con credenciales de Test y tarjetas de prueba del panel, túnel para el webhook, idempotencia, reintento de pago y runbook de Railway). No se escribió ninguna credencial ni número de tarjeta.

**Qué falta**

- Deploy en Railway: no se ejecutó (no hay CLI/cuenta en este entorno).
- Prueba en producción/registro, Google, carrito → pago sandbox real → webhook → administrador ve el pedido: pendiente; la firma local se probó en Fase 5, pero no el flujo completo con pagos reales.
- Revisión responsive en celular de todo el flujo cliente: pendiente.
- Limitación conocida: el menú del navbar en celular solo enlaza Inicio y Catálogo, y las rutas `/nosotros` y `/cuenta/perfil` no existen (verificado en `src/components/store/store-navbar.tsx` y en el árbol de `src/app`). No se agregaron en esta tarea para no salir del alcance.

**Verificación**

- `npm run typecheck`: pasa sin errores.
- `npm run lint`: pasa sin errores ni warnings.
- `npm run build`: pasa sin errores; `/admin/clientes`, `/admin/clientes/[id]` y `/admin/configuracion` figuran como Partial Prerender.
- `git diff --check`: limpio (exit 0; solo los avisos de conversión LF → CRLF por la config de Git en el working copy).
- Smoke de base de datos (solo lectura, ejecutado con `tsx` sobre el mismo armado de consulta): 20 clientes con coincidencia "a", primer registro con 14 pedidos de ingreso y 758900 centavos, y detalle con direcciones y pedidos coherentes. No se ejecutó `updateStoreSettings` contra la base para no mutar datos.
- Smoke HTTP con `next start`: las tres rutas nuevas sirven el shell sin errores; el proxy redirige a `/login` cuando la sesión no es válida. No se logró una cookie admin sintética aceptada por Auth.js, así que el render autenticado no se verificó por HTTP en esta sesión; no se generaron credenciales ni se hizo deploy.
- No se agregaron dependencias, no se tocó el esquema ni se crearon migraciones, no se mutó la base y no se hicieron commits.

## 2026-11-20 — Fase 10: rutas públicas y revisión responsive

**Qué se hizo**

- Se agregaron `/nosotros` y `/cuenta/perfil` bajo `src/app/(store)/` para que hereden el layout del storefront (las URLs finales son `/nosotros` y `/cuenta/perfil`). `/nosotros` lee `getStoreSettings` y solo muestra los datos de contacto que existen; `/cuenta/perfil` exige sesión y muestra nombre, email y teléfono leídos de la base.
- `updateProfileAction` vuelve a verificar la sesión con `requireUser()`, valida con Zod y actualiza únicamente `name` y `phone` del propio usuario. Nunca toca `role`, `email`, `passwordHash` ni `isDemo`. Revalida `/cuenta/perfil` y `/admin/clientes`.
- El menú del navbar en celular ahora incluye las siete rutas existentes: Inicio, Catálogo, Nosotros, Carrito, Mis pedidos, Mis direcciones y Mi perfil. El footer sumó "Sobre nosotros".
- El catálogo pasa a una columna por debajo de 380 px y mantiene 2/3/4 columnas en los breakpoints siguientes.

**Verificación**

- `npm run typecheck`, `npm run lint`, `npm run build` y `git diff --check`: pasan. El build figura con 35 rutas, incluidas `/nosotros` y `/cuenta/perfil`.
- Revisión mobile: sin desbordamiento horizontal a 360 px en `/nosotros`, `/catalogo` y `/carrito` (con un ítem real en el carrito). `/checkout` autenticado queda cubierto solo por revisión estática; sin sesión redirige y no desborda.
- No se agregaron dependencias, no se tocó el esquema ni se hicieron migraciones, no se mutó la base y no se hizo deploy.

**Qué falta**

- Deploy en Railway y smoke en producción siguen pendientes. El repo local tiene 15 commits sin pushear y no hay CLI de Railway en este entorno; se decidió no pushear ni desplegar.

## 2026-11-20 — Autenticación: se quita Google y se endurece el rol

**Qué se hizo**

- Se eliminó el inicio de sesión con Google de punta a punta: provider en `src/auth.config.ts`, `googleSignInAction` en `src/server/auth/actions.ts`, botón/divider en `src/components/auth/login-form.tsx`, handler de fusión de carrito en `src/auth.ts`, variables en `.env.example` y referencias en `README.md` y `AGENTS.md`. Motivo: `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` están vacíos y el usuario decidió prescindir del proveedor en vez de configurarlo. Quedan sin efecto los pendientes de Fases 1/2 relativos a Google.
- La tabla `accounts` y el adaptador Drizzle se mantienen (no generan migración). La fusión del carrito de invitado al loguearse sigue funcionando en el login con Credentials (`src/server/auth/actions.ts:59`).
- `src/auth.ts`: el callback `jwt` delega en la config edge-safe y vuelve a leer `users.role` por `token.sub` en cada refresco; si cambió, actualiza `token.role`. La lectura está en `try/catch` con fallback al rol previo, así que un problema de base no rompe la autenticación. No se importó el cliente de base en `auth.config.ts` ni en `proxy.ts`.
- `src/db/queries/catalog.ts`: `await requireAdmin()` como primera instrucción de `getAdminProductById` y `getVariantStockHistory`, que solo apoyaban en el rol verificado por sus callers.

**Verificación**

- `npm run typecheck`, `npm run lint`, `npm run build` y `git diff --check`: pasan; `/api/auth/providers` anuncia únicamente `credentials`.
- Smoke HTTP real con sesión: admin (`role=admin`) → login 302 a `/admin`, `/api/auth/session` devuelve `role=admin`, `GET /admin` → 200. Usuario temporal `role=customer` creado solo para la prueba → `GET /admin` → 307 a `/403`; el usuario se borró al finalizar. No se usaron credenciales reales nuevas ni se tocó `.env.local`.
