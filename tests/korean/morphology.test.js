'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { koreanPack } = require('../helpers/load.js');

let pack;
test.before(async () => { pack = await koreanPack(); });
const texts = (a) => a.display.map((l) => l.text);

// ---- the five sentences from the product brief ------------------------------------------------------------------
test('「오늘 어디에 있었어요?」 is analysed word by word', () => {
  const t = pack.tokenize('오늘 어디에 있었어요?').filter((x) => pack.isClickable(x)).map((x) => x.text);
  assert.deepEqual(t, ['오늘', '어디에', '있었어요']);
  assert.equal(pack.analyzeWord('오늘').summary, 'hôm nay');
  const a = pack.analyzeWord('어디에');
  assert.equal(a.type, 'nominal'); assert.equal(a.lemma, '어디'); assert.equal(a.confidenceLabel, 'high');
  assert.deepEqual(texts(a), ['어디', '-에']);
  assert.equal(a.display[0].gloss, 'đâu'); assert.match(a.display[1].gloss, /ở \/ tại/);
  assert.equal(a.summary, 'ở đâu');
  const b = pack.analyzeWord('있었어요');
  assert.equal(b.lemma, '있다'); assert.deepEqual(texts(b), ['있다', '있었-', '-어요']); assert.match(b.summary, /^đã ở \/ có/);
});
test('「사람이 많아요.」', () => {
  const a = pack.analyzeWord('사람이');
  assert.deepEqual(texts(a), ['사람', '-이']); assert.equal(a.display[1].gloss, 'trợ từ chủ ngữ'); assert.equal(a.summary, 'người (chủ ngữ)');
  const b = pack.analyzeWord('많아요');
  assert.equal(b.lemma, '많다'); assert.equal(b.type, 'predicate'); assert.equal(b.confidenceLabel, 'high');
});
test('「저는 한국어를 공부해요.」', () => {
  assert.equal(pack.analyzeWord('저는').summary, 'tôi (chủ đề)');
  const a = pack.analyzeWord('한국어를');
  assert.deepEqual(texts(a), ['한국어', '-를']); assert.equal(a.display[1].gloss, 'trợ từ tân ngữ'); assert.equal(a.summary, 'tiếng Hàn (tân ngữ)');
  const b = pack.analyzeWord('공부해요');
  assert.equal(b.lemma, '공부하다'); assert.match(b.summary, /^học/);
});
test('「왜 이렇게 늦었어요?」', () => {
  assert.equal(pack.analyzeWord('왜').type, 'word');
  assert.equal(pack.analyzeWord('이렇게').summary, 'như thế này');
  const a = pack.analyzeWord('늦었어요');
  assert.equal(a.lemma, '늦다'); assert.deepEqual(texts(a), ['늦다', '늦었-', '-어요']);
});
test('「그 사람을 찾고 있어요.」', () => {
  assert.equal(pack.analyzeWord('사람을').summary, 'người (tân ngữ)');
  const a = pack.analyzeWord('찾고');
  assert.equal(a.lemma, '찾다'); assert.deepEqual(texts(a), ['찾다', '-고']); assert.equal(a.summary, 'tìm và');
  assert.equal(pack.analyzeWord('있어요').lemma, '있다');
});

// ---- examples written in the brief ---------------------------------------------------------------------------------
test('먹었습니다 → 먹다 / 먹었- / -습니다 (exactly the layout requested)', () => {
  const a = pack.analyzeWord('먹었습니다');
  assert.deepEqual(a.display.map((l) => [l.text, l.kind]), [['먹다', 'lemma'], ['먹었-', 'stem'], ['-습니다', 'ending']]);
  assert.equal(a.display[0].gloss, 'ăn');
  assert.equal(a.display[1].gloss, 'đã ăn');
  assert.match(a.display[2].gloss, /lịch sự, trang trọng/);
  assert.equal(a.summary, 'đã ăn (lịch sự, trang trọng)');
});

// ---- irregular conjugations are found through the dictionary ----------------------------------------------------------
const LEMMA_CASES = [
  ['추워요', '춥다'], ['추운', '춥다'], ['도와요', '돕다'], ['어려워요', '어렵다'], ['들었어요', '듣다'], ['지어요', '짓다'], ['그래요', '그렇다'], ['어때요', '어떻다'],
  ['몰라요', '모르다'], ['불러요', '부르다'], ['달라요', '다르다'], ['아파요', '아프다'], ['예뻐요', '예쁘다'], ['써요', '쓰다'], ['커요', '크다'], ['바빠요', '바쁘다'],
  ['갔어요', '가다'], ['왔어요', '오다'], ['봤어요', '보다'], ['줬어요', '주다'], ['했어요', '하다'], ['돼요', '되다'], ['됩니다', '되다'], ['마셨어요', '마시다'],
  ['아세요', '알다'], ['삽니다', '살다'], ['만드는', '만들다'], ['먼', '멀다'], ['계세요', '계시다'], ['드셨어요', '드시다'], ['아니에요', '아니다'], ['아닙니다', '아니다'],
  ['갑니다', '가다'], ['합니다', '하다'], ['감사합니다', '감사하다'], ['죽었어요', '죽다'], ['싫어요', '싫다'], ['좋은', '좋다'], ['많은', '많다'], ['없는', '없다'], ['맛있는', '맛있다'],
  ['가셨어요', '가다'], ['가시겠어요', '가다'], ['먹을까요', '먹다'], ['먹을게요', '먹다'], ['먹으면', '먹다'], ['먹으니까', '먹다'], ['먹지만', '먹다'], ['먹어서', '먹다'], ['먹는데', '먹다'],
  ['도망쳐', '도망치다'], ['숨어요', '숨다'], ['앉으세요', '앉다'], ['들어가요', '들어가다'], ['일어나요', '일어나다'],
];
test('Dictionary-backed predicate readings: ' + LEMMA_CASES.length + ' inflected forms map to the right lemma', () => {
  const bad = [];
  for (const [form, lemma] of LEMMA_CASES) {
    const a = pack.analyzeWord(form);
    const ok = a.lemma === lemma || (a.alternatives || []).some((x) => x.lemma === lemma);
    if (!ok) bad.push(`${form}: got ${a.lemma} (${a.type}), expected ${lemma}`);
    else if (a.lemma !== lemma && !a.warnings.includes('ambiguous') && a.type !== 'word') bad.push(`${form}: lemma only in alternatives but not flagged ambiguous`);
  }
  assert.deepEqual(bad, []);
});

test('Genuinely ambiguous forms are flagged instead of presented as certain', () => {
  for (const w of ['사는', '걸어요']) {
    const a = pack.analyzeWord(w);
    assert.ok(a.warnings.includes('ambiguous'), w + ' should be flagged ambiguous');
    assert.ok(a.confidence <= 0.75, w);
    assert.ok(a.alternatives.length >= 1, w);
  }
});

// ---- noun + particle chains, copula, contractions, compounds --------------------------------------------------------
test('Homophone readings stay visible as alternatives (들어요: 듣다 vs 들다)', () => {
  const a = pack.analyzeWord('들어요');
  assert.ok([a.lemma].concat(a.alternatives.map((x) => x.lemma)).includes('들다') && [a.lemma].concat(a.alternatives.map((x) => x.lemma)).includes('듣다'));
});
test('Particle chains and contractions', () => {
  const S = (w) => pack.analyzeWord(w).summary;
  assert.equal(S('집에서는'), 'ở nhà (chủ đề)'); assert.equal(S('학교까지'), 'đến trường học'); assert.equal(S('한국에서만'), 'chỉ ở Hàn Quốc');
  assert.equal(S('사람들이'), 'người (số nhiều, chủ ngữ)'); assert.equal(S('저한테'), 'cho tôi'); assert.equal(S('너의'), 'của bạn');
  const c = pack.analyzeWord('제가');
  assert.equal(c.lemma, '저'); assert.deepEqual(texts(c), ['제가', '저', '-가']); assert.match(c.display[0].note, /rút gọn/);
  assert.equal(pack.analyzeWord('이게').summary, 'cái này (chủ ngữ)');
});
test('Copula (이다) after consonant / vowel nouns', () => {
  assert.equal(pack.analyzeWord('학생이에요').summary, 'là học sinh (lịch sự)');
  assert.equal(pack.analyzeWord('의사예요').summary, 'là bác sĩ (lịch sự)');
  assert.equal(pack.analyzeWord('뭐예요').summary, 'là cái gì (lịch sự)');
  assert.equal(pack.analyzeWord('괴물이다').type, 'copula');
});
test('Verb + auxiliary inside one word (도와주세요 style) and fixed phrases', () => {
  const a = pack.analyzeWord('먹어봐요');
  assert.equal(a.type, 'compound'); assert.equal(a.lemma, '먹다'); assert.match(a.summary, /^thử ăn/);
  assert.equal(pack.analyzeWord('가고싶어요').summary, 'muốn đi (lịch sự)');
  const p = pack.analyzeWord('도와주세요');
  assert.equal(p.summary, 'xin hãy giúp tôi'); assert.ok(p.display.length > 1, 'phrase keeps its grammar breakdown');
});
test('Trailing particles on predicate forms: 먹지는, 가기를', () => {
  assert.equal(pack.analyzeWord('먹지는').lemma, '먹다');
  assert.equal(pack.analyzeWord('가기를').summary, 'việc đi (tân ngữ)');
});

// ---- honesty about uncertainty ---------------------------------------------------------------------------------------
test('Unknown stems are reported as guesses with low confidence — never as certain', () => {
  const a = pack.analyzeWord('코끼리가');
  assert.equal(a.known, false); assert.equal(a.confidenceLabel, 'low'); assert.ok(a.confidence < 0.55);
  assert.ok(a.warnings.includes('stem-not-in-dictionary')); assert.equal(a.summary, '');
  assert.match(a.display[0].gloss, /chưa có trong từ điển/);
  const g = pack.analyzeWord('값쯧');
  assert.equal(g.type, 'unknown'); assert.equal(g.confidenceLabel, 'low'); assert.ok(g.warnings.includes('not-in-dictionary'));
  // an unknown verb with strong grammar evidence: grammar is explained, meaning is not invented
  const v = pack.analyzeWord('휘갈겼습니다');
  assert.equal(v.known, false); assert.ok(v.confidence <= 0.5); assert.equal(v.summary, '');
  assert.ok(v.display.some((l) => l.kind === 'ending'));
});
test('Nouns that merely look like particle-final words stay whole when the dictionary knows them', () => {
  for (const w of ['나이', '아이', '어머니', '여기', '사이', '고양이', '자기']) assert.equal(pack.analyzeWord(w).type, 'word', w);
});

// ---- interface contract ------------------------------------------------------------------------------------------------
test('LanguagePack interface: id/name/nativeName/lookup/pronunciation/wordForm/baseForm', async () => {
  assert.equal(pack.getId(), 'ko'); assert.equal(pack.getName(), 'Korean'); assert.equal(pack.getNativeName(), '한국어'); assert.equal(pack.getSpeechLang(), 'ko-KR');
  const l = await pack.lookup('어디에');
  assert.equal(l.lemma, '어디'); assert.deepEqual(l.meanings, ['đâu', 'ở đâu']); assert.equal(l.pronunciation, 'eodi'); assert.ok(l.confidence > 0.9);
  assert.deepEqual(Object.keys(l).sort(), ['analysis', 'confidence', 'examples', 'lemma', 'meanings', 'pos', 'pronunciation', 'word']);
  const p = pack.getPronunciation('먹었습니다');
  assert.deepEqual({ lang: p.lang, spoken: p.spoken, rom: p.romanization }, { lang: 'ko-KR', spoken: '머걷씀니다', rom: 'meogeotseumnida' });
  assert.equal(pack.getBaseForm('먹었습니다'), '먹다');
  const wf = pack.getWordForm('가셨어요');
  assert.equal(wf.kind, 'predicate'); assert.match(wf.label, /kính ngữ \+ quá khứ/);
  assert.equal(pack.getWordForm('추워요').irregular, 'ㅂ');
  assert.ok(pack.detect('오늘 어디에 있었어요?') > 0.9); assert.equal(pack.detect('Hôm nay bạn đã ở đâu?'), 0); assert.ok(pack.detect('OK 좋아요') > 0.5);
  assert.deepEqual(pack.getExtraForms('먹다').map((x) => x.form).slice(0, 2), ['먹어요', '먹었어요']);
});
test('Analysis is fast enough for click-time use', () => {
  const words = ['먹었습니다', '어디에', '도와주세요', '그렇습니다', '만들어요', '아니에요', '가시겠어요', '코끼리가', '알겠습니다', '이상해요'];
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 20; i++) for (const w of words) pack.morphology._cache.clear(), pack.analyzeWord(w);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / (20 * words.length);
  assert.ok(ms < 25, 'average analysis took ' + ms.toFixed(1) + ' ms');
});
