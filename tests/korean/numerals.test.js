'use strict';
/* Korean numbers written as one word are computed, not listed (src/languages/korean/numerals.js). These tests pin the parser, the
 * dictionary-shaped entry it produces, and how the morphology uses it (a number + particle, a number + counter written together). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { koreanPack } = require('../helpers/load.js');

let pack, N;
test.before(async () => { pack = await koreanPack(); N = globalThis.LinguaFlow.Korean.Numerals; });

const SINO = [['영', 0], ['일', 1], ['십', 10], ['십일', 11], ['이십', 20], ['삼십오', 35], ['구십구', 99], ['백', 100], ['백이십삼', 123], ['오천', 5000], ['만', 10000], ['삼만오천', 35000],
  ['이천이십사', 2024], ['백만', 1000000], ['일억', 100000000]];
const NATIVE = [['하나', 1], ['한', 1], ['둘', 2], ['두', 2], ['셋', 3], ['세', 3], ['넷', 4], ['네', 4], ['다섯', 5], ['일곱', 7], ['아홉', 9], ['열', 10], ['열한', 11], ['열두', 12], ['스무', 20], ['스물', 20],
  ['스물세', 23], ['서른', 30], ['마흔다섯', 45], ['쉰', 50], ['예순', 60], ['아흔아홉', 99]];

test('parse(): Sino-Korean numbers (영, 일 … 천, 만, 억) give the right value', () => {
  for (const [s, v] of SINO) assert.deepEqual(N.parse(s), { value: v, kind: 'sino' }, s);
});
test('parse(): native Korean numbers (하나, 열두, 스물세, 마흔다섯 …) give the right value', () => {
  for (const [s, v] of NATIVE) assert.deepEqual(N.parse(s), { value: v, kind: 'native' }, s);
});
test('parse(): things that are not one number are rejected (digits side by side, repeated units, other words, non-Hangul)', () => {
  for (const s of ['이삼', '공일공', '십십', '일일', '구구', '일본', '이사', '사이', '오이', '삼 십', '3', 'abc', '', '삼십오분', '스물세살']) assert.equal(N.parse(s), null, JSON.stringify(s));
  assert.equal(N.parse(null), null); assert.equal(N.parse(undefined), null);
});
test('entry(): a dictionary-shaped, clearly synthesized entry with the value and the kind of number', () => {
  const e = N.entry('삼십오', N.parse('삼십오'));
  assert.deepEqual(e, { word: '삼십오', pos: 'num', meanings: ['35 (số Hán Hàn)'], synthesized: true, numeral: { value: 35, kind: 'sino' } });
  assert.equal(N.entry('열두', N.parse('열두')).meanings[0], '12 (số thuần Hàn)');
  assert.equal(N.entry('이천이십사', N.parse('이천이십사')).meanings[0], '2024 (số Hán Hàn)');
  assert.equal(N.entry('만', N.parse('만')).meanings[0], '10,000 (số Hán Hàn)'); // 5 digits and up get a thousands separator
});

test('a number written as one word is a known word: 삼십오, 열두, 이천이십사', () => {
  for (const [w, s] of [['삼십오', '35'], ['열두', '12'], ['이천이십사', '2024'], ['백이십삼', '123']]) {
    const a = pack.analyzeWord(w);
    assert.equal(a.type, 'word', w); assert.equal(a.known, true, w); assert.equal(a.confidenceLabel, 'high', w); assert.equal(a.summary, s, w);
  }
});
test('a number + particle is a known noun chain, not an unknown stem: 삼십오를, 열두가, 스물세는', () => {
  for (const [w, lemma, summary] of [['삼십오를', '삼십오', '35 (tân ngữ)'], ['삼십오가', '삼십오', '35 (chủ ngữ)'], ['삼십오는', '삼십오', '35 (chủ đề)'], ['열두를', '열두', '12 (tân ngữ)'], ['스물세를', '스물세', '23 (tân ngữ)'], ['이천이십사를', '이천이십사', '2024 (tân ngữ)']]) {
    const a = pack.analyzeWord(w);
    assert.equal(a.type, 'nominal', w); assert.equal(a.lemma, lemma, w); assert.equal(a.confidenceLabel, 'high', w); assert.equal(a.summary, summary, w);
    assert.ok(!a.warnings.includes('stem-not-in-dictionary'), w);
  }
});
test('a unit + 이 reads as the particle, not as "…02" (만이 = 만 + 이, never 10,002)', () => {
  for (const w of ['만이', '백이', '천이']) {
    const a = pack.analyzeWord(w);
    assert.equal(a.type, 'nominal', w); assert.ok(a.display.some((l) => l.text === '-이'), w);
  }
  assert.equal(pack.analyzeWord('십이').summary, '12'); assert.equal(pack.analyzeWord('이십이').summary, '22'); // …but 십이 / 이십이 are plainly numbers
});

test('number + counter written together: known when the counter is on the generated list, segmented (and flagged) otherwise', () => {
  const known = { 두명: 'hai người', 세잔: 'ba ly', 네시간: 'bốn tiếng', 한개: 'một cái' };
  for (const [w, s] of Object.entries(known)) { const a = pack.analyzeWord(w); assert.equal(a.type, 'word', w); assert.equal(a.summary, s, w); }
  const seg = [['열두시', '열두 + 시', '12 + giờ'], ['삼십오분', '삼십오 + 분', '35 + phút'], ['스물세살', '스물세 + 살', '23 + tuổi'], ['일곱명', '일곱 + 명', 'bảy + người'],
    ['오분전', '오 + 분 + 전', 'năm + phút + trước'], ['이주전', '이 + 주 + 전', 'hai + tuần + trước']];
  for (const [w, pieces, summary] of seg) {
    const a = pack.analyzeWord(w);
    assert.equal(a.type, 'segmented', w); assert.equal(a.confidenceLabel, 'medium', w); assert.ok(a.warnings.includes('segmented'), w);
    assert.equal(a.display[0].text, pieces, w); assert.equal(a.summary, summary, w);
  }
});
test('number + unit + "before / after / for / within" and ages: 삼일후에, 이년전에, 십분뒤에, 삼년만에, 서른두살', () => {
  const rows = [['삼일후에', '삼 + 일 + 후에'], ['이년전에', '이 + 년 + 전에'], ['십분뒤에', '십 + 분 + 뒤에'], ['오분안에', '오 + 분 + 안에'], ['삼년만에', '삼 + 년 + 만에'],
    ['칠일만에', '칠 + 일 + 만에'], ['삼일동안', '삼 + 일 + 동안'], ['서른두살', '서른두 + 살'], ['스물한살', '스물한 + 살'], ['열세살', '열세 + 살'], ['삼일', '삼 + 일']];
  const bad = [];
  for (const [w, pieces] of rows) {
    const a = pack.analyzeWord(w);
    if (a.type !== 'segmented' || a.display[0].text !== pieces || a.confidenceLabel !== 'medium') bad.push(`${w}: ${a.type}/${a.confidenceLabel}/${a.display[0].text} (expected ${pieces})`);
  }
  assert.deepEqual(bad, []);
  assert.match(pack.analyzeWord('삼년만에').summary, /sau \(một khoảng thời gian\)/); // 만에 = "after (a period)", not "ten thousand"
  assert.equal(pack.analyzeWord('안에').summary, 'ở bên trong');
  assert.match(pack.analyzeWord('오분안에').summary, /ở bên trong$/);
});
test('삼일 / 이일 are "3 / 2 days", never the copula "will be three"', () => {
  for (const w of ['삼일', '이일', '칠일']) {
    const a = pack.analyzeWord(w);
    assert.notEqual(a.type, 'copula', w); assert.doesNotMatch(a.summary, /sẽ là/, w);
  }
});
