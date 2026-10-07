/* Korean dictionary adapter: knows the Korean entry schema and builds the indexes morphology needs.
 * Data comes from the generic core DictionaryManager (provider: data/korean/dictionary.json). */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  const K = LF.Korean || (LF.Korean = {});
  const H = K.Hangul;

  const PREDICATE_POS = new Set(['v', 'adj', 'aux', 'cop']);
  const NOMINAL_POS = new Set(['n', 'pron', 'num', 'cnt', 'adv', 'nbound']);

  class KoreanDictionary {
    /** @param {DictionaryManager} manager  @param {string} language */
    constructor(manager, language) {
      this.manager = manager;
      this.language = language || 'ko';
      this.predicatesByInitial = new Map(); // cho -> [{lemma, stem, entry}]
      this._ready = false;
    }
    async init() {
      await this.manager.init(this.language);
      this.buildIndex();
    }
    buildIndex() {
      this.predicatesByInitial.clear();
      for (const [lemma] of this.manager.entries(this.language)) {
        const entry = this.get(lemma);
        if (!entry || !PREDICATE_POS.has(entry.pos) || !lemma.endsWith('다') || lemma.length < 2) continue;
        const stem = lemma.slice(0, -1), cho = H.cho(stem);
        if (!this.predicatesByInitial.has(cho)) this.predicatesByInitial.set(cho, []);
        this.predicatesByInitial.get(cho).push({ lemma, stem, entry });
      }
      this._ready = true;
    }
    isReady() { return this._ready; }
    get(word) { return this.manager.lookupSync(word, this.language); }
    has(word) { return this.get(word) !== null; }
    isPredicate(entry) { return !!entry && PREDICATE_POS.has(entry.pos); }
    isNominal(entry) { return !!entry && NOMINAL_POS.has(entry.pos); }
    async lookup(word) { return this.manager.lookup(word, this.language); }
  }

  K.KoreanDictionary = KoreanDictionary;
  K.PREDICATE_POS = PREDICATE_POS;
  K.NOMINAL_POS = NOMINAL_POS;
  if (typeof module !== 'undefined' && module.exports) module.exports = KoreanDictionary;
})(typeof globalThis !== 'undefined' ? globalThis : this);
