/**
 * modules/ui-components.js — SimNego v3.2
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo: componentes de UI reutilizables
 * Fase 1 — Día 1 del plan de modularización
 *
 * Funciones incluidas (copiadas de app.js — NO eliminadas aún):
 *   - fmt        → formateadores de números/fechas
 *   - finRow     → fila de estado financiero
 *   - finRowSub  → fila subtotal de estado financiero
 *   - escapeHtml → sanitización HTML
 *   - toast      → notificaciones UI
 *
 * NOTA: estas funciones también existen en app.js durante el período de
 * transición. Una vez verificado el módulo 24h en producción, se comentarán
 * en app.js. No hay conflicto — las definiciones son idénticas.
 *
 * Reversión: comentar <script src="modules/ui-components.js"> en index.html
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Redondeo ──────────────────────────────────────────────────────────────────
/**
 * Redondeo comercial a n decimales (2 por defecto): la mitad se aleja de cero
 * (56,565 → 56,57; −56,565 → −56,57). Única función de redondeo de las
 * pantallas: la usan fmt.d (app.js y este archivo) y costosUnitariosEquipo.
 *
 * Opera sobre el decimal que JavaScript imprime (String(x)) y corre el exponente
 * por texto: "56.565e2" es 5656,5 exacto. toFixed redondea el valor BINARIO
 * (56,565 se guarda como 56,56499999…) y daba 56,56; multiplicar por 10^n también
 * falla (8,575 × 100 = 857,4999…), aun sumando Number.EPSILON. El split por 'e'
 * cubre la notación científica (1e-7).
 *
 * @param {number} x
 * @param {number} [n=2] decimales
 * @returns {number}
 */
function redondear(x, n) {
  n = n === undefined ? 2 : n;
  x = Number(x);
  if (!isFinite(x) || x === 0) return 0;
  var partes = String(Math.abs(x)).split('e');
  var entero = Math.round(Number(partes[0] + 'e' + (Number(partes[1] || 0) + n)));
  return (x < 0 ? -1 : 1) * Number(entero + 'e' + (-n));
}

// ── Formateadores ─────────────────────────────────────────────────────────────
/**
 * Objeto de utilidades de formato
 * Sobrescribe el fmt de app.js si ya existe (son idénticos)
 */
if (typeof window !== 'undefined') {
  window.fmt = window.fmt || {
    bs:  function(v) { return 'Bs ' + ((+v||0).toLocaleString('es-BO', {maximumFractionDigits:0})); },
    num: function(v) { return (+v||0).toLocaleString('es-BO', {maximumFractionDigits:0}); },
    pct: function(v) { return (((+v||0)*100).toFixed(2)) + '%'; },
    d:   function(v, n) { n = n !== undefined ? n : 2; return redondear(+v||0, n).toFixed(n); },
    dt:  function(s) { return s ? new Date(s).toLocaleString('es-BO', {dateStyle:'short', timeStyle:'short'}) : '—'; },
  };
}

// ── Filas de estados financieros ──────────────────────────────────────────────
/**
 * Genera una fila de estado financiero
 * @param {string} label  - Etiqueta de la fila
 * @param {number} value  - Valor monetario
 * @param {boolean} bold  - Si la fila va en negrita
 * @param {string} type   - 'pos' | 'neg' | 'neutral'
 * @returns {string} HTML de la fila
 */
function finRow(label, value, bold, type) {
  bold = bold || false;
  type = type || 'neutral';
  var col = type === 'pos' ? 'var(--accent5)' : type === 'neg' ? 'var(--accent4)' : 'var(--text)';
  var w = bold ? 'font-weight:700' : '';
  return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:.83rem;' + w + '">'
    + '<span style="color:var(--text2)">' + label + '</span>'
    + '<span style="font-family:var(--font-mono);font-size:.8rem;color:' + col + '">' + fmt.bs(value) + '</span>'
    + '</div>';
}

/**
 * Genera una fila de subtotal de estado financiero
 * @param {string} label  - Etiqueta del subtotal
 * @param {number} value  - Valor monetario
 * @param {boolean} bold  - Si va en negrita (default true)
 * @returns {string} HTML de la fila subtotal
 */
function finRowSub(label, value, bold) {
  bold = bold !== undefined ? bold : true;
  var col = value >= 0 ? 'var(--accent5)' : 'var(--accent4)';
  return '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:.85rem;font-weight:700;margin-top:2px">'
    + '<span>' + label + '</span>'
    + '<span style="font-family:var(--font-mono);color:' + col + '">' + fmt.bs(value) + '</span>'
    + '</div>';
}

// ── Sanitización HTML ─────────────────────────────────────────────────────────
/**
 * Escapa caracteres especiales HTML para prevenir XSS
 * @param {string} str - String a escapar
 * @returns {string} String escapado
 */
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// ── Notificaciones toast ──────────────────────────────────────────────────────
/**
 * Muestra una notificación toast temporal
 * @param {string} msg    - Mensaje a mostrar
 * @param {string} type   - 'success' | 'error' | 'warning'
 */
function toast(msg, type) {
  type = type || 'success';
  var el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show ' + type;
  setTimeout(function() { el.className = 'toast'; }, 3000);
}

// ── Sección de estado financiero ──────────────────────────────────────────────
/**
 * Genera un encabezado de sección para estados financieros
 * @param {string} label - Título de la sección
 * @returns {string} HTML del encabezado
 */
function finSection(label) {
  return '<div style="font-size:.72rem;font-weight:700;text-transform:uppercase;'
    + 'letter-spacing:.08em;color:var(--text3);padding:10px 0 4px;margin-top:6px;'
    + 'border-top:1px solid var(--border2)">' + label + '</div>';
}

/**
 * Traduce la tasa de crecimiento de un segmento a su etiqueta de tendencia.
 *
 * Antes 'tendencia' era un campo GUARDADO, editable por un <select> del panel, y
 * 'tasaCrecimiento' un número independiente que nadie podía editar. Los dos venían de
 * la plantilla de industria ya coherentes entre sí, pero esa coherencia era obra del
 * autor del JSON, no del código: cambiar la etiqueta en el panel no alteraba el
 * crecimiento real, y guardar segmentos borraba la tasa (server.js, corregido).
 *
 * Ahora la etiqueta se DERIVA del número, que es el único dato que el motor consume
 * (engine.js:299). Una sola fuente de verdad.
 *
 * Umbrales confirmados contra los 6 segmentos reales de la plantilla
 * Calzados_COM540_1_2026_V2, donde la correspondencia era 1 a 1 sin excepciones:
 *   0.06 → "Alto crecimiento" (×3)   0.03 → "Creciente" (×2)   0 → "Estable" (×1)
 * "Decreciente" no aparece en ningún dato real; es la lectura obvia del patrón para
 * tasas negativas, y la cuarta opción que ya ofrecía el <select> anterior.
 *
 * @param {number} tasaCrecimiento  ej. 0.06
 * @returns {string} "Alto crecimiento" | "Creciente" | "Estable" | "Decreciente"
 */
function calcularTendencia(tasaCrecimiento) {
  var t = Number(tasaCrecimiento);
  if (!isFinite(t)) return 'Estable';   // sin dato → mercado plano, igual que el ?? 0 del motor
  if (t < 0)     return 'Decreciente';
  if (t >= 0.05) return 'Alto crecimiento';
  if (t >= 0.01) return 'Creciente';
  return 'Estable';
}

/**
 * Fase 1 de pantallas (D1) — costo variable unitario por producto, coherente con
 * el libro mayor. Lo usan KPIs (equipo-resultados.js) y la hoja (equipo-hoja.js).
 *
 *   MP neta por unidad  = costoVentas / unidades vendidas: el mismo monto que el
 *                          asiento costoVenta:prod_n (5.1.01). Sin ventas: inventario
 *                          PT valorizado / unidades; sin ninguna de las dos: cuVar
 *                          (MP consumida en la ronda).
 *   Calidad por unidad  = costoCalidadUnit (asiento calidad:prod_n, 5.2.22, ÷ producción).
 *   Redondeo: MP, calidad y precio sin IVA se redondean a centavos (redondear) y
 *   costo variable y margen se calculan desde esos valores ya redondeados: en
 *   pantalla costo variable + margen = precio sin IVA al centavo.
 *   Costo variable unit = MP + calidad. NO incluye transformación (costoBase ×
 *                          (1 − pctMateriaPrima)) ni costo adicional del canal:
 *                          ninguno de los dos entra al costo de ventas.
 *   Precio sin IVA      = ventasBrutas / unidades vendidas (4.1.01 del producto).
 *   Margen unitario     = precio sin IVA − costo variable unitario.
 *   Nómina por unidad   = nómina de operarios de la EMPRESA ÷ producción total de
 *                          la empresa: gasto del trimestre, no costo del producto.
 *
 * Verificado contra sim_mu8g6mzr R1-R20 (200 producto-ronda): 0 diferencias con
 * los asientos costoVenta y calidad, y la nómina igual al saldo de 5.2.06.
 *
 * @param {object} r         resultado de /api/resultados (con r.productos si hay varios)
 * @param {object} decision  decisión de la ronda (solo para la capacitación, en
 *                           simulaciones sin partida doble)
 * @returns {{productos: Array, nominaPeriodo: number, produccionTotal: number, nominaPorUnidad: (number|null)}}
 */
function costosUnitariosEquipo(r, decision) {
  var n = function (v) { return Number(v) || 0; };
  if (!r) return { productos: [], nominaPeriodo: 0, produccionTotal: 0, nominaPorUnidad: null };
  var prods = (Array.isArray(r.productos) && r.productos.length) ? r.productos : [r];
  var productos = prods.map(function (p) {
    var vend = n(p.ventasReales);
    // ADR-005 — costeo por absorción: el costo de ventas incluye el costo fijo
    // aplicado; el costo VARIABLE por unidad sale de su parte variable (MP + gastos
    // indirectos variables, engine.js costoVentasVariable). En costeo variable no
    // existe ese campo y todo sigue igual.
    var costoVentasVar = p.costoVentasVariable !== undefined ? n(p.costoVentasVariable) : n(p.costoVentas);
    var mpUnit = redondear(vend > 0 ? costoVentasVar / vend
      : n(p.inventarioFinal) > 0 ? n(p.invFinalValorizado) / n(p.inventarioFinal)
      : n(p.cuVar), 2);
    var calidadUnit = redondear(n(p.costoCalidadUnit), 2);
    // SimMkt v0.5 — decisión 1 del docente: en absorción con el módulo de mezcla,
    // el costo de las características ya está dentro de costoVentasVariable; se
    // muestra aparte y se descuenta de la materia prima para no contarlo dos veces
    // (costo variable unitario = parte variable del costo de ventas por unidad).
    if (n(p.costoCaracteristicasAbsorbido) > 0 && vend > 0) mpUnit = redondear(mpUnit - calidadUnit, 2);
    var cvUnit = redondear(mpUnit + calidadUnit, 2);
    var precioSinIVA = vend > 0 ? redondear(n(p.ventasBrutas) / vend, 2) : null;
    return {
      productoId: p.productoId || 'prod_1', producto: p.producto || '',
      precioConIVA: n(p.precioVenta), precioSinIVA: precioSinIVA,
      mpUnit: mpUnit, calidadUnit: calidadUnit, cvUnit: cvUnit,
      margenUnit: precioSinIVA !== null ? redondear(precioSinIVA - cvUnit, 2) : null,
      vendidas: vend, produccion: n(p.produccion),
    };
  });
  var produccionTotal = productos.reduce(function (s, x) { return s + x.produccion; }, 0);
  var nominaPeriodo;
  var p1n = prods.filter(function (p) { return (p.productoId || 'prod_1') === 'prod_1'; })[0] || prods[0];
  var enAbsorcion = p1n && p1n.costoFijoFabricacionEmpresa !== undefined;
  if (r.fuenteER === 'partida_doble' && !enAbsorcion) {
    nominaPeriodo = n(r.pagoOperarios);                        // saldo de 5.2.06
  } else {
    // También en absorción (ADR-005): la nómina va a 5.1.10, no a 5.2.06, así que
    // se toma de Motor 1, igual que sin partida doble.
    // Motor 1: los costos comunes van en prod_1, y costoOperarios incluye
    // contratación, despido y capacitación (engine.js:599-601): se descuentan.
    var p1 = prods.filter(function (p) { return (p.productoId || 'prod_1') === 'prod_1'; })[0] || prods[0];
    nominaPeriodo = n(p1.costoOperarios) - n(p1.costoContratacion) - n(p1.costoDespido)
      - n(decision && decision.montoCapacitacion);
  }
  return {
    productos: productos, nominaPeriodo: nominaPeriodo, produccionTotal: produccionTotal,
    nominaPorUnidad: produccionTotal > 0 ? nominaPeriodo / produccionTotal : null,
  };
}

console.log('[ui-components] ✅ Módulo cargado — redondear, fmt, finRow, finRowSub, escapeHtml, toast, finSection, calcularTendencia, costosUnitariosEquipo');
