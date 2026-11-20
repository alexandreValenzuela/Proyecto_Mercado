# Nudo

Plataforma web de e-commerce para un emprendimiento, con foco en gestión contable y estudio de mercado. El proyecto sigue la especificación completa de `AGENTS.md`: catálogo, carrito, checkout con MercadoPago, pedidos, panel de administración, contabilidad, estadísticas y estudio de mercado.

## Requisitos

- Node.js 24 o superior y npm 11 o superior.
- Una base de datos PostgreSQL en Neon (URLs pooled y directa).
- Cuentas de Google OAuth, Cloudinary y MercadoPago para habilitar esos módulos.
- Opcional: Cloudflared o Ngrok para exponer el webhook cuando se prueba en local.

## Instalación

```bash
npm install
cp .env.example .env.local
npm run dev
```

En Windows PowerShell: `Copy-Item .env.example .env.local`.

La aplicación abre en `http://localhost:3000`. Nunca subas `.env.local` ni ningún archivo con credenciales: `.gitignore` ya los excluye y solo `.env.example` se versiona.

## Variables de entorno

Copiá `.env.example` a `.env.local` y completá los valores según el entorno.

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión pooled de Neon, usada en runtime. |
| `DATABASE_URL_UNPOOLED` | Conexión directa de Neon, usada por drizzle-kit en las migraciones. |
| `APP_URL` | URL pública de la app. En local, `http://localhost:3000`; en desarrollo con túnel, la URL del túnel; en producción, la URL final de Railway. Define las `back_urls` y la `notification_url` de MercadoPago. |
| `AUTH_SECRET` | Secreto de Auth.js; generarlo con `openssl rand -base64 32`. |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Credenciales de Google OAuth. Con las variables vacías el login con Google no está disponible, pero el resto funciona. |
| `MP_ACCESS_TOKEN` | Access token de MercadoPago: de **Test** para desarrollar y probar, de producción solo en el deploy final. |
| `MP_ENVIRONMENT` | `test` (default) o `production`. Con credenciales de Test **tiene** que ser `test` para usar `sandbox_init_point`; para producción hay que declarar explícitamente `production` y usar `init_point`. No se infiere del prefijo del token: MP devuelve ambas URLs y el prefijo de Test puede variar. |
| `MP_WEBHOOK_SECRET` | Secreto de firma del webhook, tomado del panel de desarrolladores de MP. Sin él, la notificación se rechaza. |
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | Solo si se usa Bricks (este proyecto usa Checkout Pro, así que no hace falta). |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Subida firmada de imágenes desde el admin. Sin credenciales, la subida muestra un error claro. |
| `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD` | Primer usuario administrador; los lee el script `db:create-admin`. La contraseña debe tener al menos 8 caracteres. |

Para Google OAuth registrá como URI de redirección `http://localhost:3000/api/auth/callback/google` y, en producción, `https://<dominio-railway>/api/auth/callback/google`.

## Scripts

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` | Build de producción. |
| `npm run start` | Servidor de producción. |
| `npm run lint` | ESLint sobre el proyecto. |
| `npm run typecheck` | Verificación de tipos con `tsc --noEmit`. |
| `npm run format` | Formateo con Prettier. |
| `npm run db:generate` | Genera migraciones SQL a partir de `src/db/schema.ts`. |
| `npm run db:migrate` | Aplica las migraciones pendientes en Neon. |
| `npm run db:studio` | Abre Drizzle Studio. |
| `npm run db:seed:demo` | Carga la configuración inicial y los datos demo. |
| `npm run db:clean-demo` | Borra solo los datos demo. |
| `npm run db:create-admin` | Crea o actualiza el primer administrador. |

## Base de datos y administrador

1. Creá un proyecto en Neon y copiá la URL pooled a `DATABASE_URL` y la URL directa a `DATABASE_URL_UNPOOLED`.
2. Ejecutá `npm run db:migrate` para aplicar las migraciones de `drizzle/`. Todo cambio de esquema se hace con migraciones; nunca editando la base a mano.
3. Definí `ADMIN_EMAIL` y `ADMIN_INITIAL_PASSWORD` en `.env.local` y corré `npm run db:create-admin`. El script hace upsert: si el email ya existe, lo promueve a administrador y actualiza su contraseña con bcrypt. Nunca imprime la contraseña.
4. Si querés datos de ejemplo, corré `npm run db:seed:demo`.

`src/db/client.ts` expone `getDb()`, un cliente de Neon + Drizzle perezoso: no intenta conectarse al importar el módulo, por lo que `npm run build` funciona sin variables de entorno.

## Datos demo

`npm run db:seed:demo` hace dos cosas, en este orden:

- `scripts/seed-settings.mjs` inserta, si no existe, la fila única de `store_settings` (nombre, costo de envío, umbral de envío gratis, retiro, contacto) y las 6 categorías de egreso iniciales (Mercadería, Envíos, Publicidad, Servicios, Impuestos y Otros). No son demo: se mantienen después de limpiar.
- `scripts/seed-demo.mjs` borra el demo anterior y genera 5 categorías, 16 productos, 28 variantes, 20 clientes en provincias argentinas distintas, 180 pedidos de los últimos 90 días con sus ítems y snapshots, 32 egresos y 98 visitas a productos. Todo marcado como demo, con ids deterministas e imágenes de placeholder. Podés validar el generator sin tocar la base con `DRY_RUN=1 npm run db:seed:demo`.

`npm run db:clean-demo` elimina únicamente las filas demo (y las que dependen de ellas) en orden inverso de claves foráneas. No toca datos reales, `store_settings` ni `expense_categories`. Para volver a poblar, corré el seed de nuevo.

## Pagos con MercadoPago (Checkout Pro)

El flujo es: carrito → `/checkout` → pedido en `pending_payment` con ítems y snapshots → preferencia de Checkout Pro → redirección a MP → webhook → pedido `paid` con descuento de stock.

### Probar en local con credenciales de Test

1. En el panel de desarrolladores de MercadoPago, creá la aplicación de **Test** y obtené el Access Token de prueba y el secreto de firma del webhook. Pegalos en `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` de `.env.local`.
2. Dejá `MP_ENVIRONMENT=test`. Con credenciales de Test es obligatorio: production solo se habilita de forma explícita con `MP_ENVIRONMENT=production` y credenciales reales.
3. Creá usuarios de prueba (comprador y vendedor) en el panel y usalos para iniciar sesión en la página de pago. No hace falta ingresar datos reales de tarjeta: en el checkout de prueba se elige una tarjeta de test **APRO** para aprobar, u otras tarjetas de prueba para rechazo/pendiente. Los datos de esas tarjetas están en la documentación de MP; no los guardes en el repo.
4. Exponé el servidor local con un túnel, por ejemplo:

   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

   Copiá la URL pública que imprime en `APP_URL` (sin barra final) y reiniciá `npm run dev`.
5. En el panel de MP registrá la URL de notificación `https://<tu-tunnel>/api/webhooks/mercadopago` y su secreto de firma. La preferencia ya envía esa URL como `notification_url`.
6. Comprá con el usuario de prueba de comprador: elegí envío o retiro, cargá una dirección si corresponde y confirmá. Te redirige al checkout de sandbox; al volver, `/checkout/resultado` muestra aprobado, pendiente o rechazado según los parámetros de retorno.
7. Confirmá en `/admin/pedidos` que el pedido pasó a **Pagado**, que se descontó el stock y que se registró el historial. El webhook es la **única fuente de verdad**: la URL de retorno es informativa y nunca cambia el estado por sí sola.
8. Para probar la persistencia, recargá el detalle del pedido y revisá `payment_events`: el evento se registra una sola vez por `(provider, external_id, action)`, así que reenviar la misma notificación no descuenta stock dos veces.
9. Si el pago se rechaza, se cancela o expira, el pedido queda en `pending_payment`. Desde `/cuenta/pedidos` el botón **Reintentar pago** genera una nueva preferencia sobre el **mismo** pedido, sin duplicarlo.

Si el pago se aprueba pero no hay stock para descontar todos los ítems, el pedido queda en `paid` con `mp_status` prefijado con `MANUAL_REVIEW:` y el admin lo ve como alerta **Revisión manual** en el listado y el detalle. Nunca se permite stock negativo.

## Panel de administración

`/admin` concentra dashboard, productos, categorías, pedidos, contabilidad, estadísticas, mercado, clientes y configuración. El acceso está protegido por el proxy y, además, cada query y server action del panel vuelve a verificar el rol con `requireAdmin()`. Los clientes solo ven sus propios pedidos, direcciones y carrito.

## Despliegue en Railway

El servicio Next.js se despliega en Railway y la base queda en Neon. No hace falta crear una base en Railway.

1. Creá el servicio desde este repositorio. Si Railway no detecta el stack, configurá manualmente:
   - Build command: `npm run build`
   - Start command: `npm run start`
2. Cargá **todas** las variables de entorno del service, con los valores finales:
   - `DATABASE_URL` (pooled de Neon) y `DATABASE_URL_UNPOOLED` (directa de Neon). La segunda es la que usa `npm run db:migrate`.
   - `APP_URL` = la URL final de Railway, por ejemplo `https://nudo-production.up.railway.app`, sin barra final. Tiene que ser pública y accesible desde Internet para que MP pueda llamar al webhook.
   - `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.
   - `MP_ACCESS_TOKEN`, `MP_ENVIRONMENT`, `MP_WEBHOOK_SECRET`, `NEXT_PUBLIC_MP_PUBLIC_KEY` si corresponde.
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
   - `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD`.
3. En Google Cloud, agregá `https://<dominio-railway>/api/auth/callback/google` a los URIs de redirección autorizados.
4. En el panel de MercadoPago registrá `https://<dominio-railway>/api/webhooks/mercadopago` como URL de notificación y cargá el mismo secreto que `MP_WEBHOOK_SECRET`. Si las credenciales son de Test, `MP_ENVIRONMENT` sigue siendo `test`; el paso a producción requiere cambiar credenciales **y** setear `MP_ENVIRONMENT=production` explícitamente.
5. Desplegá y esperá a que el build termine con `npm run build`.
6. Ejecutá como comando one-off (Railway run / Railway Shell) `npm run db:migrate` **después** del primer deploy. Es la forma de aplicar las migraciones en Neon desde el entorno donde están las variables. Repetilo después de cada deploy que traiga migraciones nuevas.
7. Ejecutá también como one-off `npm run db:create-admin` para crear el administrador inicial. `npm run db:seed:demo` es opcional y conviene usarlo solo en un entorno de prueba, nunca sobre datos reales.
8. Verificación de salud:
   - `GET /` responde 200 y muestra la marca Nudo y el catálogo.
   - `GET /api/auth/providers` responde 200 y lista Credentials y Google.
   - Ingresás con el administrador y `/admin` carga el dashboard con datos reales.
   - En `/admin/pedidos` se ve el pedido generado en el smoke de pago y el webhook aparece como entregado en el panel de MP.

## Estructura

- `src/app`: rutas de App Router (storefront, auth, admin y API).
- `src/components/ui`: primitivas generadas por shadcn/ui.
- `src/config/site.ts`: nombre de marca y constantes regionales (único lugar donde se define `Nudo`).
- `src/db`: esquema, cliente de Neon y consultas.
- `src/lib`, `src/server`: lógica de integraciones y reglas de negocio.
- `scripts`: tareas de base de datos y administración.
- `drizzle`: migraciones generadas.

## Calidad

```bash
npm run typecheck
npm run lint
npm run build
git diff --check
```

Los commits siguen el formato Conventional Commits en inglés (`feat:`, `fix:`, `chore:`, `docs:`). Nunca se incluyen credenciales en commits.
