/* VocabularyManager: saved words for ANY language. Every item stores its `language`, so Korean, Japanese,
 * Chinese ... can live in the same store. Persistence = browser.storage.local only (no cloud, no account). */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});

  const MAX_CONTEXTS = 5;
  const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

  class VocabularyManager extends LF.util.EventEmitter {
    /** @param {{storage:VocabularyStorage, now?:Function}} opts */
    constructor(opts) {
      super();
      this.storage = opts.storage;
      this.now = opts.now || (() => Date.now());
    }
    static makeId(language, lemma) { return language + ':' + String(lemma).normalize('NFC'); }

    /**
     * Save a word (or update the existing one). A freshly saved word is due for review immediately.
     * @returns {Promise<{item:object, created:boolean}>}
     */
    async add(entry) {
      if (!entry || !entry.language || !(entry.lemma || entry.word)) throw new Error('vocabulary.add needs language and lemma/word');
      const t = this.now();
      const lemma = String(entry.lemma || entry.word).normalize('NFC');
      const id = VocabularyManager.makeId(entry.language, lemma);
      const existing = await this.storage.get(id);
      const form = entry.word ? String(entry.word).normalize('NFC') : lemma;
      const ctx = entry.sentence ? { sentence: entry.sentence, translation: entry.translation || '', at: t } : null;
      if (existing) {
        const item = Object.assign({}, existing);
        item.forms = Array.from(new Set((item.forms || []).concat(form))).slice(-8);
        if (ctx && !(item.contexts || []).some((c) => c.sentence === ctx.sentence)) item.contexts = (item.contexts || []).concat(ctx).slice(-MAX_CONTEXTS);
        if (!item.sentence && entry.sentence) { item.sentence = entry.sentence; item.translation = entry.translation || ''; }
        if (!item.meaning && entry.meaning) item.meaning = entry.meaning;
        if (entry.known === true) item.known = true;
        else if (item.known) { item.known = false; item.nextReview = t; item.interval = 0; } // saving a "known" word again = learn it again
        await this.storage.put(item);
        this.emit('change', { type: 'update', item });
        return { item, created: false };
      }
      const item = {
        id, language: entry.language, word: form, lemma, meaning: entry.meaning || '', sentence: entry.sentence || '', translation: entry.translation || '',
        createdAt: t, known: entry.known === true, reviewCount: 0, lastReviewed: null, nextReview: t, interval: 0, ease: LF.ReviewEngine.START_EASE,
        pos: entry.pos || null, pronunciation: entry.pronunciation || '', forms: [form], contexts: ctx ? [ctx] : [],
      };
      await this.storage.put(item);
      this.emit('change', { type: 'add', item });
      return { item, created: true };
    }
    get(id) { return this.storage.get(id); }
    find(language, lemma) { return this.storage.get(VocabularyManager.makeId(language, lemma)); }
    async has(language, lemma) { return (await this.find(language, lemma)) !== null; }
    async remove(id) { await this.storage.remove(id); this.emit('change', { type: 'remove', id }); }
    async update(id, patch) {
      const it = await this.storage.get(id);
      if (!it) return null;
      const item = Object.assign({}, it, patch, { id: it.id, language: it.language });
      await this.storage.put(item);
      this.emit('change', { type: 'update', item });
      return item;
    }
    /** "I already know this": excluded from review until un-marked. */
    setKnown(id, known) { return this.update(id, known ? { known: true } : { known: false, nextReview: this.now(), interval: 0 }); }

    /** @param {{language?:string, known?:boolean, query?:string, due?:boolean}} f */
    async list(f) {
      const o = f || {};
      let items = await this.storage.getAll();
      if (o.language) items = items.filter((i) => i.language === o.language);
      if (typeof o.known === 'boolean') items = items.filter((i) => !!i.known === o.known);
      if (o.due) items = items.filter((i) => LF.ReviewEngine.isDue(i, this.now()));
      if (o.query) { const q = o.query.toLowerCase(); items = items.filter((i) => [i.word, i.lemma, i.meaning, i.sentence, i.translation].some((s) => s && String(s).toLowerCase().includes(q))); }
      return items.sort((a, b) => b.createdAt - a.createdAt);
    }
    async getDue(language, opts) {
      const items = await this.list({ language });
      return LF.ReviewEngine.buildQueue(items, Object.assign({ now: this.now() }, opts || {}));
    }
    async review(id, grade) {
      const it = await this.storage.get(id);
      if (!it) throw new Error('Unknown vocabulary item: ' + id);
      const next = LF.ReviewEngine.schedule(it, grade, this.now());
      const item = Object.assign({}, it, next);
      await this.storage.put(item);
      this.emit('change', { type: 'review', item });
      return item;
    }
    async stats(language) {
      const items = await this.list({ language });
      const now = this.now();
      return { total: items.length, known: items.filter((i) => i.known).length, learning: items.filter((i) => !i.known).length,
        due: items.filter((i) => LF.ReviewEngine.isDue(i, now)).length, new: items.filter((i) => !i.known && !(i.reviewCount > 0)).length };
    }

    // ---- import / export (user-owned data) ----------------------------------------------------------------
    async exportJSON(language) {
      const items = await this.list({ language });
      return JSON.stringify({ app: 'LinguaFlow', schema: 1, exportedAt: new Date(this.now()).toISOString(), items }, null, 2);
    }
    async exportCSV(language) {
      const cols = ['language', 'word', 'lemma', 'meaning', 'sentence', 'translation', 'known', 'reviewCount', 'nextReview'];
      const rows = (await this.list({ language })).map((i) => cols.map((c) => csvCell(c === 'nextReview' && i.nextReview ? new Date(i.nextReview).toISOString() : i[c])).join(','));
      return [cols.join(',')].concat(rows).join('\n');
    }
    /** @returns {Promise<{added:number, skipped:number, invalid:number}>} existing items are kept unless overwrite=true */
    async importJSON(text, opts) {
      const o = opts || {};
      let data;
      try { data = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { throw new Error('File is not valid JSON'); }
      const list = Array.isArray(data) ? data : data && Array.isArray(data.items) ? data.items : null;
      if (!list) throw new Error('No "items" array found');
      let added = 0, skipped = 0, invalid = 0;
      const toWrite = [];
      const existing = new Set((await this.storage.getAll()).map((i) => i.id));
      for (const raw of list) {
        if (!raw || typeof raw.language !== 'string' || !(raw.lemma || raw.word)) { invalid++; continue; }
        const lemma = String(raw.lemma || raw.word).normalize('NFC');
        const id = VocabularyManager.makeId(raw.language, lemma);
        if (existing.has(id) && !o.overwrite) { skipped++; continue; }
        const t = this.now();
        toWrite.push(Object.assign({ word: lemma, meaning: '', sentence: '', translation: '', createdAt: t, known: false, reviewCount: 0, lastReviewed: null, nextReview: t, interval: 0, ease: LF.ReviewEngine.START_EASE }, raw, { id, lemma }));
        existing.add(id); added++;
      }
      if (toWrite.length) await this.storage.putMany(toWrite);
      this.emit('change', { type: 'import' });
      return { added, skipped, invalid };
    }
    async clear(language) { const n = await this.storage.clear(language); this.emit('change', { type: 'clear' }); return n; }
  }

  LF.VocabularyManager = VocabularyManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = VocabularyManager;
})(typeof globalThis !== 'undefined' ? globalThis : this);
