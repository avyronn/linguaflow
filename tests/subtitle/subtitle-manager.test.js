'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { koreanPack } = require('../helpers/load.js');
const D = require('../helpers/dom.js');

async function setup(opts) {
  const pack = await koreanPack();
  const LF = globalThis.LinguaFlow;
  const dom = D.makeDom();
  const doc = dom.window.document;
  D.addVideoCanvas(doc);
  const mgr = new LF.SubtitleManager(Object.assign({ document: doc, window: dom.window, languagePack: pack, nativeLanguage: 'vi', debounceMs: 5, checkLayout: false }, opts || {}));
  return { LF, pack, dom, doc, mgr };
}

test('Netflix native DOM: Korean line detected as primary', async () => {
  const { doc, mgr } = await setup();
  D.netflixNative(doc, ['오늘 어디에 있었어요?']);
  mgr.start();
  const cur = mgr.getCurrentSubtitle();
  assert.equal(cur.primary.language, 'ko');
  assert.equal(cur.primary.text, '오늘 어디에 있었어요?');
  assert.equal(cur.secondary, null);
  assert.equal(cur.source, 'netflix');
  mgr.stop();
});

test('Native Korean (Netflix) + NflxMultiSubs Vietnamese (SVG text): primary/secondary split, no duplicate', async () => {
  const { doc, mgr } = await setup();
  D.netflixNative(doc, ['오늘 어디에 있었어요?']);
  D.multiSubs(doc, ['Hôm nay bạn đã ở đâu?']);
  mgr.start();
  const cur = mgr.getCurrentSubtitle();
  assert.deepEqual({ l: cur.primary.language, t: cur.primary.text }, { l: 'ko', t: '오늘 어디에 있었어요?' });
  assert.deepEqual({ l: cur.secondary.language, t: cur.secondary.text }, { l: 'vi', t: 'Hôm nay bạn đã ở đâu?' });
  assert.equal(cur.source, 'nflxmultisubs+netflix');
  assert.ok(typeof cur.timestamp === 'number');
  mgr.stop();
});

test('Reverse layout: Vietnamese native + Korean in NflxMultiSubs SVG text', async () => {
  const { doc, mgr } = await setup();
  D.netflixNative(doc, ['Hôm nay bạn đã ở đâu?']);
  D.multiSubs(doc, ['오늘 어디에 있었어요?']);
  mgr.start();
  const cur = mgr.getCurrentSubtitle();
  assert.equal(cur.primary.text, '오늘 어디에 있었어요?');
  assert.equal(cur.secondary.text, 'Hôm nay bạn đã ở đâu?');
  const maps = mgr.getWordMaps();
  assert.equal(maps.length, 1);
  assert.equal(maps[0].block.kind, 'svg-text');
  assert.deepEqual(maps[0].tokens.map((t) => t.text), ['오늘', '어디에', '있었어요']);
  mgr.stop();
});

test('Two-line native caption with Korean + Vietnamese in the same box is split per line', async () => {
  const { doc, mgr } = await setup();
  D.netflixNative(doc, ['저는 한국어를 공부해요.', 'Tôi học tiếng Hàn.']);
  mgr.start();
  const cur = mgr.getCurrentSubtitle();
  assert.equal(cur.primary.text, '저는 한국어를 공부해요.');
  assert.equal(cur.secondary.text, 'Tôi học tiếng Hàn.');
  mgr.stop();
});

test('Only fires on change (cached), clears when subtitle disappears, reacts via MutationObserver', async () => {
  const { doc, mgr } = await setup();
  const events = [];
  mgr.on('subtitle', (s) => events.push('subtitle:' + s.primary.text));
  mgr.on('clear', () => events.push('clear'));
  mgr.start();
  D.netflixNative(doc, ['사람이 많아요.']);
  await D.tick(40);
  D.netflixNative(doc, ['사람이 많아요.']); // identical text re-rendered into new nodes: no new event
  await D.tick(40);
  D.netflixNative(doc, ['왜 이렇게 늦었어요?']);
  await D.tick(40);
  D.clearNative(doc);
  await D.tick(40);
  assert.deepEqual(events, ['subtitle:사람이 많아요.', 'subtitle:왜 이렇게 늦었어요?', 'clear']);
  assert.equal(mgr.getCurrentSubtitle(), null);
  mgr.stop();
});

test('Re-rendered identical text refreshes element references (word maps never point to detached nodes)', async () => {
  const { doc, mgr } = await setup();
  mgr.start();
  D.netflixNative(doc, ['그 사람을 찾고 있어요.']);
  await D.tick(40);
  const first = mgr.getWordMaps()[0].block.element;
  D.netflixNative(doc, ['그 사람을 찾고 있어요.']);
  await D.tick(40);
  const second = mgr.getWordMaps()[0].block.element;
  assert.notEqual(first, second);
  assert.ok(second.isConnected);
  mgr.stop();
});

test('Hidden duplicate (display:none) is ignored, visible one is used', async () => {
  const { doc, mgr } = await setup();
  const hidden = D.netflixNative(doc, ['오늘 어디에 있었어요?']);
  hidden.style.display = 'none';
  D.multiSubs(doc, ['오늘 어디에 있었어요?']);
  mgr.start();
  const kinds = mgr.describe().blocks.map((b) => b.kind);
  assert.deepEqual(kinds, ['svg-text']);
  mgr.stop();
});

test('Custom selectors from Settings are honoured; invalid selectors are ignored safely', async () => {
  const { doc, mgr, LF } = await setup();
  const el = doc.createElement('div'); el.className = 'brand-new-netflix-subtitle'; el.textContent = '왜 그래요?';
  doc.body.appendChild(el);
  mgr.start();
  assert.equal(mgr.getCurrentSubtitle(), null);
  mgr.setCustomSelectors(LF.SubtitleSelectors.parseCustom('  \n# comment\n[[[bad\n.brand-new-netflix-subtitle\n'));
  assert.equal(mgr.getCurrentSubtitle().primary.text, '왜 그래요?');
  mgr.stop();
});

test('watchOnly: nothing is processed outside /watch', async () => {
  const pack = await koreanPack();
  const LF = globalThis.LinguaFlow;
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<body></body>', { url: 'https://www.netflix.com/browse', pretendToBeVisual: true });
  const doc = dom.window.document;
  const mgr = new LF.SubtitleManager({ document: doc, window: dom.window, languagePack: pack, debounceMs: 5, checkLayout: false, watchOnly: true });
  D.netflixNative(doc, ['오늘 어디에 있었어요?']);
  mgr.start();
  assert.equal(mgr.getCurrentSubtitle(), null);
  mgr.stop();
});

test('Image-based subtitles (no text) yield nothing instead of garbage', async () => {
  const { doc, mgr } = await setup();
  const div = doc.createElement('div'); div.className = 'image-based-subtitles';
  div.innerHTML = '<svg><image href="x.png"/></svg>';
  doc.body.appendChild(div);
  mgr.start();
  assert.equal(mgr.getCurrentSubtitle(), null);
  assert.equal(mgr.describe().imageSubtitles, true);
  mgr.stop();
});
