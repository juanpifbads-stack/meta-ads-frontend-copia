# HANDOFF — AlquimiaOS / meta-ads-frontend

Documento de traspaso para cualquier persona (o asistente de IA) que empiece a
trabajar en este proyecto. Resume qué es, cómo está armado y cómo trabajar acá.

## Qué es AlquimiaOS

App interna + portal de clientes de **Alquimia**, una agencia de Meta Ads.
Son **dos repos separados**:

| Proyecto | Repo | Hosting |
|---|---|---|
| **meta-ads-frontend** (este) | `juanpifbads-stack/meta-ads-frontend-copia` | Vercel (`meta-ads-frontend-copia.vercel.app`, branch `main`) |
| meta-ads-backend | `JuanIgnacioRios/meta-ads-backend` | Railway (`meta-ads-backend-production-85df.up.railway.app`) |

> **Importante:** este repo se llama `...-copia` pero **es el de producción real**.
> Vercel deploya solo desde `main`. Trabajar tranquilo sobre `main`.
> Las dos cuentas de GitHub son de Agustín (todavía no hay org unificada — ver más abajo).

## Este repo (frontend)

React 18 + Vite + React Router + Recharts + Axios. Consume la API del backend.

### Estructura (`src/`)
- `App.jsx` — ruteo. Rutas:
  - `/` → `Login` (OAuth Meta). Si ya está logueado redirige a `/app`.
  - `/app` → shell con vistas internas: **Home**, **Dashboard** (optimizar campañas), **Admin**, **ClientHub**.
  - `/cliente/:slug` → **portal público del cliente**, protegido con `accessKey` simple.
  - `/cliente/:slug/pagos` → vista solo de pagos, con clave separada (`paymentsKey`).
  - `/audit` → historial de acciones.
- `context/AuthContext.jsx` — estado de auth global.
- `api/client.js` — instancia de Axios. Toma el token del `#hash` tras el login con Meta y lo guarda en `localStorage` (`alquimia_auth_token`); lo manda como `Authorization: Bearer` en cada request. `baseURL` = `VITE_API_URL` o el backend de Railway por default.
- `pages/` — `Home`, `Dashboard`, `Admin`, `ClientHub`, `ClientPortal` (+ `PaymentsPortal`), `MediaPlan`, `Login`, `Audit`, `Control`, `Analyze`, `Choice`, `ClientsList`.
- `components/` — tablas de métricas, tarjetas de campaña/adset, paneles de presupuesto, tareas, pagos, gráficos de tendencia, modal de detalle de anuncio, etc.
- `data/clients.js` — config de clientes del portal. **Ojo:** parte de la estrategia/presupuesto/objetivos está hardcodeada de ejemplo; se migra a editar desde Admin + base de datos.

### Correr local
```bash
cp .env.example .env   # VITE_API_URL=http://localhost:3001  (o el backend de Railway)
npm install
npm run dev            # http://localhost:5173
npm run build          # genera dist/
```

## Flujo de trabajo

- Trabajar sobre `main`. Vercel deploya solo en cada push a `main` (production branch).
- Verificar config de deploy: Vercel → proyecto `meta-ads-frontend-copia` → Settings → Git → `juanpifbads-stack/meta-ads-frontend-copia`, production branch `main`.
- Cuentas de GitHub: este repo es de `juanpifbads-stack`, el backend de `JuanIgnacioRios`. Con `gh` instalado, cambiar de cuenta con `gh auth switch`.

## Decisión pendiente (cuando haya tiempo)

Unificar ambos repos bajo una **org de GitHub** (ej. `alquimia-os`). Transferir cambia
la URL → hay que reconectar Vercel y Railway al repo en su nueva ubicación y actualizar
el `remote` en cada compu. Planificarlo en un momento dedicado para no cortar los deploys.
Por ahora se deja como está.
