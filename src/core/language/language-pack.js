/* LanguagePack: the interface between the language-agnostic core and a concrete language.
 * The core only ever calls these methods; it never branches on a language id.
 *
 *   Token    = { text, start, end, type, clickable }          (offsets refer to the original string)
 *   Analysis = { surface, lemma, pos, known, confidence, confidenceLabel, display[], summary, warnings[], alternatives[] }
 *   Lookup   = { word, lemma, pos, meanings[], pronunciation, examples[], confidence, analysis, etymology? }
 *   etymology (optional) = { label, text, reading?, root?, rootLabel? }   where a word comes from, shown as one line on the card
 *                          (Korean: label "Hán tự · Hán-Việt", text "學校", reading "học hiệu"; root = the noun a 하다 verb is built on). All text is written by the pack.
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
    /**
     * Optional: the grammar of ONE sentence of a subtitle line (the one holding the clicked word). null = this language has no grammar module.
     * `opts.focus` = the clicked word, as an offset or {start, end} into `text`. Every label is already written for the learner by the pack;
     * the core only lays the pieces out.
     *   SentenceAnalysis = {
     *     text, offset, sentenceCount, sentenceIndex,
     *     facts:     [{ id, label, value, hint? }]          what the sentence as a whole shows (kind of sentence, speech level, tense ...)
     *     patterns:  [{ id, title, meaning, note, level, category, categoryLabel, kind: 'pattern'|'ending', text, confidence, notes[], focus,
     *                   examples: [{ text, translation }] }] constructions found; the clicked word's come first
     *     words:     [{ index, text, role, roleLabel, roleHint, lemma, posLabel, gloss, confidence, clause, focus, patterns[] }]
     *     clauses:   [{ index, text, kind, kindLabel, relationLabel, predicate, ending, label }]
     *     structure: [{ role, label }]                       word-order skeleton of the main clause
     *   }
     * @returns {SentenceAnalysis|null}
     */
    analyzeSentence(/* text, opts */) { return null; }
    /**
     * Optional: the grammar reference of the language, for the popup's "Grammar" tab.
     *   [{ id, title, items: [{ id, title, summary, note, level, kind, examples: [{ text, translation }] }] }]
     */
    getGrammarReference() { return []; }
  }

  LF.LanguagePack = LanguagePack;
  if (typeof module !== 'undefined' && module.exports) module.exports = LanguagePack;
})(typeof globalThis !== 'undefined' ? globalThis : this);
