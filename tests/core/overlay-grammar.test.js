'use strict';
/* The grammar part of the word card (overlay): patterns of the clicked word first, the other patterns of the sentence collapsed, then the
 * structure of the sentence. The card is fed by the REAL Korean pack here (not a hand-made model), so this also pins the contract between
 * LanguagePack.analyzeSentence() and the core that lays it out - the core never needs to know the language. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAll, koreanPack } = require('../helpers/load.js');
const D = require('../helpers/dom.js');
const LF = loadAll();

let pack;
test.before(async () => { pack = await koreanPack(); });

function setup() {
  const dom = D.makeDom();
  const i18n = LF.i18n.create('vi');
  const overlay = new LF.LearningOverlay({ document: dom.window.document, window: dom.window, t: i18n.t });
  return { dom, overlay, doc: dom.window.document };
}
const RECT = { left: 300, top: 600, right: 380, bottom: 630, width: 80, height: 30 };
const $ = (o, sel) => o.shadow.querySelector(sel);
const $$ = (o, sel) => Array.from(o.shadow.querySelectorAll(sel));
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
/** a card model for `surface` clicked inside `sentence`, with the real grammar of that sentence */
function model(sentence, surface, extra) {
  return Object.assign({
    lang: 'ko', surface, lemma: surface, pos: 'n', posLabel: 'danh từ', romanization: '', lines: [{ text: surface, gloss: 'x', kind: 'stem' }], summary: 'x', meanings: ['x'],
    confidence: 0.95, confidenceLabel: 'high', alternatives: [], sentence, translation: 'dịch', saved: false, known: false,
    settings: { morphology: true, vocabulary: true, pronunciation: true, showRomanization: false, grammar: true },
    grammar: pack.analyzeSentence(sentence, { focus: surface }),
  }, extra || {});
}
const folds = (o) => $$(o, 'details.lf-gram');
const foldTitle = (d) => text(d.querySelector('summary'));

test('three sections, in order: the patterns of the clicked word (open), the other patterns (collapsed), the sentence structure (collapsed)', () => {
  const { overlay } = setup();
  overlay.showCard(model('오늘 어디에 있었어요?', '어디에'), RECT);
  const f = folds(overlay);
  assert.deepEqual(f.map(foldTitle), ['Mẫu ngữ pháp · 1', 'Các mẫu khác trong câu · 2', 'Cấu trúc câu']);
  assert.deepEqual(f.map((d) => d.open), [true, false, false]);
  // the grammar comes after the sentence and before the actions
  const order = Array.from($(overlay, '.lf-card').children).map((c) => c.className);
  assert.ok(order.findIndex((c) => /lf-sent/.test(c)) < order.findIndex((c) => /lf-gram/.test(c)));
  assert.ok(order.findIndex((c) => /lf-gram/.test(c)) < order.findIndex((c) => /lf-actions/.test(c)));
});
test('a pattern block: form, level, meaning, the words it matched, and (collapsed) the explanation with examples', () => {
  const { overlay } = setup();
  overlay.showCard(model('오늘 어디에 있었어요?', '어디에'), RECT);
  const pat = $(overlay, '.lf-pat.focus');
  assert.equal(text(pat.querySelector('.lf-pform')), 'N에 있다/없다');
  assert.equal(text(pat.querySelector('.lf-lv')), 'Lv 1');
  assert.equal(text(pat.querySelector('.lf-pm')), 'ở N / không ở N');
  assert.equal(text(pat.querySelector('.lf-ptext')), 'Trong câu: 어디에 있었어요');
  assert.equal(pat.querySelector('.lf-ptext .lf-ko').getAttribute('lang'), 'ko'); // the right font / reading for Korean text
  assert.equal(pat.querySelector('.lf-pill'), null, 'no warning on a high-confidence match');
  const det = pat.querySelector('details.lf-pdet');
  assert.equal(det.open, false); assert.equal(text(det.querySelector('summary')), 'Giải thích & ví dụ');
  assert.match(text(det.querySelector('p')), /Vị trí của người hoặc vật/);
  const ex = Array.from(det.querySelectorAll('.lf-exs li')).map((li) => [li.querySelector('.lf-ko').textContent, li.querySelector('.lf-exvi').textContent]);
  assert.deepEqual(ex, [['제 친구는 서울에 있어요.', 'Bạn tôi ở Seoul.'], ['책이 가방에 없어요.', 'Sách không có trong cặp.']]);
});
test('the other patterns: constructions before single endings; an ending is tagged "đuôi từ"', () => {
  const { overlay } = setup();
  overlay.showCard(model('오늘 어디에 있었어요?', '어디에'), RECT);
  const other = $$(overlay, 'details.lf-gram')[1];
  assert.deepEqual(Array.from(other.querySelectorAll('.lf-pform')).map((e) => e.textContent).sort(), ['-아요/어요', '-았/었- (quá khứ)']);
  assert.ok(Array.from(other.querySelectorAll('.lf-pat')).every((p) => p.querySelector('.lf-tag') && p.querySelector('.lf-tag').textContent === 'đuôi từ'));
  assert.equal(other.querySelector('.lf-pat.focus'), null);
  // a construction (not an ending) is listed first, whatever the order in the sentence
  overlay.showCard(model('비가 와서 집에 있었어요.', '비가'), RECT);
  const o2 = $$(overlay, 'details.lf-gram')[1];
  const tags = Array.from(o2.querySelectorAll('.lf-pat')).map((p) => !!p.querySelector('.lf-tag'));
  assert.equal(tags[0], false, 'N에 있다/없다 (a construction) comes first');
  assert.ok(tags.slice(1).every(Boolean), 'the endings follow');
  assert.equal(text(o2.querySelector('.lf-pform')), 'N에 있다/없다');
});
test('clicking a word that no pattern covers says so, and the sentence patterns are still one fold away', () => {
  const { overlay } = setup();
  overlay.showCard(model('오늘 어디에 있었어요?', '오늘'), RECT);
  const f = folds(overlay);
  assert.equal(foldTitle(f[0]), 'Mẫu ngữ pháp');
  assert.equal(text(f[0].querySelector('.lf-meta')), 'Không có mẫu ngữ pháp riêng nào gắn với từ này.');
  assert.equal(foldTitle(f[1]), 'Các mẫu khác trong câu · 3');
});
test('the structure fold: facts, role of each word (the clicked one marked), the order skeleton and the honesty note', () => {
  const { overlay } = setup();
  overlay.showCard(model('오늘 어디에 있었어요?', '어디에'), RECT);
  const s = $$(overlay, 'details.lf-gram')[2];
  const facts = Array.from(s.querySelectorAll('.lf-facts dt')).map((dt) => [dt.textContent, text(dt.nextElementSibling).replace(/(đuôi này|có dấu|-아요).*$/, '').trim()]);
  assert.deepEqual(facts.map((f) => f[0]), ['Loại câu', 'Mức độ lịch sự', 'Thì / thể', 'Từ để hỏi']);
  assert.equal(facts[0][1], 'Câu hỏi'); assert.match(facts[1][1], /^Lịch sự thân mật \(해요체\)/); assert.match(facts[2][1], /^quá khứ/); assert.equal(facts[3][1], '어디에');
  const rw = Array.from(s.querySelectorAll('.lf-rw')).map((e) => [e.textContent, e.classList.contains('focus')]);
  assert.deepEqual(rw, [['오늘', false], ['어디에', true], ['있었어요', false]]);
  assert.deepEqual(Array.from(s.querySelectorAll('.lf-rr')).map((e) => text(e).split(' — ')[0]), ['Danh từ', 'Địa điểm / thời điểm / đích', 'Vị ngữ']);
  assert.ok(Array.from(s.querySelectorAll('.lf-rr')).every((e) => e.getAttribute('title')), 'each role has a hint');
  assert.deepEqual(Array.from(s.querySelectorAll('.lf-skel .lf-chip')).map((e) => e.textContent), ['Địa điểm / thời điểm / đích', 'Vị ngữ']);
  assert.equal(s.querySelectorAll('.lf-skel .lf-arrow').length, 1);
  assert.match(text(s.querySelector('.lf-sn')), /Phân tích theo quy tắc, không phải bộ phân tích cú pháp đầy đủ/);
  assert.equal(s.querySelector('.lf-clauses'), null, 'one clause: no clause list');
});
test('several clauses are listed with their kind and relation; the clicked word\'s patterns come first', () => {
  const { overlay } = setup();
  overlay.showCard(model('비가 와서 집에 있었어요.', '와서'), RECT);
  assert.match(foldTitle(folds(overlay)[0]), /^Mẫu ngữ pháp · 1$/);
  assert.equal(text($(overlay, 'details.lf-gram .lf-pat.focus .lf-pform')), '-아서/어서');
  const li = $$(overlay, '.lf-clauses li').map((e) => [e.querySelector('.lf-ko').textContent, e.querySelector('small').textContent]);
  assert.deepEqual(li, [['비가 와서', 'Mệnh đề phụ · nguyên nhân / lý do (… nên)'], ['집에 있었어요', 'Mệnh đề chính']]);
});
test('a subtitle of several sentences says which one is analysed', () => {
  const { overlay } = setup();
  const s = '오늘 어디에 있었어요? 사람이 많아요. 저는 한국어를 공부해요.';
  overlay.showCard(model(s, '한국어를'), RECT);
  assert.equal(text($(overlay, 'details.lf-gram .lf-gbody .lf-meta')), 'Câu 3/3 của phụ đề: 저는 한국어를 공부해요.');
  overlay.showCard(model('사람이 많아요.', '사람이'), RECT);
  assert.doesNotMatch(text($(overlay, 'details.lf-gram .lf-gbody')), /Câu \d+\/\d+ của phụ đề/, 'one sentence: no "sentence i/n" line');
});
test('a low-confidence pattern is flagged and explained, never presented as certain', () => {
  const { overlay } = setup();
  overlay.showCard(model('내일 비가 올꺼에요.', '올꺼에요'), RECT);
  const pat = $(overlay, '.lf-pat.focus');
  assert.equal(text(pat.querySelector('.lf-pill')), 'Có thể nhầm');
  assert.ok(pat.querySelector('.lf-pill').className.includes('medium'));
  assert.match(text(pat.querySelector('.lf-pnote')), /viết liền nhiều từ|viết tắt hoặc viết sai chính tả/);
});
test('open / closed state of the grammar folds survives a re-render (save, known …)', () => {
  const { overlay } = setup();
  overlay.showCard(model('오늘 어디에 있었어요?', '어디에'), RECT);
  const f = folds(overlay);
  f[1].open = true; f[2].open = true; f[0].open = false;
  overlay.updateCard({ saved: true });
  assert.deepEqual(folds(overlay).map((d) => d.open), [false, true, true]);
});
test('the grammar switch in the settings hides the whole part; so does a pack without sentence analysis', () => {
  const { overlay } = setup();
  const m = model('오늘 어디에 있었어요?', '어디에');
  overlay.showCard(Object.assign({}, m, { settings: Object.assign({}, m.settings, { grammar: false }) }), RECT);
  assert.equal($$(overlay, 'details.lf-gram').length, 0);
  overlay.showCard(Object.assign({}, m, { grammar: null }), RECT);
  assert.equal($$(overlay, 'details.lf-gram').length, 0);
  overlay.showCard(Object.assign({}, m, { grammar: { text: '', offset: 0, sentenceCount: 1, sentenceIndex: 0, facts: [], patterns: [], words: [], clauses: [], structure: [] } }), RECT);
  assert.equal($$(overlay, 'details.lf-gram').length, 0, 'an empty analysis shows nothing');
  assert.ok($(overlay, '.lf-card'), 'the rest of the card is still there');
});
test('grammar text comes from subtitles and a pack: it is rendered as text, never as HTML', () => {
  const { overlay } = setup();
  const m = model('오늘 어디에 있었어요?', '어디에');
  const evil = '<img src=x onerror=alert(1)>';
  m.grammar.patterns[0].title = evil; m.grammar.patterns[0].meaning = '<b>x</b>'; m.grammar.patterns[0].note = '<script>1</script>'; m.grammar.patterns[0].text = evil;
  m.grammar.patterns[0].examples = [{ text: evil, translation: '<i>y</i>' }];
  m.grammar.facts[0].value = evil; m.grammar.words[0].gloss = evil; m.grammar.clauses[0].text = evil;
  overlay.showCard(m, RECT);
  assert.equal(overlay.shadow.querySelectorAll('img, script, b, i').length, 0);
  assert.equal(text($(overlay, '.lf-pform')), evil);
});
test('an English interface gets English card text for the same analysis', () => {
  const dom = D.makeDom();
  const overlay = new LF.LearningOverlay({ document: dom.window.document, window: dom.window, t: LF.i18n.create('en').t });
  overlay.showCard(model('오늘 어디에 있었어요?', '어디에'), RECT);
  assert.deepEqual(folds(overlay).map(foldTitle), ['Grammar patterns · 1', 'Other patterns in the sentence · 2', 'Sentence structure']);
  assert.equal(text($(overlay, '.lf-pdet summary')), 'Explanation & examples');
});
