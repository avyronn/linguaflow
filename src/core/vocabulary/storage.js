/* Vocabulary storage on top of a storage area (browser.storage.local). One key per item, so a popup and a
 * content script saving at the same moment cannot overwrite each other's words.
 * Nothing here ever leaves the browser: no network, no sync. */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  const PREFIX = 'lf:v1:vocab:';

  /** In-memory area with the same surface as browser.storage.local (used by tests and as a safe fallback). */
  class MemoryStorageArea {
    constructor() { this.data = {}; this._listeners = []; this.onChanged = { addListener: (fn) => this._listeners.push(fn), removeListener: (fn) => { this._listeners = this._listeners.filter((x) => x !== fn); } }; }
    async get(keys) {
      if (keys == null) return JSON.parse(JSON.stringify(this.data));
      const list = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys);
      const out = {};
      for (const k of list) if (k in this.data) out[k] = JSON.parse(JSON.stringify(this.data[k]));
      return out;
    }
    async set(items) {
      const changes = {};
      for (const k of Object.keys(items)) { changes[k] = { oldValue: this.data[k], newValue: items[k] }; this.data[k] = JSON.parse(JSON.stringify(items[k])); }
      this._emit(changes);
    }
    async remove(keys) {
      const changes = {};
      for (const k of Array.isArray(keys) ? keys : [keys]) { if (k in this.data) { changes[k] = { oldValue: this.data[k] }; delete this.data[k]; } }
      this._emit(changes);
    }
    async clear() { const changes = {}; for (const k of Object.keys(this.data)) changes[k] = { oldValue: this.data[k] }; this.data = {}; this._emit(changes); }
    _emit(changes) { if (Object.keys(changes).length) for (const fn of this._listeners) fn(changes, 'local'); }
  }

  class VocabularyStorage {
    constructor(area) { this.area = area; }
    key(id) { return PREFIX + id; }
    async getAll() {
      const all = await this.area.get(null);
      const out = [];
      for (const k of Object.keys(all)) if (k.startsWith(PREFIX)) out.push(all[k]);
      return out;
    }
    async get(id) { const r = await this.area.get(this.key(id)); return r[this.key(id)] || null; }
    async put(item) { await this.area.set({ [this.key(item.id)]: item }); return item; }
    async putMany(items) { const o = {}; for (const it of items) o[this.key(it.id)] = it; await this.area.set(o); return items; }
    async remove(id) { await this.area.remove(this.key(id)); }
    async clear(language) {
      const all = await this.getAll();
      const keys = all.filter((i) => !language || i.language === language).map((i) => this.key(i.id));
      if (keys.length) await this.area.remove(keys);
      return keys.length;
    }
    /** Calls fn() whenever any vocabulary item changes (from any extension context). */
    onChange(storageApi, fn) {
      if (!storageApi || !storageApi.onChanged) return () => {};
      const h = (changes) => { if (Object.keys(changes).some((k) => k.startsWith(PREFIX))) fn(); };
      storageApi.onChanged.addListener(h);
      return () => storageApi.onChanged.removeListener && storageApi.onChanged.removeListener(h);
    }
  }

  LF.MemoryStorageArea = MemoryStorageArea;
  LF.VocabularyStorage = VocabularyStorage;
  LF.VOCAB_PREFIX = PREFIX;
  if (typeof module !== 'undefined' && module.exports) module.exports = { MemoryStorageArea, VocabularyStorage, PREFIX };
})(typeof globalThis !== 'undefined' ? globalThis : this);
