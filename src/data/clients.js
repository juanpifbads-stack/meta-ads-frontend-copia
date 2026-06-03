/**
 * Configuración de clientes del portal.
 * Por ahora los datos de estrategia/presupuesto/objetivos son de EJEMPLO y están
 * hardcodeados. Más adelante se editarán desde un panel de admin y se guardarán
 * en la base de datos. Los datos de Meta y Tienda Nube se conectarán por API.
 *
 * IMPORTANTE: `accessKey` es la clave simple que protege el link del cliente.
 * El cliente entra a /cliente/{slug} y debe ingresar esta clave.
 */

export const CLIENTS = {
  moka: {
    slug: 'moka',
    name: 'Moka Knit',
    accessKey: 'moka2026',
    // Clave separada para el link SOLO de pagos (para administración/finanzas)
    paymentsKey: 'pagos2026',
    active: true,
    // Cuenta de Meta (la que arranca con 7)
    metaAccountId: '708620227018166',
    // Store de Tienda Nube (se completa cuando tengamos el token)
    tiendanubeStoreId: null,

    // Módulo 1 — Estrategia macro y mensual
    strategyMacro: {
      period: 'Junio – Julio 2026',
      objective: 'Maximizar ventas de remanentes de temporada manteniendo un ROAS saludable.',
      description:
        'Cuando el rendimiento comience a disminuir, iniciar liquidaciones. ' +
        'Paralelamente comenzar la preparación de la nueva temporada.',
    },
    strategyMonthly: {
      month: 'Junio 2026',
      objective: 'Detectar productos ganadores y escalar inversión sobre los de mejor rendimiento.',
      description:
        'Foco en testeo de catálogo, validación de ganadores y escalamiento progresivo.',
    },

    // Módulo 2 — Roadmap semanal (con grabaciones de la semana)
    roadmap: [
      {
        week: 'Semana 1', goal: 'Planificación y preparación', status: 'finalizada',
        recordings: [
          { date: '2026-06-03', actress: 'Delfina', note: 'Sesión UGC · 2 hs' },
        ],
      },
      {
        week: 'Semana 2', goal: 'Identificación de productos ganadores', status: 'en_curso',
        recordings: [
          { date: '2026-06-10', actress: 'Delfina', note: 'Producto + estáticos' },
          { date: '2026-06-12', actress: 'Karina', note: 'Reels de catálogo' },
        ],
      },
      {
        week: 'Semana 3', goal: 'Validación de productos ganadores', status: 'pendiente',
        recordings: [],
      },
      {
        week: 'Semana 4', goal: 'Escalamiento de productos seleccionados', status: 'pendiente',
        recordings: [
          { date: '2026-06-24', actress: 'Karina', note: 'Contenido de escalamiento' },
        ],
      },
    ],

    // Módulo 3 — Presupuesto y pagos
    budget: {
      // Componente variable de alquimia: 3% del diferencial de facturación
      // respecto de la base inicial. (Ajustar baseInicial con el número real.)
      variable: { rate: 0.03, baseInicial: 80000000, currency: 'ARS' },

      // Ítems del mes. phase: 'inicio' (1-5) | 'fin' (29-30) | 'post' (post día 30, mes vencido)
      items: [
        {
          concept: 'Fee mensual alquimia', detail: 'TikTok + Meta Ads', phase: 'inicio',
          breakdown: [
            { concept: 'Meta Ads', amount: 1100, currency: 'USD' },
            { concept: 'TikTok Ads', amount: 400, currency: 'USD', bonificado: 'Bonificado junio' },
          ],
        },
        { concept: 'Fee mensual alquimia', detail: 'Email mkt + Gestión web', amount: 350, currency: 'USD', phase: 'inicio' },
        { concept: 'Fee mensual alquimia', detail: 'Contenido para pauta · creación de 3 sesiones de 2 hs c/u', amount: 1000, currency: 'USD', phase: 'inicio' },
        {
          concept: 'Actrices', phase: 'inicio',
          breakdown: [
            {
              concept: 'Delfina', detail: '2 sesiones · 2 hs', amount: 500000, currency: 'ARS',
              bankInfo: { titular: 'Delfina (apellido)', alias: 'delfina.alias', cbu: '0000000000000000000000', observaciones: 'Datos de la actriz — completar con los reales.' },
            },
            {
              concept: 'Karina — sesión 1', detail: '2 hs · $225.000 por sesión', amount: 225000, currency: 'ARS',
              bankInfo: { titular: 'Karina (apellido)', alias: 'karina.alias', cbu: '0000000000000000000000', observaciones: 'Datos de la actriz — completar con los reales.' },
            },
            { concept: 'Karina — sesión 2', detail: '2 hs · $225.000 por sesión', amount: 225000, currency: 'ARS', bonificado: 'Bonificado junio' },
          ],
        },
        {
          concept: 'Viáticos del mes (Delfina) + alquileres de estudio', phase: 'fin',
          detail: 'Lo que alquimia haya abonado durante el mes', variableMonto: true, currency: 'ARS',
        },
        // post día 30 — corresponde al mes presente (junio)
        { concept: 'Inversión Meta', amount: 15000000, currency: 'ARS', phase: 'post', media: true },
        { concept: 'Inversión TikTok', amount: 1500000, currency: 'ARS', phase: 'post', media: true },
        { concept: 'Componente variable alquimia', detail: '3% del diferencial de facturación', phase: 'post', isVariable: true, currency: 'ARS' },
      ],

      bankInfo: {
        titular: 'Alquimia SRL',
        alias: 'alquimia.ads.mp',
        cbu: '0000000000000000000000',
        observaciones: 'Enviar comprobante al confirmar el pago.',
      },
    },

    // Módulo 4 — Objetivo ecommerce (Tienda Nube)
    ecommerceGoal: {
      target: 250000000,
      // Estos se llenarán con la API de Tienda Nube:
      current: 110000000,
      orders: 1240,
    },

    // Módulo 5 — Objetivos Meta
    metaGoal: {
      revenueTarget: 200000000,
      roasTarget: 10,
      spendTarget: 20000000,
    },

    // Módulo 6 — Justificación de objetivos (desplegable)
    hypotheses: {
      points: [
        'ROAS 12 alcanzado en Hot Sale.',
        'Estacionalidad favorable por invierno.',
        'Aguinaldo.',
        'Falta de stock en mayo.',
        'Nuevos productos en testeo.',
      ],
      conclusion: 'Objetivo de ROAS 10 considerado viable.',
    },

    // Módulo 7 — Productos estratégicos (se enriquecen con Tienda Nube)
    strategicProducts: [
      { name: 'Sweater Oversize Lana', sku: 'MK-SW-001' },
      { name: 'Cardigan Trenzado', sku: 'MK-CG-014' },
      { name: 'Buzo Polar Premium', sku: 'MK-BZ-007' },
    ],

    // Módulo 8 — Consideraciones y riesgos (desplegable)
    considerations: [
      { title: 'Riesgo 1', text: 'Estamos testeando nuevos productos.' },
      { title: 'Riesgo 2', text: 'Impacto potencial del Mundial sobre el comportamiento de compra.' },
    ],
  },

  // Clientes futuros (inactivos por ahora)
  estancias: { slug: 'estancias', name: 'Estancias', active: false },
  cameo: { slug: 'cameo', name: 'Cameo', active: false },
  chenal: { slug: 'chenal', name: 'Chenal', active: false },
};

export const CLIENT_LIST = Object.values(CLIENTS);

export function getClient(slug) {
  return CLIENTS[slug] || null;
}
