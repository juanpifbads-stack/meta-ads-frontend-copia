# CLAUDE.md — alquimia OS (frontend)

> Reglas que el asistente debe respetar SIEMPRE al tocar este repo.
> Arquitectura completa y onboarding → ver `HANDOFF.md`.

## Qué es
- React + Vite. Deploy en **Vercel**. Repo `juanpifbads-stack/meta-ads-frontend-copia`, rama **`main`** → producción `meta-ads-frontend-copia.vercel.app`.
- ⚠️ Aunque diga "copia", **ES el repo de producción real.** Trabajar sobre `main`.
- El backend es OTRO repo: `JuanIgnacioRios/meta-ads-backend`.

## Flujo de trabajo (obligatorio)
- **`git pull` ANTES de tocar nada** (trabajan 2 personas + 2 asistentes; evitar conflictos).
- Commit/push **solo cuando el usuario lo pide**.
- **Push a `main` = deploy automático** a producción. Cuidado con qué se sube.
- Cambios grandes → rama `feature/...` y merge cuando esté probado.

## Reglas duras (romper esto = bug en producción)
1. 🚫 **No cambiar el comportamiento del portal de Moka.** En `ClientPortal.jsx`: si el cliente NO tiene `panel` (Moka) → modo "legacy" (muestra todo desde `monthly_plans`). Clientes nuevos → modo "genérico" (gobernado por `panel.sections`, alimentado por el plan de medios). No unificar ni "migrar" Moka sin pedido explícito.
2. 🧩 **`MANDATORY` (lista de secciones obligatorias del portal) en `ClientPortal.jsx` debe coincidir** con `MANDATORY_SECTIONS` del backend (`portalConfig.js`). Si cambia una, cambiar la otra.
3. 🔁 **`elapsedPace()`** (cálculo del ritmo: días completos + fracción de hoy 10am→22hs) está **duplicado en `Home.jsx` y `ClientPortal.jsx`**. Mantener ambos iguales.
4. 🔑 **Auth por token:** se guarda en `localStorage` (`alquimia_auth_token`) y se manda como `Authorization: Bearer` (ver `api/client.js`). No romper los interceptors (se mantiene también la cookie por compat).
5. 🟡 **El portal público `/cliente/:slug` todavía usa la lista estática `data/clients.js`** (solo Moka funciona ahí). Hacerlo manejado desde la base es un TODO planificado. **No hardcodear clientes nuevos** acá.

## De dónde sale cada dato (no duplicar campos)
- **Plan de medios** → objetivo (facturación + ROAS → inversión), justificación, consideraciones, planificación, metas del mes, objetivo ecommerce.
- **Admin (micro del mes)** → solo: estrategia del mes + roadmap.
- **Productos** → automáticos de Tienda Nube (sin SKUs = todos, top 60).
- Facturación/ritmo/productos = Tienda Nube (real). Performance Meta = atribuido por Meta. Son fuentes distintas a propósito.

## Comandos
- `npm install` · `npm run dev` (local) · `npm run build`.

## TODOs frágiles (NO "arreglar" a lo bruto sin avisar)
- Portal público manejado desde la base (manteniendo el de Moka intacto + uno nuevo genérico).
- Pagos detallados (fees/actrices/variable) solo existen para Moka; falta wirearlos para clientes nuevos.
