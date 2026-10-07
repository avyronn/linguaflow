/* DictionaryProvider: the contract every dictionary source implements. The core never knows which
 * language a provider serves; it only calls lookup(word, language).
 *
 * Result shape (all providers must return this or null):
 *   { word, lemma, pos, meanings: string[], pronunciation: string, examples: [ko, vi][], confidence: number, source }
 */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});

  class DictionaryProvider {
    constructor(opts) {
      const o = opts || {};
      this.id = o.id || 'provider';
      this.language = o.language || null;
    }
    /** Load resources. Must be idempotent. */
    async init() { /* nothing */ }
    isReady() { return true; }
    /** @returns {Promise<object|null>} */
    async lookup(/* word, language */) { return null; }
    /** Synchronous fast path (only after init()). */
    lookupSync(/* word */) { return null; }
    has(word) { return this.lookupSync(word) !== null; }
    /** Iterate [headword, rawEntry] pairs in frequency order (used by language packs to build indexes). */
    entries() { return []; }
  }

  LF.DictionaryProvider = DictionaryProvider;
  if (typeof module !== 'undefined' && module.exports) module.exports = DictionaryProvider;
})(typeof globalThis !== 'undefined' ? globalThis : this);
