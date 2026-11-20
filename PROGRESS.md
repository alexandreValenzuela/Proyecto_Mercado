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
