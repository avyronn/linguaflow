'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAll } = require('../helpers/load.js');
const LF = loadAll();
const { Hangul: H, Tokenizer: T } = LF.Korean;

test('Hangul: decompose / compose / final-consonant helpers', () => {
  assert.deepEqual(H.parts('갔'), { c: 'ㄱ', v: 'ㅏ', f: 'ㅆ' });
  assert.equal(H.build('ㅇ', 'ㅓ', 'ㅆ'), '었');
  assert.equal(H.addJong('가', 'ㅂ'), '갑');
  assert.equal(H.addJong('살', 'ㅁ'), '삶');
  assert.equal(H.addJong('살', 'ㄹ'), '살');
  assert.equal(H.addJong('먹', 'ㄴ'), null);
  assert.equal(H.hasBatchim('춥'), true);
  assert.equal(H.hasBatchim('가'), false);
  assert.equal(H.cho('먹'), 'ㅁ');
  assert.equal(H.hasHangul('abc 한'), true);
  assert.equal(H.hasHangul('Tôi học'), false);
});

const SENTENCES = [
  ['오늘 어디에 있었어요?', ['오늘', '어디에', '있었어요']],
  ['사람이 많아요.', ['사람이', '많아요']],
  ['저는 한국어를 공부해요.', ['저는', '한국어를', '공부해요']],
  ['왜 이렇게 늦었어요?', ['왜', '이렇게', '늦었어요']],
  ['그 사람을 찾고 있어요.', ['그', '사람을', '찾고', '있어요']],
];
for (const [text, words] of SENTENCES) {
  test('Tokenizer: ' + text, () => {
    assert.deepEqual(T.words(text).map((t) => t.text), words);
    const toks = T.tokenize(text);
    assert.equal(toks.map((t) => t.text).join(''), text, 'tokens must cover the whole text');
    for (const t of toks) assert.equal(text.slice(t.start, t.end), t.text, 'offsets must refer to the original string');
  });
}

test('Tokenizer: punctuation, quotes, numbers, Latin, jamo and mixed text are separated — not just whitespace', () => {
  const t = T.tokenize('“안녕하세요!” 1945년… OK ㅋㅋ ♪ 괜찮아요?!');
  const kinds = t.filter((x) => x.type !== 'space').map((x) => x.type + ':' + x.text);
  assert.deepEqual(kinds, ['punct:“', 'word:안녕하세요', 'punct:!”', 'number:1945', 'word:년', 'punct:…', 'latin:OK', 'jamo:ㅋㅋ', 'symbol:♪', 'word:괜찮아요', 'punct:?!']);
  assert.deepEqual(T.words('“안녕하세요!” 1945년… OK').map((x) => x.text), ['안녕하세요', '년']);
});

test('Tokenizer: dialogue dashes, brackets, newlines, NBSP and zero-width characters', () => {
  assert.deepEqual(T.words('- 뭐해?\n- 아무것도 안 해.').map((x) => x.text), ['뭐해', '아무것도', '안', '해']);
  assert.deepEqual(T.words('[한숨] (웃음)').map((x) => x.text), ['한숨', '웃음']);
  assert.deepEqual(T.words('사람\u00A0많아\u200B요').map((x) => x.text), ['사람', '많아', '요']);
});

test('Tokenizer: Vietnamese (with combining marks) and empty input never produce clickable tokens', () => {
  assert.deepEqual(T.words('Hôm nay bạn đã ở đâu?'), []);
  assert.deepEqual(T.words('Hôm nay'.normalize('NFD')), []);
  assert.deepEqual(T.tokenize(''), []);
  assert.deepEqual(T.tokenize(null), []);
});
