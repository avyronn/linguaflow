/* Korean language pack (V1). Implements the LanguagePack interface on top of the modules in this folder.
 * Register-only entry point: everything language-specific lives under src/languages/korean/. */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  const K = LF.Korean;
  const H = K.Hangul;

  const DATA_PATH = 'data/korean/dictionary.json';

  class KoreanLanguagePack extends LF.LanguagePack {
    /** @param {{dictionaries?: DictionaryManager, dataPath?: string, loader?: Function, data?: object}} opts */
    constructor(opts) {
      super();
      const o = opts || {};
      this.dictionaries = o.dictionaries || LF.dictionaries;
      this.dataPath = o.dataPath || DATA_PATH;
      this._loader = o.loader || null;
      this._data = o.data || null;
      this.dictionary = null;
      this.morphology = null;
      this._initP = null;
    }
    getId() { return 'ko'; }
    getName() { return 'Korean'; }
    getNativeName() { return '한국어'; }
    getFlag() { return '🇰🇷'; }
    getSpeechLang() { return 'ko-KR'; }

    init() {
      if (!this._initP) {
        this._initP = (async () => {
          if (!this.dictionaries.hasLanguage('ko')) {
            this.dictionaries.register('ko', new LF.LocalProvider({ id: 'ko-local', language: 'ko', path: this.dataPath, loader: this._loader, data: this._data }));
          }
          this.dictionary = new K.KoreanDictionary(this.dictionaries, 'ko');
          await this.dictionary.init();
          this.morphology = new K.Morphology.KoreanMorphology(this.dictionary);
        })();
        this._initP.catch(() => { this._initP = null; });
      }
      return this._initP;
    }
    _ensure() { if (!this.morphology) throw new Error('Korean language pack is not initialised: await pack.init() first'); }

    /** Share of Hangul among letters (spaces, digits and punctuation ignored). */
    detect(text) {
      let hangul = 0, letters = 0;
      for (const ch of String(text || '')) {
        if (H.isHangul(ch)) { hangul++; letters++; } else if (/\p{L}/u.test(ch)) letters++;
      }
      return letters ? hangul / letters : 0;
    }
    tokenize(text) { return K.Tokenizer.tokenize(text); }

    analyzeWord(word) { this._ensure(); return this.morphology.analyze(word); }
    getBaseForm(word) { return this.analyzeWord(word).lemma; }

    getWordForm(word) {
      const a = this.analyzeWord(word);
      const f = a.features;
      let label;
      if (a.type === 'predicate') {
        const pf = f.filter((x) => x.startsWith('prefinal-')).map((x) => ({ 'prefinal-H': 'kính ngữ', 'prefinal-P': 'quá khứ', 'prefinal-F': 'tương lai/phỏng đoán' }[x]));
        const end = a.display.length ? a.display[a.display.length - 1].gloss : '';
        label = [pf.join(' + '), end].filter(Boolean).join(' · ');
      } else if (a.type === 'nominal') label = 'danh từ + trợ từ';
      else if (a.type === 'copula') label = 'danh từ + 이다';
      else if (a.type === 'compound') label = 'động từ + trợ động từ';
      else if (a.type === 'word') label = 'từ nguyên dạng';
      else label = 'không xác định';
      return { surface: a.surface, kind: a.type, features: f, label, irregular: (f.find((x) => x.startsWith('irregular-')) || '').replace('irregular-', '') || null };
    }

    getPronunciation(word) {
      const w = String(word || '');
      let hint;
      if (this.morphology) {
        const a = this.morphology.analyze(w);
        if ((a.type === 'predicate' || a.type === 'compound') && a.stemHint && w.startsWith(a.stemHint)) hint = { stemEnd: a.stemHint.length - 1 };
      }
      return { text: w, lang: this.getSpeechLang(), spoken: K.Romanization.pronounce(w, hint), romanization: K.Romanization.romanize(w, hint) };
    }

    async lookup(word) {
      await this.init();
      const analysis = this.analyzeWord(word);
      const entry = analysis.entry || null;
      const pron = this.getPronunciation(analysis.lemma || word);
      return {
        word: String(word), lemma: analysis.lemma, pos: entry ? entry.pos : analysis.pos,
        meanings: entry ? entry.meanings.slice() : [], pronunciation: pron.romanization,
        examples: entry && entry.examples ? entry.examples.slice() : [], confidence: analysis.confidence, analysis,
      };
    }
    /** A few common inflections of a predicate lemma (shown on the card). */
    getExtraForms(lemma) {
      this._ensure();
      const e = this.dictionary.get(lemma);
      if (!e || !this.dictionary.isPredicate(e) || !lemma.endsWith('다') || lemma === '이다') return [];
      return K.Conjugation.commonForms(this.morphology._stemInfoFromEntry(lemma, e)).slice(0, 4);
    }
    getExternalLinks(word) {
      const q = encodeURIComponent(String(word || ''));
      return [
        { label: 'Naver', url: 'https://korean.dict.naver.com/kovidict/#/search?query=' + q },
        { label: 'Wiktionary', url: 'https://vi.wiktionary.org/wiki/' + q },
      ];
    }
  }

  K.KoreanLanguagePack = KoreanLanguagePack;
  if (LF.LanguagePackManager && !LF.LanguagePackManager.has('ko')) LF.LanguagePackManager.register(new KoreanLanguagePack());
  if (typeof module !== 'undefined' && module.exports) module.exports = KoreanLanguagePack;
})(typeof globalThis !== 'undefined' ? globalThis : this);
