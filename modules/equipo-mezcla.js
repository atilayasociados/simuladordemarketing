/**
 * equipo-mezcla.js — SimMkt v0.3, módulo "Mezcla de marketing" (Etapa 7)
 * ═══════════════════════════════════════════════════════════════════════
 * Pantallas del equipo cuando la simulación tiene el módulo encendido:
 *   - Panel de la hoja de decisión organizado por roles:
 *       A Gerencia general · B Producto y operaciones · C Marketing ·
 *       D Ventas y distribución · E Finanzas (secciones 3 y 3.5 de siempre) ·
 *       F Resumen (pronóstico, costo y margen por unidad, estado de
 *       resultados proyectado y punto de equilibrio).
 *     Todos los cálculos los hace el servidor con el motor
 *     (POST /api/mezcla/proyeccion); aquí no se repiten fórmulas.
 *   - Tabla Proyectado / Real / Diferencia para Estados Financieros.
 *   - Estudios de mercado comprados (Investigación).
 * No muestra ajuste, eficacia de medios ni cuotas de competidores (el
 * servidor no los envía). v0.6: los puntos ideales y el orden de importancia
 * solo aparecen si el equipo compró el estudio (el último, con su ronda).
 *
 * Dependencias globales: api(), fmt, state, toast, hojaProductoActivo,
 * hojaTieneCambiosSinGuardar (equipo-hoja.js).
 */

/* global api, fmt, state, toast */
var hojaMezcla = null;   // bloque `mezcla` de GET /api/decisiones (null = módulo apagado)

var MM_MEDIOS = ['publicidad', 'promocion', 'eventos', 'marketingRedes', 'relacionesPublicas'];
var MM_INTENSIDADES = [['exclusiva', 'Exclusiva'], ['selectiva', 'Selectiva'], ['intensiva', 'Intensiva']];

function mmEsc(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function mmGet(obj, ruta) {
  return ruta.split('.').reduce(function (o, k) { return (o && typeof o === 'object') ? o[k] : undefined; }, obj);
}
function mmSet(obj, ruta, v) {
  var ks = ruta.split('.');
  var o = obj;
  for (var i = 0; i < ks.length - 1; i++) {
    if (!o[ks[i]] || typeof o[ks[i]] !== 'object') o[ks[i]] = {};
    o = o[ks[i]];
  }
  o[ks[ks.length - 1]] = v;
}
function mmBs(v) { return (typeof fmt !== 'undefined' && fmt.bs) ? fmt.bs(v || 0) : ('Bs ' + Math.round(v || 0)); }
function mmRol(letra, nombre) {
  return '<span style="display:inline-block;padding:1px 7px;border-radius:10px;background:rgba(124,58,237,.12);color:var(--accent3);font-size:.68rem;font-weight:700;margin-left:6px">'
    + letra + ' · ' + nombre + '</span>';
}

/**
 * Panel del módulo para el producto activo.
 * ctx: { decision, producto, idx, editable, ref }
 */
function mmPanelHTML(ctx) {
  var M = hojaMezcla;
  if (!M) return '';
  var d = ctx.decision || {};
  var p = ctx.producto || {};
  var ed = ctx.editable;
  var idx = ctx.idx || 0;
  var esPrimero = idx === 0;
  // v0.6, etapa 3: las decisiones de empresa (estudios, vendedores) se ven con cualquier producto activo.
  var verEmpresa = esPrimero || !!ctx.empresaEnTodos;
  var pid = p.productoId || ('prod_' + (idx + 1));

  // Entradas genéricas: data-mm-campo (ruta), data-mm-nivel (producto|empresa)
  function inpNum(nivel, ruta, val, attrs) {
    return ed ? '<input class="hoja-input editable" type="number" data-mm-nivel="' + nivel + '" data-mm-campo="' + ruta + '" value="' + (val == null ? '' : mmEsc(val)) + '" ' + (attrs || '') + '/>'
      : '<span class="hoja-value-ro">' + (val == null || val === '' ? '—' : mmEsc(val)) + '</span>';
  }
  function selCampo(nivel, ruta, opciones, val) {
    if (!ed) {
      var o = opciones.find(function (x) { return x[0] === val; });
      return '<span class="hoja-value-ro">' + mmEsc(o ? o[1] : (val || '—')) + '</span>';
    }
    return '<select class="hoja-select editable" data-mm-nivel="' + nivel + '" data-mm-campo="' + ruta + '">'
      + opciones.map(function (x) { return '<option value="' + mmEsc(x[0]) + '"' + (x[0] === val ? ' selected' : '') + '>' + mmEsc(x[1]) + '</option>'; }).join('')
      + '</select>';
  }
  function chkLista(nivel, lista, id, marcado, etiqueta) {
    return '<label style="display:inline-flex;align-items:center;gap:6px;margin-right:14px;cursor:' + (ed ? 'pointer' : 'default') + '">'
      + '<input type="checkbox" data-mm-nivel="' + nivel + '" data-mm-lista="' + lista + '" value="' + mmEsc(id) + '"' + (marcado ? ' checked' : '') + (ed ? '' : ' disabled') + '/> '
      + etiqueta + '</label>';
  }
  function fila(label, control, ref) {
    return '<tr><td class="hoja-label">' + label + '</td><td>' + control + '</td><td class="hoja-ref">' + (ref || '') + '</td></tr>';
  }
  // v0.6, etapas 2 y 3 (docente, 05-11-2026): cada sección lleva su bloque
  // (data-hoja-bloque) para ordenar la hoja como un plan de marketing.
  function seccion(titulo, rol, filas, encabezado, bloque) {
    return '<div class="hoja-section"' + (bloque ? ' data-hoja-bloque="' + bloque + '"' : '') + '><div class="hoja-section-title">' + titulo + rol + '</div>'
      + '<table class="hoja-table"><thead><tr>' + (encabezado || '<th>Decisión</th><th>Tu elección</th><th>Referencia</th>') + '</tr></thead><tbody>'
      + filas + '</tbody></table></div>';
  }

  var segs = (ctx.ref && ctx.ref.segmentos) || [];
  var canales = (ctx.ref && ctx.ref.canales || []).map(function (c) { return c.nombre; });
  var segSec = p.segmentoSecundario || 'Ninguno';
  var segsProd = [p.segmentoObjetivo].concat(segSec !== 'Ninguno' && segSec !== p.segmentoObjetivo ? [segSec] : []).filter(Boolean);
  var canalesProd = [p.canalPrincipal].concat(p.canalSecundario && p.canalSecundario !== 'Ninguno' && p.canalSecundario !== p.canalPrincipal ? [p.canalSecundario] : []).filter(Boolean);
  var html = '<div class="hoja-section" data-hoja-bloque="mm-cabecera" style="border-left:3px solid var(--accent3)"><div class="hoja-section-title">🎯 Mezcla de marketing — Producto ' + (idx + 1)
    // v0.6 (docente, 05-11-2026): todas las decisiones desde la ronda 1, como en una empresa real;
    // el aviso de ronda solo aparece si una plantilla todavía las escalona.
    + (M.fase2 ? '' : ' <span style="font-size:.7rem;color:var(--text3)">(etiquetado, servicios y mensaje desde la ronda ' + mmEsc(M.fase2DesdeRonda) + ')</span>')   // v0.4, P2
    + '</div><div style="font-size:.74rem;color:var(--text3)">Cada integrante completa la sección de su rol. Solo Gerencia general envía las decisiones.</div></div>';

  // ── A · Gerencia general ─────────────────────────────────────────
  html += seccion('Segmentos del producto', mmRol('A', 'Gerencia general'),
    fila('🎯 Segmento secundario (opcional)',
      selCampo('producto', 'segmentoSecundario', [['Ninguno', 'Ninguno']].concat(segs.filter(function (s) { return s.nombre !== p.segmentoObjetivo; }).map(function (s) { return [s.nombre, s.nombre]; })), segSec),
      'El producto vende en el segmento objetivo (arriba) y en este. Agregar un segmento suma su población al público objetivo: con el mismo alcance y veces, los medios cuestan más. Cada medio llega al mismo % de personas en los dos segmentos; el efecto en cada uno depende de cuánto le sirve ese medio a ese segmento.'), null, 'mm-A');

  // ── B · Producto y operaciones ───────────────────────────────────
  var mem = (M.productos || {})[pid];
  // v0.4, P4: valores actuales del producto elegido en la sección 1 (memoria
  // de la ronda anterior o, si es nuevo, los de su tipo); se actualizan al
  // cambiar el producto (mmActualizarCaracteristicas).
  var actuales = mmCaracteristicasDe(p.producto, pid);
  var filasB = '';
  Object.keys(M.caracteristicas || {}).forEach(function (k) {
    var c = M.caracteristicas[k];
    // v0.6 (docente, 03-11-2026): qué significa, de dónde sale el valor, costo
    // por nivel (gratis, dato propio) e ideal, brecha e importancia (solo con
    // el estudio comprado, el último, con su ronda).
    filasB += fila('🧩 ' + mmEsc(c.nombre || k), '<span class="hoja-value-ro" data-mm-car="' + mmEsc(k) + '">' + mmValorCaracteristica(actuales, k, p.producto) + '</span>',
      '<span data-mm-car-ref="' + mmEsc(k) + '">' + mmRefCaracteristica(k, p, pid) + '</span>');
  });
  if (mem && mem.proyecto) {
    var pr = mem.proyecto;
    filasB += fila('🔬 Proyecto en curso', '<span class="hoja-value-ro">' + mmEsc((M.caracteristicas[pr.caracteristica] || {}).nombre || pr.caracteristica) + ' → ' + mmEsc(pr.objetivo) + '</span>',
      'Ronda ' + mmEsc(pr.rondasTranscurridas) + ' de al menos ' + mmEsc(pr.rondasBase) + '; invertido ' + mmBs(pr.invertido) + ' de ' + mmBs(pr.costoRequerido) + '.');
  }
  // v0.6, punto 2 (docente, 05-11-2026): las características no se eligen aquí; las
  // decisiones de etiquetado y servicio llevan su propio encabezado «Tu elección».
  if (M.fase2) filasB += '<tr><th>Decisión</th><th>Tu elección</th><th>Referencia</th></tr>';
  if (M.fase2) {
    var sellosSel = Array.isArray(p.sellos) ? p.sellos : [];
    var sellosHTML = Object.keys(M.sellos || {}).map(function (id) {
      var s = M.sellos[id];
      return chkLista('producto', 'sellos', id, sellosSel.indexOf(id) >= 0, mmEsc(s.nombre || id) + ' <span style="color:var(--text3)">(' + mmBs(s.costoUnitario) + '/u)</span>');
    }).join('') || '<span class="hoja-value-ro">—</span>';
    filasB += fila('🏷️ Etiquetado (sellos)', sellosHTML, 'Cada sello tiene un costo por unidad producida y un valor distinto en cada segmento.');
    var servOpts = Object.keys(M.servicios || {}).map(function (id) { return [id, (M.servicios[id].nombre || id) + ' (' + mmBs(M.servicios[id].costoUnitario) + '/u vendida)']; });
    filasB += fila('🛠️ Servicio de apoyo', selCampo('producto', 'servicioApoyo', servOpts, p.servicioApoyo || 'ninguno'),
      'Costo por unidad vendida. Aumenta la lealtad según cuánto lo valora el segmento.');
  }
  html += seccion('Producto', mmRol('B', 'Producto y operaciones'), filasB, '<th>Característica</th><th>Valor actual</th><th>Referencia</th>', 'mm-B');

  // ── C · Marketing ────────────────────────────────────────────────
  // SimMkt v0.4 (sección C, aprobado por el docente): los cinco medios se
  // deciden SOLO aquí (alcance y frecuencia); costo y contactos de cada medio
  // en la misma fila, con total (los calcula el servidor: /api/mezcla/medios);
  // población del segmento en la referencia; sin eficacia de los medios.
  var filasC = '';
  // v0.6 (docente, 03-11-2026): sin «% de audiencia» (forma B: cada medio
  // llega al mismo % de personas en todos los segmentos del producto). Cada
  // medio se decide por alcance y veces, o por monto (Bs) y veces; siempre se
  // ven el costo y el alcance que calcula el servidor.
  var pobTotal = segsProd.reduce(function (a, s) { return a + (Number((M.poblacion || {})[s]) || 0); }, 0);
  // v0.6, etapa 3: la explicación común de los medios va una sola vez (antes se repetía en cada medio).
  filasC += '<tr><td colspan="3" style="padding:8px 10px;font-size:.76rem;color:var(--text2);background:var(--bg3)">ℹ️ <strong>Cómo decidir cada medio:</strong> «Fijar alcance y veces»: eliges a qué % de tu público objetivo llegar y cuántas veces; el sistema calcula el costo. «Fijar monto»: eliges cuánto gastar y cuántas veces; el sistema calcula a qué % llegas. '
    + 'El medio llega al mismo % de personas en cada segmento del producto. Desde 3 veces, cada repetición adicional rinde menos.</td></tr>';
  MM_MEDIOS.forEach(function (m) {
    var info = (M.medios || {})[m] || {};
    var nombre = m === 'promocion' ? 'Promoción al consumidor' : (info.nombre || m);
    var modo = mmGet(p, 'medios.' + m + '.modo') === 'monto' ? 'monto' : 'alcance';
    var control = selCampo('producto', 'medios.' + m + '.modo', [['alcance', 'Fijar alcance y veces'], ['monto', 'Fijar monto (Bs)']], modo)
      + '<div style="margin-top:4px">'
      + '<span data-mm-modo-alcance="' + m + '"' + (modo === 'monto' ? ' style="display:none"' : '') + '>Alcance % ' + inpNum('producto', 'medios.' + m + '.alcance', mmGet(p, 'medios.' + m + '.alcance'), 'min="0" max="100" step="5" style="width:70px"') + '</span>'
      + '<span data-mm-modo-monto="' + m + '"' + (modo === 'monto' ? '' : ' style="display:none"') + '>Monto Bs ' + inpNum('producto', 'medios.' + m + '.monto', mmGet(p, 'medios.' + m + '.monto'), 'min="0" step="500" style="width:90px"') + '</span>'
      + ' · Veces por trimestre ' + inpNum('producto', 'medios.' + m + '.frecuencia', mmGet(p, 'medios.' + m + '.frecuencia'), 'min="0" max="52" step="1" style="width:60px"')
      + '</div>'
      + '<div style="font-size:.74rem;margin-top:4px;color:var(--text2)" data-mm-medio-res="' + m + '">Alcance — · Contactos — · Costo —</div>';
    filasC += fila('📣 ' + mmEsc(nombre), control,
      'Precio por contacto: Bs ' + mmEsc(info.precioContacto) + '.'
      + (m === 'promocion' ? ' Promoción dirigida al consumidor final (la promoción al canal está en Plaza).' : ''));
  });
  filasC += fila('📊 Total de comunicación', '<div style="font-size:.8rem;font-weight:700" id="mmMediosTotal">Contactos — · Costo —</div>',
    'Suma de los cinco medios. Público objetivo = población de los segmentos del producto'
    + (pobTotal ? ' (' + segsProd.map(function (s) { return mmEsc(s) + ': ' + Number((M.poblacion || {})[s] || 0).toLocaleString('es'); }).join(' + ') + ' = ' + pobTotal.toLocaleString('es') + ' personas)' : '')
    + '.');
  // v0.6, etapa 1 (docente, 05-11-2026): la justificación del presupuesto, antes en la sección 2.
  if (ctx.justificacionMediosHTML) filasC += fila('✍️ Justificación', ctx.justificacionMediosHTML, '¿Por qué este reparto entre medios?');
  if (M.fase2) {
    // v0.6, punto 6 (docente, 05-11-2026): tipos de mensaje. Efecto de la comunicación ×
    // (1 + bonusMensaje × receptividad del segmento × credibilidad del producto).
    var mensOpts = [['', 'Sin énfasis']].concat(Object.keys(M.caracteristicas || {}).map(function (k) { return [k, 'Atributo: ' + (M.caracteristicas[k].nombre || k)]; }))
      .concat([['precio', 'Precio / valor'], ['emocional', 'Emocional / estilo de vida']])
      .concat(M.selloSostenible ? [['sostenibilidad', 'Sostenibilidad']] : []);
    var selloSost = M.selloSostenible ? ((M.sellos || {})[M.selloSostenible] || {}).nombre || M.selloSostenible : '';
    filasC += fila('💬 Mensaje', selCampo('producto', 'mensaje', mensOpts, p.mensaje || ''),
      'Qué destaca la comunicación de este producto. Multiplica el efecto de los medios en cada segmento según cuánto le llega ese mensaje y si el producto lo respalda:'
      + '<br>• <strong>Atributo</strong>: rinde más donde esa característica es importante.'
      + '<br>• <strong>Precio / valor</strong>: rinde más en segmentos sensibles al precio; pierde fuerza si tu precio está sobre el precio de referencia.'
      + '<br>• <strong>Emocional / estilo de vida</strong>: rinde más en segmentos que compran por imagen y emoción.'
      + (selloSost ? '<br>• <strong>Sostenibilidad</strong>: rinde más donde valoran el sello «' + mmEsc(selloSost) + '»; sin ese sello en el producto, pierde credibilidad.' : '')
      + '<br>Cambiar de mensaje de una ronda a otra resta notoriedad en tu segmento objetivo.');
  }
  var filasE = '';
  if (verEmpresa) {
    var estSel = Array.isArray(d.estudios) ? d.estudios : [];
    var pctE = function (x) { return (Math.round((Number(x) || 0) * 1000) / 10) + ' %'; };
    // v0.4: C-12 (R2) el Informe de la industria también se compra; una línea
    // por estudio con qué entrega y su margen de error.
    // v0.6 (06-11-2026): mismo orden y código que en Investigación (INV01–INV09).
    var idsE = Object.keys(M.estudios || {});
    if (typeof mmeOrdenEstudios === 'function') idsE = mmeOrdenEstudios(idsE);
    var nomE = function (id, n) { return typeof mmeNombreEstudio === 'function' ? mmeNombreEstudio(id, n) : (n || id); };
    var estHTML = idsE.map(function (id) {
      var e = M.estudios[id];
      return '<div style="margin-bottom:6px">' + chkLista('empresa', 'estudios', id, estSel.indexOf(id) >= 0, mmEsc(nomE(id, e.nombre)) + ' <span style="color:var(--text3)">(' + mmBs(e.costo) + ')</span>')
        + '<div style="font-size:.72rem;color:var(--text3);margin-left:22px">' + (e.entrega ? mmEsc(e.entrega) + ' ' : '') + 'Margen de error ± ' + pctE(e.margenError) + '.</div></div>';
    }).join('');
    filasE += fila('🔍 Estudios de mercado', estHTML || '—', 'Cada estudio tiene costo y margen de error. Se entregan al simular la ronda, en Investigación: compra hoy lo que necesitarás para decidir la próxima ronda.');
    if ((M.estudios || {}).prueba_concepto) {
      filasE += fila('🧪 Prueba de concepto: segmento',
        selCampo('empresa', 'pruebaConcepto.segmento', [['', '—']].concat(segs.map(function (s) { return [s.nombre, s.nombre]; })), mmGet(d, 'pruebaConcepto.segmento') || ''),
        // v0.6, punto 1 (docente, 05-11-2026): para qué sirve y con qué valores se llena.
        'Grupo de clientes al que le «muestras» el prototipo. Solo funciona si marcas «Prueba de concepto» en Estudios de mercado. '
        + 'Al simular, en Investigación verás la aceptación estimada (0 a 100): qué tan cerca está el prototipo de lo que busca ese segmento, según cuánto le importa cada característica. '
        + 'Sirve para probar un cambio antes de pagar un proyecto de I+D o lanzar un producto.');
      Object.keys(M.caracteristicas || {}).forEach(function (k) {
        var ck = M.caracteristicas[k];
        filasE += fila('🧪 Prototipo: ' + mmEsc(ck.nombre || k), inpNum('empresa', 'pruebaConcepto.caracteristicas.' + k, mmGet(d, 'pruebaConcepto.caracteristicas.' + k), 'min="' + mmEsc(ck.min) + '" max="' + mmEsc(ck.max) + '" step="1"'),
          'Nota de ' + mmEsc(ck.min) + ' a ' + mmEsc(ck.max) + ' de un producto que todavía no existe (no se fabrica, solo se evalúa): ' + mmEsc(ck.min) + ' = ' + mmEsc(ck.nivel1 || 'el nivel más bajo') + ' · ' + mmEsc(ck.max) + ' = ' + mmEsc(ck.nivel10 || 'el nivel más alto') + '. Llena las tres características o el estudio no entrega resultado.');
      });
    }
  }
  if (filasE) html += seccion('Estudios de mercado', mmRol('C', 'Marketing'), filasE, null, 'mm-estudios');
  html += seccion('Comunicación', mmRol('C', 'Marketing'), filasC, null, 'mm-C');

  // ── D · Ventas y distribución ────────────────────────────────────
  var filasD = '';
  canalesProd.forEach(function (c) {
    filasD += fila('🏬 ' + mmEsc(c) + ': intensidad', selCampo('producto', 'intensidadCanal.' + c, MM_INTENSIDADES.map(function (x) {
      var costo = ((M.intensidades || {})[x[0]] || {}).costoTrimestral; return [x[0], x[1] + (costo != null ? ' (' + mmBs(costo) + '/trim.)' : '')];
    }), mmGet(p, 'intensidadCanal.' + c) || 'selectiva'), 'Más intensidad: más cobertura y más costo.');
    filasD += fila('🏬 ' + mmEsc(c) + ': descuento al canal (%)', inpNum('producto', 'descuentoCanal.' + c, mmGet(p, 'descuentoCanal.' + c), 'min="0" max="' + Math.round((M.descuentoMaximo || 0) * 100) + '" step="1"'),
      'Empuje: sube la cobertura; baja el precio facturado. Máximo ' + Math.round((M.descuentoMaximo || 0) * 100) + ' %.');
    filasD += fila('🏬 ' + mmEsc(c) + ': promoción al canal (Bs)', inpNum('producto', 'promocionCanal.' + c, mmGet(p, 'promocionCanal.' + c), 'min="0" step="500"'), 'Empuje: sube la cobertura.');
  });
  // v0.6 (docente, 03-11-2026): sin alianza de canal. Fuerza de ventas por
  // canal: vendedores disponibles, solo los canales que usan los productos,
  // cobertura actual (gratis), objetivo, ronda siguiente y efecto de ±1
  // vendedor (POST /api/mezcla/cobertura, fórmulas del motor).
  if (verEmpresa) {
    var usadosEmp = mmCanalesEmpresa();
    filasD += '<tr><td colspan="3" style="padding:8px 10px;font-weight:700;font-size:.8rem;border-top:2px solid var(--border2)">👔 Fuerza de ventas por canal <span style="font-weight:400;color:var(--text3)">(aplica a toda la empresa)</span></td></tr>';
    // v0.6, etapa 1: contratar y despedir vendedores (antes en la sección 2) van aquí.
    filasD += (ctx.vendedoresFilasHTML || '');
    filasD += fila('👔 Vendedores disponibles', '<span class="hoja-value-ro" id="mmVendTotal">—</span>',
      'Vendedores actuales + contratados − despedidos (filas de arriba). Se pagan todos, aunque no los asignes a un canal.');
    canales.forEach(function (c) {
      filasD += '<tr data-mm-vend-row="' + mmEsc(c) + '"' + (usadosEmp.indexOf(c) >= 0 ? '' : ' style="display:none"') + '><td class="hoja-label">👔 Vendedores en ' + mmEsc(c) + '</td><td>'
        + inpNum('empresa', 'vendedoresCanal.' + c, mmGet(d, 'vendedoresCanal.' + c), 'min="0" step="1"')
        + '</td><td class="hoja-ref" data-mm-vend-ref="' + mmEsc(c) + '">—</td></tr>';
      // v0.6 (docente, 06-11-2026): comisión de vendedores del canal, en %, decidida por el equipo.
      if (M.comisionVendedores) {
        var tasaC = mmGet(d, 'comisionCanal.' + c);
        filasD += '<tr data-mm-vend-row="' + mmEsc(c) + '"' + (usadosEmp.indexOf(c) >= 0 ? '' : ' style="display:none"') + '><td class="hoja-label">💸 Comisión de vendedores en ' + mmEsc(c) + ' (%)</td><td>'
          + inpNum('empresa', 'comisionCanal.' + c, tasaC, 'min="0" max="100" step="0.5"')
          + '</td><td class="hoja-ref" data-mm-com-ref="' + mmEsc(c) + '">' + mmTextoComision(M.comisionVendedores, tasaC) + '</td></tr>';
      }
    });
    filasD += fila('👔 Resumen', '<span class="hoja-value-ro" id="mmVendResumen">—</span>',
      'Cuántos vendedores asignaste a los canales y si sobran: los que sobran se pagan, pero no venden. Sin canal elegido no hay a dónde asignarlos.');   // v0.6, punto 5
    filasD += '<tr><td colspan="3" style="padding:8px 10px;font-size:.76rem;color:var(--text2);background:var(--bg3)"><details><summary style="cursor:pointer">ℹ️ <strong>¿Para qué sirven los vendedores? Reglas del reparto</strong></summary>'
      + '<strong>¿Para qué sirve?</strong> Los vendedores logran que tu producto esté en más puntos de venta: eso es la <strong>cobertura</strong>. Si tu producto no está donde compran tus clientes, no te compran. '
      + 'Cada vendedor adicional suma menos cobertura que el anterior: reparte para que el último vendedor rinda parecido en cada canal. '
      + 'La cobertura cambia de a poco: cada ronda avanza ' + Math.round((Number(M.alphaCobertura) || 0.4) * 100) + ' % de la distancia hacia su objetivo.<br>'
      + '<strong>Reglas:</strong> si dejas todos los campos vacíos, se reparten en partes iguales entre los canales en uso. Si llenas alguno, los vacíos valen 0. Si asignas más de los que tienes, se reducen en proporción.<br>'
      + '<strong>Comisión por canal:</strong> la decides tú (0 a 100 %) y se paga además del sueldo, sobre las ventas sin IVA del canal (las ventas de cada producto se reparten entre sus canales según su cobertura). Motiva a los vendedores del canal: sube el atractivo de tus productos en la misma ronda y la cobertura del canal desde la ronda siguiente, con rendimientos decrecientes. Si el canal no tiene vendedores, no se paga ni tiene efecto. Conviene cuando el esfuerzo extra se convierte en ventas (por ejemplo, si te sobra capacidad de producción); si ya vendes todo lo que produces, solo es costo.</details></td></tr>';
  }
 if (!verEmpresa) filasD += '<tr><td colspan="3" style="padding:6px 10px;font-size:.76rem;color:var(--text3);font-style:italic">ℹ️ Contratar, despedir y repartir vendedores se decide en <strong>Producto 1</strong> y aplica a toda la empresa.</td></tr>';
  html += seccion('Distribución', mmRol('D', 'Ventas y distribución'), filasD, null, 'mm-D');

  // ── F · Resumen ──────────────────────────────────────────────────
  html += '<div class="hoja-section" data-hoja-bloque="mm-F"><div class="hoja-section-title">Resumen y proyección' + mmRol('F', 'Resumen') + '</div>'
    // v0.6, etapa 1: el pronóstico pasó a la sección 2 de la hoja (antes de producción).
    + (ed ? '<button type="button" class="btn btn-ghost btn-sm" id="btnMmProyeccion" style="margin-top:8px">🧮 Calcular costo, margen y estado proyectado</button>' : '')
    + '<div id="mmProyeccion" style="margin-top:10px"></div></div>';
  return html;
}

/** v0.4, P4: características actuales de un producto (memoria propia o las de su tipo). */
function mmCaracteristicasDe(producto, pid) {
  var M = hojaMezcla;
  if (!M || !producto) return null;
  var mem = (M.productos || {})[pid];
  if (mem && mem.tipo === producto && mem.caracteristicas) return mem.caracteristicas;
  return (M.caracteristicasIniciales || {})[producto] || null;
}
function mmValorCaracteristica(actuales, k, producto) {
  if (actuales && actuales[k] != null) return mmEsc(actuales[k]);
  return producto ? '—' : '— (elige el tipo de producto en Mercado meta)';
}
function mmActualizarCaracteristicas(producto) {
  var idx = (typeof hojaProductoActivo === 'number') ? hojaProductoActivo : 0;   // eslint-disable-line no-undef
  var actuales = mmCaracteristicasDe(producto, 'prod_' + (idx + 1));
  document.querySelectorAll('[data-mm-car]').forEach(function (el) { el.innerHTML = mmValorCaracteristica(actuales, el.dataset.mmCar, producto); });
  mmRefrescarCaracteristicas();
}

/** v0.6: producto y segmentos del producto activo, leídos de la hoja (DOM o estado). */
function mmProductoDeHoja() {
  var idx = (typeof hojaProductoActivo === 'number') ? hojaProductoActivo : 0;   // eslint-disable-line no-undef
  var prod = (state.decisiones && state.decisiones.productos && state.decisiones.productos[idx]) || {};
  var val = function (sel, def) { var el = document.querySelector(sel); return el ? el.value : def; };
  var producto = (val('[data-hoja-field="producto"]', prod.producto) || '').replace(/\s*\(Bs[\s\d.]+\)\s*$/, '').trim();
  return { idx: idx, pid: prod.productoId || ('prod_' + (idx + 1)), producto: producto,
    segmentoObjetivo: val('[data-hoja-field="segmentoObjetivo"]', prod.segmentoObjetivo),
    segmentoSecundario: val('[data-mm-campo="segmentoSecundario"]', prod.segmentoSecundario) };
}

function mmBsSigno(v) {
  if (v == null) return null;
  return (v >= 0 ? '+' : '−') + mmBs(Math.abs(v));
}

/**
 * v0.6 (docente, 03-11-2026): referencia de una característica en B · Producto:
 * qué es y qué significan 1 y 10; «más alto no siempre es mejor»; de dónde
 * sale el valor; costo por unidad de ±1 nivel (dato propio, gratis); ideal y
 * brecha (último estudio Puntos ideales comprado) e importancia (última
 * Encuesta de consumidores comprada), con la ronda del estudio.
 */
function mmRefCaracteristica(k, p, pid) {
  var M = hojaMezcla;
  if (!M) return '';
  var c = (M.caracteristicas || {})[k] || {};
  var producto = p && p.producto;
  var mem = (M.productos || {})[pid];
  var conMemoria = !!(mem && mem.tipo === producto && mem.caracteristicas);
  var actuales = mmCaracteristicasDe(producto, pid);
  var v = actuales && actuales[k] != null ? Number(actuales[k]) : null;
  var t = [];
  t.push((c.descripcion ? mmEsc(c.descripcion) + ' ' : '') + mmEsc(c.min) + ' = ' + mmEsc(c.nivel1 || 'el nivel más bajo') + ' · ' + mmEsc(c.max) + ' = ' + mmEsc(c.nivel10 || 'el nivel más alto') + '.');
  // v0.6, punto 2: de dónde sale el valor, a la vista (no se elige en esta fila).
  t.push('<strong>' + (conMemoria ? 'Valor actual (ronda anterior)' : 'Valor inicial (plantilla del docente)') + '</strong>: no se escribe aquí; se cambia con un proyecto de I+D (Innovación, tipo «Innovación incremental de producto», en este mismo bloque).');
  // v0.6, etapa 3: lo explicativo va plegado («Más información») para acortar la hoja.
  t.push('<details><summary style="cursor:pointer;color:var(--text3)">Más información</summary>Más alto no siempre es mejor: conviene acercarse al punto ideal de tu segmento, y cada nivel cambia el costo. '
    + (conMemoria ? 'El valor es el que el producto tenía al cerrar la ronda anterior.' : 'El valor es el inicial del producto, fijado por el docente en la plantilla de la industria.')
    + ' Solo cambia cuando termina un proyecto de I+D (investigación y desarrollo); rige desde la ronda siguiente.</details>');
  var cn = (conMemoria && mem.costoNivel) ? mem.costoNivel : (M.costoNivelTipo || {})[producto];
  var ck = cn && cn[k];
  if (ck) {
    t.push('💲 Costo por unidad: subir 1 nivel ' + (mmBsSigno(ck.sube) || '— (ya está en el máximo)') + ' · bajar 1 nivel ' + (mmBsSigno(ck.baja) || '— (ya está en el mínimo)') + '.');
  }
  var segs = [p && p.segmentoObjetivo].concat(p && p.segmentoSecundario && p.segmentoSecundario !== 'Ninguno' && p.segmentoSecundario !== p.segmentoObjetivo ? [p.segmentoSecundario] : []).filter(Boolean);
  var nombre = c.nombre || k;
  var UI = M.ultimoIdeal;
  if (UI && segs.length) {
    var lin = segs.map(function (sg) {
      var ideal = (UI.segmentos || {})[sg] ? UI.segmentos[sg][nombre] : null;
      if (ideal == null) return mmEsc(sg) + ': sin dato en el estudio';
      var txt = mmEsc(sg) + ': ideal ' + mmEsc(ideal);
      if (v != null) {
        var b = Math.round((v - Number(ideal)) * 10) / 10;
        txt += Math.abs(b) < 0.5 ? ' → estás en el ideal' : (b > 0 ? ' → te sobran ' + b + ' nivel(es)' : ' → te faltan ' + (-b) + ' nivel(es)');
      }
      return txt;
    });
    t.push('🎯 Según el estudio Puntos ideales de la ronda ' + mmEsc(UI.ronda) + ' (± ' + Math.round((Number(UI.margenError) || 0) * 100) + ' %): ' + lin.join(' · ') + '.');
  } else {
    t.push('🔒 Compra el estudio Puntos ideales para comparar con lo que busca tu segmento.');
  }
  var UC = M.ultimosCriterios;
  var conCrit = UC && segs.filter(function (sg) { return Array.isArray((UC.segmentos || {})[sg]); });
  if (conCrit && conCrit.length) {
    t.push('📊 Importancia (Encuesta de consumidores, ronda ' + mmEsc(UC.ronda) + '): ' + conCrit.map(function (sg) {
      var lista = UC.segmentos[sg]; var pos = lista.indexOf(nombre);
      return mmEsc(sg) + ': ' + (pos >= 0 ? (pos + 1) + '.º de ' + lista.length + ' criterios' : 'sin dato');
    }).join(' · ') + '.');
  } else {
    t.push('🔒 Compra la Encuesta de consumidores para conocer el orden de importancia de los criterios en tu segmento.');
  }
  return t.map(function (x) { return '<div style="margin-bottom:3px">' + x + '</div>'; }).join('');
}

/** v0.6: vuelve a escribir las referencias de las características (producto o segmentos cambiaron). */
function mmRefrescarCaracteristicas() {
  if (!hojaMezcla) return;
  var p = mmProductoDeHoja();
  document.querySelectorAll('[data-mm-car-ref]').forEach(function (el) { el.innerHTML = mmRefCaracteristica(el.dataset.mmCarRef, p, p.pid); });
  mmActualizarCalculoID();
}

/** v0.6: canales que usan los productos de la empresa (sección 1 de cada producto). */
function mmCanalesEmpresa() {
  var out = [];
  ((state.decisiones && state.decisiones.productos) || []).forEach(function (p) {
    [p.canalPrincipal, p.canalSecundario].forEach(function (c) { if (c && c !== 'Ninguno' && out.indexOf(c) < 0) out.push(c); });
  });
  return out;
}

/**
 * v0.6 (docente, 03-11-2026): sección 4 Innovación, tipo «Característica».
 * Cálculo en vivo con la regla del motor (mezclaMarketing.avanzarProyecto):
 * distancia, plazo mínimo, costo del proyecto y cuánto cubre la inversión.
 */
function mmActualizarCalculoID() {
  var M = hojaMezcla;
  var out = document.getElementById('mmCalculoID');
  var refObj = document.getElementById('mmIDObjetivoRef');
  if (!M || (!out && !refObj)) return;
  var val = function (f) { var el = document.querySelector('[data-hoja-field="' + f + '"]'); return el ? (el.type === 'checkbox' ? el.checked : el.value) : null; };
  var p = mmProductoDeHoja();
  var k = val('idCaracteristica');
  var c = (M.caracteristicas || {})[k];
  var actuales = mmCaracteristicasDe(p.producto, p.pid);
  var actual = actuales && k && actuales[k] != null ? Number(actuales[k]) : null;
  if (refObj) {
    refObj.innerHTML = c
      ? 'Nuevo valor de «' + mmEsc(c.nombre || k) + '»: ' + mmEsc(c.min) + ' = ' + mmEsc(c.nivel1 || 'el nivel más bajo') + ' · ' + mmEsc(c.max) + ' = ' + mmEsc(c.nivel10 || 'el nivel más alto') + '.'
        + (actual != null ? ' Valor actual: <strong>' + mmEsc(actual) + '</strong>.' : '') + ' Rige desde la ronda siguiente a la que termina el proyecto.'
      : 'Solo para «Innovación incremental de producto»: nota que tendrá la característica al terminar el proyecto (elige primero la característica para ver su valor actual). '
        + 'Ejemplo: de 4 a 7 = 3 niveles: al menos ' + Math.ceil(3 / (Number((M.investigacionDesarrollo || {}).puntosPorRonda) || 1)) + ' ronda(s) y ' + mmBs(3 * (Number((M.investigacionDesarrollo || {}).costoPorPunto) || 0)) + ', en una o varias rondas. Rige desde la ronda siguiente a la que termina.';
  }
  if (!out) return;
  // v0.6, punto 3: con Producto, Proceso o Canal, vista previa del acumulado y de su efecto.
  var TIPO_ACUM = { Producto: 'producto', Proceso: 'proceso', Canal: 'canal' };
  var tAcum = TIPO_ACUM[val('tipoInnovacion')];
  if (tAcum) {
    var cI = (M.innovacion || {})[tAcum] || {};
    var memI = (M.productos || {})[p.pid];
    var prevA = memI && memI.tipo === p.producto && memI.innovacion ? Number(memI.innovacion[tAcum]) || 0 : 0;
    var montoA = val('innovacion') ? Math.max(0, Number(val('montoInnovacion')) || 0) : 0;
    var A = (1 - (Number(cI.delta) || 0)) * prevA + montoA;
    var ef = Number(cI.K) > 0 ? (Number(cI.maximo) || 0) * (1 - Math.exp(-A / Number(cI.K))) : 0;
    var pctI = function (x) { return (Math.round(x * 1000) / 10) + ' %'; };
    out.innerHTML = '📐 Acumulado: ' + mmBs(prevA) + ' de antes → ' + mmBs(Math.round(A)) + ' con esta ronda. Efecto: '
      + (tAcum === 'proceso' ? '−' + pctI(ef) + ' del costo base por unidad' : '+' + pctI(ef) + ' de atractivo')
      + ' (tope ' + pctI(Number(cI.maximo) || 0) + ').' + (val('innovacion') ? '' : '<br><span style="color:var(--accent4)">⚠️ Marca «Sí, innovar» para que la inversión cuente.</span>');
    return;
  }
  if (val('tipoInnovacion') !== 'Característica') { out.innerHTML = ''; return; }
  var obj = Number(val('idObjetivo'));
  if (!c || !(obj > 0) || actual == null) { out.innerHTML = 'Elige la característica y el valor objetivo para ver el plazo y el costo del proyecto.'; return; }
  obj = Math.min(Number(c.max || 10), Math.max(Number(c.min || 1), obj));
  var id = M.investigacionDesarrollo || {};
  var dist = Math.abs(obj - actual);
  if (dist === 0) { out.innerHTML = 'El valor objetivo es igual al actual: no hay proyecto que hacer.'; return; }
  var ppr = Number(id.puntosPorRonda) || 1, rmax = Number(id.rondasMaximas) || 3;
  var rondas = Math.min(rmax, Math.max(1, Math.ceil(dist / ppr)));
  var costo = Math.round((Number(id.costoPorPunto) || 0) * dist * 100) / 100;
  var mem = (M.productos || {})[p.pid];
  var pr = mem && mem.tipo === p.producto && mem.proyecto && mem.proyecto.caracteristica === k && Number(mem.proyecto.objetivo) === obj ? mem.proyecto : null;
  var previo = pr ? Number(pr.invertido) || 0 : 0;
  var monto = Math.max(0, Number(val('montoInnovacion')) || 0);
  var falta = Math.round((costo - previo - monto) * 100) / 100;
  var t = '📐 Distancia: ' + dist + ' nivel(es) (de ' + actual + ' a ' + obj + '). Plazo mínimo: ' + rondas + ' ronda(s). Costo del proyecto: ' + mmBs(costo) + ' (' + mmBs(id.costoPorPunto) + ' por nivel).'
    + (pr ? ' Ya invertido en este proyecto: ' + mmBs(previo) + ' (ronda ' + mmEsc(pr.rondasTranscurridas) + ' de al menos ' + mmEsc(pr.rondasBase) + ').' : '')
    + '<br>Con ' + mmBs(monto) + ' esta ronda: ' + (falta > 0 ? '<span style="color:var(--accent4)">faltan ' + mmBs(falta) + '; el proyecto sigue abierto hasta cubrir el costo.</span>' : '<span style="color:var(--accent5)">el costo queda cubierto; termina al cumplirse el plazo y el nuevo valor rige desde la ronda siguiente.</span>')
    + (val('innovacion') ? '' : '<br><span style="color:var(--accent4)">⚠️ Marca «Sí, innovar» para que el proyecto avance.</span>')
    + (!pr && mem && mem.proyecto ? '<br><span style="color:var(--accent4)">⚠️ Tienes otro proyecto en curso: cambiar de característica u objetivo lo reinicia y se pierde lo invertido.</span>' : '');
  out.innerHTML = t;
}

/** Copia los campos del panel al estado de la hoja (producto activo y empresa). */
function mmSincronizarDesdeDOM(root) {
  if (!hojaMezcla || !state.decisiones) return;
  var idx = (typeof hojaProductoActivo === 'number') ? hojaProductoActivo : 0;
  var prod = state.decisiones.productos && state.decisiones.productos[idx];
  var destino = function (nivel) { return nivel === 'empresa' ? state.decisiones : prod; };
  (root || document).querySelectorAll('[data-mm-campo]').forEach(function (el) {
    var obj = destino(el.dataset.mmNivel);
    if (!obj) return;
    var v = el.type === 'number' ? (el.value === '' ? null : +el.value) : el.value;
    mmSet(obj, el.dataset.mmCampo, v);
    if (el.dataset.mmNivel === 'producto' && idx === 0 && el.dataset.mmCampo.indexOf('.') < 0) state.decisiones[el.dataset.mmCampo] = v;
  });
  var listas = {};
  (root || document).querySelectorAll('[data-mm-lista]').forEach(function (el) {
    var k = el.dataset.mmNivel + '|' + el.dataset.mmLista;
    listas[k] = listas[k] || [];
    if (el.checked) listas[k].push(el.value);
  });
  Object.keys(listas).forEach(function (k) {
    var partes = k.split('|');
    var obj = destino(partes[0]);
    if (obj) obj[partes[1]] = listas[k];
  });
  // Descuento al canal: la hoja lo pide en %, el motor acepta % o fracción.
}

/** Enlaza el panel: marca cambios sin guardar y el botón de proyección. */
function mmEnlazar(cont) {
  if (!hojaMezcla || !cont) return;
  cont.querySelectorAll('[data-mm-campo],[data-mm-lista]').forEach(function (el) {
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', function () {
      hojaTieneCambiosSinGuardar = true;   // eslint-disable-line no-undef
      var campo = el.dataset.mmCampo || '';
      // v0.6: alternar entre «Fijar alcance y veces» y «Fijar monto (Bs)».
      var mModo = /^medios\.([^.]+)\.modo$/.exec(campo);
      if (mModo) {
        var monto = el.value === 'monto';
        cont.querySelectorAll('[data-mm-modo-alcance="' + mModo[1] + '"]').forEach(function (x) { x.style.display = monto ? 'none' : ''; });
        cont.querySelectorAll('[data-mm-modo-monto="' + mModo[1] + '"]').forEach(function (x) { x.style.display = monto ? '' : 'none'; });
      }
      mmSincronizarDesdeDOM(cont);
      // v0.4/v0.6: medios o segmento secundario cambian el costo y el alcance de los medios.
      if (/^(medios\.|segmentoSecundario)/.test(campo)) mmProgramarMedios();
      if (campo === 'segmentoSecundario') mmRefrescarCaracteristicas();
      // v0.6: vendedores, intensidad, descuento o promoción al canal cambian la cobertura.
      if (/^(vendedoresCanal\.|intensidadCanal\.|descuentoCanal\.|promocionCanal\.|comisionCanal\.)/.test(campo)) mmProgramarCobertura();
      var mCom = /^comisionCanal\.(.+)$/.exec(campo);
      if (mCom && hojaMezcla && hojaMezcla.comisionVendedores) cont.querySelectorAll('[data-mm-com-ref]').forEach(function (x) { if (x.dataset.mmComRef === mCom[1]) x.innerHTML = mmTextoComision(hojaMezcla.comisionVendedores, el.value); });
    });
  });
  var b = cont.querySelector('#btnMmProyeccion');
  if (b) b.addEventListener('click', mmCalcularProyeccion);
  // v0.4, P4: al cambiar el producto en la sección 1, el bloque B muestra sus características.
  var selProd = cont.querySelector('[data-hoja-field="producto"]');
  if (selProd) selProd.addEventListener('change', function () { mmActualizarCaracteristicas(selProd.value.replace(/\s*\(Bs[\s\d.]+\)\s*$/, '').trim()); });
  // v0.6: campos de la hoja que cambian las referencias del panel.
  ['segmentoObjetivo'].forEach(function (f) {
    var el = cont.querySelector('[data-hoja-field="' + f + '"]');
    if (el) el.addEventListener('change', function () { mmRefrescarCaracteristicas(); mmProgramarMedios(); });
  });
  ['idCaracteristica', 'idObjetivo', 'montoInnovacion', 'tipoInnovacion', 'innovacion'].forEach(function (f) {
    var el = cont.querySelector('[data-hoja-field="' + f + '"]');
    if (el) el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', mmActualizarCalculoID);
  });
  ['contratarVendedores', 'despedirVendedores', 'canalPrincipal', 'canalSecundario', 'producto'].forEach(function (f) {
    var el = cont.querySelector('[data-hoja-field="' + f + '"]');
    if (el) el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', mmProgramarCobertura);
  });
  mmActualizarMedios();
  mmActualizarCalculoID();
  mmActualizarCobertura();
}

/**
 * v0.6 (docente, 03-11-2026): fuerza de ventas por canal, calculada por el
 * servidor con el borrador de la hoja (POST /api/mezcla/cobertura).
 */
/**
 * v0.6 (06-11-2026): texto de la comisión de vendedores de un canal: qué cuesta y qué
 * efecto tiene con la tasa escrita (misma fórmula del motor: máximo·(1 − e^(−t/K))).
 */
function mmTextoComision(C, valor) {
  var t = Math.min(100, Math.max(0, Number(valor) || 0));
  var ef = function (e) { return t > 0 ? (Number(e && e.maximo) || 0) * (1 - Math.exp(-t / (Number(e && e.K) || 5))) : 0; };
  var pct = function (x) { return (Math.round(x * 1000) / 10).toLocaleString('es') + ' %'; };
  var base = 'Se paga además del sueldo (' + mmBs(C.sueldoVendedor) + ' por vendedor), sobre las ventas sin IVA de este canal. Solo si el canal tiene vendedores.';
  if (!(t > 0)) return base + ' Con 0 %: sin costo ni efecto.';
  return base + ' Con <strong>' + (Math.round(t * 10) / 10).toLocaleString('es') + ' %</strong>: atractivo <strong>+' + pct(ef(C.atractivo)) + '</strong> en esta ronda y los vendedores del canal rinden <strong>+'
    + pct(ef(C.cobertura)) + '</strong> (cobertura desde la ronda siguiente). Cada punto adicional aporta menos que el anterior.';
}

var mmCoberturaTimer = null;
function mmProgramarCobertura() { clearTimeout(mmCoberturaTimer); mmCoberturaTimer = setTimeout(mmActualizarCobertura, 400); }
async function mmActualizarCobertura() {
  if (!hojaMezcla || !state.decisiones || !document.getElementById('mmVendTotal')) return;
  try {
    if (typeof sincronizarHojaConEstado === 'function') sincronizarHojaConEstado();   // eslint-disable-line no-undef
    var r = await api('POST', '/api/mezcla/cobertura', { decision: state.decisiones });
    var pct = function (x) { return (Math.round((Number(x) || 0) * 10) / 10).toLocaleString('es') + ' %'; };
    var pts = function (x) { return (x >= 0 ? '+' : '−') + (Math.round(Math.abs(Number(x) || 0) * 10) / 10).toLocaleString('es') + ' puntos'; };
    var tot = document.getElementById('mmVendTotal');
    if (tot) tot.textContent = (r.total || 0) + ' vendedor(es)';
    var usados = (r.canales || []).map(function (c) { return c.canal; });
    document.querySelectorAll('[data-mm-vend-row]').forEach(function (row) { row.style.display = usados.indexOf(row.dataset.mmVendRow) >= 0 ? '' : 'none'; });
    (r.canales || []).forEach(function (c) {
      var varios = (c.productos || []).length > 1;
      var txt = 'Vendedores que trabajan este canal: <strong>' + (Math.round(c.vendedores * 100) / 100).toLocaleString('es') + '</strong>.'
        + (c.productos || []).map(function (p) {
          return '<div>' + (varios ? mmEsc(p.producto) + ': ' : '') + 'Cobertura actual <strong>' + pct(p.actual) + '</strong> · objetivo ' + pct(p.objetivo) + ' · próxima ronda ' + pct(p.siguiente)
            + '. Un vendedor más: ' + pts(p.masUno) + (p.menosUno != null ? ' · uno menos: ' + pts(p.menosUno) : '') + '.</div>';
        }).join('');
      document.querySelectorAll('[data-mm-vend-ref]').forEach(function (el) { if (el.dataset.mmVendRef === c.canal) el.innerHTML = txt; });
    });
    var res = document.getElementById('mmVendResumen');
    if (res) {
      if (!usados.length) res.textContent = 'Elige el canal de tus productos en Plaza (arriba).';
      else if (r.repartoAutomatico) res.textContent = 'Reparto automático: ' + (r.total || 0) + ' vendedor(es) en partes iguales entre ' + usados.length + ' canal(es).';
      else {
        res.innerHTML = 'Asignados ' + r.asignados + ' de ' + r.total + ' · Sin asignar ' + r.sinAsignar
          + (r.exceso ? ' <span style="color:var(--accent4)">· Asignaste más de los que tienes: se reducen en proporción.</span>'
            : (r.sinAsignar > 0 ? ' <span style="color:var(--accent4)">· Los que sobran se pagan, pero no venden.</span>' : ''));
      }
      res.style.color = (r.exceso || r.sinAsignar > 0) ? 'var(--accent4)' : '';
    }
  } catch (e) { /* sin respuesta: el servidor calcula la cobertura al simular */ }
}

/**
 * v0.4 (sección C de la hoja): contactos y costo de los cinco medios del
 * producto activo, calculados por el servidor (POST /api/mezcla/medios). Se
 * muestran en la sección C (fila y total) y, en solo lectura, en la sección 2;
 * el costo queda como monto de cada medio en la decisión.
 */
var mmMediosTimer = null;
function mmProgramarMedios() { clearTimeout(mmMediosTimer); mmMediosTimer = setTimeout(mmActualizarMedios, 350); }
async function mmActualizarMedios() {
  if (!hojaMezcla || !state.decisiones) return;
  var idx = (typeof hojaProductoActivo === 'number') ? hojaProductoActivo : 0;   // eslint-disable-line no-undef
  var prod = state.decisiones.productos && state.decisiones.productos[idx];
  if (!prod) return;
  try {
    var segObj = (document.querySelector('[data-hoja-field="segmentoObjetivo"]') || {}).value || prod.segmentoObjetivo;
    var r = await api('POST', '/api/mezcla/medios', { producto: { segmentoObjetivo: segObj, segmentoSecundario: prod.segmentoSecundario, medios: prod.medios || {} } });
    MM_MEDIOS.forEach(function (m) {
      var x = (r.medios || {})[m] || { contactos: 0, costo: 0 };
      prod[m] = x.costo;
      if (idx === 0) state.decisiones[m] = x.costo;
      // v0.6: alcance logrado (mismo % en cada segmento del producto), contactos y costo.
      document.querySelectorAll('[data-mm-medio-res="' + m + '"]').forEach(function (el) {
        el.innerHTML = 'Alcance ' + (Number(x.alcance) || 0).toLocaleString('es') + ' % del público objetivo' + (x.frecuencia ? ', ' + x.frecuencia + ' veces' : '')
          + ' · Contactos ' + (x.contactos || 0).toLocaleString('es') + ' · Costo ' + mmBs(x.costo)
          + (x.tope ? '<br><span style="color:var(--accent4)">⚠️ El monto alcanza para más del 100 % del público: el exceso no suma efecto.</span>' : '');
      });
      document.querySelectorAll('[data-mm-costo-medio="' + m + '"]').forEach(function (el) { el.textContent = mmBs(x.costo); });
    });
    var t = document.getElementById('mmMediosTotal');
    if (t && r.total) t.textContent = 'Contactos ' + (r.total.contactos || 0).toLocaleString('es') + ' · Costo ' + mmBs(r.total.costo);
  } catch (e) { /* sin respuesta: el servidor recalcula el costo al enviar */ }
}

async function mmCalcularProyeccion() {
  var cont = document.getElementById('mmProyeccion');
  if (!cont) return;
  try {
    if (typeof sincronizarHojaConEstado === 'function') sincronizarHojaConEstado();   // eslint-disable-line no-undef
    cont.innerHTML = '<span style="color:var(--text3)">Calculando…</span>';
    var r = await api('POST', '/api/mezcla/proyeccion', { decision: state.decisiones });
    cont.innerHTML = mmProyeccionHTML(r);
  } catch (e) {
    cont.innerHTML = '<span style="color:var(--accent4)">' + mmEsc(e.message) + '</span>';
  }
}

function mmProyeccionHTML(r) {
  var filasP = (r.productos || []).map(function (p) {
    var rango = p.rangoPrecio ? (mmBs(p.rangoPrecio.minimo) + ' a ' + mmBs(p.rangoPrecio.maximo)) : 'sin límite';
    return '<tr><td>' + mmEsc(p.producto) + '</td><td>' + mmBs(p.precioLista) + '</td><td>' + mmBs(p.precioFacturado) + '</td><td>' + mmBs(p.costoUnitario) + '</td>'
      + '<td style="color:' + (p.margenUnitario < 0 ? 'var(--accent4)' : 'var(--accent5)') + '">' + mmBs(p.margenUnitario) + '</td>'
      + '<td style="color:' + (p.margenContribucionUnitario < 0 ? 'var(--accent4)' : 'var(--accent5)') + '">' + (p.margenContribucionUnitario != null ? mmBs(p.margenContribucionUnitario) : '—') + '</td><td>' + rango + '</td></tr>'
      + (p.avisoBajoCosto ? '<tr><td colspan="7" style="color:var(--accent4);font-size:.75rem">⚠️ El precio (sin IVA) queda por debajo del costo por unidad de ' + mmEsc(p.producto) + '.</td></tr>' : '');
  }).join('');
  var er = r.estadoResultados || {};
  var lineas = [['ventasBrutasPrecioLista', 'Ventas brutas a precio de lista'], ['descuentosComerciales', '(−) Descuentos comerciales'], ['ventasBrutas', '= Ventas brutas'],
    ['comisionesNeto', '(−) Comisiones de canal'], ['ventasNetasReal', '= Ventas netas'], ['costoVentas', '(−) Costo de ventas'], ['utilidadBruta', '= Utilidad bruta'],
    ['gastosOp', '(−) Gastos operativos'], ['ebit', '= Utilidad operativa'], ['gastoFinanciero', '(−) Gastos financieros'], ['totalImpuestos', '(−) Impuestos'], ['utilidadNeta', '= Utilidad neta']];
  var pe = r.puntoEquilibrio || {};
  return '<table class="hoja-table"><thead><tr><th>Producto</th><th>Precio de lista</th><th>Precio facturado</th><th>Costo por unidad</th><th>Margen por unidad sobre costo total (sin IVA)</th><th>Margen de contribución por unidad (sin IVA)</th><th>Precio permitido</th></tr></thead><tbody>' + filasP + '</tbody></table>'
    + '<div style="margin-top:8px;font-weight:700;font-size:.8rem">Estado de resultados proyectado (con el pronóstico)</div>'
    + '<table class="hoja-table"><tbody>' + lineas.map(function (l) { return '<tr><td>' + l[1] + '</td><td style="text-align:right">' + mmBs(er[l[0]]) + '</td></tr>'; }).join('') + '</tbody></table>'
    + '<div style="margin-top:8px;font-size:.8rem"><strong>Punto de equilibrio:</strong> '
    + (pe.unidades != null ? (pe.unidades.toLocaleString('es') + ' unidades (' + mmBs(pe.ventasBs) + ') — gastos fijos ' + mmBs(pe.gastosFijos) + ' ÷ margen de contribución por unidad ' + mmBs(pe.margenContribucionPromedio)) : mmEsc(pe.nota || '—'))
    + '</div>';
}

/** Estados Financieros: Proyectado / Real / Diferencia (con el pronóstico de la ronda). */
function mmTablaProyectadoRealHTML(proy) {
  if (!proy || !proy.estadoResultados || !proy.real) return '';
  var P = proy.estadoResultados, R = proy.real;
  var lineas = [['ventasBrutasPrecioLista', 'Ventas brutas a precio de lista'], ['descuentosComerciales', 'Descuentos comerciales'], ['ventasBrutas', 'Ventas brutas'],
    ['comisionesNeto', 'Comisiones de canal'], ['ventasNetasReal', 'Ventas netas'], ['costoVentas', 'Costo de ventas'], ['utilidadBruta', 'Utilidad bruta'],
    ['gastosOp', 'Gastos operativos'], ['ebit', 'Utilidad operativa'], ['gastoFinanciero', 'Gastos financieros'], ['totalImpuestos', 'Impuestos'], ['utilidadNeta', 'Utilidad neta']];
  var pron = Object.keys(proy.pronosticos || {}).map(function (k) { return k.replace('prod_', 'Producto ') + ': ' + proy.pronosticos[k] + ' u'; }).join(' · ');
  var pe = proy.puntoEquilibrio || {};
  return '<div class="result-round-header" style="margin-top:14px"><h3>Proyectado, real y diferencia</h3></div>'
    + '<div style="font-size:.74rem;color:var(--text3);margin-bottom:6px">Proyectado con el pronóstico de ventas (' + mmEsc(pron || 'sin pronóstico') + ').</div>'
    + '<table class="hoja-table"><thead><tr><th>Línea</th><th style="text-align:right">Proyectado</th><th style="text-align:right">Real</th><th style="text-align:right">Diferencia</th></tr></thead><tbody>'
    + lineas.map(function (l) {
      var p = P[l[0]] || 0, r = R[l[0]] || 0;
      return '<tr><td>' + l[1] + '</td><td style="text-align:right">' + mmBs(p) + '</td><td style="text-align:right">' + mmBs(r) + '</td><td style="text-align:right">' + mmBs(r - p) + '</td></tr>';
    }).join('') + '</tbody></table>'
    + '<div style="margin-top:6px;font-size:.78rem"><strong>Punto de equilibrio (proyectado):</strong> '
    + (pe.unidades != null ? (pe.unidades.toLocaleString('es') + ' unidades — gastos fijos ' + mmBs(pe.gastosFijos) + ' ÷ margen de contribución por unidad ' + mmBs(pe.margenContribucionPromedio)) : mmEsc(pe.nota || '—')) + '</div>';
}

/** Investigación: estudios de mercado del módulo (generados por el servidor). */
// v0.6 (06-11-2026): la pantalla Investigación (mmEstudiosHTML) está en equipo-estudios.js.

// v0.4, C-6 / D-11: mapa de Puntos ideales (SVG en línea), ejes a elección.
var mmMapas = {};
var mmContadorMapas = 0;
function mmMapaSVG(seg, ex, ey) {
  var W = 380, H = 260, M = 38;
  var pts = (seg.productos || []).map(function (p) { return { x: Number(p.posicion[ex]), y: Number(p.posicion[ey]), propia: !!p.propia, marca: p.marca }; })
    .filter(function (p) { return isFinite(p.x) && isFinite(p.y); });
  var ideal = (seg.puntoIdeal && seg.puntoIdeal[ex] != null && seg.puntoIdeal[ey] != null) ? { x: Number(seg.puntoIdeal[ex]), y: Number(seg.puntoIdeal[ey]) } : null;
  var todos = pts.concat(ideal ? [ideal] : []);
  if (!todos.length) return '<div style="font-size:.75rem;color:var(--text3)">Sin datos para estos ejes.</div>';
  var rango = function (vals) { var a = Math.min.apply(null, vals), b = Math.max.apply(null, vals); var pad = (b - a) * 0.1 || Math.max(1, Math.abs(a) * 0.1); return [a - pad, b + pad]; };
  var rx = rango(todos.map(function (p) { return p.x; })), ry = rango(todos.map(function (p) { return p.y; }));
  var sx = function (v) { return M + (v - rx[0]) / (rx[1] - rx[0]) * (W - 2 * M); };
  var sy = function (v) { return H - M - (v - ry[0]) / (ry[1] - ry[0]) * (H - 2 * M); };
  var f = function (v) { return Math.round(v * 10) / 10; };
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:' + W + 'px;height:auto;background:var(--bg2);border:1px solid var(--border);border-radius:8px" role="img">'
    + '<line x1="' + M + '" y1="' + (H - M) + '" x2="' + (W - M) + '" y2="' + (H - M) + '" style="stroke:var(--text3)"/>'
    + '<line x1="' + M + '" y1="' + M + '" x2="' + M + '" y2="' + (H - M) + '" style="stroke:var(--text3)"/>'
    + '<text x="' + (W / 2) + '" y="' + (H - 8) + '" text-anchor="middle" style="fill:var(--text2);font-size:11px">' + mmEsc(ex) + ' (' + f(rx[0]) + ' a ' + f(rx[1]) + ')</text>'
    + '<text x="12" y="' + (H / 2) + '" text-anchor="middle" transform="rotate(-90 12 ' + (H / 2) + ')" style="fill:var(--text2);font-size:11px">' + mmEsc(ey) + ' (' + f(ry[0]) + ' a ' + f(ry[1]) + ')</text>';
  pts.forEach(function (p) {
    svg += '<circle cx="' + sx(p.x) + '" cy="' + sy(p.y) + '" r="6" style="' + (p.propia ? 'fill:var(--accent3);stroke:var(--accent3)' : 'fill:none;stroke:var(--text2);stroke-width:1.5') + '"><title>' + mmEsc(p.marca) + ': ' + p.x + ' · ' + p.y + '</title></circle>';
  });
  if (ideal) {
    var cx = sx(ideal.x), cy = sy(ideal.y);
    svg += '<polygon points="' + cx + ',' + (cy - 8) + ' ' + (cx + 8) + ',' + cy + ' ' + cx + ',' + (cy + 8) + ' ' + (cx - 8) + ',' + cy + '" style="fill:var(--accent5);opacity:.85"><title>Punto ideal: ' + ideal.x + ' · ' + ideal.y + '</title></polygon>';
  }
  return svg + '</svg>';
}
function mmRedibujarMapa(key) {
  var m = mmMapas[key]; if (!m) return;
  var ex = document.getElementById(key + '_x'), ey = document.getElementById(key + '_y'), cont = document.getElementById(key);
  if (ex && ey && cont) cont.innerHTML = mmMapaSVG(m.seg, ex.value, ey.value);
}
window.mmRedibujarMapa = mmRedibujarMapa;

window.mmPanelHTML = mmPanelHTML;
window.mmSincronizarDesdeDOM = mmSincronizarDesdeDOM;
window.mmEnlazar = mmEnlazar;
window.mmActualizarMedios = mmActualizarMedios;
window.mmActualizarCobertura = mmActualizarCobertura;
window.mmActualizarCalculoID = mmActualizarCalculoID;
window.mmCalcularProyeccion = mmCalcularProyeccion;
window.mmTablaProyectadoRealHTML = mmTablaProyectadoRealHTML;
