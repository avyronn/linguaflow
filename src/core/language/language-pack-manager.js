/* LanguagePackManager: registry of installed language packs + the "coming soon" roadmap shown in the UI. */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});

  // Languages on the roadmap. They are listed in the UI but cannot be selected until a pack is registered.
  const PLANNED = [
    { id: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
    { id: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
    { id: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
    { id: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
    { id: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
    { id: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  ];

  const LanguagePackManager = {
    _packs: new Map(),
    DEFAULT_ID: 'ko',
    register(pack) {
      const id = pack.getId();
      if (!id) throw new Error('Language pack without id');
      this._packs.set(id, pack);
      return pack;
    },
    unregister(id) { this._packs.delete(id); },
    has(id) { return this._packs.has(id); },
    /** @returns {LanguagePack|null} */
    get(id) { return this._packs.get(id) || null; },
    require(id) {
      const p = this.get(id);
      if (!p) throw new Error('Language pack "' + id + '" is not installed');
      return p;
    },
    /** Registered packs, as plain metadata. */
    list() {
      return Array.from(this._packs.values()).map((p) => ({ id: p.getId(), name: p.getName(), nativeName: p.getNativeName(), flag: p.getFlag(), available: true }));
    },
    /** Installed packs first, then planned ones flagged available:false. */
    listAll() {
      const installed = this.list();
      const ids = new Set(installed.map((p) => p.id));
      return installed.concat(PLANNED.filter((p) => !ids.has(p.id)).map((p) => Object.assign({ available: false }, p)));
    },
    /** A stored preference may refer to a pack that is not installed (yet): fall back safely. */
    resolve(id) { return this.has(id) ? id : (this.has(this.DEFAULT_ID) ? this.DEFAULT_ID : (this.list()[0] || {}).id || null); },
  };

  LF.LanguagePackManager = LanguagePackManager;
  LF.PLANNED_LANGUAGES = PLANNED;
  if (typeof module !== 'undefined' && module.exports) module.exports = LanguagePackManager;
})(typeof globalThis !== 'undefined' ? globalThis : this);
