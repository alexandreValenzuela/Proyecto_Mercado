# GAO Store

Plataforma web de e-commerce para un emprendimiento, con foco en gestión contable y estudio de mercado. El proyecto sigue la especificación completa de `AGENTS.md`; este README cubre la puesta en marcha de la base del proyecto (Fase 0).

## Estado actual

Fase 0 completada: aplicación Next.js con TypeScript, Tailwind CSS v4, shadcn/ui, tokens de diseño, fuentes, configuración de Drizzle para Neon y documentación base. Las funcionalidades de catálogo, carrito, pagos y administración se implementan en las fases siguientes.

## Requisitos

- Node.js 24 o superior y npm 11 o superior.
- Una base de datos PostgreSQL en Neon (para las tareas de base de datos).
- Cuentas de Google OAuth, Cloudinary y MercadoPago solo cuando se implementen esos módulos.

## Instalación

```bash
npm install
cp .env.example .env.local
npm run dev
```

En Windows PowerShell: `Copy-Item .env.example .env.local`.

La aplicación abre en `http://localhost:3000`. Nunca subas `.env.local` ni ningún archivo con credenciales: `.gitignore` ya los excluye y solo `.env.example` se versiona.

## Variables de entorno

Copiá `.env.example` a `.env.local` y completá los valores que necesites para cada fase.

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión pooled de Neon, usada en runtime. |
| `DATABASE_URL_UNPOOLED` | Conexión directa de Neon, usada por drizzle-kit en migraciones. |
| `APP_URL` | URL pública de la app; por defecto `http://localhost:3000`. |
| `AUTH_SECRET` | Secreto de Auth.js; generarlo con `openssl rand -base64 32`. |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Credenciales de Google OAuth (Fase 2). |
| `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` | Credenciales de MercadoPago; usar sandbox en desarrollo (Fase 5). |
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | Solo si se usa Bricks (no previsto para Checkout Pro). |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Subida de imágenes del admin (Fase 3). |
| `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD` | Primer usuario administrador (Fase 1). |

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
| `npm run db:seed:demo` | Datos demo (placeholder hasta Fase 1). |
| `npm run db:clean-demo` | Limpieza de datos demo (placeholder hasta Fase 1). |
| `npm run db:create-admin` | Creación del primer administrador (placeholder hasta Fase 1). |

## Base de datos y migraciones

1. Creá un proyecto en Neon y copiá la URL pooled a `DATABASE_URL` y la URL directa a `DATABASE_URL_UNPOOLED`.
2. La Fase 1 completa `src/db/schema.ts` con todas las tablas, enums, relaciones e índices.
3. Ejecutá `npm run db:generate` para generar el SQL en `drizzle/` y `npm run db:migrate` para aplicarlo.
4. `npm run db:studio` permite inspeccionar los datos.

Todos los cambios de esquema se hacen mediante migraciones; nunca editando la base a mano. `src/db/client.ts` expone `getDb()`, un cliente de Neon + Drizzle perezoso: no intenta conectarse al importar el módulo, por lo que `npm run build` funciona sin variables de entorno.

## Datos demo

`npm run db:seed:demo` creará productos, clientes en distintas provincias argentinas, pedidos de los últimos 90 días y egresos, todos marcados como demo. `npm run db:clean-demo` eliminará únicamente esas filas. Ambos scripts son placeholders en Fase 0 e imprimen un aviso; su lógica se implementa en Fase 1.

## Pagos con MercadoPago

La integración prevista es Checkout Pro con redirección y webhook validado. La documentación completa de prueba en sandbox (tokens, usuarios de prueba y exposición local del webhook) se agregará en Fase 10, cuando el flujo de pagos esté implementado. Por ahora solo están declaradas las variables de entorno.

## Estructura

- `src/app`: rutas de App Router (storefront, auth, admin y API en fases posteriores).
- `src/components/ui`: primitivas generadas por shadcn/ui.
- `src/config/site.ts`: nombre de marca y constantes regionales (único lugar donde se define `GAO Store`).
- `src/db`: esquema, cliente de Neon y consultas.
- `src/lib`, `src/server`: lógica de integraciones y reglas de negocio.
- `scripts`: tareas de base de datos y administración.
- `drizzle`: migraciones generadas.

## Calidad

```bash
npm run typecheck
npm run lint
npm run build
```

Los commits siguen el formato Conventional Commits en inglés (`feat:`, `fix:`, `chore:`, `docs:`). Nunca se incluyen credenciales en commits.
