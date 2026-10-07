'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAll } = require('../helpers/load.js');
const LF = loadAll();

const DATA = { meta: { language: 'xx' }, entries: { 가: { pos: 'v', meanings: ['đi'], pron: 'ga', examples: [['a', 'b']] }, 나: { pos: 'pron', meanings: ['tôi'] } } };

test('DictionaryManager.lookup(word, language) returns the documented result shape', async () => {
  const dm = new LF.DictionaryManager();
  dm.register('xx', new LF.LocalProvider({ id: 'xx-local', language: 'xx', data: DATA }));
  assert.equal(dm.lookupSync('가', 'xx'), null, 'not ready before init');
  const r = await dm.lookup('가', 'xx');
  assert.deepEqual(Object.keys(r).sort(), ['confidence', 'examples', 'irregular', 'lemma', 'level', 'meanings', 'pos', 'pronunciation', 'rank', 'source', 'word']);
  assert.deepEqual({ word: r.word, lemma: r.lemma, meanings: r.meanings, pronunciation: r.pronunciation, confidence: r.confidence, rank: r.rank }, { word: '가', lemma: '가', meanings: ['đi'], pronunciation: 'ga', confidence: 1, rank: 0 });
  assert.equal(await dm.lookup('없음', 'xx'), null);
  assert.equal(await dm.lookup('가', 'yy'), null, 'unknown language');
  assert.equal(dm.has('나', 'xx'), true);
  assert.deepEqual(Array.from(dm.entries('xx')).map((e) => e[0]), ['가', '나']);
});
test('Providers are chained per language; first non-null answer wins', async () => {
  const dm = new LF.DictionaryManager();
  const a = new LF.LocalProvider({ id: 'a', language: 'xx', data: { entries: {} } });
  const b = new LF.LocalProvider({ id: 'b', language: 'xx', data: DATA });
  dm.register('xx', a).register('xx', b).register('xx', b);
  assert.equal(dm.getProviders('xx').length, 2);
  assert.equal((await dm.lookup('나', 'xx')).source, 'b');
});
test('LocalProvider rejects malformed data and can retry after a failed load', async () => {
  const p = new LF.LocalProvider({ id: 'bad', language: 'xx', data: { nope: 1 } });
  await assert.rejects(() => p.init(), /Invalid dictionary data/);
  let calls = 0;
  const q = new LF.LocalProvider({ id: 'flaky', language: 'xx', loader: async () => { if (calls++ === 0) throw new Error('boom'); return DATA; } });
  await assert.rejects(() => q.init(), /boom/);
  await q.init();
  assert.equal(q.size, 2);
});
test('Loader falls back to the background script when the page context blocks fetch', async () => {
  const saved = { fetch: globalThis.fetch, browser: globalThis.browser };
  const sent = [];
  globalThis.fetch = async () => { throw new Error('Content Security Policy blocked'); };
  globalThis.browser = { runtime: { getURL: (p) => 'moz-extension://test/' + p, sendMessage: async (m) => { sent.push(m); return { ok: true, data: DATA }; } } };
  try {
    const p = new LF.LocalProvider({ id: 'bg', language: 'xx', path: 'data/xx/dictionary.json' });
    assert.equal((await p.lookup('가')).meanings[0], 'đi');
    assert.deepEqual(sent, [{ type: 'linguaflow:getData', path: 'data/xx/dictionary.json' }]);
    globalThis.browser.runtime.sendMessage = async () => ({ ok: false, error: 'nope' });
    await assert.rejects(() => new LF.LocalProvider({ id: 'bg2', language: 'xx', path: 'x.json' }).init(), /Background could not load/);
  } finally { globalThis.fetch = saved.fetch; globalThis.browser = saved.browser; }
});

// ---- settings ---------------------------------------------------------------------------------------------------------
test('Settings: defaults, persistence, type-safe sanitising, change events, cross-context sync', async () => {
  const area = new LF.MemoryStorageArea();
  const s = new LF.Settings.SettingsStore(area);
  assert.deepEqual(await s.load(), LF.Settings.DEFAULTS);
  assert.equal(s.value('learningMode'), true); assert.equal(s.value('allowExternalLinks'), false); assert.equal(s.value('language'), 'ko');
  const seen = [];
  s.on('change', (v) => seen.push(v.speechRate));
  await s.set({ speechRate: 9, morphology: false, language: 123, bogus: true, uiLanguage: 'fr' });
  assert.equal(s.value('speechRate'), 2); assert.equal(s.value('morphology'), false); assert.equal(s.value('language'), 'ko'); assert.equal(s.value('uiLanguage'), 'vi'); assert.ok(!('bogus' in s.get()));
  assert.deepEqual(seen, [2]);
  const s2 = new LF.Settings.SettingsStore(area);
  assert.equal((await s2.load()).morphology, false);
  area.data[LF.Settings.KEY] = 'garbage'; // corrupted store never breaks the extension
  assert.deepEqual(await s2.load(), LF.Settings.DEFAULTS);
  // live sync: another context writes -> this one is notified
  const s3 = new LF.Settings.SettingsStore(area); await s3.load(); s3.watch({ onChanged: area.onChanged });
  let got = null; s3.on('change', (v) => { got = v; });
  await new LF.Settings.SettingsStore(area).set({ pauseOnLookup: false });
  assert.equal(got.pauseOnLookup, false);
  await s3.reset(); assert.equal(s3.value('pauseOnLookup'), true);
});

// ---- pronunciation ------------------------------------------------------------------------------------------------------
function fakeSynth(voices, behaviour) {
  const log = { spoken: [], cancels: 0 };
  const synth = { log, listeners: {}, getVoices: () => (typeof voices === 'function' ? voices() : voices), cancel() { log.cancels++; },
    addEventListener(t, fn) { this.listeners[t] = fn; },
    speak(u) { log.spoken.push(u); setTimeout(() => (behaviour === 'error' ? u.onerror({ error: 'synthesis-failed' }) : behaviour === 'canceled' ? u.onerror({ error: 'canceled' }) : u.onend()), 0); } };
  return synth;
}
const U = function (t) { this.text = t; };
test('speak(text, language): picks a ko-KR voice, sets lang/rate, cancels previous speech', async () => {
  const synth = fakeSynth([{ lang: 'en-US', name: 'Alex' }, { lang: 'ko_KR', name: 'Yuna' }]);
  const p = new LF.Pronunciation({ synth, Utterance: U, packs: LF.LanguagePackManager, getRate: () => 0.8 });
  assert.deepEqual(await p.speak('먹었습니다', 'ko'), { ok: true, lang: 'ko-KR', voice: 'Yuna' });
  const u = synth.log.spoken[0];
  assert.deepEqual({ text: u.text, lang: u.lang, rate: u.rate, voice: u.voice.name }, { text: '먹었습니다', lang: 'ko-KR', rate: 0.8, voice: 'Yuna' });
  assert.equal(synth.log.cancels, 1);
  assert.equal((await p.speak('가', 'ko', { rate: 1.3 })).ok, true); assert.equal(synth.log.spoken[1].rate, 1.3);
});
test('speak(): honest failure reasons (never reads Korean with a wrong voice)', async () => {
  const mk = (voices, extra) => new LF.Pronunciation(Object.assign({ synth: fakeSynth(voices), Utterance: U, packs: LF.LanguagePackManager, voiceWaitMs: 10 }, extra));
  assert.equal((await mk([]).speak('가', 'ko')).reason, 'no-voices');
  assert.equal((await mk([{ lang: 'en-US', name: 'Alex' }]).speak('가', 'ko')).reason, 'no-voice-for-language');
  assert.equal((await mk([{ lang: 'en-US', name: 'Alex' }]).speak('가', 'ko', { force: true })).ok, true);
  assert.equal((await mk([{ lang: 'ko-KR', name: 'Y' }]).speak('  ', 'ko')).reason, 'empty');
  assert.equal((await new LF.Pronunciation({ synth: null, Utterance: null }).speak('가', 'ko')).reason, 'unsupported');
  const errSynth = fakeSynth([{ lang: 'ko-KR', name: 'Y' }], 'error');
  assert.equal((await new LF.Pronunciation({ synth: errSynth, Utterance: U, packs: LF.LanguagePackManager }).speak('가', 'ko')).reason, 'error');
  const cancelSynth = fakeSynth([{ lang: 'ko-KR', name: 'Y' }], 'canceled');
  assert.equal((await new LF.Pronunciation({ synth: cancelSynth, Utterance: U, packs: LF.LanguagePackManager }).speak('가', 'ko')).ok, true);
});
test('speak(): waits (bounded) for voices that load asynchronously', async () => {
  let loaded = false;
  const synth = fakeSynth(() => (loaded ? [{ lang: 'ko-KR', name: 'Yuna' }] : []));
  const p = new LF.Pronunciation({ synth, Utterance: U, packs: LF.LanguagePackManager, voiceWaitMs: 500 });
  const pending = p.speak('가', 'ko');
  setTimeout(() => { loaded = true; synth.listeners.voiceschanged(); }, 20);
  assert.equal((await pending).ok, true);
});
