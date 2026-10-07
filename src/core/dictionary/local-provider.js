/* LocalProvider: offline dictionary bundled with the extension (JSON, no network, no account).
 * JSON format: { meta: {...}, entries: { headword: { pos, meanings[], irr?, examples?, level? } } }
 * Entry order = frequency order (used as a ranking hint for ambiguous analyses).
 */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  const Base = LF.DictionaryProvider;

  // Browser loader: direct fetch of the packaged file; if the page context blocks it (CSP / WAR quirks),
  // ask the background script (which is not subject to the page's CSP) to fetch it for us.
  async function browserLoader(path) {
    const b = root.browser || root.chrome;
    if (!b || !b.runtime) throw new Error('No extension runtime available to load ' + path);
    try {
      const res = await root.fetch(b.runtime.getURL(path));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      LF.log && LF.log.debug('direct fetch failed, asking background:', e && e.message);
      const reply = await b.runtime.sendMessage({ type: 'linguaflow:getData', path });
      if (!reply || !reply.ok) throw new Error('Background could not load ' + path + ': ' + (reply && reply.error));
      return reply.data;
    }
  }

  class LocalProvider extends Base {
    /** @param {{id?:string, language:string, path?:string, loader?:()=>Promise<object>, data?:object}} opts */
    constructor(opts) {
      super(opts);
      this.path = opts.path || null;
      this._loader = opts.loader || null;
      this._data = opts.data || null;
      this._map = null;
      this._rank = null;
      this.meta = {};
      this._initP = null;
    }
    init() {
      if (!this._initP) {
        this._initP = (async () => {
          const data = this._data || (this._loader ? await this._loader() : await browserLoader(this.path));
          this._ingest(data);
        })();
        this._initP.catch(() => { this._initP = null; }); // allow retry after a failure
      }
      return this._initP;
    }
    _ingest(data) {
      if (!data || typeof data.entries !== 'object') throw new Error('Invalid dictionary data');
      this.meta = data.meta || {};
      this._map = new Map();
      this._rank = new Map();
      let i = 0;
      for (const k of Object.keys(data.entries)) { this._map.set(k, data.entries[k]); this._rank.set(k, i++); }
    }
    isReady() { return this._map !== null; }
    get size() { return this._map ? this._map.size : 0; }
    entries() { return this._map ? this._map.entries() : [][Symbol.iterator](); }
    rank(word) { const r = this._rank && this._rank.get(word); return r === undefined ? Infinity : r; }
    getRaw(word) { return this._map ? this._map.get(String(word).normalize('NFC')) || null : null; }
    lookupSync(word) {
      const key = String(word == null ? '' : word).normalize('NFC');
      const raw = this._map && this._map.get(key);
      return raw ? this._normalize(key, raw) : null;
    }
    async lookup(word) { await this.init(); return this.lookupSync(word); }
    _normalize(word, raw) {
      return {
        word, lemma: word, pos: raw.pos || null, meanings: Array.isArray(raw.meanings) ? raw.meanings.slice() : [],
        pronunciation: raw.pron || '', examples: Array.isArray(raw.examples) ? raw.examples.slice() : [],
        irregular: raw.irr || null, level: raw.level || null, rank: this.rank(word), confidence: 1, source: this.id,
      };
    }
  }

  LF.LocalProvider = LocalProvider;
  if (typeof module !== 'undefined' && module.exports) module.exports = LocalProvider;
})(typeof globalThis !== 'undefined' ? globalThis : this);
