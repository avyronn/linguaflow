'use strict';
/* Regression tests for the colloquial, spaceless and misspelled forms that real subtitles contain.
 * Each table row is a form that an earlier build analysed wrongly (a fake "…다" verb, a numeral read as a counter, a particle read as a
 * verb ending ...) or reported as unknown. The expectation is the analysis type, the lemma and an honest confidence label. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { koreanPack } = require('../helpers/load.js');

let pack;
test.before(async () => { pack = await koreanPack(); });
const A = (w) => pack.analyzeWord(w);

/** rows: [form, type, lemma, confidenceLabel?]  → list of mismatches (empty = all good) */
function mismatches(rows) {
  const bad = [];
  for (const [w, type, lemma, conf] of rows) {
    const a = A(w);
    if (a.type !== type || a.lemma !== lemma || (conf && a.confidenceLabel !== conf)) bad.push(`${w}: got ${a.type}/${a.lemma}/${a.confidenceLabel}, expected ${type}/${lemma}/${conf || '*'}`);
  }
  return bad;
}

test('copula after nouns and question words: 뭐냐면, 누구냐고, 사람이고요 … (never a fake "뭐냐다" verb)', () => {
  assert.deepEqual(mismatches([
    ['뭐냐면', 'copula', '뭐', 'high'], ['뭐냐면요', 'copula', '뭐', 'high'], ['뭐냐니까', 'copula', '뭐', 'high'], ['뭐냐니까요', 'copula', '뭐', 'high'],
    ['뭐냐고요', 'copula', '뭐', 'high'], ['뭐냐는', 'copula', '뭐', 'high'], ['누구냐면', 'copula', '누구', 'high'],
    ['사람이고요', 'copula', '사람', 'high'], ['학생이냐고', 'copula', '학생', 'high'], ['학생이라곤', 'copula', '학생', 'high'],
    ['거고요', 'copula', '거', 'high'],
  ]), []);
  assert.equal(A('뭐냐면').summary, 'nếu hỏi là cái gì thì');
  assert.equal(A('뭐냐니까요').summary, 'đã hỏi là cái gì mà (lịch sự)');
});

test('plural 들 + 이다: 사람들이죠, 사람들입니다 are 사람 + 들 + 이다, not 들다 / 들이다', () => {
  for (const w of ['사람들이죠', '사람들입니다']) {
    const a = A(w);
    assert.equal(a.type, 'copula', w); assert.equal(a.lemma, '사람', w); assert.equal(a.confidenceLabel, 'high', w);
    assert.match(a.summary, /số nhiều/, w);
  }
});

test('verb endings that take a polite -요: 있다면요, 공부하느라고요, 먹으면서요 … are real predicates of the right lemma', () => {
  assert.deepEqual(mismatches([
    ['있다면요', 'predicate', '있다', 'high'], ['않는다면요', 'predicate', '않다', 'high'], ['그렇다면요', 'predicate', '그렇다', 'high'],
    ['공부하느라고요', 'predicate', '공부하다', 'high'], ['먹으면서요', 'predicate', '먹다', 'high'], ['먹거나요', 'predicate', '먹다', 'high'],
    ['먹든지요', 'predicate', '먹다', 'high'], ['먹더니요', 'predicate', '먹다', 'high'],
  ]), []);
});

test('common misspellings are analysed through the corrected spelling and are labelled as misspelled (never silently accepted)', () => {
  assert.deepEqual(mismatches([
    ['말예요', 'misspelled', '말', 'high'], ['책예요', 'misspelled', '책', 'high'], ['댓가', 'misspelled', '대가', 'high'], ['댓가를', 'misspelled', '대가', 'high'],
    ['돼죠', 'misspelled', '되다', 'high'], ['돼네요', 'misspelled', '되다', 'high'], ['몇일', 'misspelled', '며칠', 'high'], ['할께요', 'misspelled', '하다', 'high'],
  ]), []);
  for (const w of ['돼죠', '몇일', '할께요', '말예요']) {
    const a = A(w);
    assert.ok(a.warnings.includes('misspelling'), w);
    assert.equal(a.display[0].kind, 'note', w); assert.match(a.display[0].note, /viết sai chính tả — chính tả đúng: /, w);
  }
  assert.match(A('돼죠').display[0].note, /되죠$/); assert.match(A('말예요').display[0].note, /말이에요$/);
});

test('correct words that merely look like a misspelling are left alone (돼지 = pig, 돼요 / 돼서 = 되다)', () => {
  assert.deepEqual(mismatches([['돼지', 'word', '돼지', 'high'], ['돼지고기', 'word', '돼지고기', 'high'], ['돼지가', 'nominal', '돼지', 'high'], ['돼요', 'predicate', '되다', 'high'], ['돼서', 'predicate', '되다', 'high']]), []);
  for (const w of ['돼지', '돼요', '돼서']) assert.ok(!A(w).warnings.includes('misspelling'), w);
});

test('"don\'t" written together: 가지마 / 하지마 / 먹지마세요 are 가다 + 지 + 말다, not 가지다 + the rare ending -마', () => {
  assert.deepEqual(mismatches([['가지마', 'compound', '가다', 'medium'], ['하지마', 'compound', '하다', 'medium'], ['먹지마', 'compound', '먹다', 'medium'], ['먹지마세요', 'compound', '먹다', 'medium'], ['울지마', 'compound', '울다', 'medium']]), []);
  assert.equal(A('가지마').summary, 'đừng đi (thân mật)');
  // the genuine promise ending and the verb 가지다 are still found where nothing competes
  assert.equal(A('해주마').type, 'compound'); assert.match(A('해주마').summary, /^sẽ làm giúp/);
  assert.equal(A('가지다').lemma, '가지다'); assert.equal(A('가지는').lemma, '가지다');
});

test('verb + auxiliary written as one word: 좋아보여요, 볼만해요, 갈까해요, 도와주고있어요 are analysed as head + auxiliary', () => {
  assert.deepEqual(mismatches([
    ['좋아보여요', 'compound', '좋다', 'medium'], ['피곤해보여요', 'compound', '피곤하다', 'medium'], ['볼만해요', 'compound', '보다', 'medium'], ['갈까해요', 'compound', '가다', 'medium'],
    ['도와주고있어요', 'compound', '도와주다', 'medium'], ['가고싶어요', 'compound', '가다', 'medium'], ['먹어봐요', 'compound', '먹다', 'medium'],
  ]), []);
  assert.equal(A('좋아보여요').summary, 'trông tốt (lịch sự)');
  assert.equal(A('갈까해요').summary, 'đang tính đi (lịch sự)');
});

test('adverbs do not take case particles at high confidence (어서와 = 어서 + 와), with the real exceptions kept', () => {
  const a = A('어서와');
  assert.equal(a.type, 'segmented'); assert.equal(a.lemma, '어서'); assert.equal(a.confidenceLabel, 'medium');
  assert.deepEqual(mismatches([['정말이요', 'nominal', '정말', 'high'], ['만약을', 'nominal', '만약', 'high'], ['잘', 'word', '잘', 'high']]), []);
  assert.notEqual(A('다를').type, 'nominal'); assert.notEqual(A('다하고').type, 'nominal');
});

test('an adverb that is also a noun shows the noun sense once a case particle follows (안에 = inside, 못을 = nail)', () => {
  assert.equal(A('안').summary, 'không'); // alone it is the negation
  assert.equal(A('안에').summary, 'ở bên trong'); assert.equal(A('안으로').summary, 'bên trong (bằng / hướng đến)');
  assert.equal(A('못을').summary, 'đinh (tân ngữ)'); assert.equal(A('진짜가').summary, 'đồ thật (chủ ngữ)');
  assert.equal(A('못해요').lemma, '못하다');
});

test('spoken contractions with a particle: 뭘로, 뭘로는, 누가요, 제가요, 내가요', () => {
  assert.deepEqual(mismatches([['뭘로', 'nominal', '뭐', 'high'], ['뭘로는', 'nominal', '뭐', 'high'], ['누가요', 'nominal', '누구', 'high'], ['제가요', 'nominal', '저', 'high'], ['내가요', 'nominal', '나', 'high'], ['아무에게도', 'nominal', '아무', 'high'], ['아무한테도', 'nominal', '아무', 'high']]), []);
  assert.deepEqual(A('누가요').display.map((l) => l.text), ['누가요', '누구', '-가', '-요']);
  assert.equal(A('뭘로').summary, 'cái gì (bằng / hướng đến)');
});

test('words added in this release are in the dictionary (food, places, society, interjections, endings written together)', () => {
  const WORDS = ['두부', '돼지고기', '떡볶이', '불고기', '놀이공원', '전자레인지', '충전기', '소방관', '헌법', '화이팅', '아이쿠', '야호', '잘가요', '잘자요', '안돼요', '만약', '조용', '조심히', '친애하다', '예쁜이',
    '왔다갔다하다', '같으니라고', '테야', '테죠', '테면', '만에', '겠어요', '겠죠', '잖아', '거든요'];
  const missing = WORDS.filter((w) => !A(w).known || A(w).confidenceLabel !== 'high');
  assert.deepEqual(missing, []);
  assert.equal(A('친애하는').lemma, '친애하다'); assert.equal(A('왔다갔다해요').lemma, '왔다갔다하다');
  assert.ok(pack.morphology.dict.get('내').altSenses.some((s) => s.pos === 'nbound'), '내 as a bound noun ("within")');
  assert.equal(A('내에').summary, 'ở trong');
});

test('spaceless runs are segmented best-effort: always "segmented", never above medium, and every piece is listed', () => {
  const ROWS = [
    ['할수있어요', '할 + 수 + 있어요'], ['먹을수있어요', '먹을 + 수 + 있어요'], ['가본적있어요', '가본 + 적 + 있어요'], ['한번도없어요', '한 + 번도 + 없어요'],
    ['너무좋아요', '너무 + 좋아요'], ['잘지내요', '잘 + 지내요'], ['남자친구를', '남자 + 친구를'], ['잘부탁드립니다', '잘 + 부탁드립니다'], ['만나서반갑습니다', '만나서 + 반갑습니다'],
    ['오늘은안돼요', '오늘은 + 안 + 돼요'],
  ];
  const bad = [];
  for (const [w, pieces] of ROWS) {
    const a = A(w);
    if (a.type !== 'segmented' || a.confidenceLabel !== 'medium' || !a.warnings.includes('segmented') || a.display[0].kind !== 'note' || !a.display[0].text.startsWith(pieces) || a.confidence > 0.65) bad.push(`${w}: ${a.type}/${a.confidenceLabel}/${a.display[0].text}`);
  }
  assert.deepEqual(bad, []);
  assert.match(A('할수있어요').display[0].note, /viết liền không dấu cách/);
});

test('segmentation prefers fewer pieces on a tie and never reads a lone particle as a verb ending', () => {
  // 이리 + 와 beats 이 + 리 + 와; 스물세 + 살 beats 스물 + 세 + 살다-ㄹ; a final 는 is the particle, not the adnominal of 늘다
  assert.equal(A('스물세살').display[0].text, '스물세 + 살');
  assert.equal(A('잘부탁드립니다').display[0].text, '잘 + 부탁드립니다');
  assert.notEqual(A('뭘로는').type, 'segmented');
  assert.notEqual(A('놀는').type, 'segmented');
});

test('the 50 most common spoken ways to say a thing in one word stay known (regression list from frequency scans)', () => {
  const WORDS = ['괜찮아요', '알겠어요', '알았어요', '몰랐어요', '모르겠어요', '그렇군요', '그렇구나', '맞아요', '아니에요', '고마워요', '미안해요', '죄송합니다', '감사합니다', '축하해요', '안녕히계세요',
    '안녕히가세요', '잠깐만요', '잠시만요', '조금만기다려요', '어서와요', '얼른가요', '이따봐요', '내일봐요', '많이먹었어요', '너무좋아요', '정말고마워요', '진짜미안해요', '아주좋아요',
    '천천히해요', '같이가요', '함께해요', '지금가요', '그냥가요', '그냥해요', '아직몰라요', '벌써왔어요', '이미끝났어요', '항상그래요', '가끔와요', '자주와요', '절대안돼요', '꼭해요',
    '왜그래요', '뭐해요', '어디가요', '누구세요', '언제와요', '어떻게해요', '얼마예요', '몇시예요'];
  const unknown = WORDS.filter((w) => !A(w).known || A(w).type === 'unknown');
  assert.deepEqual(unknown, []);
});

test('a rare dictionary word that shares its spelling with a very common verb form does not hide the verb (가요 = đi, not "ca khúc")', () => {
  for (const [w, lemma, summary] of [['가요', '가다', 'đi (lịch sự)'], ['보고', '보다', 'nhìn và'], ['가면', '가다', 'nếu đi'], ['본', '보다', 'đã nhìn (định ngữ)'], ['볼', '보다', 'sẽ nhìn (định ngữ)'],
    ['알', '알다', 'sẽ biết (định ngữ)'], ['온', '오다', 'đã đến (định ngữ)'], ['간', '가다', 'đã đi (định ngữ)']]) {
    const a = A(w);
    assert.equal(a.type, 'predicate', w); assert.equal(a.lemma, lemma, w); assert.equal(a.summary, summary, w); assert.equal(a.confidenceLabel, 'high', w);
    // the dictionary word is still offered as another reading (the sentence analyser may pick it when the sentence needs a noun)
    assert.ok(a.alternatives.some((x) => x.type === 'word' && x.lemma === w), w + ': the noun reading must stay available');
    assert.ok(pack.morphology.readings(w, 4).some((r) => r.type === 'word'), w);
  }
  assert.equal(A('가요').alternatives.find((x) => x.type === 'word').summary, 'ca khúc');
  // …while nouns that are common in their own right keep winning
  for (const w of ['가게', '봄', '감', '산', '살', '일', '해', '한', '가지']) assert.equal(A(w).type, 'word', w);
});

test('in a sentence, 못 가요 / 어디 가요? / 어제 본 영화 are read with the verb (clause, role and confidence)', () => {
  const r = pack.analyzeSentence('오늘은 못 가요.');
  const last = r.words[r.words.length - 1];
  assert.equal(last.lemma, '가다'); assert.equal(last.role, 'pred'); assert.equal(last.confidence, 'high');
  const fact = (res, id) => (res.facts.find((x) => x.id === id) || {}).value;
  assert.equal(fact(r, 'type'), 'Câu trần thuật'); assert.equal(fact(r, 'negation'), 'có');
  const q = pack.analyzeSentence('어디 가요?');
  assert.equal(fact(q, 'type'), 'Câu hỏi'); assert.equal(q.words[1].lemma, '가다'); assert.equal(q.words[1].role, 'pred');
  const m = pack.analyzeSentence('어제 본 영화가 재미있었어요.');
  assert.equal(m.words[1].lemma, '보다'); assert.equal(m.words[1].role, 'adn');
});
