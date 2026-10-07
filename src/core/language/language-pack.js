/* LanguagePack: the interface between the language-agnostic core and a concrete language.
 * The core only ever calls these methods; it never branches on a language id.
 *
 *   Token    = { text, start, end, type, clickable }          (offsets refer to the original string)
 *   Analysis = { surface, lemma, pos, known, confidence, confidenceLabel, display[], summary, warnings[], alternatives[] }
 *   Lookup   = { word, lemma, pos, meanings[], pronunciation, examples[], confidence, analysis }
 */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});

  class LanguagePack {
    /** BCP-47-ish short id, e.g. "ko" */
    getId() { throw new Error('LanguagePack.getId() not implemented'); }
    /** English name, e.g. "Korean" */
    getName() { throw new Error('LanguagePack.getName() not implemented'); }
    /** Name in the language itself, e.g. "한국어" */
    getNativeName() { throw new Error('LanguagePack.getNativeName() not implemented'); }
    getFlag() { return '🏳️'; }
    /** Language tag for speech synthesis, e.g. "ko-KR" */
    getSpeechLang() { throw new Error('LanguagePack.getSpeechLang() not implemented'); }
    /** Languages the bundled dictionary can explain words in (V1: Vietnamese). */
    getGlossLanguages() { return ['vi']; }
    /** Load dictionaries / build indexes. Must be idempotent. */
    async init() { /* nothing */ }
    /** 0..1: how much of `text` looks like this language (script based). Used to find the learning-language line. */
    detect(/* text */) { return 0; }
    /** @returns {Token[]} */
    tokenize(/* text */) { throw new Error('LanguagePack.tokenize() not implemented'); }
    isClickable(token) { return !!token && token.clickable === true; }
    /** @returns {Analysis} */
    analyzeWord(/* word */) { throw new Error('LanguagePack.analyzeWord() not implemented'); }
    /** @returns {Promise<Lookup|null>} */
    async lookup(/* word */) { throw new Error('LanguagePack.lookup() not implemented'); }
    /** @returns {{text:string, lang:string, romanization?:string, spoken?:string}} */
    getPronunciation(/* word */) { throw new Error('LanguagePack.getPronunciation() not implemented'); }
    /** Describes the grammatical form of a surface word, e.g. "past tense + formal polite". */
    getWordForm(/* word */) { throw new Error('LanguagePack.getWordForm() not implemented'); }
    /** Dictionary form of a surface word. */
    getBaseForm(word) { return word; }
    /** Optional: a few inflections of a dictionary form for the card, [{label, form}]. */
    getExtraForms(/* lemma */) { return []; }
    /** Optional: online dictionary links, [{label, url}] — only shown if the user enabled them, opened only on click. */
    getExternalLinks(/* word */) { return []; }
  }

  LF.LanguagePack = LanguagePack;
  if (typeof module !== 'undefined' && module.exports) module.exports = LanguagePack;
})(typeof globalThis !== 'undefined' ? globalThis : this);
