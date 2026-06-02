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

    // Módulo 2 — Roadmap semanal
    roadmap: [
      { week: 'Semana 1', goal: 'Planificación y preparación', status: 'finalizada' },
      { week: 'Semana 2', goal: 'Identificación de productos ganadores', status: 'en_curso' },
      { week: 'Semana 3', goal: 'Validación de productos ganadores', status: 'pendiente' },
      { week: 'Semana 4', goal: 'Escalamiento de productos seleccionados', status: 'pendiente' },
    ],

    // Módulo 3 — Presupuesto y pagos (mes siguiente)
    budget: {
      servicios: [
        { concept: 'Fee mensual', amount: 1500000, dueDate: '2026-07-05', status: 'pendiente' },
        { concept: 'Variable sobre resultados', amount: 800000, dueDate: '2026-07-05', status: 'pendiente' },
        { concept: 'Email Marketing', amount: 250000, dueDate: '2026-07-05', status: 'pendiente' },
        { concept: 'Gestión Web', amount: 300000, dueDate: '2026-07-05', status: 'pendiente' },
      ],
      medios: [
        { concept: 'Inversión Meta', amount: 20000000, dueDate: '2026-07-01', status: 'pendiente' },
        { concept: 'Inversión TikTok', amount: 5000000, dueDate: '2026-07-01', status: 'pendiente' },
      ],
      produccion: [
        { concept: 'Contenido', amount: 600000, dueDate: '2026-07-10', status: 'pendiente' },
        { concept: 'Actrices', amount: 400000, dueDate: '2026-07-10', status: 'pendiente' },
        { concept: 'Estudios', amount: 350000, dueDate: '2026-07-10', status: 'pendiente' },
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
