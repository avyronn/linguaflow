'use strict';
/* Smoke-tests the real popup.html / page.html in jsdom: the actual <script> tags are loaded from disk in the
 * order written in the HTML (so a wrong order or a missing file fails here), against an in-memory browser.storage. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { loadAll, ROOT } = require('../helpers/load.js');
const LFNode = loadAll();

async function openPage(file, hash) {
  const area = new LFNode.MemoryStorageArea();
  const errors = [], tabs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
  const browser = { storage: { local: area, onChanged: area.onChanged }, runtime: { id: 'test', getURL: (p) => 'moz-extension://test/' + p }, tabs: { create: async (o) => { tabs.push(o.url); } } };
  const [rel, h] = file.split('#');
  const file_ = path.join(ROOT, rel);
  const dom = await JSDOM.fromFile(file_, { runScripts: 'dangerously', resources: 'usable', virtualConsole: vc, url: 'file://' + file_ + (h ? '#' + h : (hash || '')), beforeParse(w) { w.browser = browser; w.close = () => {}; } });
  const w = dom.window, doc = w.document;
  const until = async (fn, ms) => { const t0 = Date.now(); for (;;) { try { const r = fn(); if (r) return r; } catch (e) { /* retry */ } if (Date.now() - t0 > (ms || 3000)) throw new Error('timeout waiting for UI'); await new Promise((r) => setTimeout(r, 15)); } };
  await until(() => doc.querySelector('#view').children.length > 0);
  const nav = async (label) => { Array.from(doc.querySelectorAll('#nav button')).find((b) => b.textContent.includes(label)).click(); await new Promise((r) => setTimeout(r, 40)); await until(() => doc.querySelector('#view').children.length > 0); };
  const vm = () => new w.LinguaFlow.VocabularyManager({ storage: new w.LinguaFlow.VocabularyStorage(area) });
  const settings = () => area.data['lf:v1:settings'];
  return { dom, w, doc, area, errors, tabs, until, nav, vm, settings, wait: (ms) => new Promise((r) => setTimeout(r, ms || 40)) };
}
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

test('Home: header, language selector (한국어 selected, others "Sắp ra mắt" and not selectable), switches', async () => {
  const p = await openPage('src/popup/popup.html');
  const { doc } = p;
  assert.equal(text(doc.querySelector('h1')), 'LinguaFlow'); assert.equal(text(doc.querySelector('.tag')), 'Learn languages while watching.');
  const langs = Array.from(doc.querySelectorAll('.lang'));
  assert.deepEqual(langs.map((l) => l.querySelector('b').textContent), ['한국어', '日本語', '中文', 'English', 'Español', 'Français', 'Deutsch']);
  assert.equal(langs[0].getAttribute('aria-checked'), 'true'); assert.match(text(langs[0]), /Đang học/);
  for (const l of langs.slice(1)) { assert.equal(l.getAttribute('aria-disabled'), 'true'); assert.match(text(l), /Sắp ra mắt/); }
  langs[1].click(); await p.wait();
  assert.equal(p.settings() && p.settings().language, undefined, 'a pack that does not exist cannot be selected');
  assert.deepEqual(Array.from(doc.querySelectorAll('.switch .label')).map((l) => l.firstChild.textContent), ['Learning mode', 'Click words', 'Morphology', 'Vocabulary', 'Pronunciation']);
  assert.deepEqual(Array.from(doc.querySelectorAll('#nav button')).map((b) => text(b).slice(1)), ['Trang chủ', 'Vocabulary', 'Review', 'Settings']);
  const clickWords = Array.from(doc.querySelectorAll('.switch')).find((l) => l.textContent.includes('Click words')).querySelector('input');
  assert.equal(clickWords.checked, true); clickWords.click(); await p.wait();
  assert.equal(p.settings().clickWords, false);
  assert.match(text(doc.querySelector('.stats')), /0 từ đã lưu · 0 cần ôn/);
  assert.match(text(doc.querySelector('#view p.muted')), /bật phụ đề 한국어/);
  assert.deepEqual(p.errors, []);
});

test('Vocabulary: list, search, filters, speak message without TTS, mark known, delete, export/import buttons', async () => {
  const p = await openPage('src/popup/popup.html');
  const vm = p.vm();
  await vm.add({ language: 'ko', word: '어디에', lemma: '어디', meaning: 'đâu', sentence: '오늘 어디에 있었어요?', translation: 'Hôm nay bạn đã ở đâu?' });
  await vm.add({ language: 'ko', word: '사람', lemma: '사람', meaning: 'người' });
  await p.nav('Vocabulary');
  const { doc } = p;
  await p.until(() => doc.querySelectorAll('.vitem').length === 2);
  assert.match(text(doc.querySelector('.vitem')), /사람|어디/);
  const item = Array.from(doc.querySelectorAll('.vitem')).find((i) => i.textContent.includes('어디'));
  assert.match(text(item), /eodi/); assert.match(text(item), /Hôm nay bạn đã ở đâu\?/);
  const search = doc.querySelector('input[type="search"]'); search.value = 'người'; search.dispatchEvent(new p.w.Event('input')); await p.wait();
  assert.equal(doc.querySelectorAll('.vitem').length, 1);
  search.value = ''; search.dispatchEvent(new p.w.Event('input')); await p.wait();
  const btn = (el, label) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent.includes(label));
  btn(item, '🔊').click(); await p.wait(60);
  assert.match(text(doc.querySelector('.status')), /không hỗ trợ Web Speech/);
  btn(item, 'Đã biết').click(); await p.wait(60);
  assert.equal((await vm.find('ko', '어디')).known, true);
  Array.from(doc.querySelectorAll('.chip')).find((c) => c.textContent === 'Đã biết').click(); await p.wait();
  assert.equal(doc.querySelectorAll('.vitem').length, 1);
  Array.from(doc.querySelectorAll('.chip')).find((c) => c.textContent === 'Tất cả').click(); await p.wait();
  btn(Array.from(doc.querySelectorAll('.vitem')).find((i) => i.textContent.includes('사람')), 'Xóa').click(); await p.wait(60);
  assert.equal(await vm.find('ko', '사람'), null);
  assert.deepEqual(Array.from(doc.querySelectorAll('.row .btn')).map((b) => text(b)), ['Xuất JSON', 'Xuất CSV', 'Nhập JSON']);
  assert.deepEqual(p.errors, []);
});

test('Review: front → Show answer → grade (Again/Hard/Good/Easy with intervals) → next card → done', async () => {
  const p = await openPage('src/popup/popup.html');
  const vm = p.vm();
  await vm.add({ language: 'ko', word: '어디에', lemma: '어디', meaning: 'đâu', sentence: '오늘 어디에 있었어요?', translation: 'Hôm nay bạn đã ở đâu?' });
  await new Promise((r) => setTimeout(r, 5));
  await vm.add({ language: 'ko', word: '사람이', lemma: '사람', meaning: 'người' });
  await p.nav('Review');
  const { doc } = p;
  await p.until(() => doc.querySelector('.rv-word'));
  assert.equal(text(doc.querySelector('.rv-word')), '어디'); assert.equal(text(doc.querySelector('.rv-rom')), 'eodi');
  assert.equal(doc.querySelector('.rv-meaning'), null, 'answer hidden until requested');
  doc.querySelector('#show').click(); await p.wait();
  assert.equal(text(doc.querySelector('.rv-meaning')), 'đâu'); assert.match(text(doc.querySelector('.rv-ctx')), /Hôm nay bạn đã ở đâu/);
  assert.equal(doc.querySelector('.rv-ctx mark').textContent, '어디에');
  const grades = Array.from(doc.querySelectorAll('.grades .btn'));
  assert.deepEqual(grades.map((g) => text(g)), ['Again10 phút', 'Hard1 ngày', 'Good1 ngày', 'Easy4 ngày']);
  grades[2].click(); await p.wait(60);
  assert.equal((await vm.find('ko', '어디')).reviewCount, 1);
  await p.until(() => text(doc.querySelector('.rv-word')) === '사람');
  doc.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: ' ', bubbles: true })); await p.wait();
  doc.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: '1', bubbles: true })); await p.wait(60);
  const again = await vm.find('ko', '사람');
  assert.equal(again.reviewCount, 1); assert.equal(again.interval, 0);
  await p.until(() => /Hết thẻ/.test(text(doc.querySelector('.empty'))));
  assert.deepEqual(p.errors, []);
});

test('Review with nothing due shows the empty state', async () => {
  const p = await openPage('src/popup/popup.html#review');
  await p.until(() => p.doc.querySelector('.empty'));
  assert.match(text(p.doc.querySelector('.empty')), /Chưa có thẻ nào cần ôn/);
});

test('Settings: persisted controls, custom selectors, UI language switch to English and back, reset, delete-all', async () => {
  const p = await openPage('src/popup/popup.html');
  await p.nav('Settings');
  const { doc, w } = p;
  const ta = doc.querySelector('textarea'); ta.value = '.my-subs\n#other'; ta.dispatchEvent(new w.Event('change')); await p.wait();
  assert.equal(p.settings().customSelectors, '.my-subs\n#other');
  const rate = doc.querySelector('input[type="range"]'); rate.value = '1.2'; rate.dispatchEvent(new w.Event('change')); await p.wait();
  assert.equal(p.settings().speechRate, 1.2);
  const sw = (label) => Array.from(doc.querySelectorAll('.switch')).find((l) => l.textContent.includes(label)).querySelector('input');
  assert.equal(sw('Tạm dừng video').checked, true); sw('Tạm dừng video').click(); await p.wait();
  assert.equal(p.settings().pauseOnLookup, false);
  assert.equal(sw('Hiện nút tra từ điển online').checked, false, 'external dictionary links are opt-in');
  const sel = doc.querySelector('select'); sel.value = 'en'; sel.dispatchEvent(new w.Event('change')); await p.wait(80);
  assert.equal(p.settings().uiLanguage, 'en');
  assert.deepEqual(Array.from(doc.querySelectorAll('#nav button')).map((b) => text(b).slice(1)), ['Home', 'Vocabulary', 'Review', 'Settings']);
  assert.match(text(doc.querySelector('#view')), /Everything stays in this browser/);
  w.confirm = () => true;
  const vm = p.vm(); await vm.add({ language: 'ko', word: '가', lemma: '가', meaning: 'x' });
  await p.nav('Settings');
  Array.from(doc.querySelectorAll('.btn.danger')).find((b) => /Delete all vocabulary/.test(b.textContent)).click(); await p.wait(80);
  assert.equal((await vm.list()).length, 0);
  Array.from(doc.querySelectorAll('.btn')).find((b) => /Restore default/.test(b.textContent)).click(); await p.wait(80);
  assert.equal(p.settings().uiLanguage, 'vi'); assert.equal(p.settings().pauseOnLookup, true); assert.equal(p.settings().customSelectors, '');
  assert.deepEqual(p.errors, []);
});

test('"Open full page" opens the options page in a tab with the current view; page.html renders in tab mode', async () => {
  const p = await openPage('src/popup/popup.html');
  await p.nav('Vocabulary');
  p.doc.getElementById('openTab').click(); await p.wait();
  assert.deepEqual(p.tabs, ['moz-extension://test/src/popup/page.html#vocabulary']);
  const t = await openPage('src/popup/page.html#settings');
  assert.equal(t.doc.body.dataset.mode, 'tab');
  assert.equal(t.doc.querySelector('#nav button[aria-current="page"]').textContent.slice(1), 'Settings');
  assert.deepEqual(t.errors, []);
});
