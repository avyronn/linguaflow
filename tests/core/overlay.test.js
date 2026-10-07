'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAll } = require('../helpers/load.js');
const D = require('../helpers/dom.js');
const LF = loadAll();

function setup() {
  const dom = D.makeDom();
  const i18n = LF.i18n.create('vi');
  const overlay = new LF.LearningOverlay({ document: dom.window.document, window: dom.window, t: i18n.t });
  const actions = [];
  overlay.on('action', (a) => actions.push(a.type));
  return { dom, overlay, actions, doc: dom.window.document };
}
const MODEL = () => ({
  lang: 'ko', surface: '어디에', lemma: '어디', pos: 'pron', posLabel: 'đại từ', romanization: 'eodie',
  lines: [{ text: '어디', gloss: 'đâu', kind: 'stem' }, { text: '-에', gloss: 'ở / tại / vào lúc / đến', kind: 'particle' }], summary: 'ở đâu',
  meanings: ['đâu', 'ở đâu'], confidence: 0.92, confidenceLabel: 'high', alternatives: [], sentence: '오늘 어디에 있었어요?', translation: 'Hôm nay bạn đã ở đâu?',
  saved: false, known: false, settings: { morphology: true, vocabulary: true, pronunciation: true, showRomanization: true },
});
const $ = (o, sel) => o.shadow.querySelector(sel);
const $$ = (o, sel) => Array.from(o.shadow.querySelectorAll(sel));
const RECT = { left: 300, top: 600, right: 380, bottom: 630, width: 80, height: 30 };

test('mount(): one shadow-DOM host; styles applied; unmount removes everything', () => {
  const { overlay, doc } = setup();
  overlay.mount(); overlay.mount();
  assert.equal(doc.querySelectorAll('#linguaflow-root').length, 1);
  assert.equal(overlay.host.shadowRoot.mode, 'open');
  assert.ok(overlay.shadow.querySelector('style').textContent.includes('.lf-card'), 'jsdom has no constructable stylesheets → <style> fallback');
  overlay.unmount();
  assert.equal(doc.getElementById('linguaflow-root'), null);
});
test('the card shows the word, romanization, morpheme rows and the composed meaning', () => {
  const { overlay } = setup();
  overlay.showCard(MODEL(), RECT);
  assert.equal($(overlay, '.lf-surface').textContent, '어디에');
  assert.equal($(overlay, '.lf-roman').textContent, 'eodie');
  assert.deepEqual($$(overlay, '.lf-rtext').map((e) => e.textContent), ['어디', '-에']);
  assert.ok($$(overlay, '.lf-rtext')[1].className.includes('k-particle'));
  assert.equal($$(overlay, '.lf-rgloss')[0].textContent.replace(/\s/g, ''), '=đâu');
  assert.equal($(overlay, '.lf-summary').textContent, '→ ở đâu');
  assert.equal($(overlay, '.lf-card').style.visibility, 'visible');
  assert.equal($(overlay, '.lf-pill'), null, 'no confidence warning when confidence is high');
});
test('buttons emit actions: speak, save, known, close — and saved state flips to unsave', () => {
  const { overlay, actions } = setup();
  overlay.showCard(MODEL(), RECT);
  const btn = (label) => $$(overlay, 'button').find((b) => b.textContent.includes(label));
  btn('🔊').click(); btn('Lưu từ').click(); btn('Đã biết').click(); btn('✕').click();
  assert.deepEqual(actions, ['speak', 'save', 'known', 'close']);
  overlay.updateCard({ saved: true, known: true });
  assert.ok(btn('Đã lưu').className.includes('on')); assert.ok(btn('Đã biết').className.includes('on'));
  btn('Đã lưu').click(); btn('Đã biết').click();
  assert.deepEqual(actions.slice(4), ['unsave', 'unknown']);
});
test('low confidence: pill + "view base form" toggle revealing original word, lemma and other readings', () => {
  const { overlay } = setup();
  overlay.showCard(Object.assign(MODEL(), { surface: '사는', lemma: '살다', confidenceLabel: 'low', confidence: 0.4, alternatives: [{ lemma: '사다', summary: 'mua (định ngữ)' }] }), RECT);
  assert.equal($(overlay, '.lf-pill').textContent, 'Analysis confidence: low');
  const box = $(overlay, '.lf-base'); assert.equal(box.hidden, true);
  const toggle = $$(overlay, 'button').find((b) => b.textContent === 'Xem từ gốc');
  toggle.click();
  assert.equal(box.hidden, false);
  assert.match(box.textContent, /사는/); assert.match(box.textContent, /살다/); assert.match(box.textContent, /사다 — mua/);
  toggle.click(); assert.equal(box.hidden, true);
});
test('sentence & translation live in a collapsed <details>; the clicked word is marked', () => {
  const { overlay } = setup();
  overlay.showCard(MODEL(), RECT);
  const det = $(overlay, 'details.lf-sent');
  assert.equal(det.open, false);
  assert.equal(det.querySelector('mark').textContent, '어디에');
  assert.equal(det.querySelector('.lf-trans').textContent, 'Hôm nay bạn đã ở đâu?');
  det.open = true; overlay.updateCard({ saved: true });
  assert.equal($(overlay, 'details.lf-sent').open, true, 'state survives re-render');
});
test('settings switch sections off', () => {
  const { overlay } = setup();
  overlay.showCard(Object.assign(MODEL(), { settings: { morphology: false, vocabulary: false, pronunciation: false, showRomanization: false } }), RECT);
  assert.equal($(overlay, '.lf-rows'), null); assert.equal($(overlay, '.lf-roman'), null); assert.equal($(overlay, '.lf-actions'), null);
  assert.equal($$(overlay, 'button').some((b) => b.textContent === '🔊'), false);
  assert.deepEqual($$(overlay, '.lf-meanings li').map((l) => l.textContent), ['đâu', 'ở đâu']);
});
test('untrusted text (subtitle content) is rendered as text, never as HTML', () => {
  const { overlay } = setup();
  overlay.showCard(Object.assign(MODEL(), { surface: '<img src=x onerror=alert(1)>', sentence: '<b>x</b> <img src=x>', translation: '<script>1</script>' }), RECT);
  assert.equal(overlay.shadow.querySelectorAll('img, script, b').length, 0);
  assert.equal($(overlay, '.lf-surface').textContent, '<img src=x onerror=alert(1)>');
});
test('placement: opens above the subtitle, stays inside the viewport, uses the fullscreen element as parent', () => {
  const { overlay, dom, doc } = setup();
  overlay.showCard(MODEL(), { left: 20, top: 650, right: 60, bottom: 680, width: 40, height: 30 });
  const card = $(overlay, '.lf-card');
  assert.ok(parseInt(card.style.top, 10) < 650, 'above the word');
  assert.ok(parseInt(card.style.left, 10) >= 8, 'clamped to the left edge');
  overlay.showCard(MODEL(), { left: 1000, top: 5, right: 1020, bottom: 30, width: 20, height: 25 });
  assert.ok(parseInt($(overlay, '.lf-card').style.top, 10) >= 30, 'no room above → opens below');
  assert.ok(parseInt($(overlay, '.lf-card').style.left, 10) + 340 <= dom.window.innerWidth - 8 + 1);
  const fs = doc.createElement('div'); doc.body.appendChild(fs);
  Object.defineProperty(doc, 'fullscreenElement', { configurable: true, get: () => fs });
  overlay.attach();
  assert.equal(overlay.host.parentNode, fs);
});
test('highlight box follows a rect and hides on null; toast appears and clears', async () => {
  const { overlay } = setup();
  overlay.setHighlight(RECT);
  const hl = $(overlay, '.lf-hl');
  assert.equal(hl.style.display, 'block'); assert.equal(hl.style.transform, 'translate(298px, 598px)'); assert.equal(hl.style.width, '84px');
  overlay.setHighlight(null); assert.equal(hl.style.display, 'none');
  overlay.showCard(MODEL(), RECT);
  overlay.toast('Không có giọng đọc', 20);
  assert.equal($(overlay, '.lf-toast').textContent, 'Không có giọng đọc');
  await D.tick(60);
  assert.equal($(overlay, '.lf-toast'), null);
});
test('containsEvent(): events from inside the card are recognised; page events are not', () => {
  const { overlay, doc, dom } = setup();
  overlay.showCard(MODEL(), RECT);
  let inside = null, outside = null;
  overlay.shadow.addEventListener('click', (e) => { inside = overlay.containsEvent(e); });
  doc.body.addEventListener('click', (e) => { if (e.target === doc.body) outside = overlay.containsEvent(e); });
  $(overlay, '.lf-surface').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, composed: true }));
  doc.body.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(inside, true); assert.equal(outside, false);
});
test('debug panel toggles and shows the given info', () => {
  const { overlay } = setup();
  assert.equal(overlay.toggleDebug({ a: 1 }), true);
  assert.match($(overlay, '.lf-debug pre').textContent, /"a": 1/);
  overlay.updateDebug('hello'); assert.equal($(overlay, '.lf-debug pre').textContent, 'hello');
  assert.equal(overlay.toggleDebug(), false); assert.equal($(overlay, '.lf-debug'), null);
});
