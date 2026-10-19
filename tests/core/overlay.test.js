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
test('Sino-Korean words: a line with the Hanja and the Hán-Việt reading (+ the root word of a derived verb); nothing when there is none', () => {
  const { overlay } = setup();
  overlay.showCard(Object.assign(MODEL(), { surface: '학교에서', lemma: '학교', etymology: { label: 'Hán tự · Hán-Việt', text: '學校', reading: 'học hiệu (trường học)' } }), RECT);
  assert.equal($(overlay, '.lf-ek').textContent, 'Hán tự · Hán-Việt');
  assert.equal($(overlay, '.lf-et').textContent, '學校');
  assert.equal($(overlay, '.lf-et').getAttribute('lang'), 'ko');
  assert.equal($(overlay, '.lf-er').textContent, 'học hiệu (trường học)');
  assert.equal($(overlay, '.lf-eroot'), null);
  overlay.showCard(Object.assign(MODEL(), { etymology: { label: 'Hán tự · Hán-Việt', text: '準備', reading: 'chuẩn bị', root: '준비', rootLabel: 'từ gốc' } }), RECT);
  assert.equal($(overlay, '.lf-eroot').textContent, '(từ gốc: 준비)');
  overlay.showCard(MODEL(), RECT);
  assert.equal($(overlay, '.lf-ety'), null);
});
test('...it is generic (any pack can give an etymology; label and root label are optional) and its text is text, never HTML', () => {
  const { overlay } = setup();
  overlay.showCard(Object.assign(MODEL(), { etymology: { text: '日本語', reading: '<img src=x onerror=alert(1)>', root: '日本' } }), RECT);
  assert.equal($(overlay, '.lf-ek'), null);
  assert.equal($(overlay, '.lf-et').textContent, '日本語');
  assert.equal($(overlay, '.lf-er').textContent, '<img src=x onerror=alert(1)>');
  assert.equal($(overlay, '.lf-er img'), null);
  assert.equal($(overlay, '.lf-eroot').textContent, '(日本)');
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

// ---- placement of a TALL card: it must never be pushed over the subtitle lines -----------------------------------------------------
// (found by the real-browser run: the grammar sections made the card taller than the room above a subtitle in a small player, and the old
// placement fell back to "clamp into the viewport", which put the card on top of the very subtitle the learner was reading)
function stubCardHeight(dom, heightOf) {
  const proto = dom.window.HTMLElement.prototype, orig = proto.getBoundingClientRect;
  proto.getBoundingClientRect = function () {
    if (this.classList && this.classList.contains('lf-card')) {
      const cap = parseInt(this.style.maxHeight, 10);
      const h = Math.min(heightOf(this), Number.isNaN(cap) ? Infinity : cap);
      return { left: 0, top: 0, right: 340, bottom: h, width: 340, height: h };
    }
    return orig.call(this);
  };
}
const boxOf = (o) => { const c = $(o, '.lf-card'), top = parseInt(c.style.top, 10), cap = parseInt(c.style.maxHeight, 10); return { top, cap, c }; };
const LINES = { left: 250, top: 440, right: 700, bottom: 520, width: 450, height: 80 }; // two subtitle lines; the word clicked is on the first
const WORD = { left: 300, top: 440, right: 380, bottom: 470, width: 80, height: 30 };

test('placement: a card that fits above the subtitle goes above it, at its natural height', () => {
  const { overlay, dom } = setup();
  stubCardHeight(dom, () => 300);
  overlay.showCard(MODEL(), WORD, LINES);
  const { top, cap, c } = boxOf(overlay);
  assert.equal(top, 440 - 10 - 300); assert.ok(Number.isNaN(cap), 'no height cap when it fits'); assert.equal(c.style.maxHeight, '');
});
test('placement: taller than the room above and the room below -> it takes the larger side, is shortened (scrolls inside) and does not touch the subtitles', () => {
  const { overlay, dom } = setup();
  stubCardHeight(dom, () => 600); // innerHeight in jsdom is 768: room above = 440-18 = 422, room below = 768-520-18 = 230
  overlay.showCard(MODEL(), WORD, LINES);
  const { top, cap } = boxOf(overlay);
  assert.equal(cap, 422); assert.equal(top, 8);
  assert.ok(top + cap <= LINES.top - 10, 'bottom edge ' + (top + cap) + ' is clear of the first subtitle line');
});
test('placement: no room above (subtitle near the top) -> below, shortened to the room there', () => {
  const { overlay, dom } = setup();
  stubCardHeight(dom, () => 900);
  const lines = { left: 250, top: 60, right: 700, bottom: 140, width: 450, height: 80 };
  overlay.showCard(MODEL(), { left: 300, top: 60, right: 380, bottom: 90, width: 80, height: 30 }, lines);
  const { top, cap } = boxOf(overlay);
  assert.equal(top, 140 + 10); assert.equal(cap, 768 - 140 - 18); assert.ok(top + cap <= 768 - 8);
});
test('placement: opening a section re-places the card - the edge facing the subtitles stays where it was, the card grows away from them', () => {
  const { overlay, dom } = setup();
  stubCardHeight(dom, (el) => 300 + 120 * el.querySelectorAll('details[open]').length);
  overlay.showCard(MODEL(), WORD, LINES);
  const before = boxOf(overlay);
  assert.equal(before.top + 300, 430);
  const det = $(overlay, 'details.lf-sent');
  det.open = true; det.dispatchEvent(new dom.window.Event('toggle'));
  const after = boxOf(overlay);
  assert.equal(after.top + 420, 430, 'grew upwards: its bottom edge is still 10px above the subtitle');
  assert.ok(after.top < before.top);
  // and a redraw (Save ...) keeps the open section and the clearance
  overlay.updateCard({ saved: true });
  const redrawn = boxOf(overlay);
  assert.equal(redrawn.top + 420, 430); assert.equal($(overlay, 'details.lf-sent').open, true);
});
