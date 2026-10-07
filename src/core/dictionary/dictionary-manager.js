/* DictionaryManager: routes lookup(word, language) to the providers registered for that language.
 * The core only uses this API; which dictionary answers (Korean, Japanese ...) is data, not code. */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});

  class DictionaryManager {
    constructor() { this._providers = new Map(); }
    register(language, provider) {
      if (!this._providers.has(language)) this._providers.set(language, []);
      const list = this._providers.get(language);
      if (!list.includes(provider)) list.push(provider);
      return this;
    }
    getProviders(language) { return (this._providers.get(language) || []).slice(); }
    hasLanguage(language) { return this.getProviders(language).length > 0; }
    async init(language) { await Promise.all(this.getProviders(language).map((p) => p.init())); }
    /** @returns {Promise<object|null>} first non-null provider result */
    async lookup(word, language) {
      for (const p of this.getProviders(language)) {
        const r = await p.lookup(word, language);
        if (r) return r;
      }
      return null;
    }
    lookupSync(word, language) {
      for (const p of this.getProviders(language)) {
        if (!p.isReady()) continue;
        const r = p.lookupSync(word);
        if (r) return r;
      }
      return null;
    }
    has(word, language) { return this.lookupSync(word, language) !== null; }
    /** Iterate [headword, raw] of the first ready provider (for building language-pack indexes). */
    entries(language) {
      for (const p of this.getProviders(language)) if (p.isReady()) return p.entries();
      return [][Symbol.iterator]();
    }
  }

  LF.DictionaryManager = DictionaryManager;
  LF.dictionaries = LF.dictionaries || new DictionaryManager();
  if (typeof module !== 'undefined' && module.exports) module.exports = DictionaryManager;
})(typeof globalThis !== 'undefined' ? globalThis : this);
