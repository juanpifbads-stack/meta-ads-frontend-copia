# BACKLOG — alquimia OS

> Lista viva de mejoras y pendientes para atacar más adelante. **Texto plano**, pensada para que
> cualquiera la lea (incluido el Claude de Agus y el de Juanpi). Es el "para después" del proyecto.
>
> **Cómo usarla:** agregá ítems abajo con una línea de contexto y la fecha. Cuando algo se hace,
> movelo a "Hecho (referencia)" o borralo. Mantener este archivo **igual en los dos repos**
> (frontend `meta-ads-frontend-copia` y backend `meta-ads-backend`).

---

## 🔴 Alta prioridad

- **Snapshot de Tienda Nube + cron (VELOCIDAD).** Hoy el portal le pega a TN **en vivo** en cada
  carga (paginar catálogo + órdenes) → lento, el usuario espera el viaje caro. Mover a un
  **snapshot en Postgres (Supabase)** refrescado por un **cron cada ~30 min** con **upsert por
  lotes** (`INSERT ... ON CONFLICT DO UPDATE` en chunks); los endpoints del portal pasan a **leer
  del snapshot** (1 query = instantáneo) y mostrar "última sync: hace X". Guardar el análisis **ya
  computado** (productos + ventas + pedidos por ventana, facturación, origen de ventas), no solo
  stock crudo. ⚠️ El cron pega a TN de **todos** los clientes aunque nadie mire → decidir
  frecuencia/alcance (igual que pasó con el cron de Notion, que se apagó por miedo a las llamadas
  constantes). Ya existe scaffold de cron en `jobs/notionSync.js`. [06/2026]

## 🟡 Media prioridad

- **Reorganizar el admin en 3 lugares (en discusión 06/2026).** Hoy "Admin del cliente" es un cajón
  de sastre. Target: (1) **Admin del cliente** = identidad (nombre, tipo, responsable), cuenta
  publicitaria, integración Tienda Nube, email — lo que ve el paid; (2) **Administración / Gestión
  de agencia** (solo admin) = usuarios internos + **finanzas por cliente** (fees, variable/reparto,
  datos bancarios, clave de pagos) sacadas del admin del cliente; (3) **Panel del cliente** =
  apartado aparte (tipo onboarding) con las **secciones visibles** del portal + **clave de acceso**
  + **Estrategia (macro+mes) unificada acá** (es contenido que ve el cliente). Plan de medios sigue
  como herramienta propia (enlazada).
- **Plan de medios — vista del vigente tipo "documento".** Al entrar a Plan de medios, "Ver el
  actual" debe mostrar el plan **estático, parecido al PDF que se le manda al cliente** (componentes
  read-only), con los botones **Crear plan de medios** y **Ver anteriores** arriba. Estética alineada
  a alquimia (no seguir mocks literales). Hoy hay una landing simple que abre el constructor. [06/2026]
- **Validar "Resultados" de servicios vs Ads Manager.** El semáforo/optimizador de cuentas de
  servicios calcula resultados = conversaciones (mensajería) + leads. Confirmar que el número da
  parecido a Ads Manager; si la cuenta usa otro resultado, ajustar. [06/2026]
- **Facturación tienda + ticket promedio en la página interna del cliente.** Hoy "Valor de compras"
  sale de **Meta** (atribución). Sumar un apartado con la **facturación real de Tienda Nube** y el
  **ticket promedio** (facturación ÷ pedidos), para contrastar Meta vs tienda real. [06/2026]
- **Integrar TikTok Ads API.** Hoy "Performance Meta y TikTok" trae **solo Meta**. El UTM de TikTok
  subcuenta brutalmente (el navegador in-app pierde los params + TikTok es canal de descubrimiento,
  la gente vuelve directo a comprar). Para medir TikTok de verdad hay que traer la **atribución que
  reporta TikTok Ads Manager** (su píxel), igual que hacemos con Meta. [Cameo, 06/2026]
- **Frecuencia exacta en CBO (optimizador).** Hoy la Frecuencia a nivel campaña es **aproximada**
  (suma el reach de los ad sets, ignora solapamiento de audiencias). CPM y CTR sí son exactos. Para
  exacto: una llamada de insights a nivel campaña.
- **Fijar token de agencia para portales públicos.** Hoy usan `getLatestAccessToken()` (token del
  último login) → impredecible con varios usuarios logueándose. Conviene fijarlo a un token de
  agencia estable.

## 🟢 Baja prioridad / polish

- **Columna SKU en productos sin SKU.** Para tiendas que no usan SKU (ej. Cameo), la columna SKU
  muestra el ID interno del producto. Mostrar algo más prolijo o esconder la columna cuando no aplica.
- **Variable modo `percent` en PaymentsTimeline.** Existe en config pero el front solo calcula el
  modo `differential` (Moka). Falta wirear `percent`.
- **Pagos detallados para clientes nuevos.** Fees / variable / bankInfo solo están wireados para
  Moka (legacy `budgetItems`). Falta armar el timeline desde `config.fees` de los clientes nuevos.

---

## ✅ Hecho (referencia, para no re-hacer)

- **Reducción de carga a Meta (sanción 7.e.i.2).** Meta restringió la app por "impacto negativo /
  volumen". Causa: `/admin/overview` (el Home) disparaba ~23 llamadas a Meta **en paralelo y sin
  caché** en CADA carga. Fix: caché (`utils/cache.js`) + concurrencia limitada (`mapLimit`) en TODOS
  los puntos que pegan a Meta: `/admin/overview` (salud 10min + lotes de 4), `meta-trend` (1h + lotes),
  `public/meta-insights` (10min), `public/sales-source` (10min). Crons apagados. ⚠️ **No volver a
  hacer llamadas a Meta sin caché ni en `Promise.all` sobre todos los clientes.** [06/2026]
- **Meta blindado a fondo (reglas duras en CLAUDE.md del backend).** (1) **Limitador global**
  `utils/metaLimit.js` (`metaRun`): ≤6 llamadas simultáneas a Meta en todo el proceso, TODA llamada
  pasa por ahí (`metaGet`). (2) **Snapshot de Meta** (`meta_snapshot` + cron `jobs/metaSnapshot.js`
  cada 30min, `services/metaData.js`): inicio y portales LEEN de la DB, no de Meta en vivo. (3)
  **`meta_month`** (`db/metaMonthCache.js`): los meses cerrados del plan de medios se calculan una
  vez y se guardan para siempre. (4) **System User token** (`META_SYSTEM_TOKEN` vía `db/metaToken.js`).
  (5) **Candado del optimizador** (`leaseGuard` en `routes/actions.js` + `utils/leases.js`): rechaza
  pausas/presupuesto si otro está optimizando la cuenta. Requiere correr `sql/meta_snapshot.sql` y
  `sql/meta_month.sql`. [06/2026]
- Portal público manejado **desde la base** (ya no la lista estática `data/clients.js`). [06/2026]
- Productos estratégicos: cruce de ventas **por ID de variante** (funciona aunque la tienda no use
  SKU) + nueva columna **Pedidos** (en cuántos pedidos se vendió, para detectar inflado mayorista) +
  paginación de TN **en paralelo** (más rápido) + cache key con SKUs. [06/2026]
- Optimizador: **CPM/CTR/Frecuencia a nivel CBO** + **ordenar ad sets** por gasto/convs/ROAS. [06/2026]
- "¿De dónde vienen las ventas?" (Cameo): origen real por UTM de TN vs atribución de Meta. [06/2026]
- Plan de medios: objetivo de **facturación ecommerce** separado del de Meta. [06/2026]
