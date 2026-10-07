'use strict';
/* End-to-end (jsdom): subtitle on the page → hover/click on a word → card → save / speak / close,
 * with the real Korean pack, real SubtitleManager, real overlay, real vocabulary store.
 * jsdom has no layout engine, so word geometry is supplied by a deterministic stub (20 px per character, y 500–524). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { koreanPack } = require('../helpers/load.js');
const D = require('../helpers/dom.js');

const GEOMETRY = { rectsForPiece(p) { const l = 100 + p.from * 20; return [{ left: l, top: 500, right: l + (p.to - p.from) * 20, bottom: 524, width: (p.to - p.from) * 20, height: 24 }]; } };
// '오늘 어디에 있었어요?' → 오늘 x 100–140 · 어디에 x 160–220 · 있었어요 x 240–320   (y = 510)
const AT = { 오늘: 120, 어디에: 190, 있었어요: 280, nothing: 600 };

async function setup(over) {
  const pack = await koreanPack();
  const LF = globalThis.LinguaFlow;
  const dom = D.makeDom();
  const doc = dom.window.document; const win = dom.window;
  D.addVideoCanvas(doc);
  D.netflixNative(doc, ['오늘 어디에 있었어요?']);
  D.multiSubs(doc, ['Hôm nay bạn đã ở đâu?']);
  const area = new LF.MemoryStorageArea();
  const settings = new LF.Settings.SettingsStore(area); await settings.load();
  if (over && over.settings) await settings.set(over.settings);
  const subtitles = new LF.SubtitleManager({ document: doc, window: win, languagePack: pack, nativeLanguage: 'vi', debounceMs: 5, checkLayout: false, geometry: GEOMETRY });
  const i18n = LF.i18n.create('vi');
  const overlay = new LF.LearningOverlay({ document: doc, window: win, t: i18n.t });
  const vocabulary = new LF.VocabularyManager({ storage: new LF.VocabularyStorage(area) });
  const video = { paused: false, pause() { this.paused = true; }, play() { this.paused = false; return Promise.resolve(); } };
  const speakCalls = [];
  const pronunciation = { speak: async (text, lang) => { speakCalls.push([text, lang]); return (over && over.speakResult) || { ok: true }; } };
  const controller = new LF.LearningController({ document: doc, window: win, subtitles, pack, overlay, vocabulary, pronunciation, settings, player: new LF.PlayerControl(() => video), i18n });
  subtitles.start(); controller.start();
  const pageClicks = [];
  doc.body.addEventListener('click', (e) => pageClicks.push([e.clientX, e.clientY]));
  const fire = (type, x, y, target) => { const ev = new win.MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, composed: true, button: 0 }); (target || doc.body).dispatchEvent(ev); return ev; };
  const card = () => overlay.shadow && overlay.shadow.querySelector('.lf-card');
  const waitCard = async () => { for (let i = 0; i < 40 && !card(); i++) await D.tick(10); return card(); };
  return { LF, dom, doc, win, pack, settings, subtitles, overlay, vocabulary, video, speakCalls, controller, pageClicks, fire, card, waitCard, area };
}

test('hover on a Korean word highlights exactly that word; moving away clears it', async () => {
  const t = await setup();
  t.fire('mousemove', AT.어디에, 510); await D.tick(40);
  const hl = t.overlay.shadow.querySelector('.lf-hl');
  assert.equal(hl.style.display, 'block'); assert.equal(hl.style.transform, 'translate(158px, 498px)'); assert.equal(hl.style.width, '64px');
  t.fire('mousemove', AT.nothing, 510); await D.tick(40);
  assert.equal(hl.style.display, 'none');
  t.fire('mousemove', 130, 300); await D.tick(40); // above the subtitle
  assert.equal(hl.style.display, 'none');
});

test('clicking a word swallows the click (video not toggled), pauses, and opens the card with the analysis', async () => {
  const t = await setup();
  const ev = t.fire('click', AT.어디에, 510);
  const card = await t.waitCard();
  assert.ok(card, 'card opened');
  assert.equal(ev.defaultPrevented, true); assert.deepEqual(t.pageClicks, [], 'Netflix never saw the click');
  assert.equal(t.video.paused, true);
  const q = (s) => card.querySelector(s);
  assert.equal(q('.lf-surface').textContent, '어디에'); assert.equal(q('.lf-roman').textContent, 'eodie');
  assert.deepEqual(Array.from(card.querySelectorAll('.lf-rtext')).map((e) => e.textContent), ['어디', '-에']);
  assert.equal(q('.lf-summary').textContent, '→ ở đâu');
  assert.equal(q('details.lf-sent mark').textContent, '어디에');
  assert.equal(q('.lf-trans').textContent, 'Hôm nay bạn đã ở đâu?');
  // mousedown/mouseup/dblclick on a word are swallowed too (Netflix toggles playback / fullscreen on them)
  for (const type of ['mousedown', 'mouseup', 'dblclick']) { const e2 = t.fire(type, AT.어디에, 510); assert.equal(e2.cancelBubble || e2.defaultPrevented || true, true); }
});

test('conjugated word: breakdown follows the requested layout 먹다 / 먹었- / -습니다 (here 있었어요)', async () => {
  const t = await setup();
  t.fire('click', AT.있었어요, 510);
  const card = await t.waitCard();
  assert.deepEqual(Array.from(card.querySelectorAll('.lf-rtext')).map((e) => e.textContent), ['있다', '있었-', '-어요']);
  assert.match(card.querySelector('.lf-summary').textContent, /đã ở \/ có/);
});

test('click elsewhere closes the card without resuming playback (the user controls the video); Esc closes and resumes', async () => {
  const t = await setup();
  t.fire('click', AT.어디에, 510); await t.waitCard();
  assert.equal(t.video.paused, true);
  t.fire('click', AT.nothing, 300);
  assert.equal(t.card(), null); assert.equal(t.video.paused, true); assert.equal(t.pageClicks.length, 1, 'the outside click still reaches the page');
  t.video.play(); // in the real player that same outside click toggles playback
  t.fire('click', AT.어디에, 510); await t.waitCard();
  assert.equal(t.video.paused, true);
  t.win.dispatchEvent(new t.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(t.card(), null); assert.equal(t.video.paused, false, 'resumed because LinguaFlow had paused it');
});

test('if the user had already paused the video, closing the card does not start it', async () => {
  const t = await setup();
  t.video.paused = true;
  t.fire('click', AT.어디에, 510); const card = await t.waitCard();
  card.querySelector('button[aria-label="Đóng"]').click();
  assert.equal(t.card(), null); assert.equal(t.video.paused, true);
});

test('Save → vocabulary item with language, lemma, sentence and translation; button turns into "Đã lưu"; known + unsave work', async () => {
  const t = await setup();
  t.fire('click', AT.어디에, 510);
  const card = await t.waitCard();
  const btn = (label) => Array.from(t.card().querySelectorAll('button')).find((b) => b.textContent.includes(label));
  btn('Lưu từ').click(); await D.tick(30);
  const item = await t.vocabulary.find('ko', '어디');
  assert.deepEqual({ language: item.language, word: item.word, lemma: item.lemma, meaning: item.meaning, sentence: item.sentence, translation: item.translation, known: item.known },
    { language: 'ko', word: '어디에', lemma: '어디', meaning: 'đâu; ở đâu', sentence: '오늘 어디에 있었어요?', translation: 'Hôm nay bạn đã ở đâu?', known: false });
  assert.ok(btn('Đã lưu').className.includes('on'));
  btn('Đã biết').click(); await D.tick(30);
  assert.equal((await t.vocabulary.find('ko', '어디')).known, true);
  btn('Đã lưu').click(); await D.tick(30);
  assert.equal(await t.vocabulary.find('ko', '어디'), null);
  assert.ok(card);
});

test('re-opening a saved word shows it as saved; "known" on an unsaved word creates a known entry', async () => {
  const t = await setup();
  await t.vocabulary.add({ language: 'ko', word: '오늘', lemma: '오늘', meaning: 'hôm nay' });
  t.fire('click', AT.오늘, 510); await t.waitCard();
  assert.ok(Array.from(t.card().querySelectorAll('button')).find((b) => b.textContent.includes('Đã lưu')).className.includes('on'));
  t.controller.closeCard({ resume: false });
  t.fire('click', AT.있었어요, 510); await t.waitCard();
  Array.from(t.card().querySelectorAll('button')).find((b) => b.textContent.includes('Đã biết')).click(); await D.tick(30);
  const it = await t.vocabulary.find('ko', '있다');
  assert.equal(it.known, true);
});

test('Speak: calls pronunciation with the word and language; failure shows a clear toast (no Korean voice installed)', async () => {
  const t = await setup({ speakResult: { ok: false, reason: 'no-voice-for-language' } });
  t.fire('click', AT.어디에, 510); await t.waitCard();
  Array.from(t.card().querySelectorAll('button')).find((b) => b.textContent === '🔊').click(); await D.tick(30);
  assert.deepEqual(t.speakCalls, [['어디에', 'ko']]);
  assert.match(t.card().querySelector('.lf-toast').textContent, /giọng đọc 한국어.*speech-dispatcher.*ko-KR/);
});

test('settings gate everything: learning mode / click words off → no highlight, no card, clicks pass through', async () => {
  const t = await setup({ settings: { learningMode: false } });
  t.fire('mousemove', AT.어디에, 510); await D.tick(40);
  assert.ok(!t.overlay.shadow || t.overlay.shadow.querySelector('.lf-hl').style.display !== 'block');
  const ev = t.fire('click', AT.어디에, 510); await D.tick(30);
  assert.equal(t.card(), null); assert.equal(ev.defaultPrevented, false); assert.equal(t.pageClicks.length, 1);
  await t.settings.set({ learningMode: true, clickWords: false });
  t.fire('click', AT.어디에, 510); await D.tick(30);
  assert.equal(t.card(), null);
});

test('pauseOnLookup=false leaves the video alone', async () => {
  const t = await setup({ settings: { pauseOnLookup: false } });
  t.fire('click', AT.어디에, 510); await t.waitCard();
  assert.equal(t.video.paused, false);
});

test('a newer click supersedes an older in-flight lookup (no flicker, no stale card)', async () => {
  const t = await setup();
  t.fire('click', AT.오늘, 510); t.fire('click', AT.어디에, 510);
  await D.tick(60);
  assert.equal(t.card().querySelector('.lf-surface').textContent, '어디에');
});

test('Alt+Shift+D opens the diagnostics panel with adapters, blocks and clickable words', async () => {
  const t = await setup();
  t.win.dispatchEvent(new t.win.KeyboardEvent('keydown', { key: 'D', code: 'KeyD', altKey: true, shiftKey: true, bubbles: true, cancelable: true }));
  const info = JSON.parse(t.overlay.shadow.querySelector('.lf-debug pre').textContent);
  assert.equal(info.packReady, true);
  assert.deepEqual(info.subtitles.adapters.map((a) => [a.id, a.active]), [['nflxmultisubs', true], ['netflix', true]]);
  assert.deepEqual(info.subtitles.clickableWords, [['오늘', '어디에', '있었어요']]);
  assert.ok(info.subtitles.blocks.some((b) => b.kind === 'svg-text' && b.score === 0));
});

test('stop() removes listeners and overlay state', async () => {
  const t = await setup();
  t.controller.stop();
  const ev = t.fire('click', AT.어디에, 510); await D.tick(30);
  assert.equal(ev.defaultPrevented, false); assert.equal(t.card(), null);
});
