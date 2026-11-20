# Informe técnico y de producto — Nudo

**Fecha:** 20/11/2026 · **Commit:** `4eb9611` · **Producción:** `https://proyectomercado-production.up.railway.app`

Nudo es una plataforma de e-commerce argentina con foco contable y de estudio de mercado, creada como proyecto escolar de GAO. Este informe describe qué está construido, cómo está construido y qué falta para cerrar la entrega. Se basa en lectura directa del código, consultas a la base de datos de producción y pruebas HTTP contra el deploy real.

## Resumen ejecutivo

**La aplicación está terminada, desplegada y funcionando.** Hay 35 rutas compiladas, 18 tablas en PostgreSQL, 16 productos con imágenes reales y un panel admin con contabilidad, estadísticas y estudio de mercado. El bloqueo restante no es de código: **falta una prueba de pago sandbox real que demuestre que el webhook de MercadoPago actualiza el pedido**. Sin esa prueba, Fase 5 y Fase 10 siguen abiertas.

| Dimensión | Estado |
|---|---|
| Funcionalidad cliente y admin | Implementada de punta a punta |
| Despliegue en Railway | Realizado y verificado (aunque no está tildado en `AGENTS.md`) |
| Datos demo | 180 pedidos, 20 clientes, 32 egresos |
| Datos reales | 4 pedidos de prueba, todos `pending_payment` |
| Pago sandbox + webhook | **Sin probar** — único bloqueo funcional |
| Pruebas automatizadas / CI | **No existen** |
| Deuda documental | `README.md` y `PROGRESS.md` desactualizados en varios puntos |

---

## Parte 1 — Mirada técnica

### Stack y versiones

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router, Turbopack) | 16.4.6 |
| UI | React + Tailwind CSS + shadcn/ui + lucide-react | 19.3.0 / Tailwind 4 |
| Lenguaje | TypeScript estricto | ^5 |
| Base de datos | PostgreSQL en Neon (driver HTTP + pool WebSocket) | `@neondatabase/serverless` |
| ORM / migraciones | Drizzle ORM + drizzle-kit | ^0.45.4 |
| Auth | Auth.js v5, Credentials, sesión JWT, adaptador Drizzle | `next-auth ^5.0.0-beta.32` |
| Validación y formularios | Zod + react-hook-form + resolvers | ^4.6.7 |
| Pagos | SDK oficial de MercadoPago (Checkout Pro) | ^3.6.2 |
| Gráficos | Recharts | ^3.11.0 |
| Calidad | ESLint 9, Prettier, `tsc --noEmit` | — |

Los 11 scripts requeridos están presentes (`dev`, `build`, `start`, `lint`, `typecheck`, `db:generate`, `db:migrate`, `db:studio`, `db:seed:demo`, `db:clean-demo`, `db:create-admin`), más `format`. **No hay script `test`.**

### Arquitectura y capas

La separación entre capas se respeta en la práctica: los componentes solo importan server actions y queries (20 importaciones verificadas); no hay acceso directo a `getDb` ni al schema desde la UI.

```
src/app/       51 archivos — páginas, layouts, route handlers
src/components/ 39 archivos — ui / store / admin / auth / feedback
src/lib/       35 archivos — auth, money, dates, validators, MP, Cloudinary
src/server/    21 archivos — 8 dominios de lógica de negocio
src/db/         9 archivos — client, transaction, schema, 6 módulos de queries
```

**Total:** 160 archivos TypeScript, ~15.400 líneas. 12 `loading.tsx` con esqueletos, 2 límites de error (root y admin).

Los 21 módulos de servidor se agrupan en: `checkout` (3), `admin` (5), `analytics` (3), `cart` (3), `catalog` (3), `account` (2), `accounting` (1), `auth` (1). Los 5 módulos de admin llaman a `requireAdmin()`.

### Base de datos

`src/db/schema.ts` define **18 tablas**, **4 enums** (`user_role`, `order_status`, `shipping_method`, `stock_movement_reason`), una secuencia para numerar pedidos y 16 declaraciones de relaciones.

| Grupo | Tablas |
|---|---|
| Auth | `users`, `accounts` |
| Catálogo | `categories`, `products`, `product_variants`, `product_images` |
| Carrito | `carts`, `cart_items` |
| Cliente | `addresses` |
| Pedidos | `orders`, `order_items`, `order_status_history`, `payment_events` |
| Inventario | `stock_movements` |
| Contabilidad | `expense_categories`, `expenses` |
| Analítica | `product_views` |
| Configuración | `store_settings` (fila única) |

Convenciones aplicadas: IDs uuid, `timestamptz`, dinero en centavos (`*_cents`), nombres en `snake_case`, claves foráneas e índices en columnas de filtro. Restricciones destacadas: stock y cantidades no negativos, `cart_items(cart_id, variant_id)` único, `payment_events(provider, external_id, action)` único para idempotencia del webhook, campos de comisión nulos preparados para el futuro.

Hay **una sola migración** (`drizzle/0000_even_chat.sql`) con 18 `CREATE TABLE`, 4 tipos, 1 secuencia y 37 índices explícitos (6 únicos), más `meta/_journal.json`. El schema completo se creó desde el inicio, según lo previsto.

Los scripts `scripts/*.mjs` cubren conexión compartida, seed de ajustes, seed demo, limpieza demo (en orden inverso de claves foráneas) y creación del administrador.

### Autenticación y permisos

- Proveedor único: **Credentials** (email + contraseña hasheada con bcryptjs). Google se eliminó por completo.
- Sesión **JWT**; los callbacks copian `id` y `role` al token.
- `src/proxy.ts` reemplaza al `middleware.ts` clásico en Next 16: redirige `/admin/*` y `/cuenta/*` sin sesión a `/login?next=…`, y a los clientes de `/admin` a `/403`.
- `requireUser()` y `requireAdmin()` en `src/lib/auth/helpers.ts`. `requireAdmin()` **relee el rol desde la BD en cada llamada**, así un cambio de rol se refleja de inmediato en el acceso (el botón del navbar requiere re-login porque el rol vive en el token).
- Rate limit de login por IP + email, **en memoria del proceso** (`src/lib/auth/rate-limit.ts`): no sobrevive a múltiples instancias ni a reinicios.

### Pagos con MercadoPago

Flujo implementado en `src/lib/mercadopago.ts`, `src/server/checkout/*` y `src/app/api/webhooks/mercadopago/route.ts`:

1. `createPendingOrder()` recalcula precios, stock y envío **desde la BD** dentro de una transacción, guarda snapshots del producto y escribe el historial de estados.
2. Se crea la preferencia de Checkout Pro en ARS (centavos / 100), con `external_reference = order.id`, `back_urls`, `auto_return: approved` y `notification_url="${APP_URL}/api/webhooks/mercadopago"`.
3. El entorno se elige con `MP_ENVIRONMENT=test` en producción → `sandbox_init_point`.
4. La Server Action devuelve `checkoutUrl` y el cliente hace `window.location.assign(...)`. Esto reemplazó un `redirect()` de Server Action que se colgaba en celular.
5. El webhook valida la firma con el SDK **antes de parsear el body** (401 si falla), ignora notificaciones que no son de pago, consulta el pago a la API de MP (nunca confía en el body), inserta el evento de forma idempotente, bloquea filas con `FOR UPDATE` y en una sola transacción marca el pedido como `paid`, descuenta stock con movimientos `sale` (nunca negativo), vacía el carrito y registra el historial.
6. Si falta stock al aprobar, el pedido queda `paid` con prefijo `MANUAL_REVIEW:` en `mp_status` para revisión manual. No hay columna dedicada para ese estado.

**Estado de la prueba:** se crearon 4 preferencias reales (pedidos #361 a #364, todos `pending_payment`), la API de MP no registra ningún pago intentado en las últimas 4 horas y `payment_events` no tiene eventos nuevos. El error reportado ocurre en la pantalla de MP antes del cobro. La firma del webhook se probó localmente (401 sin firma), pero **nunca con una notificación real de MP**.

### Contabilidad y analítica

- `src/server/accounting/queries.ts`: balance por período, costo de ventas, margen bruto, egresos por categoría y tabla unificada de movimientos (límite 500). Ingresos = pedidos `paid|preparing|shipped|delivered`, fecha contable `paid_at`.
- `src/server/analytics/queries.ts`: KPIs del dashboard, comparativa por período, ventas a 30 días, pedidos por estado, rankings de productos y categorías, métodos de pago, clientes nuevos vs. recurrentes, stock bajo.
- `src/server/analytics/market.ts` + `market-findings.ts`: compras por provincia/ciudad desde la dirección congelada, mapa de calor día/hora, embudo de conversión, abandono de carrito, visitados vs. comprados, recompra y hallazgos automáticos deterministas.
- Toda la agrupación usa `AT TIME ZONE 'America/Argentina/Buenos_Aires'`; los denominadores en cero devuelven `null` en vez de `NaN`.

### Configuración y despliegue

- `.env.example` declara 13 variables (nombres). La configuración real está en Railway: 24 variables verificadas por nombre, incluyendo `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `APP_URL=${{RAILWAY_PUBLIC_DOMAIN}}`, `AUTH_SECRET`, `MP_*` y `CLOUDINARY_*`. **Ningún secreto está versionado.**
- Deploy automático desde GitHub (`alexandreValenzuela/Proyecto_Mercado`, rama `main`). Último deploy verificado: `3cdddf8c` (SUCCESS).
- No hay `Dockerfile`, `railway.json`, `Procfile`, CI ni tests. `README.md` documenta instalación, variables, seeds, creación de admin, flujo MP Test con túnel y webhook, y el runbook de Railway.
- El optimizador de imágenes de Next.js fue verificado en producción: `/_next/image` devuelve 200 para los 3 hosts nuevos, y `/catalogo` ya no referencia `placehold.co`.

---

## Parte 2 — Mirada de usuario

### Quién lo usa

| Perfil | Qué hace |
|---|---|
| Invitado | Navega el catálogo, arma carrito por cookie httpOnly de 30 días |
| Cliente | Se registra/loguea, fusiona su carrito de invitado, paga, sigue pedidos, administra direcciones y perfil |
| Administrador (único vendedor) | Gestiona catálogo, stock, pedidos, egresos y consulta contabilidad, estadísticas y mercado |

**No están implementados** (decisión explícita): facturación AFIP, cupones, exportación de reportes, comisiones, logística real y múltiples vendedores.

### Mapa de rutas

| Área | Rutas | Cantidad |
|---|---|---|
| Tienda | `/`, `/catalogo`, `/producto/[slug]`, `/carrito`, `/checkout`, `/checkout/resultado`, `/nosotros`, `/cuenta/pedidos`, `/cuenta/pedidos/[id]`, `/cuenta/direcciones`, `/cuenta/perfil` | 11 |
| Acceso | `/login`, `/registro` | 2 |
| Admin | `/admin`, productos (3), categorías, pedidos (2), contabilidad (3), estadísticas, mercado, clientes (2), configuración | 15 |
| Sistema | `/403`, `/404`, `/api/auth/[...nextauth]`, `/api/product-views`, `/api/webhooks/mercadopago` | 5 |

Las 19 rutas relevantes fueron verificadas por HTTP en producción: las públicas devuelven 200, las protegidas 307 hacia login, y `/404` devuelve 404.

### Recorrido del cliente

1. **Inicio:** hero, destacados calculados, categorías, medios de pago y footer con contacto.
2. **Catálogo:** búsqueda, filtro por categoría y precio, 5 ordenamientos, paginación, estado vacío amigable y contador con `aria-live`.
3. **Producto:** galería, selector de variantes, stock, cantidad tope, registro de visita (máx. 1 por sesión/producto/hora) y feedback al agregar al carrito.
4. **Carrito:** cantidades editables, recompra de precios y stock en servidor, avisos de cambio de precio y de stock insuficiente. Al loguearse, el carrito de invitado se fusiona sumando cantidades.
5. **Checkout:** requiere sesión (`?next=/checkout`), 3 pasos (entrega, dirección, resumen). Dirección guardada o nueva. Errores visibles con mensajes concretos de validación.
6. **Resultado:** muestra aprobado/pendiente/rechazado, pero el estado oficial lo define el webhook, no la URL.
7. **Mis pedidos:** historial, detalle con línea de tiempo, snapshots, dirección congelada y botón "Reintentar pago" solo si está `pending_payment`.

### Recorrido del admin

Los 9 módulos del sidebar están implementados, sin stubs:

| Módulo | Qué permite |
|---|---|
| Dashboard | Ventas de hoy/mes con variación, pedidos pendientes, stock bajo, ticket promedio, gráfico de 30 días |
| Productos | CRUD con variantes, imágenes de Cloudinary, ajuste de stock con motivo e historial por variante |
| Categorías | CRUD |
| Pedidos | Filtros, paginación, detalle, transiciones válidas (`paid → preparing → shipped → delivered`) y cancelación con devolución de stock |
| Contabilidad | Egresos y sus categorías, balance, costo de ventas, margen con aviso "Margen incompleto", gráficos y movimientos unificados |
| Estadísticas | Ventas comparadas, top productos, categorías, métodos de pago, clientes nuevos vs. recurrentes |
| Mercado | Provincia/ciudad, mapa de calor día/hora, embudo, abandono de carrito, visitados vs. comprados y hallazgos |
| Clientes | Listado con pedidos y total gastado, detalle por cliente |
| Configuración | Datos de tienda, envío, umbral de envío gratis, retiro y contacto |

El navbar de la tienda muestra un acceso directo a `/admin` solo para administradores; el topbar del admin tiene "Volver a la tienda".

### Identidad visual y redacción

- Marca **Nudo**, definida en una única constante (`src/config/site.ts`).
- Paleta "Arcilla y salvia" como tokens CSS: fondo `#FBF7F2`, primary `#4F7A5A`, accent `#E39A78`, texto `#2B2A28`.
- Titulares Nunito, cuerpo Inter, vía `next/font`. Bordes redondeados, sombras suaves, mobile-first.
- Moneda `Intl.NumberFormat('es-AR', { currency: 'ARS' })`, fechas `dd/MM/yyyy`, zona `America/Argentina/Buenos_Aires`.
- Los textos de interfaz usan voseo rioplatense ("Agregar al carrito", "Revisá estos datos", "No tenés acceso"). Los identificadores de código están en inglés.
- Accesibilidad presente: `role="alert"`, `aria-invalid`, `aria-label`, `aria-pressed`, `sr-only` y menú móvil con `<details>`.

### Permisos

| Recurso | Invitado | Cliente | Admin |
|---|---|---|---|
| Catálogo y producto | Sí | Sí | Sí |
| Carrito | Sí (cookie) | Sí | Sí |
| Checkout | No → login | Sí | Sí |
| Pedidos, direcciones, perfil | No | Solo propios | Los propios |
| `/admin/*` | No → login | 403 | Sí |

---

## Datos reales de producción

Consulta directa a Neon el 20/11/2026:

| Métrica | Valor |
|---|---|
| Categorías / productos / variantes / imágenes | 5 / 16 / 28 / 16 |
| Usuarios (1 admin, 20 demo) / direcciones | 21 / 21 |
| Pedidos | 184 (180 demo, 4 reales) |
| Pedidos con ingreso registrado | 158 — $96.313,00 ARS |
| Pedidos pagados / pendientes / cancelados | 53 / 18 / 8 |
| Ítems de pedido / eventos de estado | 355 / 350 |
| Eventos de webhook | 166 (ninguno de los 4 pedidos reales) |
| Movimientos de stock / egresos / categorías de egreso | 28 / 32 / 6 |
| Visitas a productos / carritos activos | 103 / 2 |

Los 4 pedidos reales (#361–#364) son intentos de checkout de hoy, todos `pending_payment`, con dirección guardada y $137,00 de total. Confirman que el formulario y la creación de preferencia funcionan; no confirman el cobro.

---

## Estado de la entrega y hallazgos

### Ya resuelto y verificado

- Despliegue, migraciones, admin creado, health checks y 19 rutas respondiendo.
- Accesos admin/storefront, imágenes reales, fix del redirect en celular y fix de direcciones guardadas: todos desplegados y verificados con evidence (último deploy `3cdddf8c`).
- `typecheck`, `lint`, `build` (35 rutas) y `git diff --check` en verde tras cada cambio.

### Bloqueos y deuda, ordenados por prioridad

| Prioridad | Hallazgo | Evidencia | Acción |
|---|---|---|---|
| P0 | Pago sandbox y webhook real sin probar | 4 pedidos `pending_payment`, 0 pagos en la API de MP, `payment_events` sin eventos nuevos | Completar el pago con el comprador de prueba de MP y verificar BD |
| P0 | Fase 5 y Fase 10 siguen sin tildar en `AGENTS.md` | `AGENTS.md` §12 | Tildarlas después de la prueba real, no antes |
| P1 | Sin tests automatizados ni CI | No hay script `test`, archivos de test ni configuración de CI | Agregar pruebas de validators, webhook y flujo de stock |
| P1 | Documentación desactualizada | `README.md` línea 72 sigue describiendo imágenes como placeholders; `PROGRESS.md` da por no desplegados fixes que ya están activos | Actualizar ambos archivos |
| P1 | Rate limit de login en memoria | `src/lib/auth/rate-limit.ts` | Persistirlo (BD o Redis) si hay más de una instancia |
| P2 | Calidad de 7 imágenes demo | Miniaturas de Google de 203–253 px y preview de Dreamstime | Pedir URLs de mayor resolución |
| P2 | Métrica de abandono de carrito inexacta | Los carritos de invitado no se vinculan a pedidos (`PROGRESS.md:279`) | Relacionar carrito y pedido |
| P2 | Revisión manual por prefijo de texto | `MANUAL_REVIEW:` en `mp_status` | Columna dedicada en el schema |
| P2 | Sin error boundary en tienda/auth | Solo existen en root y admin | Agregar límites de error por área |

---

## Checklist de cierre

- [x] Código completo, tipado, linteado y compilado
- [x] Base de datos migrada y datos demo cargados
- [x] Deploy en Railway operativo y rutas verificadas
- [x] Imágenes reales en los 16 productos
- [x] Formulario de checkout acepta direcciones guardadas
- [ ] **Pago sandbox aprobado y webhook procesado**
- [ ] Stock descontado, carrito vacío e historial de estados verificados
- [ ] Fases 5 y 10 tildadas y `PROGRESS.md` actualizado

## Próximo paso

Completar un pago real en sandbox desde el deploy de producción con el comprador de prueba de MercadoPago, usando la tarjeta de prueba oficial (Visa `4509 9535 6623 3704`, vencimiento `11/30`, CVV `123`, titular `APRO`, DNI `12345678`). Después verificar en BD: pedido `paid`, una sola fila en `payment_events`, movimiento `sale` de stock, carrito vacío e historial de estados. Con eso se cierra el informe y la entrega.
