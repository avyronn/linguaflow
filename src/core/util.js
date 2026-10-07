/* LinguaFlow core utilities: namespace, event emitter, debounce, DOM builder, logger. */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  LF.VERSION = '1.0.0';

  class EventEmitter {
    constructor() { this._h = new Map(); }
    on(type, fn) {
      if (!this._h.has(type)) this._h.set(type, new Set());
      this._h.get(type).add(fn);
      return () => this.off(type, fn);
    }
    off(type, fn) { const s = this._h.get(type); if (s) s.delete(fn); }
    emit(type, payload) {
      const s = this._h.get(type);
      if (!s) return;
      for (const fn of Array.from(s)) {
        try { fn(payload); } catch (e) { log.error('listener for "' + type + '" threw', e); }
      }
    }
  }

  // Trailing-edge debounce with cancel()/flush(). `timers` can be injected for tests.
  function debounce(fn, ms, timers) {
    const T = timers || root;
    let id = null, lastArgs = null;
    const run = () => { id = null; const a = lastArgs; lastArgs = null; fn.apply(null, a); };
    const d = function (...args) { lastArgs = args; if (id !== null) T.clearTimeout(id); id = T.setTimeout(run, ms); };
    d.cancel = () => { if (id !== null) T.clearTimeout(id); id = null; lastArgs = null; };
    d.flush = () => { if (id !== null) { T.clearTimeout(id); run(); } };
    return d;
  }

  const log = {
    enabled: false,
    _p: '[LinguaFlow]',
    debug(...a) { if (log.enabled && root.console) root.console.debug(log._p, ...a); },
    info(...a) { if (log.enabled && root.console) root.console.info(log._p, ...a); },
    warn(...a) { if (root.console) root.console.warn(log._p, ...a); },
    error(...a) { if (root.console) root.console.error(log._p, ...a); },
  };

  // Small DOM builder. Never uses innerHTML: all text goes through text nodes.
  // attrs.__doc lets callers target a different document (tests / iframes).
  function h(tag, attrs, ...children) {
    const doc = (attrs && attrs.__doc) || root.document;
    const el = doc.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (k === '__doc' || v === undefined || v === null || v === false) continue;
        if (k === 'class') el.setAttribute('class', v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, String(v));
      }
    }
    for (const c of children.flat(Infinity)) {
      if (c === undefined || c === null || c === false) continue;
      el.appendChild(typeof c === 'object' && c.nodeType ? c : doc.createTextNode(String(c)));
    }
    return el;
  }

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  LF.util = { EventEmitter, debounce, log, h, clamp, sleep };
  LF.log = log;
  if (typeof module !== 'undefined' && module.exports) module.exports = LF.util;
})(typeof globalThis !== 'undefined' ? globalThis : this);
