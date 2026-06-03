// Utilidades de presupuesto: montos multi-moneda y componente variable.

export function fmtMoney(amount, currency = 'ARS') {
  if (amount == null || isNaN(amount)) return '—';
  if (currency === 'USD') {
    return 'USD ' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(amount);
  }
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(amount);
}

// Calcula el monto del componente variable de alquimia.
export function variableAmount(budget, facturacion) {
  const v = budget.variable;
  if (!v) return 0;
  const diff = Math.max(0, (facturacion || 0) - (v.baseInicial || 0));
  return diff * (v.rate || 0);
}

// Devuelve el monto "efectivo" de un ítem (0 si está bonificado).
function lineEffective(line) {
  if (line.bonificado) return 0;
  return line.amount || 0;
}

// Suma por moneda los ítems indicados. Devuelve { ARS, USD }.
// Resuelve breakdowns, bonificados (cuentan 0) y el componente variable.
export function sumByCurrency(items, { budget, facturacion } = {}) {
  const totals = { ARS: 0, USD: 0 };
  for (const item of items) {
    if (item.isVariable) continue;      // según facturación, no suma a un total fijo
    if (item.variableMonto) continue;   // monto a definir, no suma
    if (item.breakdown) {
      for (const b of item.breakdown) {
        totals[b.currency || 'ARS'] += lineEffective(b);
      }
    } else {
      totals[item.currency || 'ARS'] += lineEffective(item);
    }
  }
  return totals;
}

// Texto compacto de un total multi-moneda: "USD 2.450 · $950.000"
export function fmtTotals(totals) {
  const parts = [];
  if (totals.USD) parts.push(fmtMoney(totals.USD, 'USD'));
  if (totals.ARS) parts.push(fmtMoney(totals.ARS, 'ARS'));
  return parts.length ? parts.join(' · ') : '—';
}
