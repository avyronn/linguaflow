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
      this.predicatesByInitial = new Map();   // cho -> [{lemma, stem, entry}]  (every predicate)
      this._bySyllable = new Map();           // first syllable -> stems of 2+ syllables whose first syllable never changes when conjugated
      this._shortByInitial = new Map();       // cho -> 1-syllable stems and 2-syllable 르-stems (모르 -> 몰라 changes the first syllable)
      this._nominalViews = new Map();
      this._ready = false;
    }
    async init() {
      await this.manager.init(this.language);
      this.buildIndex();
    }
    buildIndex() {
      this.predicatesByInitial.clear(); this._bySyllable.clear(); this._shortByInitial.clear(); this._nominalViews.clear();
      for (const [lemma] of this.manager.entries(this.language)) {
        const entry = this.get(lemma);
        if (!entry || !PREDICATE_POS.has(entry.pos) || !lemma.endsWith('다') || lemma.length < 2) continue;
        const stem = lemma.slice(0, -1), cho = H.cho(stem);
        const item = { lemma, stem, entry };
        if (!this.predicatesByInitial.has(cho)) this.predicatesByInitial.set(cho, []);
        this.predicatesByInitial.get(cho).push(item);
        const short = stem.length === 1 || (stem.length === 2 && stem.endsWith('르'));
        const map = short ? this._shortByInitial : this._bySyllable, key = short ? cho : stem[0];
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
      }
      this._ready = true;
    }
    /** Predicate stems that can possibly produce a surface starting with `w` (cheap pre-filter for the matcher). */
    stemsFor(w) {
      if (!w) return [];
      const a = this._bySyllable.get(w[0]) || [], b = this._shortByInitial.get(H.cho(w)) || [];
      return a.length ? (b.length ? a.concat(b) : a) : b;
    }
    isReady() { return this._ready; }
    get(word) { return this.manager.lookupSync(word, this.language); }
    has(word) { return this.get(word) !== null; }
    isPredicate(entry) { return !!entry && PREDICATE_POS.has(entry.pos); }
    isNominal(entry) { return !!entry && (NOMINAL_POS.has(entry.pos) || this.nominalSense(entry) !== null); }
    /** The part-of-speech sense of a headword that can take particles: its own if nominal, else a nominal alternative (그 = det / pron). */
    nominalSense(entry) {
      if (!entry) return null;
      if (NOMINAL_POS.has(entry.pos)) return null;
      const alt = (entry.altSenses || []).find((a) => NOMINAL_POS.has(a.pos));
      return alt || null;
    }
    /** `entry` seen as a noun: for homographs whose primary sense is not nominal, a view carrying the nominal sense. */
    asNominal(entry) {
      const alt = this.nominalSense(entry);
      if (!alt) return entry;
      let v = this._nominalViews.get(entry.word);
      if (!v) { v = Object.assign({}, entry, { pos: alt.pos, meanings: alt.meanings.slice() }); this._nominalViews.set(entry.word, v); }
      return v;
    }
    /** `entry` seen as a bound noun (적 = "kẻ thù" / "kinh nghiệm: -ㄴ 적이 있다"): a view carrying the 'nbound' sense, or null. */
    asNbound(entry) {
      if (!entry || entry.pos === 'nbound' || entry.pos === 'cnt') return null;
      const alt = (entry.altSenses || []).find((a) => a.pos === 'nbound' || a.pos === 'cnt');
      if (!alt) return null;
      const key = '\u0001nb:' + entry.word;
      let v = this._nominalViews.get(key);
      if (!v) { v = Object.assign({}, entry, { pos: 'nbound', meanings: alt.meanings.slice() }); this._nominalViews.set(key, v); }
      return v;
    }
    /** The numeral sense of a homograph (이 = this / two, 일 = work / one), as an entry of its own; null when there is none. */
    asNum(entry) { return this.asAlt(entry, 'num'); }
    /** A sense of `entry` with part of speech `pos` that is not its primary one (네 = yes / four), as an entry of its own; null when there is none. */
    asAlt(entry, pos) {
      if (!entry || entry.pos === pos) return null;
      const alt = (entry.altSenses || []).find((a) => a.pos === pos);
      if (!alt) return null;
      const key = '\u0001' + pos + ':' + entry.word;
      let v = this._nominalViews.get(key);
      if (!v) { v = Object.assign({}, entry, { pos, meanings: alt.meanings.slice() }); this._nominalViews.set(key, v); }
      return v;
    }
    async lookup(word) { return this.manager.lookup(word, this.language); }
  }

  K.KoreanDictionary = KoreanDictionary;
  K.PREDICATE_POS = PREDICATE_POS;
  K.NOMINAL_POS = NOMINAL_POS;
  if (typeof module !== 'undefined' && module.exports) module.exports = KoreanDictionary;
})(typeof globalThis !== 'undefined' ? globalThis : this);
