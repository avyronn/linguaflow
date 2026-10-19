'use strict';
/* The grammar-pattern language (src/languages/korean/patterns.js) is a small program: every feature of it is tested here with tiny
 * one-row catalogues, so that a change to the matcher cannot silently change what the 239 real rows mean.
 * The catalogue itself is tested in grammar-catalogue.test.js. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { koreanPack } = require('../helpers/load.js');

let pack, K;
test.before(async () => { pack = await koreanPack(); K = globalThis.LinguaFlow.Korean; });

/** analyzer(['id', 'pattern', 'flags'?], ...) → (sentence, opts?) => analysis (all patterns, hidden ones flagged) */
function analyzer(...rows) {
  const sa = new K.Sentence.SentenceAnalyzer(pack.morphology, rows.map(([form, match, flags]) => [form, match, 1, 'basic', 'nghĩa của ' + form, '', [['가', '나']], flags || '']));
  return (s, opts) => sa.analyze(s, Object.assign({ all: true }, opts));
}
/** which of `sentences` does the single pattern `match` find? */
function hits(match, sentences, flags) {
  const an = analyzer(['T', match, flags]);
  return sentences.filter((s) => an(s).patterns.some((p) => p.id === 'T'));
}
const texts = (r) => r.patterns.map((p) => p.text);

test('slot classes: V verb · A adjective · P any predicate · N noun · D adverb / determiner / conjunction · * anything', () => {
  assert.deepEqual(hits('V', ['먹어요', '예뻐요', '학교', '빨리']), ['먹어요']);
  assert.deepEqual(hits('A', ['먹어요', '예뻐요', '학교', '빨리']), ['예뻐요']);
  assert.deepEqual(hits('P', ['먹어요', '예뻐요', '학교', '빨리']), ['먹어요', '예뻐요']);
  assert.deepEqual(hits('N', ['먹어요', '학교', '빨리', '저는']), ['학교', '저는']);
  assert.deepEqual(hits('D', ['빨리', '먹어요', '정말', '그러나']), ['빨리', '정말', '그러나']);
  assert.deepEqual(hits('*', ['먹어요', '학교']), ['먹어요', '학교']);
});

test('lemma filters: =a|b keeps, <a|b excludes (the lemma, so every inflection counts)', () => {
  assert.deepEqual(hits('V=먹다', ['먹어요', '마셔요', '먹었어요', '먹고']), ['먹어요', '먹었어요', '먹고']);
  assert.deepEqual(hits('V=먹다|마시다', ['먹어요', '마셔요', '가요']), ['먹어요', '마셔요']);
  assert.deepEqual(hits('V<먹다', ['먹어요', '마셔요']), ['마셔요']);
});

test('ending filters: @-id (exact ending), #kind (final / conn / adn / nom), ^rel (connective relation)', () => {
  assert.deepEqual(hits('V@-고', ['먹고', '먹어서', '먹으면']), ['먹고']);
  assert.deepEqual(hits('V@-고|-아서/어서', ['먹고', '먹어서', '먹으면']), ['먹고', '먹어서']);
  assert.deepEqual(hits('V#fin', ['먹어요', '먹고', '먹는']), ['먹어요']);
  assert.deepEqual(hits('V#conn', ['먹어요', '먹고', '먹는']), ['먹고']);
  assert.deepEqual(hits('V#adn', ['먹는', '먹어요']), ['먹는']);
  assert.deepEqual(hits('V^cause', ['먹어서', '먹으니까', '먹고']), ['먹어서', '먹으니까']);
  assert.deepEqual(hits('V^cond', ['먹으면', '먹어서']), ['먹으면']);
});

test('pre-final markers: %H honorific, %P past, %F future / guess (and they combine)', () => {
  assert.deepEqual(hits('V%P', ['먹었어요', '먹어요']), ['먹었어요']);
  assert.deepEqual(hits('V%H', ['드세요', '먹어요', '가셨어요']), ['드세요', '가셨어요']);
  assert.deepEqual(hits('V%F', ['먹겠어요', '먹어요']), ['먹겠어요']);
  assert.deepEqual(hits('V%HP', ['가셨어요', '가세요', '갔어요']), ['가셨어요']);
});

test('particles after a word: default = none, + lists the allowed ones, ~ light particles, * anything, ! requires one of them', () => {
  const S = ['밥 먹어요', '밥을 먹어요', '밥이 먹어요', '밥은 먹어요', '밥도 먹어요', '집에서 먹어요', '밥에게 먹어요'];
  assert.deepEqual(hits('N V', S), ['밥 먹어요']);
  assert.deepEqual(hits('N+을/를 V', S), ['밥을 먹어요']);
  assert.deepEqual(hits('N+을/를|이/가 V', S), ['밥을 먹어요', '밥이 먹어요']);
  assert.deepEqual(hits('N+~ V', S), ['밥 먹어요', '밥을 먹어요', '밥이 먹어요', '밥은 먹어요', '밥도 먹어요']);
  assert.deepEqual(hits('N+* V', S), S.filter((s) => s !== '밥에게 먹어요').concat(['밥에게 먹어요']).sort((a, b) => S.indexOf(a) - S.indexOf(b)));
  assert.deepEqual(hits('N+에서 V', ['집에서 먹어요', '집에 먹어요']), ['집에서 먹어요']);
  // ! : the word must carry the particle, not merely be allowed to
  assert.deepEqual(hits('N+이/가|은/는!은/는 V', ['저는 먹어요', '제가 먹어요', '저 먹어요']), ['저는 먹어요']);
  // (a bare noun is only accepted when the list contains _ : N+_|이/가|은/는)
  assert.deepEqual(hits('N+이/가|은/는 V', ['저는 먹어요', '제가 먹어요', '저 먹어요']), ['저는 먹어요', '제가 먹어요']);
  assert.deepEqual(hits('N+_|이/가|은/는 V', ['저는 먹어요', '제가 먹어요', '저 먹어요']), ['저는 먹어요', '제가 먹어요', '저 먹어요']);
});

test('the LAST slot of a pattern accepts any particle / ending tail by default', () => {
  assert.deepEqual(hits('P@-고 X=싶다', ['먹고 싶어요', '먹고 싶지 않아요', '먹고 싶었어요']), ['먹고 싶어요', '먹고 싶지 않아요', '먹고 싶었어요']);
  assert.deepEqual(hits('N=학교', ['학교', '학교에', '학교에서는']), ['학교', '학교에', '학교에서는']);
});

test('optional slots (?) and whole-slot alternatives (;)', () => {
  assert.deepEqual(hits('N+을/를 D? V', ['밥을 먹어요', '밥을 빨리 먹어요', '밥을 아주 빨리 먹어요']), ['밥을 먹어요', '밥을 빨리 먹어요']);
  assert.deepEqual(hits('N=학교;N=집 V', ['학교 가요', '집 가요', '회사 가요']), ['학교 가요', '집 가요']);
  assert.deepEqual(hits('N+이/가|은/는 A;V', ['날씨가 좋아요', '비가 와요', '비가 학교']), ['날씨가 좋아요', '비가 와요']);
});

test('multiple variants of one construction: an array of match strings; the construction is reported once per place', () => {
  const an = analyzer(['V-고 싶다', ['P@-고 X=싶다', 'P@-고 N=싶다']]);
  const r = an('먹고 싶어요.');
  assert.deepEqual(r.patterns.map((p) => p.id), ['V-고 싶다']);
});

test('gaps: .. skips 0-4 units of the same clause, ..N at most N; never across a comma; never over a sentence ending', () => {
  const S = ['별로 좋지 않아요', '별로 그 사람이 좋지 않아요', '별로 좋아요', '별로, 좋지 않아요'];
  assert.deepEqual(hits('D=별로 .. P=않다', S), ['별로 좋지 않아요', '별로 그 사람이 좋지 않아요']);
  assert.deepEqual(hits('D=별로 ..1 P=않다', S), ['별로 좋지 않아요']);
  assert.deepEqual(hits('D=별로 ..0 P=않다', ['별로 좋지 않아요', '별로 그 사람이 좋지 않아요']), []); // ..0 = no skipped unit: 좋지 sits between
  // a finished clause (…요 / …다) is a hard wall for a gap
  assert.deepEqual(hits('D=별로 .. P=않다', ['별로 좋아요 그리고 안 먹지 않아요']), []);
});

test('$ : the word must close its clause (a plain -아/어 ending, not a linking -아/어)', () => {
  assert.deepEqual(hits('V@-아/어$', ['밥 먹어.', '먹어 봤어요.', '먹어, 봤어요.']), ['밥 먹어.', '먹어, 봤어요.']);
  assert.deepEqual(hits('V@-아/어', ['밥 먹어.', '먹어 봤어요.']), ['밥 먹어.', '먹어 봤어요.']);
});

test('copula (N+이다) with &form: the copula must have that exact form', () => {
  assert.deepEqual(hits('N+이다&이라고 P=하다', ['학생이라고 했어요', '학생이라서 했어요']), ['학생이라고 했어요']);
  assert.deepEqual(hits('N+이다', ['학생이에요', '학생이라고', '학생']), ['학생이에요', '학생이라고']);
});

test('거 / 걸 are one lemma, 것 (so a pattern written with 것 also finds 거예요)', () => {
  assert.deepEqual(hits('P@-(으)ㄹ N=것+이다', ['먹을 거예요', '먹을 것이에요', '먹을 걸요']), ['먹을 거예요', '먹을 것이에요']);
  assert.deepEqual(hits('N=것', ['이것', '거', '건']), ['거', '건']); // 건 = 것 + 은, 이것 is a different word
});

test('the same construction is found however the learner\'s subtitle writes it: spaced, spaceless, or inside one dictionary word', () => {
  const an = analyzer(['V-고 싶다', 'V@-고 X=싶다'], ['V-고 있다', 'V@-고 P=있다'], ['V-지 못하다', 'V@-지 P=못하다']);
  const ids = (s) => an(s).patterns.map((p) => p.id).sort();
  assert.deepEqual(ids('먹고 싶어요.'), ['V-고 싶다']);
  assert.deepEqual(ids('먹고싶어요.'), ['V-고 싶다']);
  assert.deepEqual(ids('가보고 싶어요.'), ['V-고 싶다']);      // 가보다 = 가다 + 보다 written together
  assert.deepEqual(ids('도와주고 있어요.'), ['V-고 있다']);    // 도와주다 is one dictionary word, really 돕다 + -아/어 + 주다
  assert.deepEqual(ids('따뜻해지고 있어요.'), ['V-고 있다']);  // 따뜻해지다 = 따뜻하다 + -아/어 + 지다
  assert.deepEqual(ids('먹지 못해요.'), ['V-지 못하다']);
  assert.deepEqual(ids('먹지못해요.'), ['V-지 못하다']);
});

test('flag weak: a construction that is ambiguous is never reported with high confidence', () => {
  const an = analyzer(['W', 'V@-고 X=싶다', 'weak'], ['S', 'V@-고 P=있다']);
  const r = an('먹고 싶어요. 먹고 있어요.');
  const strong = an('먹고 있어요.').patterns.find((p) => p.id === 'S'), weak = an('먹고 싶어요.').patterns.find((p) => p.id === 'W');
  assert.equal(strong.confidence, 'high'); assert.equal(weak.confidence, 'medium'); assert.equal(weak.weak, true);
  assert.ok(r);
});

test('flag generic: a broad construction is hidden when a more specific one covers the same words (kept and flagged with all:true)', () => {
  const rows = [['BROAD', 'V@-고 P', 'generic'], ['SPECIFIC', 'V@-고 X=싶다']];
  const sa = new K.Sentence.SentenceAnalyzer(pack.morphology, rows.map(([form, match, flags]) => [form, match, 1, 'basic', 'm', '', [['가', '나']], flags]));
  const shown = sa.analyze('먹고 싶어요.').patterns.map((p) => p.id);
  assert.deepEqual(shown, ['SPECIFIC']);
  const all = sa.analyze('먹고 싶어요.', { all: true }).patterns;
  assert.deepEqual(all.map((p) => [p.id, !!p.hidden]).sort(), [['BROAD', true], ['SPECIFIC', false]]);
  // …but when nothing more specific exists, the broad one is shown
  assert.deepEqual(sa.analyze('먹고 가요.').patterns.map((p) => p.id), ['BROAD']);
});

test('flag end: the row describes one single ending (kind "ending" instead of "pattern")', () => {
  const an = analyzer(['-고', 'V@-고', 'end'], ['V-고 싶다', 'V@-고 X=싶다']);
  const r = an('먹고 싶어요.');
  const byId = Object.fromEntries(r.patterns.map((p) => [p.id, p]));
  assert.equal(byId['V-고 싶다'].kind, 'pattern');
  assert.equal(byId['-고'] ? byId['-고'].kind : 'ending', 'ending');
  assert.equal(K.Patterns.compile(['-고', 'V@-고', 1, 'basic', 'm', '', [['가', '나']], 'end']).kind, 'ending');
  assert.equal(K.Patterns.compile(['x', 'V', 1, 'basic', 'm', '', [['가', '나']], '']).kind, 'pattern');
});

test('flag link=REL: the pattern closes a subordinate clause with that relation (clause boundaries come from the catalogue too)', () => {
  const an = analyzer(['V-기 때문에', 'P@-기 N=때문+에', 'link=cause']);
  const r = an('비가 오기 때문에 못 가요.');
  assert.equal(r.clauses.length, 2);
  assert.equal(r.clauses[0].kind, 'sub'); assert.equal(r.clauses[0].rel, 'cause'); assert.equal(r.clauses[0].ending, 'V-기 때문에');
  assert.equal(r.clauses[0].text, '비가 오기 때문에'); assert.equal(r.clauses[1].kind, 'main'); assert.equal(r.clauses[1].text, '못 가요');
  assert.match(r.clauses[0].relLabel, /nguyên nhân/);
});

test('a construction made of two ending-bearing words is ONE complex predicate (no clause boundary inside 먹고 싶어요)', () => {
  const an = analyzer(['V-고 싶다', 'V@-고 X=싶다']);
  assert.equal(an('밥을 먹고 싶어요.').clauses.length, 1);
  assert.equal(an('밥을 먹고 학교에 가요.').clauses.length, 2); // a plain -고 does split
});

test('confidence: a construction that needs a spaceless-guess / misspelled reading is medium and says why', () => {
  const an = analyzer(['V-ㄹ 수 있다', 'P@-(으)ㄹ N=수+~ P=있다|없다']);
  const spaced = an('할 수 있어요.').patterns[0], glued = an('할수있어요.').patterns[0];
  assert.equal(spaced.confidence, 'high'); assert.deepEqual(spaced.via, []);
  assert.equal(glued.confidence, 'medium'); assert.ok(glued.via.some((v) => v.startsWith('segmented:')), glued.via.join());
  assert.ok(an('할 수 있어요.').patterns.length === 1 && an('할 수 없어요.').patterns.length === 1);
});

test('one pattern per place: the same row is not reported twice for the same words, and different rows may overlap', () => {
  const an = analyzer(['V-고 싶다', 'V@-고 X=싶다'], ['V-고', 'V@-고', 'end']);
  const r = an('먹고 싶고 마시고 싶어요.');
  const places = r.patterns.filter((p) => p.id === 'V-고 싶다').map((p) => p.text);
  assert.equal(new Set(places).size, places.length);
  assert.ok(places.length >= 1);
});

test('compile() rejects malformed rows loudly (a typo in the catalogue must not become a silent no-match)', () => {
  const row = (match) => ['x', match, 1, 'basic', 'm', '', [['가', '나']], ''];
  assert.throws(() => K.Patterns.compile(row('Z')), /bad pattern slot/);
  assert.throws(() => K.Patterns.compile(row('V@-고 Q')), /bad pattern slot/);
  assert.throws(() => K.Patterns.compile(row('.. V')), /gap cannot start or end/);
  assert.throws(() => K.Patterns.compile(row('V ..')), /gap cannot start or end/);
  assert.doesNotThrow(() => K.Patterns.compile(row('N+을/를 .. V')));
  assert.doesNotThrow(() => K.Patterns.compile(row('V=가다|오다+_')));
});

test('compiled rows expose what the UI needs (form, level, category, meaning, note, examples, kind, flags)', () => {
  const c = K.Patterns.compile(['V-(으)ㄹ 수 있다', 'P@-(으)ㄹ N=수+~ P=있다|없다', 2, 'ability', 'có thể', 'ghi chú', [['갈 수 있어요.', 'Tôi có thể đi.']], 'weak generic link=cause']);
  assert.equal(c.id, 'V-(으)ㄹ 수 있다'); assert.equal(c.form, c.id); assert.equal(c.lv, 2); assert.equal(c.cat, 'ability'); assert.equal(c.meaning, 'có thể'); assert.equal(c.note, 'ghi chú');
  assert.deepEqual(c.ex, [['갈 수 있어요.', 'Tôi có thể đi.']]); assert.equal(c.weak, true); assert.equal(c.generic, true); assert.equal(c.link, 'cause'); assert.equal(c.kind, 'pattern');
  assert.equal(c.variants.length, 1); assert.equal(c.variants[0].slots.length, 3);
});

test('analysis of sentence text: texts of the places found are slices of the original sentence', () => {
  const an = analyzer(['V-고 싶다', 'V@-고 X=싶다']);
  const s = '저는 한국어를 공부하고 싶어요.';
  const r = an(s);
  assert.deepEqual(texts(r), ['공부하고 싶어요']);
  assert.equal(s.slice(r.patterns[0].from, r.patterns[0].to), '공부하고 싶어요');
});
