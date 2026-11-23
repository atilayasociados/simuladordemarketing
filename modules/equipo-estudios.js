/**
 * public/modules/equipo-estudios.js — SimMkt v0.6 (docente, 06-11-2026)
 *
 * Pantalla Investigación: cada estudio de mercado se presenta como un informe
 * profesional (formato aprobado por el docente):
 *   1. Índice con pestañas de los estudios comprados y los no comprados con su costo.
 *   2. Ficha técnica (ronda medida, base, margen de error, costo, comparación).
 *   3. Hallazgos clave (frases descriptivas, sin recomendar qué hacer).
 *   4. Gráfico principal (barras HTML/CSS: se imprimen y funcionan en celular).
 *   5. Variación frente a la ronda anterior, si el equipo compró el mismo estudio.
 *   6. Tabla de detalle, «Cómo leer este estudio» y «Preguntas para tu decisión».
 * Solo usa los datos que el estudio ya entrega: no agrega información no comprada.
 * Referencias de formato: estructura del informe de investigación (resumen,
 * metodología, hallazgos con gráficos y tablas, anexos); embudo de marca (Kantar);
 * distribución numérica y ventas por punto de distribución (NielsenIQ).
 * Depende de equipo-mezcla.js (mmEsc, mmBs, mmMapaSVG, mmMapas, mmContadorMapas).
 */

var MME_PALETA = [
  { bg: '#7fa8d8', tx: '#0e1e35' }, { bg: '#4a78ae', tx: '#ffffff' }, { bg: '#b8c8d8', tx: '#0e1e35' },
  { bg: '#2c5180', tx: '#ffffff' }, { bg: '#5d6b7c', tx: '#ffffff' }, { bg: '#9fb7cf', tx: '#0e1e35' },
  { bg: '#3d6a9e', tx: '#ffffff' }, { bg: '#7d8a99', tx: '#0e1e35' },
];
var MME_PROPIO = { bg: '#e8a820', tx: '#0e1e35' };

// ── Formato (coma decimal, punto de miles) ───────────────────────────────
function mmeDec(x, d) { return (Number(x) || 0).toFixed(d == null ? 1 : d).replace('.', ','); }
function mmePct(x, d) { return mmeDec((Number(x) || 0) * 100, d == null ? 1 : d) + ' %'; }
function mmeNum(x) { var n = Math.round(Number(x) || 0); var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return (n < 0 ? '−' : '') + s; }
function mmeTrim(n) { return 'T' + (((Number(n) || 1) - 1) % 4 + 1); }
function mmeVar(delta, unidad, dec) {
  if (delta == null || !isFinite(delta)) return '';
  var v = Number(delta), d = dec == null ? 1 : dec;
  var r = Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
  if (r === 0) return '<span class="mme-eq">= 0' + (unidad || '') + '</span>';
  return '<span class="' + (r > 0 ? 'mme-up' : 'mme-down') + '">' + (r > 0 ? '▲ +' : '▼ −') + mmeDec(Math.abs(r), d) + (unidad || '') + '</span>';
}
function mmeVarPP(actual, anterior) { return anterior == null ? '' : mmeVar((actual - anterior) * 100, ' pts'); }
function mmeVarRel(actual, anterior) { return !(anterior > 0) ? '' : mmeVar((actual - anterior) / anterior * 100, ' %'); }

// ── Marca propia ─────────────────────────────────────────────────────────
function mmeNombreEquipo() { try { return (typeof state !== 'undefined' && state && state.me && state.me.nombre) || ''; } catch (e) { return ''; } }
function mmeEsPropia(x) {
  if (!x) return false;
  if (x.propia) return true;
  var eq = mmeNombreEquipo();
  if (!eq) return false;
  if (x.empresa != null) return x.empresa === eq;
  return String(x.marca || '').indexOf(eq + ' — ') === 0;
}
function mmeMarca(x) { var t = mmEsc(x.marca || x.empresa || '—'); return mmeEsPropia(x) ? '<span class="mme-propia">' + t + ' (tú)</span>' : t; }

// ── Piezas gráficas ──────────────────────────────────────────────────────
function mmeBarra(frac, color, ancho) {
  var w = Math.max(0, Math.min(1, Number(frac) || 0)) * 100;
  return '<div class="mme-barra"' + (ancho ? ' style="max-width:' + ancho + '"' : '') + '><div style="width:' + w.toFixed(1) + '%;background:' + color + '"></div></div>';
}
function mmeApilada(partes) {
  // partes: [{frac, color:{bg,tx}, etiqueta, titulo}]
  return '<div class="mme-apilada">' + partes.map(function (p) {
    var w = Math.max(0, (Number(p.frac) || 0) * 100);
    return '<div style="width:' + w.toFixed(2) + '%;background:' + p.color.bg + ';color:' + p.color.tx + '" title="' + mmEsc(p.titulo || '') + '">' + (w >= 7 ? mmEsc(p.etiqueta || '') : '') + '</div>';
  }).join('') + '</div>';
}
function mmeLeyenda(items) {
  return '<div class="mme-leyenda">' + items.map(function (i) { return '<span><i style="background:' + i.color + '"></i>' + i.texto + '</span>'; }).join('') + '</div>';
}
function mmeGrafico(titulo, cuerpo, fuente) {
  return '<div class="mme-graf"><h4>' + titulo + '</h4>' + cuerpo + (fuente ? '<div class="mme-fuente">' + fuente + '</div>' : '') + '</div>';
}
function mmeTabla(cols, filas, alinear) {
  return '<div class="mme-tabla"><table class="hoja-table"><thead><tr>' + cols.map(function (c, i) { return '<th' + (alinear && alinear[i] === 'd' ? ' style="text-align:right"' : '') + '>' + mmEsc(c) + '</th>'; }).join('')
    + '</tr></thead><tbody>' + filas.map(function (f) {
      return '<tr' + (f.propia ? ' class="mme-fila-propia"' : '') + '>' + f.celdas.map(function (v, i) { return '<td' + (alinear && alinear[i] === 'd' ? ' style="text-align:right"' : '') + '>' + v + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table></div>';
}
function mmeFila(etiqueta, centro, derecha) { return '<div class="mme-fila"><div>' + etiqueta + '</div><div>' + centro + '</div><div class="mme-der">' + (derecha || '') + '</div></div>'; }
function mmeColorDe(i, propia) { return propia ? MME_PROPIO : MME_PALETA[i % MME_PALETA.length]; }
function mmeRanking(lista, valor) { var o = lista.slice().sort(function (a, b) { return valor(b) - valor(a); }); return o; }

// ── Textos fijos por estudio ─────────────────────────────────────────────
var MME_TEXTOS = {
  informe_industria: {
    sub: 'Tamaño del mercado por segmento, participación y precio promedio de cada empresa',
    leer: ['<strong>Demanda del trimestre</strong>: unidades que el segmento quiso comprar en el trimestre.',
      '<strong>Participación en la industria</strong>: ventas de la empresa ÷ ventas de todas las empresas.',
      '<strong>Precio promedio</strong>: ingreso a precio de lista ÷ unidades vendidas.'],
    preg: ['¿Tu empresa está en los segmentos que más demandan o en los más pequeños?',
      '¿Tu precio promedio es coherente con tu posición frente al líder?'] },
  panel_consumidores: {
    sub: 'Participación de mercado y ventas de cada marca por segmento',
    leer: ['<strong>Participación de mercado</strong>: ventas de la marca en el segmento ÷ ventas de todas las marcas del segmento.',
      '<strong>Variación en puntos</strong>: participación de esta ronda − participación de la ronda anterior. Variaciones menores al margen de error pueden ser ruido.',
      '<strong>Elasticidad</strong>: cambio % de las ventas ÷ cambio % del precio entre dos rondas.'],
    preg: ['¿En qué segmentos ganas participación y en cuáles la pierdes? ¿Coincide con tu mercado meta?',
      '¿Qué hizo diferente la marca que más ganó: precio, comunicación o distribución?'] },
  encuesta_consumidores: {
    sub: 'Embudo de marca: notoriedad, intención de compra y criterios de compra por segmento',
    leer: ['<strong>Notoriedad</strong>: % del segmento que conoce la marca.',
      '<strong>Intención de compra</strong>: % del segmento que elegiría la marca.',
      '<strong>Conversión</strong>: intención ÷ notoriedad; de cada 100 que conocen la marca, cuántos la elegirían.',
      '<strong>Potencial frente a real</strong>: la preferencia que tu producto genera frente a la participación que logró vender; la diferencia son ventas que no capturaste (por ejemplo, por falta de inventario o de cobertura).'],
    preg: ['¿Tu problema es que no te conocen (notoriedad) o que te conocen y no te eligen (conversión)?',
      '¿Tu producto destaca en el criterio de compra más importante del segmento?',
      '¿Qué medio o mensaje usarías para mejorar la etapa más débil del embudo?'] },
  panel_distribucion: {
    sub: 'Cobertura y ventas de cada marca por canal',
    leer: ['<strong>Cobertura</strong>: parte del canal donde la marca está disponible (0 a 100 %).',
      '<strong>Ventas por punto de cobertura</strong>: ventas del canal ÷ puntos de cobertura; mide qué tan bien vende la marca donde sí está.'],
    preg: ['¿Tu problema es estar en pocos puntos de venta o vender poco donde sí estás?',
      '¿En qué canal tu competidor principal te supera en cobertura?'] },
  puntos_ideales: {
    sub: 'Qué combinación de características busca cada segmento y dónde están los productos',
    leer: ['<strong>Punto ideal</strong>: la combinación de características (1 a 10) que el segmento preferiría. Lleva el margen de error del estudio.',
      '<strong>Brecha</strong>: tu producto − ideal. Negativa: te falta; positiva: te pasaste (pagas un costo que el segmento no valora).',
      'Lo que cuenta es la cercanía al ideal, sobre todo en las características que más pesan en el segmento (Análisis conjoint).'],
    preg: ['¿Qué brecha cerrarías primero con un proyecto de I+D y cuánto costaría?',
      '¿Te conviene acercarte a este segmento o a otro cuyo ideal esté más cerca de tu producto?'] },
  pronostico_mercado: {
    sub: 'Crecimiento y estacionalidad esperados por segmento',
    leer: ['<strong>Crecimiento por trimestre</strong>: tasa de crecimiento de fondo de la demanda del segmento.',
      '<strong>Estacionalidad</strong>: índice de cada trimestre (1 = trimestre normal; más de 1 = temporada alta).'],
    preg: ['¿Tu producción y tus compras de materia prima anticipan la temporada alta de tus segmentos?',
      '¿Hay un segmento de alto crecimiento donde todavía no compites?'] },
  inteligencia_competitiva: {
    sub: 'Gasto estimado de los competidores en comunicación y distribución',
    leer: ['<strong>Gasto estimado</strong>: inversión de cada competidor en el trimestre, con margen de error.',
      '<strong>Participación de la voz</strong>: tu inversión en comunicación ÷ la de toda la industria (tú + competidores). Tu propio gasto va sin error.'],
    preg: ['¿Tu inversión en comunicación es suficiente frente a la del competidor que más invierte?',
      '¿Quién invierte más en distribución y en qué canales podría estar ganándote cobertura?'] },
  analisis_conjoint: {
    sub: 'Importancia de cada característica y sensibilidad al precio por segmento',
    leer: ['<strong>Importancia</strong>: peso de cada característica en la decisión de compra del segmento (suma 100 %).',
      '<strong>Sensibilidad al precio</strong>: cuánto cae la preferencia cuando sube el precio; más alta = segmento más sensible.'],
    preg: ['¿Invertirías en I+D en la característica que más pesa en tu segmento meta?',
      '¿Tu segmento tolera un precio más alto o es muy sensible al precio?'] },
  prueba_concepto: {
    sub: 'Aceptación estimada de un prototipo en un segmento (0 a 100)',
    leer: ['<strong>Aceptación</strong>: qué tan cerca está el prototipo del punto ideal del segmento, según cuánto le importa cada característica.',
      '<strong>Intervalo</strong>: rango probable según el margen de error del estudio.',
      'Lectura orientativa: 70 o más, alta; de 40 a 69, media; menos de 40, baja.'],
    preg: ['¿Vale la pena el proyecto de I+D para llegar a este prototipo, frente a su costo?',
      '¿Qué característica del prototipo cambiarías para subir la aceptación?'] },
};

// ── Hallazgos, gráficos y detalle por estudio ───────────────────────────
function mmeInforme(e, prev) {
  var segs = e.segmentos || [], emp = e.empresas || [];
  var prevSeg = {}, prevEmp = {};
  if (prev) { (prev.segmentos || []).forEach(function (s) { prevSeg[s.segmento] = s.demanda; }); (prev.empresas || []).forEach(function (x) { prevEmp[x.empresa] = x.cuota; }); }
  var orden = mmeRanking(emp, function (x) { return x.cuota; });
  var propia = orden.filter(mmeEsPropia)[0], puesto = propia ? orden.indexOf(propia) + 1 : 0;
  var mayor = mmeRanking(segs, function (s) { return s.demanda; })[0];
  var hall = [];
  if (mayor) hall.push('El segmento de mayor demanda es <strong>' + mmEsc(mayor.segmento) + '</strong>: ' + mmeNum(mayor.demanda) + ' unidades en el trimestre.');
  var nadieVende = !emp.some(function (x) { return (x.cuota || 0) > 0; });
  if (nadieVende) hall.push('Ninguna empresa registró ventas en este trimestre: todavía no hay participaciones ni puestos.');
  else if (propia && !(propia.cuota > 0)) hall.push('Tu empresa no registró ventas en este trimestre.');
  else if (propia) hall.push('Tu empresa tiene <strong>' + mmePct(propia.cuota) + '</strong> de las ventas de la industria (puesto ' + puesto + ' de ' + orden.length + ')' + (prevEmp[propia.empresa] != null ? ' ' + mmeVarPP(propia.cuota, prevEmp[propia.empresa]) + ' frente a la ronda anterior' : '') + '.');
  if (!nadieVende && orden[0] && orden[0] !== propia) hall.push('Líder de la industria: <strong>' + mmEsc(orden[0].empresa) + '</strong> con ' + mmePct(orden[0].cuota) + ' y precio promedio ' + mmBs(orden[0].precioPromedio) + '.');
  var maxD = Math.max.apply(null, [1].concat(segs.map(function (s) { return s.demanda || 0; })));
  var g1 = segs.map(function (s) { return mmeFila(mmEsc(s.segmento), mmeBarra(s.demanda / maxD, '#7fa8d8'), mmeNum(s.demanda) + ' u ' + mmeVarRel(s.demanda, prevSeg[s.segmento])); }).join('');
  var maxC = Math.max.apply(null, [0.0001].concat(emp.map(function (x) { return x.cuota || 0; })));
  var g2 = orden.map(function (x) { var p = mmeEsPropia(x); return mmeFila(p ? '<span class="mme-propia">' + mmEsc(x.empresa) + ' (tú)</span>' : mmEsc(x.empresa), mmeBarra(x.cuota / maxC, p ? MME_PROPIO.bg : '#4a78ae'), mmePct(x.cuota) + ' ' + mmeVarPP(x.cuota, prevEmp[x.empresa]) + ' · ' + mmBs(x.precioPromedio)); }).join('');
  var graf = mmeGrafico('Gráfico 1. Demanda del trimestre por segmento (unidades)', g1, prev ? 'Variación: frente a la demanda de la ronda anterior.' : '')
    + mmeGrafico('Gráfico 2. Participación en las ventas de la industria y precio promedio', mmeLeyenda([{ color: MME_PROPIO.bg, texto: 'Tu empresa' }, { color: '#4a78ae', texto: 'Competidores' }]) + g2,
      e.numeroEmpresas != null ? 'Empresas en la industria: ' + e.numeroEmpresas + '.' : '');
  var det = '';
  if ((e.preciosSegmento || []).length) det += '<h5>Precios de lista por segmento</h5>' + mmeTabla(['Segmento', 'Mínimo', 'Promedio (ponderado por ventas)', 'Máximo'], e.preciosSegmento.map(function (p) { return { celdas: [mmEsc(p.segmento), mmBs(p.minimo), mmBs(p.promedio), mmBs(p.maximo)] }; }), ['i', 'd', 'd', 'd']);
  if ((e.productos || []).length) det += '<h5>Productos de cada empresa</h5>' + mmeTabla(['Empresa', 'Producto', 'Segmentos', 'Precio de lista'], e.productos.map(function (p) { return { propia: mmeEsPropia({ empresa: p.empresa }), celdas: [mmEsc(p.empresa), mmEsc(p.producto), mmEsc((p.segmentos || []).join(' · ')), mmBs(p.precioLista)] }; }), ['i', 'i', 'i', 'd']);
  if ((e.capturaPropia || []).length) det += '<h5>% de la demanda capturada (tus productos)</h5>' + mmeTabla(['Producto', 'Segmento', 'Ventas (u)', '% de la demanda del segmento'], e.capturaPropia.map(function (c) { return { celdas: [mmEsc(c.producto), mmEsc(c.segmento), mmeNum(c.ventas), mmePct(c.porcentaje)] }; }), ['i', 'i', 'd', 'd']);
  return { hall: hall, graf: graf, det: det, base: 'Toda la industria · ' + segs.length + ' segmentos' };
}

function mmePanel(e, prev) {
  var segs = e.segmentos || [];
  var prevC = {};
  if (prev) (prev.segmentos || []).forEach(function (s) { (s.marcas || []).forEach(function (m) { prevC[s.segmento + '|' + m.marca] = m.cuota; }); });
  var propias = [];
  segs.forEach(function (s) {
    var o = mmeRanking(s.marcas || [], function (m) { return m.cuota; });
    o.forEach(function (m, i) { if (mmeEsPropia(m)) propias.push({ seg: s.segmento, m: m, puesto: i + 1, n: o.length, prev: prevC[s.segmento + '|' + m.marca] }); });
  });
  var hall = [];
  var propiasCero = propias.filter(function (p) { return !(p.m.cuota > 0); });
  propias = propias.filter(function (p) { return p.m.cuota > 0; });
  if (propiasCero.length && !propias.length) hall.push('Tu marca no registró ventas en los segmentos donde compite (' + propiasCero.map(function (p) { return mmEsc(p.seg); }).join(', ') + ').');
  if (propias.length) {
    var mejor = mmeRanking(propias, function (p) { return p.m.cuota; });
    var b = mejor[0], w = mejor[mejor.length - 1];
    hall.push('Tu mejor posición: <strong>' + mmEsc(b.seg) + '</strong>, ' + mmePct(b.m.cuota) + ' (puesto ' + b.puesto + ' de ' + b.n + ')' + (b.prev != null ? ' ' + mmeVarPP(b.m.cuota, b.prev) : '') + '.');
    if (w !== b) hall.push('Tu posición más débil: <strong>' + mmEsc(w.seg) + '</strong>, ' + mmePct(w.m.cuota) + ' (puesto ' + w.puesto + ' de ' + w.n + ').');
    var conPrev = propias.filter(function (p) { return p.prev != null; });
    if (conPrev.length) {
      var mc = mmeRanking(conPrev, function (p) { return Math.abs(p.m.cuota - p.prev); })[0];
      hall.push('Tu mayor cambio frente a la ronda anterior: <strong>' + mmEsc(mc.seg) + '</strong> ' + mmeVarPP(mc.m.cuota, mc.prev) + '.');
    }
  } else if (!propiasCero.length) hall.push('Tu marca no registra ventas en los segmentos medidos.');
  var lideres = segs.map(function (s) { var o = mmeRanking(s.marcas || [], function (m) { return m.cuota; }); return o[0]; }).filter(Boolean);
  if (lideres.length && !propias.length) hall.push('Marca líder del primer segmento: ' + mmEsc(lideres[0].marca) + ' con ' + mmePct(lideres[0].cuota) + '.');
  var g = segs.map(function (s) {
    var o = mmeRanking(s.marcas || [], function (m) { return m.cuota; }), ci = 0;
    var total = o.reduce(function (a, m) { return a + (m.cuota || 0); }, 0) || 1;
    var partes = o.map(function (m) { var p = mmeEsPropia(m); return { frac: (m.cuota || 0) / Math.max(1, total), color: p ? MME_PROPIO : mmeColorDe(ci++, false), etiqueta: Math.round((m.cuota || 0) * 100) + '', titulo: m.marca + ': ' + mmePct(m.cuota) }; });
    var pr = o.filter(mmeEsPropia)[0];
    return mmeFila(mmEsc(s.segmento) + '<div class="mme-nota">' + o.length + ' marca(s)</div>', mmeApilada(partes), pr ? '<span class="mme-propia">' + mmePct(pr.cuota) + '</span> ' + mmeVarPP(pr.cuota, prevC[s.segmento + '|' + pr.marca]) : '<span class="mme-eq">sin ventas</span>');
  }).join('');
  var graf = mmeGrafico('Gráfico 1. Participación de mercado por segmento (100 % = ventas del segmento)',
    mmeLeyenda([{ color: MME_PROPIO.bg, texto: 'Tu marca' }, { color: MME_PALETA[0].bg, texto: 'Competidores (pasa el cursor para ver el nombre; detalle en la tabla)' }]) + g,
    'Columna derecha: tu participación' + (prev ? ' y su variación en puntos frente a la ronda anterior' : '') + '.');
  var det = segs.map(function (s) {
    var o = mmeRanking(s.marcas || [], function (m) { return m.cuota; });
    return '<h5>' + mmEsc(s.segmento) + '</h5>' + mmeTabla(['Puesto', 'Marca', 'Participación', 'Variación', 'Ventas (u)'], o.map(function (m, i) {
      return { propia: mmeEsPropia(m), celdas: [String(i + 1), mmeMarca(m), mmePct(m.cuota), mmeVarPP(m.cuota, prevC[s.segmento + '|' + m.marca]) || '—', mmeNum(m.ventas)] }; }), ['i', 'i', 'd', 'd', 'd']);
  }).join('');
  if ((e.elasticidades || []).length) {
    graf += mmeGrafico('Elasticidad precio observada (ronda anterior → esta ronda)', mmeTabla(['Marca', 'Precio de lista', 'Ventas (u)', 'Elasticidad', 'Tipo'], e.elasticidades.map(function (x) {
      return { propia: mmeEsPropia(x), celdas: [mmeMarca(x), mmBs(x.precioAnterior) + ' → ' + mmBs(x.precioActual), mmeNum(x.ventasAnterior) + ' → ' + mmeNum(x.ventasActual), mmeDec(x.elasticidad, 2), mmEsc(x.tipo)] }; }), ['i', 'd', 'd', 'd', 'i'])
      + '<ul class="mme-lista">' + e.elasticidades.map(function (x) { return '<li>' + mmEsc(x.texto) + '</li>'; }).join('') + '</ul>',
      'Es una observación entre dos rondas: otros factores (competencia, comunicación, estacionalidad) también influyen.');
  }
  return { hall: hall, graf: graf, det: det, base: segs.length + ' segmentos · ventas en unidades' };
}

function mmeEncuesta(e, prev) {
  var segs = e.segmentos || [];
  var prevM = {};
  if (prev) (prev.segmentos || []).forEach(function (s) { (s.marcas || []).forEach(function (m) { prevM[s.segmento + '|' + m.marca] = m; }); });
  var conv = function (m) { return m.notoriedad > 0 ? Math.min(1, m.intencionCompra / m.notoriedad) : 0; };
  var segsPropios = segs.filter(function (s) { return (s.marcas || []).some(mmeEsPropia); });
  var principal = segsPropios[0] || segs[0];
  var hall = [];
  if (principal) {
    var ms = principal.marcas || [];
    var pr = ms.filter(mmeEsPropia)[0];
    var lN = mmeRanking(ms, function (m) { return m.notoriedad; })[0];
    var lI = mmeRanking(ms, function (m) { return m.intencionCompra; })[0];
    if (pr) {
      var pv = prevM[principal.segmento + '|' + pr.marca];
      hall.push('En <strong>' + mmEsc(principal.segmento) + '</strong>, tu marca es conocida por el <strong>' + mmePct(pr.notoriedad, 0) + '</strong> del segmento' + (pv ? ' ' + mmeVarPP(pr.notoriedad, pv.notoriedad) : '') + (lN && lN !== pr ? '; la más conocida llega al ' + mmePct(lN.notoriedad, 0) : '') + '.');
      hall.push('De quienes te conocen, el <strong>' + mmePct(conv(pr), 0) + '</strong> te elegiría' + (lI && lI !== pr ? '; en la marca con más intención de compra, el ' + mmePct(conv(lI), 0) : '') + '.');
    }
    if ((principal.criterios || []).length) hall.push('Criterio de compra más importante en ' + mmEsc(principal.segmento) + ': <strong>' + mmEsc(principal.criterios[0]) + '</strong>.');
  }
  var brecha = (e.propios || []).filter(function (p) { return p.unidadesNoCapturadas > 0; });
  if (brecha.length) { var mx = mmeRanking(brecha, function (p) { return p.unidadesNoCapturadas; })[0]; hall.push('Demanda que no capturaste: <strong>' + mmeNum(mx.unidadesNoCapturadas) + ' u</strong> de ' + mmEsc(mx.producto) + ' en ' + mmEsc(mx.segmento) + '.'); }

  var embudo = function (s) {
    var ms = (s.marcas || []).slice().sort(function (a, b) { return (mmeEsPropia(b) - mmeEsPropia(a)) || (b.notoriedad - a.notoriedad); });
    return '<div class="mme-scroll"><div class="mme-embudo"><div class="mme-th">Marca</div><div class="mme-th">Notoriedad</div><div class="mme-th">Intención de compra</div><div class="mme-th mme-der">Conversión</div>'
      + ms.map(function (m) {
        var p = mmeEsPropia(m), c = p ? MME_PROPIO.bg : '#4a78ae', pv = prevM[s.segmento + '|' + m.marca];
        return '<div>' + mmeMarca(m) + '</div>'
          + '<div class="mme-celda">' + mmeBarra(m.notoriedad, c) + '<span>' + mmePct(m.notoriedad, 0) + (pv ? ' ' + mmeVarPP(m.notoriedad, pv.notoriedad) : '') + '</span></div>'
          + '<div class="mme-celda">' + mmeBarra(m.intencionCompra, c) + '<span>' + mmePct(m.intencionCompra, 0) + (pv ? ' ' + mmeVarPP(m.intencionCompra, pv.intencionCompra) : '') + '</span></div>'
          + '<div class="mme-der' + (p ? ' mme-propia' : '') + '">' + mmePct(conv(m), 0) + '</div>';
      }).join('') + '</div></div>'
      + ((s.criterios || []).length ? '<div class="mme-nota">Criterios de compra, de más a menos importante: <strong>' + mmEsc(s.criterios.join(' › ')) + '</strong>. El peso exacto lo da el Análisis conjoint.</div>' : '');
  };
  var graf = mmeGrafico('Gráfico 1. Embudo de marca por segmento', mmeLeyenda([{ color: MME_PROPIO.bg, texto: 'Tu marca' }, { color: '#4a78ae', texto: 'Competidores' }])
    + segs.map(function (s) {
      var esP = segsPropios.indexOf(s) >= 0;
      return '<details class="mme-seg"' + (esP || (!segsPropios.length && s === segs[0]) ? ' open' : '') + '><summary>' + mmEsc(s.segmento) + (esP ? ' <span class="mme-propia">· compites aquí</span>' : '') + '</summary>'
        + (s.descripcion ? '<div class="mme-nota">' + mmEsc(s.descripcion) + '</div>' : '') + embudo(s) + '</details>';
    }).join(''), 'Conversión = intención de compra ÷ notoriedad.' + (prev ? ' Variaciones en puntos frente a la ronda anterior.' : ''));
  if ((e.propios || []).length) {
    graf += mmeGrafico('Gráfico 2. Tus productos: participación potencial frente a real',
      mmeLeyenda([{ color: '#7fa8d8', texto: 'Potencial (preferencia)' }, { color: MME_PROPIO.bg, texto: 'Real (ventas)' }])
      + e.propios.map(function (p) {
        return mmeFila(mmEsc(p.producto) + '<div class="mme-nota">' + mmEsc(p.segmento) + '</div>', mmeBarra(p.potencial, '#7fa8d8') + '<div style="height:4px"></div>' + mmeBarra(p.real, MME_PROPIO.bg),
          mmePct(p.potencial) + ' / ' + mmePct(p.real) + '<div class="mme-nota">' + mmeNum(p.unidadesNoCapturadas) + ' u no capturadas</div>');
      }).join(''), 'Potencial: lo que los consumidores eligen tu marca ÷ lo que eligen todas. Real: tu participación de mercado (la misma del Panel de consumidores).');
  }
  var det = segs.map(function (s) {
    return '<h5>' + mmEsc(s.segmento) + '</h5>' + mmeTabla(['Marca', 'Notoriedad', 'Intención de compra', 'Valor de marca (0-100)'], (s.marcas || []).map(function (m) {
      return { propia: mmeEsPropia(m), celdas: [mmeMarca(m), mmePct(m.notoriedad), mmePct(m.intencionCompra), m.valorMarca != null ? mmeDec(m.valorMarca, 0) : '—'] }; }), ['i', 'd', 'd', 'd']);
  }).join('');
  if ((e.propios || []).length) det += '<h5>Tus productos: potencial frente a real</h5>' + mmeTabla(['Producto', 'Segmento', 'Potencial', 'Real', 'Brecha (pts)', 'Demanda asignada (u)', 'Ventas (u)', 'No capturadas (u)'],
    e.propios.map(function (p) { return { celdas: [mmEsc(p.producto), mmEsc(p.segmento), mmePct(p.potencial), mmePct(p.real), mmeDec(p.brechaPP, 1), mmeNum(p.demandaAsignada), mmeNum(p.ventas), mmeNum(p.unidadesNoCapturadas)] }; }), ['i', 'i', 'd', 'd', 'd', 'd', 'd', 'd']);
  return { hall: hall, graf: graf, det: det, base: segs.length + ' segmentos' };
}

function mmeDistribucion(e, prev) {
  var marcas = (e.marcas || []).slice().sort(function (a, b) { return mmeEsPropia(b) - mmeEsPropia(a); });
  var canales = [];
  marcas.forEach(function (m) { (m.canales || []).forEach(function (c) { if (canales.indexOf(c.canal) < 0) canales.push(c.canal); }); });
  var prevCov = {};
  if (prev) (prev.marcas || []).forEach(function (m) { (m.canales || []).forEach(function (c) { prevCov[m.marca + '|' + c.canal] = c.cobertura; }); });
  var celda = function (m, canal) { return (m.canales || []).filter(function (c) { return c.canal === canal; })[0]; };
  var hall = [];
  var propias = marcas.filter(mmeEsPropia);
  propias.forEach(function (m) {
    var cs = mmeRanking(m.canales || [], function (c) { return c.cobertura; });
    if (!cs.length) return;
    var ult = cs[cs.length - 1], igual = cs.length > 1 && Math.abs(cs[0].cobertura - ult.cobertura) < 0.005;
    hall.push('<strong>' + mmEsc(m.marca) + '</strong>: ' + (igual ? 'cobertura de ' + mmePct(cs[0].cobertura, 0) + ' en sus ' + cs.length + ' canales' : 'mayor cobertura en ' + mmEsc(cs[0].canal) + ' (' + mmePct(cs[0].cobertura, 0) + ')' + (cs.length > 1 ? '; menor en ' + mmEsc(ult.canal) + ' (' + mmePct(ult.cobertura, 0) + ')' : '')) + '.');
    cs.forEach(function (c) {
      var rival = mmeRanking(marcas.filter(function (x) { return !mmeEsPropia(x) && celda(x, c.canal); }), function (x) { return celda(x, c.canal).cobertura; })[0];
      if (rival && celda(rival, c.canal).cobertura - c.cobertura >= 0.1 && hall.length < 4) hall.push('En ' + mmEsc(c.canal) + ', ' + mmEsc(rival.marca) + ' te supera en cobertura (' + mmePct(celda(rival, c.canal).cobertura, 0) + ' frente a ' + mmePct(c.cobertura, 0) + ').');
    });
  });
  if (!propias.length) hall.push('Tu marca no tiene cobertura medida en este estudio.');
  // Escala de azules oscuros con texto claro (contraste suficiente en todas las celdas).
  var tono = function (v) { var a = Math.max(0, Math.min(1, v || 0)); return 'background:rgba(30,91,184,' + (0.15 + 0.75 * a).toFixed(2) + ');color:#ffffff'; };
  var mapa = '<div class="mme-scroll"><table class="mme-calor"><thead><tr><th>Marca</th>' + canales.map(function (c) { return '<th>' + mmEsc(c) + '</th>'; }).join('') + '</tr></thead><tbody>'
    + marcas.map(function (m) {
      return '<tr><td>' + mmeMarca(m) + '</td>' + canales.map(function (canal) {
        var c = celda(m, canal);
        if (!c) return '<td class="mme-vacio">—</td>';
        var pv = prevCov[m.marca + '|' + canal];
        return '<td style="' + tono(c.cobertura) + '"><strong>' + mmePct(c.cobertura, 0) + '</strong>' + (pv != null ? '<div>' + mmeVarPP(c.cobertura, pv) + '</div>' : '') + '<div class="mme-mini">' + mmeNum(c.ventas) + ' u</div></td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody></table></div>';
  var graf = mmeGrafico('Gráfico 1. Mapa de calor: cobertura por marca y canal', mapa, 'Más intenso = más cobertura. Debajo: ventas del canal en unidades.');
  if (propias.length) {
    graf += mmeGrafico('Gráfico 2. Tus ventas por punto de cobertura (por canal)', propias.map(function (m) {
      var vs = (m.canales || []).map(function (c) { return { c: c, v: c.cobertura > 0 ? c.ventas / (c.cobertura * 100) : 0 }; });
      var mx = Math.max.apply(null, [1].concat(vs.map(function (x) { return x.v; })));
      return '<h5>' + mmEsc(m.marca) + '</h5>' + vs.map(function (x) { return mmeFila(mmEsc(x.c.canal), mmeBarra(x.v / mx, MME_PROPIO.bg), mmeDec(x.v, 1) + ' u por punto'); }).join('');
    }).join(''), 'Ventas por punto de cobertura = ventas del canal ÷ cobertura en puntos (1 punto = 1 %).');
  }
  var det = (e.marcas || []).map(function (m) { return '<h5>' + mmeMarca(m) + '</h5>' + mmeTabla(['Canal', 'Cobertura', 'Ventas (u)'], (m.canales || []).map(function (c) { return { celdas: [mmEsc(c.canal), mmePct(c.cobertura), mmeNum(c.ventas)] }; }), ['i', 'd', 'd']); }).join('');
  return { hall: hall, graf: graf, det: det, base: marcas.length + ' marcas · ' + canales.length + ' canales' };
}

function mmeIdeales(e) {
  var ejes = e.ejes || [], segs = e.segmentos || [];
  var cars = ejes.filter(function (x) { return x !== 'Precio de lista'; });
  var hall = [];
  var dist = function (p, ideal) { return Math.sqrt(cars.reduce(function (a, k) { var d = (Number(p.posicion[k]) || 0) - (Number(ideal[k]) || 0); return a + d * d; }, 0)); };
  var segsPropios = segs.filter(function (s) { return (s.productos || []).some(mmeEsPropia); });
  segsPropios.slice(0, 2).forEach(function (s) {
    (s.productos || []).filter(mmeEsPropia).slice(0, 1).forEach(function (p) {
      var br = cars.map(function (k) { return { k: k, b: (Number(p.posicion[k]) || 0) - (Number(s.puntoIdeal[k]) || 0) }; });
      var mx = mmeRanking(br, function (x) { return Math.abs(x.b); })[0];
      if (mx && Math.abs(mx.b) >= 0.5) hall.push('En <strong>' + mmEsc(s.segmento) + '</strong>, tu mayor brecha está en <strong>' + mmEsc(mx.k) + '</strong>: ' + mmeDec(p.posicion[mx.k], 1) + ' frente a un ideal de ' + mmeDec(s.puntoIdeal[mx.k], 1) + ' (' + (mx.b < 0 ? 'te falta' : 'te pasaste') + ').');
      else if (mx) hall.push('En <strong>' + mmEsc(s.segmento) + '</strong>, tu producto está cerca del ideal en todas las características.');
    });
    var cerca = mmeRanking(s.productos || [], function (p) { return -dist(p, s.puntoIdeal); })[0];
    if (cerca && hall.length < 4) hall.push('Producto más cercano al ideal de ' + mmEsc(s.segmento) + ': ' + mmeMarca(cerca) + '.');
  });
  if (!segsPropios.length) hall.push('Tu producto no aparece en los segmentos medidos (aún no compite en ellos).');
  var opt = function (sel) { return ejes.map(function (x) { return '<option' + (x === sel ? ' selected' : '') + '>' + mmEsc(x) + '</option>'; }).join(''); };
  var tonoB = function (b) { var a = Math.abs(b); return a < 0.5 ? 'mme-b0' : (a < 2 ? 'mme-b1' : 'mme-b2'); };
  var etiqB = function (b) { var a = Math.abs(b); return a < 0.5 ? 'en el ideal' : (b < 0 ? 'te falta' : 'te pasaste'); };
  var bloques = segs.map(function (s) {
    var esP = segsPropios.indexOf(s) >= 0;
    var html = '<details class="mme-seg"' + (esP || (!segsPropios.length && s === segs[0]) ? ' open' : '') + '><summary>' + mmEsc(s.segmento) + (esP ? ' <span class="mme-propia">· compites aquí</span>' : '') + '</summary>';
    if ((s.productos || []).length && typeof mmMapaSVG === 'function') {
      mmContadorMapas += 1;
      var key = 'mmMapa_' + mmContadorMapas;
      mmMapas[key] = { seg: s };
      html += '<div class="mme-ejes">Eje horizontal <select id="' + key + '_x" onchange="mmRedibujarMapa(&quot;' + key + '&quot;)">' + opt(ejes[0]) + '</select>'
        + ' Eje vertical <select id="' + key + '_y" onchange="mmRedibujarMapa(&quot;' + key + '&quot;)">' + opt(ejes[1]) + '</select></div>'
        + '<div class="mme-doble"><div id="' + key + '">' + mmMapaSVG(s, ejes[0], ejes[1]) + '</div>';
      var pr = (s.productos || []).filter(mmeEsPropia);
      html += '<div>' + (pr.length ? pr.map(function (p) {
        return '<h5>Brechas de ' + mmEsc(p.marca) + '</h5>' + mmeTabla(['Característica', 'Ideal', 'Tu producto', 'Brecha'], cars.map(function (k) {
          var b = (Number(p.posicion[k]) || 0) - (Number(s.puntoIdeal[k]) || 0);
          return { celdas: [mmEsc(k), mmeDec(s.puntoIdeal[k], 1), mmeDec(p.posicion[k], 1), '<span class="mme-brecha ' + tonoB(b) + '">' + (b >= 0.05 ? '+' : (b <= -0.05 ? '−' : '')) + mmeDec(Math.abs(b), 1) + ' ' + etiqB(b) + '</span>'] };
        }), ['i', 'd', 'd', 'd']);
      }).join('') : '<div class="mme-nota">No compites en este segmento: compara los productos con el ideal en el mapa.</div>') + '</div></div>';
    } else html += '<div class="mme-nota">Punto ideal: ' + Object.keys(s.puntoIdeal || {}).map(function (k) { return mmEsc(k) + ' ' + mmeDec(s.puntoIdeal[k], 1); }).join(' · ') + '</div>';
    return html + '</details>';
  }).join('');
  var graf = mmeGrafico('Gráfico 1. Mapa de posicionamiento y brechas frente al ideal', bloques,
    '● relleno ámbar: tus productos · ○ contorno: competidores · ◆ verde: punto ideal (no se dibuja si un eje es el precio). Las posiciones de los productos van sin error; el ideal lleva el margen del estudio.');
  var det = mmeTabla(['Segmento', 'Punto ideal'], segs.map(function (s) { return { celdas: [mmEsc(s.segmento), Object.keys(s.puntoIdeal || {}).map(function (k) { return mmEsc(k) + ': ' + mmeDec(s.puntoIdeal[k], 1); }).join(' · ')] }; }))
    + segs.filter(function (s) { return (s.productos || []).length; }).map(function (s) {
      return '<h5>Posiciones en ' + mmEsc(s.segmento) + '</h5>' + mmeTabla(['Marca'].concat(ejes), s.productos.map(function (p) {
        return { propia: mmeEsPropia(p), celdas: [mmeMarca(p)].concat(ejes.map(function (x) { return x === 'Precio de lista' ? mmBs(p.posicion[x]) : (p.posicion[x] != null ? mmeDec(p.posicion[x], 1) : '—'); })) }; }));
    }).join('');
  return { hall: hall, graf: graf, det: det, base: segs.length + ' segmentos · ' + cars.length + ' características' };
}

function mmePronostico(e) {
  var segs = e.segmentos || [];
  var hall = [];
  var orden = mmeRanking(segs, function (s) { return s.crecimientoTrimestral; });
  if (orden[0]) hall.push('Mayor crecimiento: <strong>' + mmEsc(orden[0].segmento) + '</strong>, ' + mmePct(orden[0].crecimientoTrimestral) + ' por trimestre.');
  var altos = segs.filter(function (s) { return s.altoCrecimiento; });
  hall.push(altos.length ? altos.length + ' segmento(s) de alto crecimiento: ' + altos.map(function (s) { return mmEsc(s.segmento); }).join(', ') + '.' : 'Ningún segmento supera el umbral de alto crecimiento.');
  var prom = [0, 1, 2, 3].map(function (t) { var vs = segs.filter(function (s) { return Array.isArray(s.estacionalidad); }).map(function (s) { return Number(s.estacionalidad[t]) || 0; }); return vs.length ? vs.reduce(function (a, b) { return a + b; }, 0) / vs.length : 0; });
  var pico = prom.indexOf(Math.max.apply(null, prom));
  if (prom.some(function (x) { return x > 0; })) hall.push('Temporada más alta, en promedio de los segmentos: <strong>T' + (pico + 1) + '</strong> (índice ' + mmeDec(prom[pico], 2) + ').');
  var maxG = Math.max.apply(null, [0.0001].concat(segs.map(function (s) { return Math.abs(s.crecimientoTrimestral || 0); })));
  var cuerpo = '<div class="mme-scroll"><div class="mme-pron"><div class="mme-th">Segmento</div><div class="mme-th">Crecimiento por trimestre</div><div class="mme-th">Estacionalidad T1 · T2 · T3 · T4</div>'
    + segs.map(function (s) {
      var est = Array.isArray(s.estacionalidad) ? s.estacionalidad : null, mx = est ? Math.max.apply(null, est.map(Number)) || 1 : 1;
      return '<div>' + mmEsc(s.segmento) + (s.altoCrecimiento ? ' <span class="mme-up">▲ alto crecimiento</span>' : '') + '</div>'
        + '<div class="mme-celda">' + mmeBarra(Math.abs(s.crecimientoTrimestral || 0) / maxG, (s.crecimientoTrimestral || 0) >= 0 ? '#70cc20' : '#ff8a8a') + '<span>' + mmePct(s.crecimientoTrimestral) + '</span></div>'
        + '<div>' + (est ? '<div class="mme-estac">' + est.map(function (v, i) { return '<div title="T' + (i + 1) + ': ' + mmeDec(v, 2) + '"><div style="height:' + Math.round(Number(v) / mx * 34) + 'px"></div><span>' + mmeDec(v, 2) + '</span></div>'; }).join('') + '</div>' : '—') + '</div>';
    }).join('') + '</div></div>';
  var graf = mmeGrafico('Gráfico 1. Crecimiento y estacionalidad esperados por segmento', cuerpo,
    e.umbralAltoCrecimiento != null ? 'Alto crecimiento: ' + mmePct(e.umbralAltoCrecimiento) + ' o más por trimestre. Estacionalidad: 1 = trimestre normal.' : '');
  var det = mmeTabla(['Segmento', 'Crecimiento por trimestre', 'Estacionalidad T1-T4'], segs.map(function (s) { return { celdas: [mmEsc(s.segmento), mmePct(s.crecimientoTrimestral), (s.estacionalidad || []).map(function (v) { return mmeDec(v, 2); }).join(' · ')] }; }), ['i', 'd', 'i']);
  return { hall: hall, graf: graf, det: det, base: segs.length + ' segmentos' };
}

function mmeInteligencia(e, prev) {
  var emp = (e.empresas || []).slice();
  var prevE = {};
  if (prev) (prev.empresas || []).forEach(function (x) { prevE[x.empresa] = x; });
  var filas = emp.map(function (x) { return { nombre: x.empresa, com: x.comunicacion || 0, dis: x.distribucion || 0, propia: false, prev: prevE[x.empresa] }; });
  if (e.propio) filas.push({ nombre: (mmeNombreEquipo() || 'Tu empresa'), com: e.propio.comunicacion || 0, dis: e.propio.distribucion || 0, propia: true });
  filas.sort(function (a, b) { return (b.com + b.dis) - (a.com + a.dis); });
  var totalCom = filas.reduce(function (a, f) { return a + f.com; }, 0);
  var hall = [];
  var mc = mmeRanking(filas.filter(function (f) { return !f.propia; }), function (f) { return f.com; })[0];
  if (mc) hall.push('El competidor que más invierte en comunicación es <strong>' + mmEsc(mc.nombre) + '</strong>: ' + mmBs(mc.com) + (mc.prev ? ' ' + mmeVarRel(mc.com, mc.prev.comunicacion) + ' frente a la ronda anterior' : '') + '.');
  if (e.propio && totalCom > 0) hall.push('Tu participación en la voz publicitaria de la industria: <strong>' + mmePct(e.propio.comunicacion / totalCom) + '</strong> (' + mmBs(e.propio.comunicacion) + ' de ' + mmBs(totalCom) + ').');
  var md = mmeRanking(filas.filter(function (f) { return !f.propia; }), function (f) { return f.dis; })[0];
  if (md) hall.push('Mayor inversión en distribución: <strong>' + mmEsc(md.nombre) + '</strong> (' + mmBs(md.dis) + ').');
  var mx = Math.max.apply(null, [1].concat(filas.map(function (f) { return f.com + f.dis; })));
  var g = filas.map(function (f) {
    var t = f.com + f.dis;
    return mmeFila(f.propia ? '<span class="mme-propia">' + mmEsc(f.nombre) + ' (tú)</span>' : mmEsc(f.nombre),
      '<div style="width:' + (t / mx * 100).toFixed(1) + '%">' + mmeApilada([{ frac: t ? f.com / t : 0, color: f.propia ? MME_PROPIO : { bg: '#7fa8d8', tx: '#0e1e35' }, etiqueta: '', titulo: 'Comunicación ' + mmBs(f.com) },
        { frac: t ? f.dis / t : 0, color: { bg: '#2c5180', tx: '#ffffff' }, etiqueta: '', titulo: 'Distribución ' + mmBs(f.dis) }]) + '</div>',
      mmBs(f.com) + ' + ' + mmBs(f.dis));
  }).join('');
  var graf = mmeGrafico('Gráfico 1. Inversión en comunicación y distribución por empresa (Bs)',
    mmeLeyenda([{ color: '#7fa8d8', texto: 'Comunicación' }, { color: MME_PROPIO.bg, texto: 'Tu comunicación' }, { color: '#2c5180', texto: 'Distribución' }]) + g,
    'Competidores: gasto estimado con margen de error. Tu empresa: tu gasto real.');
  var det = mmeTabla(['Empresa', 'Comunicación (Bs)', 'Variación', 'Distribución (Bs)'], filas.map(function (f) {
    return { propia: f.propia, celdas: [f.propia ? '<span class="mme-propia">' + mmEsc(f.nombre) + ' (tú)</span>' : mmEsc(f.nombre), mmBs(f.com), f.prev ? mmeVarRel(f.com, f.prev.comunicacion) : '—', mmBs(f.dis)] }; }), ['i', 'd', 'd', 'd']);
  return { hall: hall, graf: graf, det: det, base: emp.length + ' competidores' };
}

function mmeConjoint(e) {
  var segs = e.segmentos || [];
  var cars = [];
  segs.forEach(function (s) { Object.keys(s.importancia || {}).forEach(function (k) { if (cars.indexOf(k) < 0) cars.push(k); }); });
  var col = [{ bg: '#b8c8d8', tx: '#0e1e35' }, { bg: '#4a78ae', tx: '#ffffff' }, { bg: '#7fa8d8', tx: '#0e1e35' }, { bg: '#2c5180', tx: '#ffffff' }];
  var hall = [];
  var sens = mmeRanking(segs, function (s) { return s.sensibilidadPrecio; });
  var cuenta = {};
  segs.forEach(function (s) { var k = Object.keys(s.importancia || {}).sort(function (a, b) { return s.importancia[b] - s.importancia[a]; })[0]; if (k) cuenta[k] = (cuenta[k] || 0) + 1; });
  var top = Object.keys(cuenta).sort(function (a, b) { return cuenta[b] - cuenta[a]; })[0];
  if (top) hall.push('<strong>' + mmEsc(top) + '</strong> es la característica más importante en ' + cuenta[top] + ' de ' + segs.length + ' segmentos.');
  if (sens[0]) hall.push('Segmento más sensible al precio: <strong>' + mmEsc(sens[0].segmento) + '</strong> (' + mmeDec(sens[0].sensibilidadPrecio, 2) + ').');
  if (sens.length > 1) hall.push('Segmento menos sensible al precio: <strong>' + mmEsc(sens[sens.length - 1].segmento) + '</strong> (' + mmeDec(sens[sens.length - 1].sensibilidadPrecio, 2) + ').');
  var mxS = Math.max.apply(null, [0.0001].concat(segs.map(function (s) { return s.sensibilidadPrecio || 0; })));
  var g = segs.map(function (s) {
    var tot = cars.reduce(function (a, k) { return a + (s.importancia[k] || 0); }, 0) || 1;
    return mmeFila(mmEsc(s.segmento), mmeApilada(cars.map(function (k, i) { return { frac: (s.importancia[k] || 0) / tot, color: col[i % col.length], etiqueta: Math.round((s.importancia[k] || 0) / tot * 100) + ' %', titulo: k + ': ' + mmePct((s.importancia[k] || 0) / tot) }; })),
      '<div class="mme-celda">' + mmeBarra((s.sensibilidadPrecio || 0) / mxS, '#e8a820') + '<span>' + mmeDec(s.sensibilidadPrecio, 2) + '</span></div>');
  }).join('');
  var graf = mmeGrafico('Gráfico 1. Importancia de las características (100 %) y sensibilidad al precio por segmento',
    mmeLeyenda(cars.map(function (k, i) { return { color: col[i % col.length].bg, texto: mmEsc(k) }; }).concat([{ color: '#e8a820', texto: 'Sensibilidad al precio (columna derecha)' }])) + g, 'Barra ámbar: sensibilidad al precio relativa al segmento más sensible.');
  var det = mmeTabla(['Segmento', 'Importancia de las características', 'Sensibilidad al precio'], segs.map(function (s) {
    return { celdas: [mmEsc(s.segmento), Object.keys(s.importancia || {}).map(function (k) { return mmEsc(k) + ': ' + mmePct(s.importancia[k]); }).join(' · '), mmeDec(s.sensibilidadPrecio, 2)] }; }), ['i', 'i', 'd']);
  return { hall: hall, graf: graf, det: det, base: segs.length + ' segmentos' };
}

function mmeConcepto(e) {
  if (e.error) return { hall: [mmEsc(e.error)], graf: '', det: '', base: '—' };
  var a = Number(e.aceptacion) || 0, m = Number(e.margenError) || 0;
  var lo = Math.max(0, a * (1 - m)), hi = Math.min(100, a * (1 + m));
  var nivel = a >= 70 ? 'alta' : (a >= 40 ? 'media' : 'baja');
  var hall = ['Aceptación estimada en <strong>' + mmEsc(e.segmento) + '</strong>: <strong>' + mmeDec(a, 0) + ' de 100</strong> (entre ' + mmeDec(lo, 0) + ' y ' + mmeDec(hi, 0) + ').',
    'Lectura orientativa: aceptación <strong>' + nivel + '</strong>.'];
  var nombres = (typeof hojaMezcla !== 'undefined' && hojaMezcla && hojaMezcla.caracteristicas) || {};
  var NOMBRE_DEF = { calidad: 'Calidad', beneficio: 'Beneficio principal', diseno: 'Diseño' };
  var proto = Object.keys(e.prototipo || {}).map(function (k) { return mmEsc((nombres[k] && nombres[k].nombre) || NOMBRE_DEF[k] || k) + ' ' + e.prototipo[k]; }).join(' · ');
  var graf = mmeGrafico('Gráfico 1. Aceptación del prototipo (0 a 100)',
    '<div class="mme-gauge"><div class="mme-gauge-int" style="left:' + lo.toFixed(1) + '%;width:' + (hi - lo).toFixed(1) + '%"></div><div class="mme-gauge-val" style="left:' + Math.min(100, a).toFixed(1) + '%"></div></div>'
    + '<div class="mme-gauge-esc"><span style="left:0">0</span><span style="left:40%">40</span><span style="left:70%">70</span><span style="left:100%">100</span></div>'
    + '<div class="mme-nota">Prototipo evaluado (características): ' + proto + '</div>', 'Banda clara: intervalo según el margen de error. Línea ámbar: aceptación estimada.');
  return { hall: hall, graf: graf, det: '', base: 'Segmento: ' + mmEsc(e.segmento || '—') };
}

var MME_RENDER = { informe_industria: mmeInforme, panel_consumidores: mmePanel, encuesta_consumidores: mmeEncuesta, panel_distribucion: mmeDistribucion,
  puntos_ideales: mmeIdeales, pronostico_mercado: mmePronostico, inteligencia_competitiva: mmeInteligencia, analisis_conjoint: mmeConjoint, prueba_concepto: mmeConcepto };
// v0.6 (docente, 06-11-2026): orden único y código de cada estudio (hoja, Investigación y manuales):
// de lo general a lo específico — mercado → competencia → consumidor → producto.
var MME_ORDEN = ['informe_industria', 'pronostico_mercado', 'panel_consumidores', 'panel_distribucion', 'inteligencia_competitiva', 'encuesta_consumidores', 'puntos_ideales', 'analisis_conjoint', 'prueba_concepto'];
var MME_CODIGOS = { informe_industria: 'INV01', pronostico_mercado: 'INV02', panel_consumidores: 'INV03', panel_distribucion: 'INV04', inteligencia_competitiva: 'INV05',
  encuesta_consumidores: 'INV06', puntos_ideales: 'INV07', analisis_conjoint: 'INV08', prueba_concepto: 'INV09' };
function mmeOrdenEstudios(ids) { return ids.slice().sort(function (a, b) { var ia = MME_ORDEN.indexOf(a), ib = MME_ORDEN.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); }); }
function mmeNombreEstudio(id, nombre) { return (MME_CODIGOS[id] ? MME_CODIGOS[id] + ' · ' : '') + (nombre || id); }
var MME_CON_VARIACION = { informe_industria: 1, panel_consumidores: 1, encuesta_consumidores: 1, panel_distribucion: 1, inteligencia_competitiva: 1 };

function mmeCss() {
  return '<style id="mmeCss">'
    + '.mme-wrap{display:flex;flex-direction:column;gap:14px}'
    + '.mme-indice{display:flex;flex-direction:column;gap:8px}'
    + '.mme-rotulo{font-family:var(--font-mono);font-size:.66rem;letter-spacing:2px;color:var(--text2)}'
    + '.mme-tabs{display:flex;flex-wrap:wrap;gap:6px}'
    + '.mme-tab{background:var(--bg3);color:var(--text);border:1px solid var(--border2);border-radius:8px;padding:8px 12px;font:inherit;font-size:.8rem;cursor:pointer;min-height:40px}'
    + '.mme-tab.activa{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}'
    + '.mme-nocomp{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:.74rem;color:var(--text2)}'
    + '.mme-nocomp span{border:1px dashed var(--border2);color:var(--text3);border-radius:8px;padding:4px 9px}'
    + '.mme-panel{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:18px 20px;display:flex;flex-direction:column;gap:14px}'
    + '.mme-cab{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 16px;align-items:baseline}'
    + '.mme-cab h3{margin:0;font-size:1.15rem}.mme-cab span{font-size:.78rem;color:var(--text2)}'
    + '.mme-ficha{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;background:var(--border);border:1px solid var(--border);border-radius:10px;overflow:hidden}'
    + '.mme-ficha>div{background:var(--bg3);padding:8px 12px;font-size:.82rem;font-weight:600}'
    + '.mme-ficha b{display:block;font-family:var(--font-mono);font-size:.6rem;color:var(--text2);font-weight:400;letter-spacing:.5px;text-transform:uppercase}'
    + '.mme-hall{background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px 16px}'
    + '.mme-hall h4{margin:0 0 6px;font-family:var(--font-mono);font-size:.66rem;letter-spacing:2px;color:var(--accent3)}'
    + '.mme-hall ul,.mme-lista{margin:0;padding-left:18px;font-size:.84rem;display:flex;flex-direction:column;gap:4px}'
    + '.mme-graf{background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px 16px}'
    + '.mme-graf h4{margin:0 0 10px;font-size:.86rem}.mme-graf h5,.mme-det h5{margin:12px 0 6px;font-size:.8rem}'
    + '.mme-fuente{font-size:.7rem;color:var(--text2);margin-top:8px}'
    + '.mme-nota{font-size:.7rem;color:var(--text2)}'
    + '.mme-fila{display:grid;grid-template-columns:minmax(110px,200px) minmax(0,1fr) 210px;gap:6px 12px;align-items:center;font-size:.78rem;padding:4px 0}'
    + '.mme-der{text-align:right}'
    + '.mme-barra{height:14px;background:var(--bg3);border-radius:3px;overflow:hidden;flex:1;min-width:40px}.mme-barra>div{height:100%}'
    + '.mme-apilada{display:flex;height:22px;border-radius:4px;overflow:hidden;background:var(--bg3)}'
    + '.mme-apilada>div{display:flex;align-items:center;justify-content:center;font-size:.64rem;font-weight:700;overflow:hidden}'
    + '.mme-leyenda{display:flex;flex-wrap:wrap;gap:10px;font-size:.7rem;color:var(--text2);margin-bottom:8px}'
    + '.mme-leyenda i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:middle}'
    + '.mme-propia{color:var(--accent3);font-weight:700}.mme-fila-propia td{background:rgba(232,168,32,.10)}'
    + '.mme-up{color:var(--accent5);white-space:nowrap}.mme-down{color:#ff8a8a;white-space:nowrap}.mme-eq{color:var(--text3);white-space:nowrap}'
    + '.mme-scroll{overflow-x:auto}'
    + '.mme-embudo{display:grid;grid-template-columns:minmax(120px,1.2fr) minmax(140px,1fr) minmax(140px,1fr) 80px;gap:6px 12px;align-items:center;font-size:.78rem;min-width:520px}'
    + '.mme-pron{display:grid;grid-template-columns:minmax(140px,1.2fr) minmax(140px,1fr) minmax(200px,1fr);gap:8px 12px;align-items:center;font-size:.78rem;min-width:520px}'
    + '.mme-th{font-family:var(--font-mono);font-size:.6rem;color:var(--text2);text-transform:uppercase}'
    + '.mme-celda{display:flex;gap:8px;align-items:center}.mme-celda span{white-space:nowrap}'
    + '.mme-estac{display:flex;gap:6px;align-items:flex-end}.mme-estac>div{display:flex;flex-direction:column;align-items:center;gap:2px;width:38px}'
    + '.mme-estac>div>div{width:22px;background:#7fa8d8;border-radius:2px 2px 0 0}.mme-estac span{font-size:.62rem;color:var(--text2)}'
    + '.mme-seg{border-top:1px solid var(--border);padding:8px 0}.mme-seg>summary{cursor:pointer;font-weight:600;font-size:.82rem;padding:4px 0}.mme-seg>.mme-nota{margin:2px 0 10px}.mme-seg .mme-scroll+.mme-nota{margin-top:8px}'
    + '.mme-calor{border-collapse:collapse;font-size:.76rem;min-width:420px;width:100%}.mme-calor th,.mme-calor td{border:1px solid var(--border);padding:6px 8px;text-align:center}'
    + '.mme-calor td:first-child,.mme-calor th:first-child{text-align:left}.mme-mini{font-size:.62rem;opacity:.85}.mme-vacio{color:var(--text3)}.mme-calor .mme-up{color:#c8f5a0}.mme-calor .mme-down{color:#ffd0d0}'
    + '.mme-ejes{font-size:.75rem;margin:6px 0;display:flex;flex-wrap:wrap;gap:6px;align-items:center}'
    + '.mme-doble{display:flex;flex-wrap:wrap;gap:14px}.mme-doble>div{flex:1 1 320px;min-width:0}'
    + '.mme-brecha{border-radius:4px;padding:2px 7px;font-weight:700;white-space:nowrap}.mme-b0{background:#1f4a14;color:#b8f08a}.mme-b1{background:#4a3a10;color:#f5d27a}.mme-b2{background:#5a1f1f;color:#ffb3b3}'
    + '.mme-gauge{position:relative;height:22px;background:linear-gradient(90deg,#5a1f1f 0 40%,#4a3a10 40% 70%,#1f4a14 70% 100%);border-radius:4px;margin-top:6px}'
    + '.mme-gauge-int{position:absolute;top:0;bottom:0;background:rgba(232,240,248,.35)}.mme-gauge-val{position:absolute;top:-4px;bottom:-4px;width:4px;margin-left:-2px;background:var(--accent3)}'
    + '.mme-gauge-esc{position:relative;height:16px;font-size:.66rem;color:var(--text2);margin:4px 0 8px}.mme-gauge-esc span{position:absolute;transform:translateX(-50%)}.mme-gauge-esc span:first-child{transform:none}.mme-gauge-esc span:last-child{transform:translateX(-100%)}'
    + '.mme-det{background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px 14px}.mme-det>summary{cursor:pointer;font-weight:600;font-size:.84rem}'
    + '.mme-det ul,.mme-det ol{margin:8px 0 0;padding-left:20px;font-size:.82rem;display:flex;flex-direction:column;gap:4px}'
    + '.mme-preg{border-color:var(--accent3)}.mme-preg>summary{color:var(--accent3)}'
    + '.mme-tabla{overflow-x:auto}'
    + '.mme-graf{container-type:inline-size}'
    + '@container (max-width:640px){.mme-fila{grid-template-columns:minmax(0,1fr) 125px}.mme-fila>div:first-child{grid-column:1/-1}}'
    + '@media (max-width:640px){.mme-fila{grid-template-columns:minmax(0,1fr) 125px}.mme-fila>div:first-child{grid-column:1/-1}.mme-panel{padding:14px 12px}}'
    + '@media print{.mme-panel{display:flex !important;break-inside:auto}.mme-tabs,.mme-nocomp{display:none}}'
    + '</style>';
}

/**
 * HTML de la pantalla Investigación.
 * @param {Object} estudios  estudios comprados en la ronda (reportes.estudios).
 * @param {Object} ctx       { ronda, catalogo: [{id,nombre,costo,margenError}], previos: estudios de la ronda anterior }
 */
function mmEstudiosHTML(estudios, ctx) {
  ctx = ctx || {};
  if (!estudios || !Object.keys(estudios).length) return '';
  var n = Number(ctx.ronda) || null;
  var previos = ctx.previos || {};
  var ids = mmeOrdenEstudios(Object.keys(estudios));
  var html = mmeCss() + '<div class="mme-wrap" id="mmeWrap">'
    + '<div class="result-round-header"><h3>🔍 Estudios de mercado' + (n ? ' — Ronda ' + n + ' (' + mmeTrim(n) + ')' : '') + '</h3></div>'
    + '<div class="mme-indice"><div class="mme-rotulo">ESTUDIOS DE ESTA RONDA</div><div class="mme-tabs" role="tablist">'
    + ids.map(function (id, i) { return '<button type="button" class="mme-tab' + (i === 0 ? ' activa' : '') + '" role="tab" aria-selected="' + (i === 0) + '" data-mme-tab="' + id + '" onclick="mmeTab(&quot;' + id + '&quot;)">' + mmEsc(mmeNombreEstudio(id, estudios[id].nombre)) + '</button>'; }).join('')
    + '</div>';
  var noComp = (ctx.catalogo || []).filter(function (c) { return !estudios[c.id]; });
  noComp.sort(function (a, b) { return MME_ORDEN.indexOf(a.id) - MME_ORDEN.indexOf(b.id); });
  if (noComp.length) html += '<div class="mme-nocomp">No comprados en esta ronda (información que te falta): ' + noComp.map(function (c) { return '<span>' + mmEsc(mmeNombreEstudio(c.id, c.nombre)) + ' · ' + (c.costo ? mmBs(c.costo) : 'gratuito') + '</span>'; }).join('') + '</div>';
  html += '</div>';
  ids.forEach(function (id, i) {
    var e = estudios[id], txt = MME_TEXTOS[id] || { sub: '', leer: [], preg: [] };
    var prev = MME_CON_VARIACION[id] && previos[id] && !previos[id].error ? previos[id] : null;
    var r;
    try { r = (MME_RENDER[id] || function () { return { hall: [], graf: '', det: '', base: '—' }; })(e, prev); }
    catch (err) { r = { hall: ['No se pudo preparar la presentación de este estudio (' + mmEsc(err.message) + ').'], graf: '', det: '', base: '—' }; }
    var comp = !MME_CON_VARIACION[id] ? 'No aplica (dato estructural)' : (prev ? 'Frente a la ronda ' + (n ? n - 1 : 'anterior') : 'Sin comparación: no lo compraste en la ronda anterior');
    html += '<section class="mme-panel" id="mme_' + id + '" data-mme-estudio="' + id + '"' + (i === 0 ? '' : ' style="display:none"') + '>'
      + '<div class="mme-cab"><h3>' + mmEsc(mmeNombreEstudio(id, e.nombre)) + '</h3><span>' + txt.sub + '</span></div>'
      + '<div class="mme-ficha"><div><b>Ronda medida</b>' + (n ? 'Ronda ' + n + ' · ' + mmeTrim(n) : '—') + '</div><div><b>Base</b>' + r.base + '</div>'
      + '<div><b>Margen de error</b>± ' + mmePct(e.margenError, 0) + '</div><div><b>Costo</b>' + (e.costo ? mmBs(e.costo) : 'Gratuito') + '</div><div><b>Comparación</b>' + comp + '</div></div>'
      + (e.error && id !== 'prueba_concepto' ? '<div style="color:var(--accent4)">' + mmEsc(e.error) + '</div>' : '')
      + (r.hall.length ? '<div class="mme-hall"><h4>HALLAZGOS CLAVE</h4><ul>' + r.hall.map(function (h) { return '<li>' + h + '</li>'; }).join('') + '</ul></div>' : '')
      + r.graf
      + (r.det ? '<details class="mme-det"><summary>Tabla de detalle</summary>' + r.det + '</details>' : '')
      + '<details class="mme-det"><summary>Cómo leer este estudio</summary><ul>' + txt.leer.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul></details>'
      + '<details class="mme-det mme-preg" open><summary>Preguntas para tu decisión</summary><ol>' + txt.preg.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ol></details>'
      + '</section>';
  });
  return html + '</div>';
}

function mmeTab(id) {
  document.querySelectorAll('[data-mme-estudio]').forEach(function (p) { p.style.display = p.getAttribute('data-mme-estudio') === id ? '' : 'none'; });
  document.querySelectorAll('[data-mme-tab]').forEach(function (b) { var on = b.getAttribute('data-mme-tab') === id; b.classList.toggle('activa', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
}

window.mmEstudiosHTML = mmEstudiosHTML;
window.mmeTab = mmeTab;
