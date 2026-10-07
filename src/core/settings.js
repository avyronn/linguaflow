/* Settings: one JSON object in browser.storage.local, shared live between popup, options page and content script. */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});

  const KEY = 'lf:v1:settings';
  const DEFAULTS = Object.freeze({
    language: 'ko',            // learning language (id of a registered LanguagePack)
    nativeLanguage: 'vi',      // language of translations / glosses
    uiLanguage: 'vi',          // 'vi' | 'en'
    learningMode: true,        // master switch
    clickWords: true,
    morphology: true,
    vocabulary: true,
    pronunciation: true,
    showRomanization: true,
    pauseOnLookup: true,       // pause the <video> element while the word card is open
    resumeOnClose: true,       // ...and resume it afterwards (only if LinguaFlow paused it)
    speechRate: 0.9,
    allowExternalLinks: false, // show "open in online dictionary" links (opens a tab only when you click)
    customSelectors: '',       // extra CSS selectors for subtitle text boxes (one per line)
    debug: false,
  });

  const types = {};
  for (const k of Object.keys(DEFAULTS)) types[k] = typeof DEFAULTS[k];

  /** Keep only known keys with the right type (a corrupted store can never break the extension). */
  function sanitize(obj) {
    const out = {};
    if (!obj || typeof obj !== 'object') return out;
    for (const k of Object.keys(DEFAULTS)) {
      if (!(k in obj) || typeof obj[k] !== types[k]) continue;
      if (k === 'speechRate') out[k] = Math.min(2, Math.max(0.5, obj[k]));
      else if (k === 'uiLanguage') out[k] = obj[k] === 'en' ? 'en' : 'vi';
      else out[k] = obj[k];
    }
    return out;
  }

  class SettingsStore extends LF.util.EventEmitter {
    /** @param {object} area storage area with get/set (browser.storage.local) */
    constructor(area) { super(); this.area = area; this._v = Object.assign({}, DEFAULTS); }
    async load() {
      const r = await this.area.get(KEY);
      this._v = Object.assign({}, DEFAULTS, sanitize(r && r[KEY]));
      return this.get();
    }
    get() { return Object.assign({}, this._v); }
    value(k) { return this._v[k]; }
    async set(patch) {
      this._v = Object.assign({}, this._v, sanitize(patch));
      await this.area.set({ [KEY]: this._v });
      this.emit('change', this.get());
      return this.get();
    }
    async reset() { this._v = Object.assign({}, DEFAULTS); await this.area.set({ [KEY]: this._v }); this.emit('change', this.get()); }
    /** Follow changes made by other extension contexts (popup <-> content script). */
    watch(storageApi) {
      if (!storageApi || !storageApi.onChanged) return;
      storageApi.onChanged.addListener((changes, areaName) => {
        if (areaName && areaName !== 'local') return;
        if (!changes[KEY]) return;
        this._v = Object.assign({}, DEFAULTS, sanitize(changes[KEY].newValue));
        this.emit('change', this.get());
      });
    }
  }

  function create(browserApi) {
    const b = browserApi || root.browser || root.chrome;
    const store = new SettingsStore(b.storage.local);
    store.watch(b.storage);
    return store;
  }

  LF.Settings = { KEY, DEFAULTS, SettingsStore, sanitize, create };
  if (typeof module !== 'undefined' && module.exports) module.exports = LF.Settings;
})(typeof globalThis !== 'undefined' ? globalThis : this);
