// config-supabase.js — SimMkt publicado en GitHub Pages con el servidor en Supabase.
// Envía los pedidos de la API a la función «simmkt» de Supabase y lleva la sesión en
// el encabezado x-sid (las cookies entre sitios no son confiables en todos los navegadores).
// La sesión dura lo que dura la pestaña, como antes la cookie de sesión.
(function () {
  var BASE = window.SIMMKT_API_BASE || 'https://pabpnkogubatndthrnxa.supabase.co/functions/v1/simmkt';
  window.SIMMKT_API = BASE;
  var CLAVE = 'simmkt_sid';
  function leer() { try { return sessionStorage.getItem(CLAVE) || ''; } catch (e) { return window.__simmktSid || ''; } }
  function guardar(v) {
    window.__simmktSid = v || '';
    try { if (v) sessionStorage.setItem(CLAVE, v); else sessionStorage.removeItem(CLAVE); } catch (e) {}
  }
  function esApi(u) { return typeof u === 'string' && /^\/(auth|admin|api|invitacion)(\/|\?|$)/.test(u); }
  var fetchOriginal = window.fetch.bind(window);
  window.fetch = function (entrada, opciones) {
    if (!esApi(entrada)) return fetchOriginal(entrada, opciones);
    var o = Object.assign({}, opciones || {});
    var h = new Headers(o.headers || {});
    var sid = leer();
    if (sid) h.set('x-sid', sid);
    h.delete('Authorization');
    o.headers = h;
    return fetchOriginal(BASE + entrada, o).then(function (r) {
      var nuevo = r.headers.get('x-sid');
      if (nuevo !== null) guardar(nuevo);
      return r;
    });
  };
  // Enlaces internos que empiezan con «/» (manuales): en GitHub Pages el sitio vive en una subcarpeta.
  var abrirOriginal = window.open.bind(window);
  window.open = function (u) {
    var a = Array.prototype.slice.call(arguments);
    if (typeof u === 'string' && u.charAt(0) === '/' && u.charAt(1) !== '/') a[0] = u.slice(1);
    return abrirOriginal.apply(window, a);
  };
  window.simmktRutaLocal = function (u) { return (typeof u === 'string' && u.charAt(0) === '/' && u.charAt(1) !== '/') ? u.slice(1) : u; };
})();
