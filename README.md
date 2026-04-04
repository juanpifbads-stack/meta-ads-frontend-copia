# meta-ads-frontend

Dashboard de optimización de campañas Meta Ads — Frontend React + Vite.

## Requisitos

- Node.js 18+
- npm 9+

## Instalación

```bash
cd meta-ads-frontend
npm install
```

## Configuración

Copiá el archivo de ejemplo y configurá las variables:

```bash
cp .env.example .env
```

Editá `.env`:

```env
VITE_API_URL=http://localhost:3001
```

Asegurate de que `VITE_API_URL` apunte al servidor backend Express que maneja la autenticación OAuth con Meta.

## Desarrollo

```bash
npm run dev
```

El servidor de desarrollo corre en `http://localhost:5173` por defecto.

## Build de producción

```bash
npm run build
```

Los archivos compilados quedan en `dist/`.

Para previsualizar el build:

```bash
npm run preview
```

## Estructura del proyecto

```
meta-ads-frontend/
├── index.html
├── vite.config.js
├── package.json
├── .env.example
└── src/
    ├── main.jsx              # Entry point — BrowserRouter + AuthProvider
    ├── App.jsx               # Rutas protegidas
    ├── index.css             # Sistema de diseño completo (tokens + componentes)
    ├── api/
    │   └── client.js         # Axios con withCredentials:true
    ├── context/
    │   └── AuthContext.jsx   # Estado de autenticación
    ├── pages/
    │   ├── Login.jsx         # Página de login con OAuth Meta
    │   ├── Dashboard.jsx     # Dashboard principal
    │   └── Audit.jsx         # Historial de acciones
    └── components/
        ├── AccountSelector.jsx   # Selector de cuenta publicitaria
        ├── AdSetCard.jsx         # Card de conjunto ABO
        ├── CampaignCard.jsx      # Card de campaña CBO
        ├── AdSetAccordion.jsx    # Lista colapsable de adsets dentro de CBO
        ├── MetricsTable.jsx      # Tabla de métricas 7D/14D/30D
        ├── TrendChart.jsx        # Gráfico de tendencia (Recharts)
        ├── AdDetailModal.jsx     # Modal con anuncios del conjunto
        ├── BudgetActionPanel.jsx # Panel de ajuste de presupuesto
        └── AuditLog.jsx          # Tabla de auditoría
```

## Flujo de autenticación

1. El usuario hace clic en "Conectar con Meta →"
2. El frontend redirige a `VITE_API_URL/auth/meta` (backend)
3. El backend inicia el flujo OAuth 2.0 con Meta
4. Al completarse, Meta redirige al backend con el código de autorización
5. El backend intercambia el código por tokens, los guarda en una cookie httpOnly segura
6. El backend redirige al frontend en `http://localhost:5173/dashboard`
7. El frontend llama a `/auth/me` para verificar el estado de sesión

Los tokens de Meta **nunca se exponen al frontend**. Todo se maneja en el servidor mediante cookies httpOnly con `withCredentials: true`.

## Endpoints del backend esperados

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/auth/meta` | Inicia OAuth con Meta |
| GET | `/auth/me` | Retorna usuario autenticado |
| POST | `/auth/logout` | Cierra sesión |
| GET | `/accounts` | Lista cuentas publicitarias |
| GET | `/accounts/:id/adsets` | Adsets ABO activos con métricas |
| GET | `/accounts/:id/campaigns` | Campañas CBO activas con métricas |
| GET | `/accounts/:accountId/adsets/:adsetId/ads` | Anuncios de un conjunto |
| POST | `/actions/budget` | Modifica presupuesto |
| POST | `/actions/pause` | Pausa un adset |
| GET | `/audit` | Historial de acciones |

## Notas de diseño

- Fondo: `#F7F7F5`
- Color principal: `#1B1FE8` (azul marca)
- Cards con borde izquierdo de 4px azul (elemento visual más importante)
- Fuente monoespaciada para todos los datos y métricas
- Solo pesos 400 y 700 (nunca 500 ni 600)
- Sin librerías de íconos externas — se usa Unicode
- Sin Tailwind ni CSS-in-JS — solo CSS plano en `index.css`
