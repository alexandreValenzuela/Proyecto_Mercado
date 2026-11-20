# AGENTS.md — Nudo (Grupo 10)

> Este archivo es la fuente de verdad del proyecto. Leelo completo al iniciar cada sesión.
> Si algo no está definido acá, preguntá al usuario en vez de inventar.

---

## 0. Cómo tenés que trabajar (reglas para el agente)

1. **Plan primero, código después.** Al iniciar, leé este archivo, revisá `PROGRESS.md` (créalo en la fase 0 si no existe) y anunciá qué tarea vas a hacer.
2. **Cortes verticales chicos.** Cada tarea termina con algo que funciona de punta a punta (DB → API → UI), no capas a medias.
3. **Verificá siempre.** Después de cada tarea corré `npm run typecheck`, `npm run lint` y `npm run build`. No marques una tarea como hecha si alguno falla.
4. **Marcá el progreso.** Al terminar, tildá la tarea en la sección 12 de este archivo y agregá una línea en `PROGRESS.md` (fecha, qué se hizo, qué falta).
5. **Un commit por tarea** con mensaje convencional (`feat:`, `fix:`, `chore:`, `docs:`). Nunca commitees secretos ni `.env`.
6. **Cambios de esquema de base de datos:** siempre mediante migraciones (nunca editar la base a mano). Si una migración es destructiva (borra columnas o datos), pedí confirmación al usuario antes.
7. **No salgas del alcance.** No refactorices ni agregues librerías fuera de las listadas sin avisar. Si necesitás una dependencia nueva, justificá en una línea.
8. **Si te trabás más de dos intentos** con el mismo error, detenete, resumí el problema y proponé alternativas al usuario.
9. **Idioma:** interfaz y textos para el usuario en **español rioplatense** (voseo cuando sea natural: "Agregá al carrito"). Identificadores de código, tablas y columnas en **inglés**.
10. Si tu herramienta soporta subagentes, dividí por área: `database`, `backend`, `storefront` (UI cliente), `admin` (UI admin + analytics) y `qa`. Cada uno toca solo su carpeta (ver sección 4).

### Preguntas bloqueantes (hacelas al usuario en una sola tanda al comenzar)

- URL de la base de datos de Neon (pooled y unpooled/direct) — o confirmar que el usuario las pondrá en `.env`.
- Credenciales de Google OAuth (Client ID y Secret) o confirmar que se configuran después.
- Cuenta de Cloudinary (cloud name, API key, API secret) o confirmar que se configuran después.
- **MercadoPago** — antes de implementar, pedir:
  1. Access Token de **prueba** (sandbox) y de producción; Public Key solo si se usa Bricks.
  2. Tipo de integración que ya usó en su otro proyecto (por defecto: **Checkout Pro** con redirección). Pedirle que pegue ese código de referencia para reutilizarlo.
  3. Usuarios de prueba (comprador y vendedor) creados en el panel de desarrolladores de MP.
  4. URL pública para webhooks: la de Railway una vez desplegado, o un túnel (ngrok/cloudflared) en desarrollo local.
  5. Secreto de firma del webhook (para validar `x-signature`).
- Email y contraseña inicial del primer administrador (`ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD`).
- Nombre del repositorio de GitHub y rama principal.

---

## 1. Objetivo del proyecto

Plataforma **web (responsive, funciona bien en celular y escritorio)** de e-commerce para un emprendimiento (en colaboración con GAO) que además sirva para **gestionar la parte contable y analizar el mercado**.

- **Cliente:** navega el catálogo, arma el carrito, se registra/loguea, paga con MercadoPago, sigue sus pedidos.
- **Administrador (único vendedor):** gestiona productos, stock, pedidos, egresos y ve estadísticas, balance y estudio de mercado.

Es un **proyecto escolar** de la materia de Gestión y Administración de Empresas: el valor está en que las herramientas contables y de análisis estén bien pensadas y usen datos reales de las compras.

### Restricciones
- **Entrega: 20/11/2026.** Base de datos, backend y frontend deben estar terminados y desplegados. Priorizar según la sección 12.
- Un solo vendedor. **Todavía no hay productos reales**: se necesita un seed de datos demo (sección 11).
- Solo español, solo pesos argentinos (ARS), público local.

### Fuera de alcance (no implementar)
- Facturación electrónica / AFIP.
- Cupones y descuentos.
- Exportación de reportes (Excel/PDF).
- Comisiones de venta: **no se calculan ahora**, pero el esquema deja los campos preparados (sección 5).
- Gestión real de logística de envíos (solo la opción, ver sección 7).
- Múltiples vendedores/proveedores.

---

## 2. Stack técnico (decidido)

| Capa | Tecnología |
|---|---|
| Framework | **Next.js** (App Router) + **TypeScript** |
| UI | **Tailwind CSS** + **shadcn/ui** + `lucide-react` |
| Base de datos | **PostgreSQL en Neon** (serverless) |
| ORM / migraciones | **Drizzle ORM** + `drizzle-kit` |
| Auth | **Auth.js** (`next-auth` v5): Credentials (email + contraseña) + Google, sesión JWT, adaptador Drizzle |
| Hash de contraseñas | `bcryptjs` |
| Validación | **Zod** (en cliente y en servidor) |
| Formularios | `react-hook-form` + `@hookform/resolvers` |
| Pagos | SDK oficial `mercadopago` (Checkout Pro) |
| Gráficos | **Recharts** |
| Imágenes | **Cloudinary** (subida firmada desde el admin) |
| Deploy | **Railway** (servicio Next.js) + Neon (DB externa) |
| Calidad | ESLint, Prettier, `tsc --noEmit` |

Usá las versiones estables más recientes y **verificá la documentación actual** de Next.js, Auth.js y MercadoPago antes de implementar: sus APIs cambian seguido.

Scripts requeridos en `package.json`: `dev`, `build`, `start`, `lint`, `typecheck`, `db:generate`, `db:migrate`, `db:studio`, `db:seed:demo`, `db:clean-demo`, `db:create-admin`.

---

## 3. Diseño visual

**Estilo:** claro, cálido y amigable (no oscuro). Bordes redondeados (12–16 px), mucho aire, sombras muy suaves, ilustraciones/íconos simples. Mobile-first.

**Nombre de la marca: `Nudo`** (definido por el usuario). Definido en **una única constante** (`src/config/site.ts`) para cambiarlo en un solo lugar. El logo es un texto estilizado por ahora.

### Paleta por defecto: "Arcilla y salvia"
Definila como variables CSS / tokens de Tailwind para poder cambiar de paleta tocando un solo archivo.

| Token | Hex | Uso |
|---|---|---|
| `background` | `#FBF7F2` | Fondo general (crema) |
| `surface` | `#FFFFFF` | Tarjetas, formularios |
| `surface-muted` | `#F1E9DE` | Secciones alternas, chips |
| `primary` | `#4F7A5A` | Botones principales, links (texto blanco encima) |
| `primary-soft` | `#DCE8DD` | Fondos suaves, badges |
| `accent` | `#E39A78` | Destacados, ofertas, CTAs secundarios (texto oscuro encima) |
| `text` | `#2B2A28` | Texto principal |
| `text-muted` | `#6F6A63` | Texto secundario |
| `border` | `#E6DDD0` | Bordes |
| `success` / `warning` / `danger` | `#4F7A5A` / `#C58A2B` / `#C0504D` | Estados |

Alternativas listas para intercambiar si el equipo prefiere otra identidad:
- **"Cielo y durazno":** fondo `#F7FAFD`, primary `#3E6FA3`, accent `#F4B393`.
- **"Lavanda y menta":** fondo `#FAF8FD`, primary `#6B5FA8`, accent `#8CCFB8`.

Verificá contraste mínimo AA (4.5:1) en texto sobre botones y fondos.

**Tipografía:** títulos `Nunito` (amigable), cuerpo `Inter`, vía `next/font`.

**Panel admin:** misma identidad pero más denso y sobrio: sidebar con color `primary` oscurecido, tablas claras, tarjetas de KPIs.

**Formato regional:** moneda con `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`; fechas `dd/MM/yyyy`; zona horaria `America/Argentina/Buenos_Aires` para todo agrupamiento por día/semana/mes.

---

## 4. Estructura del repositorio

```
/
├─ AGENTS.md
├─ PROGRESS.md
├─ .env.example
├─ drizzle/                  # migraciones generadas
├─ scripts/                  # seed demo, crear admin, limpiar demo
└─ src/
   ├─ app/
   │  ├─ (store)/            # sitio público y cuenta del cliente
   │  ├─ (auth)/             # login, registro
   │  ├─ admin/              # panel administrador
   │  └─ api/                # route handlers (webhooks, uploads)
   ├─ config/site.ts         # nombre de marca, constantes
   ├─ db/                    # schema.ts, client.ts, queries/
   ├─ lib/                   # auth, mercadopago, cloudinary, money, dates, validators
   ├─ components/
   │  ├─ ui/                 # shadcn
   │  ├─ store/
   │  └─ admin/
   └─ server/                # server actions y servicios de dominio (orders, stock, analytics, accounting)
```

Reglas:
- La lógica de negocio vive en `src/server/*`; las páginas y componentes solo la llaman.
- Todo acceso a datos pasa por `src/db/queries` o `src/server`. Nada de SQL suelto en componentes.
- Repo único en GitHub. Ramas: `main` (estable, deployable) y `feat/<area>-<tema>`. PRs chicos, revisados por otro integrante.
- Reparto sugerido para evitar conflictos (ajustar nombres): Integrante A → DB + backend/pagos; Integrante B → storefront; Integrante C → admin + analytics.

---

## 5. Modelo de datos (PostgreSQL / Drizzle)

Convenciones: `id` uuid (default `gen_random_uuid()`), `created_at` y `updated_at` timestamptz, **dinero en centavos como `integer`** (columnas `*_cents`), tablas en `snake_case` inglés, enums de Postgres para estados. Todas las relaciones con claves foráneas e índices en columnas de filtro (`status`, `created_at`, `category_id`, `variant_id`).

> El esquema completo debe existir desde la primera migración para no migrar después. Incluye campos preparados para el futuro (comisión) que hoy quedan en `null`.

### Autenticación
- `users`: `id`, `name`, `email` (unique), `email_verified`, `image`, `password_hash` (null si entró solo con Google), `role` enum (`customer` | `admin`, default `customer`), `phone`, `is_demo` bool.
- `accounts` (requerida por el adaptador de Auth.js: proveedor Google).
- *(Sesión JWT, no hace falta tabla `sessions`; agregarla solo si el adaptador la exige.)*

### Catálogo
- `categories`: `id`, `name`, `slug` (unique), `parent_id` (null), `position`, `active`.
- `products`: `id`, `name`, `slug` (unique), `description`, `category_id`, `base_price_cents`, `cost_cents` (costo unitario para calcular margen, null permitido), `active`, `is_demo`.
- `product_variants`: `id`, `product_id`, `sku` (unique), `label` (ej: "Talle M / Azul"), `attributes` jsonb, `price_cents` (null = usa `base_price_cents`), `cost_cents` (null = usa el del producto), `stock` integer ≥ 0, `low_stock_threshold` integer (default 3), `active`. **Todo producto tiene al menos una variante** (variante "Única" si no hay opciones).
- `product_images`: `id`, `product_id`, `url`, `public_id` (Cloudinary), `position`.

### Carrito
- `carts`: `id`, `user_id` (null), `session_token` (null, para invitados), `updated_at`. Restricción: al menos uno de `user_id` o `session_token`.
- `cart_items`: `id`, `cart_id`, `variant_id`, `quantity` (≥ 1). Único `(cart_id, variant_id)`.

### Clientes y direcciones
- `addresses`: `id`, `user_id`, `recipient_name`, `phone`, `street`, `number`, `floor_apt`, `city`, `province` (de la lista de provincias argentinas), `postal_code`, `notes`, `is_default`.

### Pedidos
- `orders`: `id`, `number` (serial legible, ej. #0041), `user_id`, `status` enum, `subtotal_cents`, `shipping_cost_cents`, `total_cents`, `shipping_method` enum (`delivery` | `pickup`), `shipping_address` jsonb (copia congelada con `province` y `city`, necesarias para el estudio de mercado), `payment_method` (texto devuelto por MP: tarjeta, dinero en cuenta, etc.), `mp_preference_id`, `mp_payment_id`, `mp_status`, `paid_at`, `cancelled_at`, **`commission_rate_bps` (null)**, **`commission_cents` (null)**, `is_demo`.
- `order_items`: `id`, `order_id`, `variant_id`, **snapshots:** `product_name`, `variant_label`, `unit_price_cents`, `unit_cost_cents`, `quantity`.
- Estados de `orders.status`: `pending_payment` → `paid` → `preparing` → `shipped` → `delivered`; además `cancelled`. Etiquetas UI en español: Pendiente de pago, Pagado, En preparación, Enviado, Entregado, Cancelado.
- `order_status_history`: `id`, `order_id`, `from_status`, `to_status`, `changed_by` (user_id null si fue el sistema), `created_at`.
- `payment_events`: `id`, `provider` ('mercadopago'), `external_id`, `payload` jsonb, `received_at`, `processed_at`. Único `(provider, external_id, action)` para **idempotencia** del webhook.

### Inventario
- `stock_movements`: `id`, `variant_id`, `delta` (+/-), `reason` enum (`sale` | `restock` | `adjustment` | `cancellation`), `order_id` (null), `note`, `created_by`, `created_at`. **Todo cambio de stock genera un movimiento** y actualiza `product_variants.stock` en la misma transacción.

### Contabilidad
- `expense_categories`: `id`, `name` (unique), `color` (opcional), `active`. El admin puede crear/editar/desactivar categorías. Seed inicial sugerido: Mercadería, Envíos, Publicidad, Servicios, Impuestos, Otros.
- `expenses`: `id`, `category_id`, `description`, `amount_cents`, `expense_date` (date), `notes`, `created_by`, `is_demo`.
- **Ingresos:** no se cargan a mano; se derivan de pedidos con estado `paid`, `preparing`, `shipped` o `delivered` (usar `paid_at` como fecha contable).

### Analítica de comportamiento
- `product_views`: `id`, `product_id`, `user_id` (null), `session_token`, `created_at`. Se registra al abrir el detalle de un producto (máx. 1 por sesión/producto/hora para no inflar).

### Configuración
- `store_settings` (una sola fila): `store_name`, `shipping_flat_cents`, `free_shipping_threshold_cents` (null), `pickup_enabled`, `delivery_enabled`, `pickup_instructions`, `contact_email`, `contact_whatsapp`.

---

## 6. Roles y permisos

| Recurso | Invitado | Cliente | Admin |
|---|---|---|---|
| Ver catálogo y producto | Sí | Sí | Sí |
| Carrito | Sí (por cookie) | Sí | Sí |
| Checkout / pagar | No (redirige a login) | Sí | Sí |
| Mis pedidos, direcciones, perfil | No | Solo los propios | Los propios |
| `/admin/*` | No | **403** | Sí |

Reglas de seguridad obligatorias:
- Proteger `/admin/*` con `middleware` **y además** verificar `role === 'admin'` en **cada** server action, route handler y query del admin. El middleware solo no alcanza.
- Un cliente solo puede leer/modificar sus propios pedidos, direcciones y carrito (filtrar siempre por `session.user.id`).
- **Nunca confiar en precios, totales o stock enviados desde el cliente.** Recalcular todo en el servidor desde la base de datos.
- Validar toda entrada con Zod en el servidor.
- Limitar intentos de login (rate limit simple por IP + email).
- El primer admin se crea con `npm run db:create-admin` usando `ADMIN_EMAIL` y `ADMIN_INITIAL_PASSWORD`. No existe registro público de admins.

---

## 7. Funcionalidades del cliente (storefront)

### Rutas
`/` inicio · `/catalogo` · `/producto/[slug]` · `/carrito` · `/checkout` · `/checkout/resultado` · `/login` · `/registro` · `/cuenta/pedidos` · `/cuenta/pedidos/[id]` · `/cuenta/direcciones` · `/cuenta/perfil` · `/nosotros` · páginas `404`, `403`.

### Comportamiento
- **Inicio:** hero, productos destacados/más vendidos (calculados), categorías, banner de medios de pago, footer con contacto.
- **Catálogo:** búsqueda por texto, filtro por categoría, rango de precio, orden (precio, novedades, más vendidos), paginación. Mostrar "Sin stock" y estado "Pocas unidades" cuando corresponda. Estado vacío amigable.
- **Detalle de producto:** galería, descripción, selector de variante, precio, stock, cantidad, botón "Agregar al carrito". Registra `product_views`.
- **Carrito (invitado o logueado):**
  - Invitado: carrito en BD identificado por cookie `cart_token` (httpOnly, 30 días).
  - **Al registrarse o loguearse se fusiona el carrito de invitado con el del usuario** (sumar cantidades por variante, respetando stock) y se limpia la cookie. **No debe perderse nada.**
  - Editar cantidades, eliminar ítems, ver subtotal. Si cambió el precio o falta stock, avisar en el carrito.
- **Checkout (requiere sesión):** si no hay sesión, redirigir a `/login?next=/checkout` y volver al checkout con el carrito intacto. Pasos: 1) elegir entrega (**Envío a domicilio** o **Retiro**), 2) dirección (elegir guardada o cargar nueva; no se pide si es retiro), 3) resumen y botón "Pagar con MercadoPago".
- **Envío:** la opción existe y se calcula con `shipping_flat_cents` de `store_settings` (con umbral opcional de envío gratis). La logística real se resuelve fuera del sistema; el admin solo cambia el estado del pedido.
- **Resultado del pago (`/checkout/resultado`):** muestra aprobado, pendiente o rechazado según los parámetros de retorno, **pero el estado oficial lo define el webhook**, no la URL.
- **Mis pedidos:** historial, detalle con estado y línea de tiempo, botón "Reintentar pago" si está `pending_payment`.

### Estados de error obligatorios (según el diagrama de flujo aprobado)
- Login/registro con datos inválidos → mensajes claros bajo cada campo, sin recargar la página perdiendo datos.
- Email ya registrado → ofrecer ir a login.
- Producto sin stock al agregar o al pagar → aviso y ajuste de cantidad, sin romper el carrito.
- Pago rechazado o cancelado → pantalla amable con "Reintentar pago" (genera nueva preferencia sobre el mismo pedido) y "Volver al carrito".
- Error inesperado → página de error con acción de reintento; nunca pantalla en blanco.

---

## 8. Pagos con MercadoPago (Checkout Pro)

Flujo:
1. `POST` server action `createCheckout`: valida sesión, carrito, stock, recalcula totales, crea `orders` (`pending_payment`) + `order_items` con snapshots.
2. Crear la **preferencia** con items (precios desde la BD en pesos = centavos / 100), `external_reference = order.id`, `back_urls` (success/failure/pending → `/checkout/resultado?order=<id>`), `auto_return: 'approved'`, `notification_url = ${APP_URL}/api/webhooks/mercadopago`. Guardar `mp_preference_id`.
3. Redirigir al `init_point` (o `sandbox_init_point` en pruebas).
4. **Webhook** `/api/webhooks/mercadopago`:
   - Validar la firma `x-signature` con `MP_WEBHOOK_SECRET`.
   - **No confiar en el cuerpo:** con el `id` del pago, consultar el pago a la API de MP.
   - Registrar en `payment_events` (idempotente: si ya se procesó, responder 200 sin repetir).
   - Si `approved`: en **una transacción** → pedido a `paid`, setear `paid_at`, `mp_payment_id`, `payment_method`, descontar stock (generar `stock_movements` tipo `sale`), vaciar el carrito, registrar `order_status_history`.
   - Si falta stock al aprobar: dejar el pedido en `paid`, marcarlo para revisión manual en el admin (campo o nota) y **nunca** dejar stock negativo.
   - `rejected`/`cancelled`/`expired`: mantener `pending_payment` (permite reintentar) o pasar a `cancelled` según el caso.
   - Responder siempre 200 rápido si ya se registró el evento.
5. Cancelación de pedidos por el admin: devolver stock (`stock_movements` tipo `cancellation`) si ya se había descontado.

Pruebas: usar credenciales y usuarios de **sandbox**. Documentar en el README cómo probar el flujo completo y cómo exponer el webhook en local.

---

## 9. Panel de administración

Layout: sidebar fija (Dashboard, Productos, Categorías, Pedidos, Contabilidad, Estadísticas, Mercado, Clientes, Configuración), topbar con usuario y cerrar sesión.

### Dashboard (`/admin`)
KPIs: ventas de hoy, ventas del mes (con variación vs. mes anterior), pedidos pendientes de acción, productos con stock bajo, ticket promedio del mes. Gráfico de ventas de los últimos 30 días. Últimos pedidos. Alertas de stock crítico.

### Productos y categorías
CRUD completo de productos con variantes (alta, edición, baja lógica `active=false`), carga de imágenes (Cloudinary), ajuste de stock con motivo (genera `stock_movements`), historial de movimientos por variante, CRUD de categorías.

### Pedidos
Listado con filtros (estado, fecha, texto) y paginación; detalle con ítems, cliente, dirección, pago, historial; cambio de estado respetando el flujo válido (no saltos inválidos); cancelar con devolución de stock.

### Contabilidad (`/admin/contabilidad`)
- CRUD de **egresos** con categoría (creable por el admin), fecha, monto y notas.
- CRUD de **categorías de egreso**.
- **Balance por período** (día / semana / mes / año / rango libre): ingresos − egresos = resultado.
- **Costo de ventas** (suma de `unit_cost_cents × quantity` de ítems vendidos) y **margen bruto** (ventas − costo de ventas), absoluto y en %.
- Egresos por categoría (gráfico de torta o barras).
- Tabla de movimientos unificada (ingresos por pedido y egresos) ordenable por fecha.
- Si un producto no tiene costo cargado, mostrar advertencia "margen incompleto" en vez de asumir 0 en silencio.

### Estadísticas (`/admin/estadisticas`)
- Ventas por período (día/semana/mes) con comparativa contra el período anterior.
- Pedidos por estado.
- Ticket promedio y cantidad de pedidos.
- **Top productos** por unidades y por ingresos (y los de menor rotación).
- Stock bajo (variantes con `stock <= low_stock_threshold`).
- Categorías más vendidas y más rentables (por margen).
- Métodos de pago utilizados.
- Clientes nuevos vs. recurrentes.

### Estudio de mercado (`/admin/mercado`)
Orientado a la materia de GAO: entender quién compra, cuánto, de dónde y cuándo.
- **Compras por provincia y por ciudad** (desde `shipping_address` congelada), con cantidad de pedidos, monto y ticket promedio; tabla + gráfico de barras. Retiro en persona se agrupa aparte.
- **Distribución por día de la semana y franja horaria** (mapa de calor o barras) en hora de Argentina.
- **Embudo de conversión:** visitas a productos (`product_views`) → agregados al carrito → pedidos creados → pedidos pagados; con tasa en cada paso.
- **Abandono de carrito:** carritos con ítems sin pedido asociado en más de 24 h; cantidad y valor potencial perdido.
- **Visitados vs. comprados:** productos con muchas visitas y pocas ventas (posible problema de precio o descripción).
- **Frecuencia de recompra** y valor por cliente (cliente nuevo vs. recurrente, compras promedio por cliente).
- Resumen de "hallazgos" generado con reglas simples (ej.: "La provincia X concentra el Y % de las ventas", "El producto Z tiene muchas visitas y baja conversión").

### Clientes (`/admin/clientes`)
Listado con cantidad de pedidos y total gastado; detalle con historial de pedidos.

### Configuración
Datos de la tienda, costo de envío fijo, umbral de envío gratis, habilitar/deshabilitar envío y retiro, instrucciones de retiro, contacto.

**Todas las consultas de analítica** viven en `src/server/analytics` y `src/server/accounting`, son funciones puras con fechas como parámetros, agrupan en zona `America/Argentina/Buenos_Aires` (`AT TIME ZONE`), y excluyen pedidos `cancelled` y `pending_payment` de ventas.

---

## 10. Variables de entorno (`.env.example`)

```
DATABASE_URL=              # Neon, conexión pooled (runtime)
DATABASE_URL_UNPOOLED=     # Neon, conexión directa (migraciones)
APP_URL=http://localhost:3000
AUTH_SECRET=               # openssl rand -base64 32
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
MP_ACCESS_TOKEN=           # sandbox en desarrollo
MP_WEBHOOK_SECRET=
NEXT_PUBLIC_MP_PUBLIC_KEY= # solo si se usa Bricks
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
ADMIN_EMAIL=
ADMIN_INITIAL_PASSWORD=
```

Google OAuth: registrar como URIs de redirección `http://localhost:3000/api/auth/callback/google` y `https://<dominio-railway>/api/auth/callback/google`.

---

## 11. Datos demo

Como todavía no hay productos reales, `npm run db:seed:demo` debe crear (todo con `is_demo = true`):
- 4–5 categorías y 12–20 productos de ejemplo con variantes, precios y costos verosímiles, algunos con stock bajo.
- 15–25 clientes demo con direcciones en **distintas provincias** argentinas.
- 150–300 pedidos distribuidos en los últimos 90 días (variando días, horas, estados, métodos de pago y provincias) con sus ítems y snapshots coherentes.
- 25–40 egresos en varias categorías.

`npm run db:clean-demo` elimina únicamente filas demo (y todo lo que dependa de ellas) sin tocar datos reales. Las imágenes demo pueden ser placeholders.

---

## 12. Plan de trabajo por fases (checklist)

**Prioridad:** P0 = imprescindible para la entrega · P1 = muy importante · P2 = si alcanza el tiempo.
Si el tiempo se acaba, se entrega lo marcado completo y se documenta en `PROGRESS.md` lo pendiente. Dentro de cada fase, hacé primero lo P0.

### Fase 0 — Base del proyecto (P0)
- [x] Crear app Next.js + TypeScript + Tailwind + shadcn/ui, ESLint/Prettier, script `typecheck`
- [x] `.env.example`, `src/config/site.ts`, tokens de la paleta, fuentes
- [x] Conexión Drizzle ↔ Neon, `drizzle.config.ts` usando `DATABASE_URL_UNPOOLED` para migraciones
- [x] `README.md` con instrucciones de instalación y `PROGRESS.md`
- [x] Repo en GitHub y primer commit en `main`

### Fase 1 — Base de datos completa (P0)
- [x] `schema.ts` con **todas** las tablas, enums, relaciones e índices de la sección 5
- [x] Primera migración aplicada en Neon
- [x] Script `db:create-admin`
- [x] Seed de categorías de egreso y `store_settings`
- [x] Seed demo y `db:clean-demo` (sección 11)

### Fase 2 — Autenticación y roles (P0)
- [x] Auth.js con Credentials (registro + login, hash bcrypt) y Google
- [x] Rol en el token/sesión, helpers `requireUser()` y `requireAdmin()`
- [x] Páginas `/login` y `/registro` con validación y errores
- [x] Middleware para `/admin/*` y `/cuenta/*`; páginas 403/404
- [x] Redirección `next` tras login

### Fase 3 — Catálogo y administración de productos (P0)
- [x] Layout del storefront (navbar, footer, responsive) y del admin (sidebar)
- [x] CRUD de categorías y productos con variantes e imágenes (Cloudinary) en admin
- [x] Ajuste de stock con `stock_movements`
- [x] Inicio, catálogo (búsqueda, filtros, orden, paginación) y detalle de producto
- [x] Registro de `product_views`

### Fase 4 — Carrito (P0)
- [x] Carrito de invitado por cookie + carrito de usuario
- [x] Agregar, editar, eliminar, validación de stock y precios
- [x] **Fusión del carrito al loguearse/registrarse**
- [x] Contador en navbar y página `/carrito`

### Fase 5 — Checkout, pagos y pedidos (P0)
- [ ] Preguntas bloqueantes de MercadoPago resueltas (sección 0) — faltan la URL pública del webhook y los usuarios de prueba
- [x] `/checkout`: entrega/retiro, direcciones (CRUD en `/cuenta/direcciones`), resumen
- [x] Creación de pedido + preferencia de MP + redirección
- [x] Webhook con validación de firma, idempotencia, descuento de stock y cambio de estado
- [x] `/checkout/resultado` con los tres casos
- [x] `/cuenta/pedidos` y detalle, con "Reintentar pago"

### Fase 6 — Gestión de pedidos admin (P0)
- [x] Listado con filtros y detalle
- [x] Cambio de estado con flujo válido + historial
- [x] Cancelación con devolución de stock

### Fase 7 — Contabilidad (P1)
- [x] CRUD de categorías de egreso y de egresos
- [x] Balance por período, costo de ventas y margen bruto
- [x] Gráficos y tabla unificada de movimientos

### Fase 8 — Dashboard y estadísticas (P1)
- [x] KPIs y gráfico del dashboard
- [x] Ventas por período con comparativa, top productos, stock bajo, ticket promedio
- [x] Categorías, métodos de pago, clientes nuevos vs. recurrentes

### Fase 9 — Estudio de mercado (P2)
- [ ] Compras por provincia y ciudad
- [ ] Día de la semana / franja horaria
- [ ] Embudo de conversión y abandono de carrito
- [ ] Visitados vs. comprados, recompra y hallazgos automáticos

### Fase 10 — Cierre y despliegue (P0)
- [ ] Clientes y configuración en admin
- [ ] Deploy en Railway (variables de entorno, build, start, migraciones aplicadas)
- [ ] Probar en producción: registro, Google, carrito → pago sandbox → webhook → admin ve el pedido
- [ ] Revisión responsive en celular de todo el flujo cliente
- [ ] Completar `README.md` (instalación, variables, cómo probar MP, cómo crear admin, cómo limpiar demo)

---

## 13. Definición de "terminado" (por módulo)

Un módulo está terminado solo si:
1. Funciona de punta a punta (datos reales de la BD, no mocks).
2. Maneja estados de carga, vacío y error.
3. Valida entradas en el servidor y chequea permisos.
4. Se ve bien en celular y escritorio.
5. `typecheck`, `lint` y `build` pasan.
6. Está tildado acá y registrado en `PROGRESS.md`.

---

## 14. Decisiones pendientes (no bloquean, usar los valores por defecto)

| Tema | Valor por defecto |
|---|---|
| Nombre de marca | `Nudo` (definido por el usuario, constante única) |
| Paleta | "Arcilla y salvia" |
| Comisión de venta | No se calcula; campos `null` |
| Envío | Costo fijo configurable + opción de retiro |
| Dominio propio | Se usa el dominio de Railway |
