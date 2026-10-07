'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAll, koreanPack } = require('../helpers/load.js');
const D = require('../helpers/dom.js');
const LF = loadAll();

/* A minimal Japanese pack, written exactly like the "How to add a language pack" guide in the README.
 * The point of this test: the core (subtitles, vocabulary, speech) works with it WITHOUT any core change. */
class FakeJapanese extends LF.LanguagePack {
  getId() { return 'ja'; } getName() { return 'Japanese'; } getNativeName() { return '日本語'; } getFlag() { return '🇯🇵'; } getSpeechLang() { return 'ja-JP'; }
  detect(text) { const l = [...String(text)].filter((c) => /\p{L}/u.test(c)); return l.length ? l.filter((c) => /[\u3040-\u30FF\u4E00-\u9FFF]/.test(c)).length / l.length : 0; }
  tokenize(text) {
    const out = []; let m; const re = /([\u3040-\u30FF\u4E00-\u9FFF]+)|([^\u3040-\u30FF\u4E00-\u9FFF]+)/gu;
    while ((m = re.exec(text))) out.push({ text: m[0], start: m.index, end: m.index + m[0].length, type: m[1] ? 'word' : 'other', clickable: !!m[1] });
    return out;
  }
  analyzeWord(w) { return { surface: w, lemma: w, pos: null, known: false, confidence: 0.4, confidenceLabel: 'low', display: [{ text: w, gloss: '', kind: 'stem' }], summary: '', warnings: [], alternatives: [] }; }
  async lookup(w) { return { word: w, lemma: w, pos: null, meanings: [], pronunciation: '', examples: [], confidence: 0.4 }; }
  getPronunciation(w) { return { text: w, lang: 'ja-JP' }; }
  getWordForm() { return { kind: 'unknown' }; }
}

test('LanguagePackManager: register / get / list / resolve; missing packs are not selectable', () => {
  const M = LF.LanguagePackManager;
  assert.equal(M.has('ko'), true);
  assert.equal(M.get('ja'), null);
  assert.throws(() => M.require('ja'), /not installed/);
  const all = M.listAll();
  assert.deepEqual(all.filter((l) => l.available).map((l) => l.id), ['ko']);
  assert.deepEqual(all.filter((l) => !l.available).map((l) => l.id), ['ja', 'zh', 'en', 'es', 'fr', 'de']);
  assert.equal(all.find((l) => l.id === 'ko').nativeName, '한국어');
  assert.equal(M.resolve('ja'), 'ko'); // a stored preference for a pack that does not exist falls back safely
  assert.equal(M.resolve('ko'), 'ko');
});

test('The interface is enforced: an incomplete pack fails loudly', () => {
  class Bad extends LF.LanguagePack {}
  const b = new Bad();
  for (const m of ['getId', 'getName', 'getNativeName', 'getSpeechLang', 'tokenize', 'analyzeWord', 'getPronunciation', 'getWordForm']) assert.throws(() => b[m]('x'), /not implemented/, m);
  assert.deepEqual(b.getExtraForms('x'), []); assert.deepEqual(b.getExternalLinks('x'), []); assert.equal(b.getBaseForm('x'), 'x');
});

test('Adding a language needs no core change: Japanese pack → subtitles, vocabulary and speech all work', async () => {
  const M = LF.LanguagePackManager;
  const ja = new FakeJapanese();
  M.register(ja);
  try {
    assert.deepEqual(M.listAll().filter((l) => l.available).map((l) => l.id), ['ko', 'ja']);
    assert.equal(M.listAll().find((l) => l.id === 'ja').available, true);

    // subtitles: Japanese primary + Vietnamese secondary, classified by the pack's detect()
    const dom = D.makeDom(); const doc = dom.window.document; D.addVideoCanvas(doc);
    D.netflixNative(doc, ['今日はどこにいましたか?']);
    D.multiSubs(doc, ['Hôm nay bạn đã ở đâu?']);
    const mgr = new LF.SubtitleManager({ document: doc, window: dom.window, languagePack: ja, nativeLanguage: 'vi', debounceMs: 5, checkLayout: false });
    mgr.start();
    const cur = mgr.getCurrentSubtitle();
    assert.deepEqual([cur.primary.language, cur.primary.text, cur.secondary.language], ['ja', '今日はどこにいましたか?', 'vi']);
    assert.deepEqual(mgr.getWordMaps()[0].tokens.map((t) => t.text), ['今日はどこにいましたか']);
    mgr.stop();

    // vocabulary keeps the language
    const vm = new LF.VocabularyManager({ storage: new LF.VocabularyStorage(new LF.MemoryStorageArea()) });
    const { item } = await vm.add({ language: 'ja', word: '時間', lemma: '時間', meaning: 'thời gian' });
    assert.equal(item.id, 'ja:時間');

    // pronunciation resolves the speech tag through the pack
    const spoken = [];
    const synth = { getVoices: () => [{ lang: 'ja-JP', name: 'Kyoko' }, { lang: 'ko-KR', name: 'Yuna' }], cancel() {}, speak(u) { spoken.push([u.lang, u.voice && u.voice.name, u.text]); setTimeout(() => u.onend && u.onend(), 0); } };
    const pron = new LF.Pronunciation({ synth, Utterance: function (t) { this.text = t; }, packs: M });
    assert.deepEqual(await pron.speak('時間', 'ja'), { ok: true, lang: 'ja-JP', voice: 'Kyoko' });
    assert.deepEqual(spoken, [['ja-JP', 'Kyoko', '時間']]);
  } finally { M.unregister('ja'); }
  assert.equal(M.has('ja'), false);
});

test('Korean pack is registered through the same interface (core never branches on "ko")', async () => {
  const pack = await koreanPack();
  assert.ok(pack instanceof LF.LanguagePack);
  const fs = require('fs'), path = require('path');
  const coreFiles = [];
  (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (p.endsWith('.js')) coreFiles.push(p); } })(path.join(__dirname, '../../src/core'));
  const offenders = coreFiles.filter((f) => /['"]ko['"]|korean|hangul|한국/i.test(fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')));
  // allowed: the planned-language roadmap and the default language id in settings/manager (data, not logic)
  const allowed = new Set(['language-pack-manager.js', 'settings.js']);
  assert.deepEqual(offenders.map((f) => path.basename(f)).filter((f) => !allowed.has(f)), []);
});
