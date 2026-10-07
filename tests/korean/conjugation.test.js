'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAll } = require('../helpers/load.js');
const LF = loadAll();
const { Conjugation: Cj, Endings: En, Romanization: R } = LF.Korean;

const spec = (id) => En.ENDINGS.find((e) => e.id === id);
function forms(lemma, pos, combo, id) {
  const stem = lemma.slice(0, -1);
  return Array.from(Cj.conjugate({ text: stem, irr: Cj.defaultIrr(stem, pos), pos }, combo, spec(id)));
}
const Y = '-아요/어요', B = '-ㅂ니다/습니다';
// [lemma, pos, prefinal combo, ending id, expected surface]
const CASES = [
  ['먹다', 'v', [], Y, '먹어요'], ['먹다', 'v', ['P'], Y, '먹었어요'], ['먹다', 'v', ['P'], B, '먹었습니다'], ['먹다', 'v', [], '-(으)면', '먹으면'], ['먹다', 'v', [], '-(으)ㄴ', '먹은'], ['먹다', 'v', [], '-는', '먹는'], ['먹다', 'v', [], '-(으)ㄹ', '먹을'], ['먹다', 'v', [], '-(으)세요', '먹으세요'], ['먹다', 'v', [], '-ㄴ다/는다', '먹는다'],
  ['가다', 'v', [], Y, '가요'], ['가다', 'v', ['P'], Y, '갔어요'], ['가다', 'v', [], B, '갑니다'], ['가다', 'v', [], '-(으)ㄴ', '간'], ['가다', 'v', [], '-(으)ㄹ', '갈'], ['가다', 'v', [], '-(으)세요', '가세요'], ['가다', 'v', ['H', 'P'], Y, '가셨어요'], ['가다', 'v', ['H'], B, '갑니다'.replace('갑', '가십')], ['가다', 'v', ['F'], B, '가겠습니다'], ['가다', 'v', ['H', 'F'], Y, '가시겠어요'], ['가다', 'v', [], '-ㄴ다/는다', '간다'],
  ['오다', 'v', [], Y, '와요'], ['오다', 'v', ['P'], Y, '왔어요'], ['보다', 'v', [], Y, '봐요'], ['보다', 'v', ['P'], Y, '봤어요'], ['주다', 'v', [], Y, '줘요'], ['주다', 'v', ['P'], Y, '줬어요'],
  ['하다', 'v', [], Y, '해요'], ['하다', 'v', ['P'], Y, '했어요'], ['하다', 'v', [], B, '합니다'], ['하다', 'v', [], '-(으)면', '하면'], ['하다', 'v', [], '-(으)세요', '하세요'], ['공부하다', 'v', [], Y, '공부해요'],
  ['되다', 'v', [], Y, '돼요'], ['되다', 'v', ['P'], Y, '됐어요'], ['마시다', 'v', ['P'], Y, '마셨어요'], ['기다리다', 'v', [], Y, '기다려요'], ['기다리다', 'v', ['P'], Y, '기다렸어요'],
  // ㅡ-drop
  ['쓰다', 'v', [], Y, '써요'], ['쓰다', 'v', ['P'], Y, '썼어요'], ['크다', 'adj', [], Y, '커요'], ['크다', 'adj', [], '-(으)ㄴ', '큰'], ['예쁘다', 'adj', [], Y, '예뻐요'], ['아프다', 'adj', ['P'], Y, '아팠어요'], ['바쁘다', 'adj', [], Y, '바빠요'], ['슬프다', 'adj', [], Y, '슬퍼요'], ['따르다', 'v', [], Y, '따라요'],
  // ㅂ-irregular (and regular ㅂ)
  ['춥다', 'adj', [], Y, '추워요'], ['춥다', 'adj', ['P'], Y, '추웠어요'], ['춥다', 'adj', [], B, '춥습니다'], ['춥다', 'adj', [], '-(으)면', '추우면'], ['춥다', 'adj', [], '-(으)ㄴ', '추운'], ['춥다', 'adj', [], '-(으)니까', '추우니까'],
  ['돕다', 'v', [], Y, '도와요'], ['돕다', 'v', ['P'], Y, '도왔어요'], ['어렵다', 'adj', [], Y, '어려워요'], ['쉽다', 'adj', [], Y, '쉬워요'], ['입다', 'v', [], Y, '입어요'], ['입다', 'v', [], '-(으)면', '입으면'], ['잡다', 'v', ['P'], Y, '잡았어요'],
  // ㄷ / ㅅ irregular and their regular lookalikes
  ['듣다', 'v', [], Y, '들어요'], ['듣다', 'v', ['P'], Y, '들었어요'], ['듣다', 'v', [], B, '듣습니다'], ['듣다', 'v', [], '-(으)면', '들으면'], ['듣다', 'v', [], '-(으)ㄴ', '들은'], ['듣다', 'v', [], '-는', '듣는'], ['걷다', 'v', [], Y, '걸어요'], ['받다', 'v', [], Y, '받아요'], ['받다', 'v', [], '-(으)면', '받으면'],
  ['짓다', 'v', [], Y, '지어요'], ['짓다', 'v', [], '-(으)면', '지으면'], ['낫다', 'v', [], Y, '나아요'], ['웃다', 'v', [], Y, '웃어요'], ['웃다', 'v', [], '-(으)면', '웃으면'],
  // ㅎ-irregular (adjectives) vs regular 좋다
  ['그렇다', 'adj', [], Y, '그래요'], ['그렇다', 'adj', ['P'], Y, '그랬어요'], ['그렇다', 'adj', [], B, '그렇습니다'], ['그렇다', 'adj', [], '-(으)면', '그러면'], ['그렇다', 'adj', [], '-(으)ㄴ', '그런'], ['그렇다', 'adj', [], '-게', '그렇게'], ['어떻다', 'adj', [], Y, '어때요'], ['어떻다', 'adj', [], '-(으)ㄴ', '어떤'], ['파랗다', 'adj', [], Y, '파래요'], ['하얗다', 'adj', [], Y, '하얘요'],
  ['좋다', 'adj', [], Y, '좋아요'], ['좋다', 'adj', ['P'], Y, '좋았어요'], ['좋다', 'adj', [], '-(으)ㄴ', '좋은'], ['많다', 'adj', [], Y, '많아요'], ['싫다', 'adj', [], Y, '싫어요'], ['괜찮다', 'adj', [], Y, '괜찮아요'],
  // 르-irregular
  ['모르다', 'v', [], Y, '몰라요'], ['모르다', 'v', ['P'], Y, '몰랐어요'], ['모르다', 'v', [], B, '모릅니다'], ['모르다', 'v', [], '-는', '모르는'], ['부르다', 'v', [], Y, '불러요'], ['다르다', 'adj', [], Y, '달라요'],
  // ㄹ-final: ㄹ drops before ㄴ ㅂ ㅅ
  ['살다', 'v', [], Y, '살아요'], ['살다', 'v', [], B, '삽니다'], ['살다', 'v', [], '-(으)면', '살면'], ['살다', 'v', [], '-(으)ㄴ', '산'], ['살다', 'v', [], '-는', '사는'], ['살다', 'v', [], '-(으)세요', '사세요'], ['살다', 'v', [], '-(으)니까', '사니까'], ['살다', 'v', [], '-(으)ㄹ까요', '살까요'],
  ['알다', 'v', [], '-는', '아는'], ['알다', 'v', [], '-(으)세요', '아세요'], ['알다', 'v', [], B, '압니다'], ['만들다', 'v', [], B, '만듭니다'], ['만들다', 'v', [], '-는', '만드는'], ['만들다', 'v', [], '-(으)ㄴ', '만든'], ['멀다', 'adj', [], '-(으)ㄴ', '먼'],
  // 있다 / 없다 / honorific verbs / 아니다
  ['있다', 'v', ['P'], Y, '있었어요'], ['있다', 'v', [], '-는', '있는'], ['없다', 'adj', [], '-는', '없는'], ['없다', 'adj', ['P'], Y, '없었어요'], ['맛있다', 'adj', [], '-는', '맛있는'],
  ['계시다', 'v', [], '-(으)세요', '계세요'], ['계시다', 'v', ['P'], Y, '계셨어요'], ['드시다', 'v', [], '-(으)세요', '드세요'], ['드시다', 'v', [], B, '드십니다'],
  ['아니다', 'adj', [], Y, '아니에요'], ['아니다', 'adj', ['P'], Y, '아니었어요'], ['아니다', 'adj', [], B, '아닙니다'], ['아니다', 'adj', [], '-(으)ㄴ', '아닌'], ['아니다', 'adj', [], '-(으)면', '아니면'],
];
test('Conjugation engine reproduces ' + CASES.length + ' known forms (regular and irregular)', () => {
  const bad = [];
  for (const [lemma, pos, combo, id, expected] of CASES) {
    const got = forms(lemma, pos, combo, id);
    if (!got.includes(expected)) bad.push(`${lemma} ${combo.join('+')} ${id}: expected ${expected}, got ${JSON.stringify(got)}`);
  }
  assert.deepEqual(bad, []);
});

test('Irregular class defaults: regular lookalikes are NOT treated as irregular', () => {
  for (const s of ['입', '잡', '좁', '씹', '받', '닫', '믿', '웃', '씻', '벗', '좋']) assert.equal(Cj.defaultIrr(s, s === '좋' ? 'adj' : 'v'), null, s);
  assert.equal(Cj.defaultIrr('춥', 'adj'), 'ㅂ'); assert.equal(Cj.defaultIrr('듣', 'v'), 'ㄷ'); assert.equal(Cj.defaultIrr('짓', 'v'), 'ㅅ');
  assert.equal(Cj.defaultIrr('그렇', 'adj'), 'ㅎ'); assert.equal(Cj.defaultIrr('모르', 'v'), '르'); assert.equal(Cj.defaultIrr('따르', 'v'), null);
});

test('Pre-final chains: honorific + past + future compose in order', () => {
  assert.ok(forms('가다', 'v', ['H', 'P', 'F'], Y).includes('가셨겠어요'));
  assert.ok(forms('먹다', 'v', ['P', 'P'], Y).includes('먹었었어요'));
});

test('Pronunciation: sound rules and Revised Romanization', () => {
  const T = [['먹었습니다', '머걷씀니다', 'meogeotseumnida'], ['있었어요', '이써써요', 'isseosseoyo'], ['한국어', '한구거', 'hangugeo'], ['어디에', '어디에', 'eodie'], ['사람이', '사라미', 'sarami'], ['많아요', '마나요', 'manayo'],
    ['이렇게', '이러케', 'ireoke'], ['늦었어요', '느저써요', 'neujeosseoyo'], ['찾고', '찯꼬', 'chatgo'], ['좋아요', '조아요', 'joayo'], ['같이', '가치', 'gachi'], ['독립', '동닙', 'dongnip'], ['신라', '실라', 'silla'],
    ['괜찮아요', '괜차나요', 'gwaenchanayo'], ['입학', '이팍', 'ipak'], ['축하', '추카', 'chuka'], ['좋다', '조타', 'jota'], ['읽어요', '일거요', 'ilgeoyo'], ['값이', '갑씨', 'gapsi'], ['꽃이', '꼬치', 'kkochi'],
    ['학교', '학꾜', 'hakgyo'], ['국물', '궁물', 'gungmul'], ['놓는', '논는', 'nonneun'], ['많고', '만코', 'manko'], ['싫어요', '시러요', 'sireoyo'], ['감사합니다', '감사함니다', 'gamsahamnida']];
  const bad = [];
  for (const [w, p, r] of T) { if (R.pronounce(w) !== p || R.romanize(w) !== r) bad.push(`${w}: ${R.pronounce(w)} / ${R.romanize(w)} (expected ${p} / ${r})`); }
  assert.deepEqual(bad, []);
  assert.equal(R.pronounce('앉다', { stemEnd: 0 }), '안따'); // stem ㄴ/ㅁ + ending: tensification needs the morphology hint
});
