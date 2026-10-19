'use strict';
/* Sentence analysis (Korean pack -> analyzeSentence): facts, grammar patterns, word roles, clauses and the sentence structure.
 * The five sentences of the project brief are pinned exactly as the learner sees them. The rest pins what is easy to break: clause splitting,
 * quotations, "which sentence of several", spaced / unspaced parity, the tense of future constructions and honest confidence. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { koreanPack } = require('../helpers/load.js');

let pack;
test.before(async () => { pack = await koreanPack(); });

const fact = (r, id) => { const f = r.facts.find((x) => x.id === id); return f ? f.value : undefined; };
const titles = (r) => r.patterns.map((p) => p.title);
const roles = (r) => r.words.map((w) => `${w.text}:${w.role}`);
const kinds = (r) => r.clauses.map((c) => c.kind);
const structure = (r) => r.structure.map((s) => s.role);
const pattern = (r, title) => r.patterns.find((p) => p.title === title);
const analyze = (text, opts) => { const r = pack.analyzeSentence(text, opts); assert.ok(r, `no analysis for ${JSON.stringify(text)}`); return r; };

// ---- the five sentences of the brief --------------------------------------------------------------------------------
const POLITE = 'Lịch sự thân mật (해요체)';
const BRIEF = [
  { text: '오늘 어디에 있었어요?', type: 'Câu hỏi', tense: 'quá khứ', qwords: '어디에',
    patterns: [['N에 있다/없다', '어디에 있었어요'], ['-았/었- (quá khứ)', '있었어요'], ['-아요/어요', '있었어요']],
    words: ['오늘:noun', '어디에:loc', '있었어요:pred'], structure: ['loc', 'pred'], clauses: [['main', '오늘 어디에 있었어요', '있다']] },
  { text: '사람이 많아요.', type: 'Câu trần thuật', tense: 'hiện tại / trạng thái',
    patterns: [['-아요/어요', '많아요']], words: ['사람이:subj', '많아요:pred'], structure: ['subj', 'pred'], clauses: [['main', '사람이 많아요', '많다']] },
  { text: '저는 한국어를 공부해요.', type: 'Câu trần thuật', tense: 'hiện tại / trạng thái',
    patterns: [['-아요/어요', '공부해요']], words: ['저는:topic', '한국어를:obj', '공부해요:pred'], structure: ['topic', 'obj', 'pred'], clauses: [['main', '저는 한국어를 공부해요', '공부하다']] },
  { text: '왜 이렇게 늦었어요?', type: 'Câu hỏi', tense: 'quá khứ', qwords: '왜',
    patterns: [['-았/었- (quá khứ)', '늦었어요'], ['-아요/어요', '늦었어요']], words: ['왜:advb', '이렇게:advb', '늦었어요:pred'], structure: ['pred'], clauses: [['main', '왜 이렇게 늦었어요', '늦다']] },
  { text: '그 사람을 찾고 있어요.', type: 'Câu trần thuật', tense: 'hiện tại / trạng thái',
    patterns: [['V-고 있다', '찾고 있어요'], ['-아요/어요', '있어요']], words: ['그:det', '사람을:obj', '찾고:predHead', '있어요:pred'], structure: ['obj', 'pred'], clauses: [['main', '그 사람을 찾고 있어요', '있다']] },
];
test('the five sentences of the brief: type, tense, politeness, patterns, word roles, clauses and structure', () => {
  for (const b of BRIEF) {
    const r = analyze(b.text);
    assert.equal(r.text, b.text, b.text);
    assert.equal(r.sentenceCount, 1, b.text);
    assert.equal(r.sentenceIndex, 0, b.text);
    assert.equal(fact(r, 'type'), b.type, b.text);
    assert.equal(fact(r, 'tense'), b.tense, b.text);
    assert.equal(fact(r, 'level'), POLITE, b.text);
    assert.equal(fact(r, 'qwords'), b.qwords, b.text);
    for (const [title, text] of b.patterns) {
      const p = pattern(r, title);
      assert.ok(p, `${b.text}: pattern ${title} missing (got ${titles(r).join(' ; ')})`);
      assert.equal(p.text, text, `${b.text}: ${title}`);
      assert.equal(p.confidence, 'high', `${b.text}: ${title}`);
    }
    assert.deepEqual(roles(r), b.words, b.text);
    assert.deepEqual(structure(r), b.structure, b.text);
    assert.deepEqual(r.clauses.map((c) => [c.kind, c.text, c.predicate]), b.clauses, b.text);
    assert.ok(r.words.every((w) => w.confidence === 'high'), b.text);
  }
});
test('"어디에 있었어요?" is explained: the place word is a location, the verb says where, the question word is named', () => {
  const r = analyze('오늘 어디에 있었어요?');
  const where = r.words.find((w) => w.text === '어디에');
  assert.equal(where.lemma, '어디'); assert.equal(where.gloss, 'ở đâu'); assert.equal(where.roleLabel, 'Địa điểm / thời điểm / đích');
  assert.ok(where.patterns.includes('N에 있다/없다'));
  const p = pattern(r, 'N에 있다/없다');
  assert.equal(p.meaning, 'ở N / không ở N'); assert.ok(p.examples.length >= 2); assert.ok(p.examples.every((e) => e.text && e.translation));
  assert.match(r.facts.find((f) => f.id === 'type').hint, /dấu “\?”/); // it is a question because of the mark and the word, say so
});

// ---- clauses: subordinate + main ----------------------------------------------------------------------------------------
const CLAUSES = [
  ['비가 와서 집에 있었어요.', ['sub', 'main'], ['비가 와서', '집에 있었어요'], [/nguyên nhân/, ''], ['-아서/어서', 'N에 있다/없다']],
  ['시간이 있으면 같이 가요.', ['sub', 'main'], ['시간이 있으면', '같이 가요'], [/điều kiện/, ''], ['-(으)면', 'N이/가 있다/없다']],
  ['피곤하지만 일을 해야 해요.', ['sub', 'main'], ['피곤하지만', '일을 해야 해요'], [/đối lập/, ''], ['-지만', 'V-아/어야 하다/되다']],
  ['공부하려고 도서관에 갔어요.', ['sub', 'main'], ['공부하려고', '도서관에 갔어요'], [/mục đích/, ''], ['-(으)려고']],
  ['날씨가 좋은데 산책할까요?', ['sub', 'main'], ['날씨가 좋은데', '산책할까요'], [/bối cảnh/, ''], ['-(으)ㄴ/는데', '-(으)ㄹ까요?']],
  ['친구가 내일 온다고 했어요.', ['main'], ['친구가 내일 온다고 했어요'], [''], ['V-다고 하다 (trích dẫn gián tiếp)']],
  ['비가 오는데…', ['open'], ['비가 오는데'], [/bối cảnh/], ['-(으)ㄴ/는데']],
  ['밥을 먹고…', ['open'], ['밥을 먹고'], [/nối tiếp/], ['-고']],
];
test('clauses: a connective ending closes a subordinate clause with its relation; a suspended sentence stays "open"', () => {
  for (const [text, kindList, clauseTexts, rels, pats] of CLAUSES) {
    const r = analyze(text);
    assert.deepEqual(kinds(r), kindList, text);
    assert.deepEqual(r.clauses.map((c) => c.text), clauseTexts, text);
    r.clauses.forEach((c, i) => { const want = rels[i]; if (want instanceof RegExp) assert.match(c.relationLabel, want, text); else assert.equal(c.relationLabel, want, text); });
    for (const t of pats) assert.ok(pattern(r, t), `${text}: pattern ${t} missing (got ${titles(r).join(' ; ')})`);
    assert.ok(r.clauses.every((c) => c.kindLabel), text);
  }
});
test('"…고 싶다", "…(으)면 안 되다", "…아/어야 하다" are one predicate, not a clause boundary', () => {
  for (const text of ['밥을 먹고 싶어요.', '비가 오면 안 돼요.', '학교에 가야 해요.', '한국어를 공부한 적이 있어요.']) assert.deepEqual(kinds(analyze(text)), ['main'], text);
});
test('a complex predicate (V-고 싶다, V-고 있다, V-아/어 보다): its main verb is named as such, glossed without the connective, and the skeleton shows ONE predicate', () => {
  const want = analyze('밥을 먹고 싶어요.');
  assert.deepEqual(roles(want), ['밥을:obj', '먹고:predHead', '싶어요:pred']);
  const head = want.words[1];
  assert.equal(head.gloss, 'ăn'); // not "ăn và": the -고 belongs to the construction, which the pattern list explains
  assert.equal(head.roleLabel, 'Động từ chính của cụm vị ngữ');
  assert.match(head.roleHint, /V-고 싶다/);
  assert.deepEqual(structure(want), ['obj', 'pred']);
  assert.deepEqual(roles(analyze('비가 오고 있어요.')), ['비가:subj', '오고:predHead', '있어요:pred']);
  assert.deepEqual(roles(analyze('한번 먹어 보세요.')), ['한번:advb', '먹어:predHead', '보세요:pred']);
  assert.deepEqual(structure(analyze('한번 먹어 보세요.')), ['pred']);
  assert.deepEqual(roles(analyze('밥을 먹고 싶지 않아요.')), ['밥을:obj', '먹고:predHead', '싶지:predHead', '않아요:pred']); // two constructions chained: two main verbs, one predicate
  // a real subordinate clause keeps its role and its "and / because" gloss; a word written as one has nothing to split
  const sub = analyze('비가 와서 집에 있었어요.').words[1];
  assert.equal(sub.role, 'sub'); assert.match(sub.gloss, /nên/);
  assert.deepEqual(roles(analyze('먹고싶어요.')), ['먹고싶어요:pred']);
  assert.equal(globalThis.LinguaFlow.Korean.Sentence.ROLE.predHead.length, 2); // [label, hint] like every other role
});
test('word roles from particles: topic / subject / object / place / companion / recipient', () => {
  assert.deepEqual(structure(analyze('친구에게 선물을 줬어요.')), ['recip', 'obj', 'pred']);
  assert.deepEqual(structure(analyze('학교에서 친구와 공부해요.')), ['place', 'comit', 'pred']);
  assert.deepEqual(roles(analyze('학교에서 친구와 공부해요.')), ['학교에서:place', '친구와:comit', '공부해요:pred']);
});

// ---- facts ------------------------------------------------------------------------------------------------------------------
test('politeness levels: 합쇼체 / 해요체 / 해체 / 해라체 are named', () => {
  const lv = (t) => fact(analyze(t), 'level');
  assert.match(lv('알겠습니다.'), /합쇼체/);
  assert.match(lv('알겠어요.'), /해요체/);
  assert.match(lv('알겠어.'), /해체/);
  assert.match(lv('내일 비가 올 것이다.'), /해라체/);
});
test('honorific: -(으)시- and N께서 are reported', () => {
  const r = analyze('선생님께서 오셨어요.');
  assert.equal(fact(r, 'honorific'), 'có (chủ ngữ là người đáng kính)');
  assert.ok(pattern(r, 'N께서 … -(으)시-')); assert.ok(pattern(r, '-(으)시- (kính ngữ)'));
  assert.equal(fact(analyze('선생님이 왔어요.'), 'honorific'), undefined);
});
test('negation: 안, 못, -지 않다, -지 못하다 and -지 마세요 are reported; a plain sentence has none', () => {
  for (const t of ['안 가요.', '못 먹어요.', '가지 않아요.', '먹지 못해요.', '먹지 마세요.']) assert.equal(fact(analyze(t), 'negation'), 'có', t);
  assert.equal(fact(analyze('가요.'), 'negation'), undefined);
  assert.equal(fact(analyze('먹지 마세요.'), 'type'), 'Câu mệnh lệnh / yêu cầu');
  assert.ok(pattern(analyze('안 가요.'), '안 + V/A')); assert.ok(pattern(analyze('가지 않아요.'), 'V-지 않다'));
});
test('sentence type: statement, question (with "?" or a question word), suggestion, promise, suspended', () => {
  const type = (t) => fact(analyze(t), 'type');
  assert.equal(type('학교에 가요.'), 'Câu trần thuật');
  assert.equal(type('학교에 가요?'), 'Câu hỏi');
  assert.equal(type('뭐 해요?'), 'Câu hỏi');
  assert.equal(type('뭐 했어요'), 'Câu hỏi'); // no "?" but a question word with an ending that can ask
  assert.equal(type('밥을 먹고…'), 'Câu bỏ lửng / chưa kết thúc');
  assert.equal(type('제가 할게요.'), 'Câu nêu ý định / hứa hẹn');
  assert.equal(type('안녕하세요.'), 'Cụm cố định / câu chào');
  // a fixed expression that is also an inflected predicate is a phrase when it stands alone (and keeps its politeness level) …
  assert.equal(type('감사합니다.'), 'Cụm cố định / câu chào'); assert.match(fact(analyze('감사합니다.'), 'level'), /합쇼체/);
  assert.equal(fact(analyze('안녕하세요.'), 'honorific'), undefined); // (a greeting has no "honoured subject")
  // … but a real order or question stays one, and inside a longer sentence it is an ordinary predicate
  assert.equal(type('앉으세요.'), 'Câu mệnh lệnh / yêu cầu'); assert.equal(type('괜찮으세요?'), 'Câu hỏi'); assert.equal(type('저는 괜찮아요.'), 'Câu trần thuật');
});
test('tense: past -았/었-, future -겠- and the future constructions (-(으)ㄹ 거예요, -(으)ㄹ게요, -(으)려고 하다, -(으)ㄹ 생각이다)', () => {
  const tense = (t) => fact(analyze(t), 'tense');
  const FUTURE = 'tương lai / ý định / phỏng đoán';
  assert.equal(tense('어제 갔어요.'), 'quá khứ');
  assert.equal(tense('알겠습니다.'), FUTURE);
  for (const t of ['내일 비가 올 거예요.', '내일 갈 거야.', '제가 할게요.', '주말에 여행을 가려고 해요.', '내년에 한국에 갈 생각이에요.', '그 사람은 학생일 거예요.']) assert.equal(tense(t), FUTURE, t);
  assert.equal(tense('이사하려고 했어요.'), 'quá khứ'); // "was going to": the past stays the past
  assert.equal(tense('학교에 가요.'), 'hiện tại / trạng thái');
});

// ---- quotations ---------------------------------------------------------------------------------------------------------------
test('a direct quotation: the marker after the closing quote is part of it, its clause is "quote", the main clause is what remains', () => {
  const r = analyze('그가 "집에 가고 싶어요"라고 했어요.');
  assert.deepEqual(kinds(r), ['quote', 'main']);
  assert.equal(r.clauses[0].text, '그가 "집에 가고 싶어요"라고'); // (clauses are consecutive stretches: the subject written before the quotation is shown with it)
  assert.equal(r.clauses[0].predicate, '싶다'); assert.equal(r.clauses[1].text, '했어요'); assert.equal(r.clauses[1].predicate, '하다');
  assert.equal(r.words.find((w) => w.text === '라고').role, 'ptcl');
  assert.ok(pattern(r, '“…”라고 하다 (trích dẫn trực tiếp)')); assert.ok(pattern(r, 'V-고 싶다'));
  assert.equal(fact(r, 'tense'), 'quá khứ');
});
test('a “?” or “!” inside the quotation does not end the sentence nor make the quoting sentence a question', () => {
  const q = analyze('“왜 그래?”라고 물었어요.');
  assert.equal(q.sentenceCount, 1); assert.equal(q.text, '“왜 그래?”라고 물었어요.');
  assert.equal(fact(q, 'type'), 'Câu trần thuật'); assert.equal(fact(q, 'qwords'), undefined);
  assert.ok(pattern(q, '“…”라고 하다 (trích dẫn trực tiếp)'));
  const e = analyze('그가 "가자!"라고 했어요. 우리는 갔어요.');
  assert.equal(e.sentenceCount, 2); assert.equal(e.text, '그가 "가자!"라고 했어요.');
  assert.equal(analyze('그가 "가자!"라고 했어요. 우리는 갔어요.', { focus: '우리는' }).text, '우리는 갔어요.');
  // …but when the quoting sentence itself asks, it is a question
  assert.equal(fact(analyze('누가 "비가 와요"라고 했어요?'), 'type'), 'Câu hỏi');
});
test('a quotation that follows the main predicate keeps the main clause main (말씀하셨어요: "…"라고)', () => {
  const r = analyze('선생님이 말씀하셨어요: "조용히 하세요!"라고.');
  assert.deepEqual(kinds(r), ['main', 'quote']);
  assert.equal(r.clauses[0].text, '선생님이 말씀하셨어요');
  assert.equal(fact(r, 'type'), 'Câu trần thuật'); // not the imperative inside the quotation
  assert.deepEqual(structure(r), ['subj', 'pred']);
});
test('direct quotations with 이라고 / 이라는 / 라며 are patterns of their own', () => {
  assert.ok(pattern(analyze('“사랑”이라고 말했어요.'), '“…”라고 하다 (trích dẫn trực tiếp)'));
  assert.ok(pattern(analyze('“행복”이라는 단어를 좋아해요.'), '“…”라는 N (định ngữ, trích dẫn trực tiếp)'));
  assert.ok(pattern(analyze('“고마워”라며 웃었어요.'), '“…”라며 / “…”라면서 (trích dẫn nối)'));
  const r = analyze('“행복”이라는 단어를 좋아해요.');
  assert.equal(r.words.find((w) => w.text === '이라는').role, 'ptcl');
  assert.deepEqual(structure(r), ['obj', 'pred']);
});

// ---- several sentences, focus -------------------------------------------------------------------------------------------------
const THREE = '오늘 어디에 있었어요? 사람이 많아요. 저는 한국어를 공부해요.';
test('several sentences: the first is analysed, or the one that holds the focus (word, offset or {start})', () => {
  const first = analyze(THREE);
  assert.equal(first.sentenceCount, 3); assert.equal(first.sentenceIndex, 0); assert.equal(first.offset, 0); assert.equal(first.text, '오늘 어디에 있었어요?');
  const byWord = analyze(THREE, { focus: '한국어를' });
  assert.equal(byWord.sentenceIndex, 2); assert.equal(byWord.offset, THREE.indexOf('저는')); assert.equal(byWord.text, '저는 한국어를 공부해요.');
  assert.deepEqual(byWord.words.filter((w) => w.focus).map((w) => w.text), ['한국어를']);
  const byOffset = analyze(THREE, { focus: THREE.indexOf('많아요') });
  assert.equal(byOffset.sentenceIndex, 1); assert.equal(byOffset.text, '사람이 많아요.');
  const byRange = analyze(THREE, { focus: { start: THREE.indexOf('사람이'), end: THREE.indexOf('사람이') + 3 } });
  assert.equal(byRange.sentenceIndex, 1);
  assert.equal(analyze(THREE, { focus: 'zzz' }).sentenceIndex, 0); // a focus that is not in the text falls back to the first sentence
  for (const r of [first, byWord, byOffset, byRange]) assert.equal(r.sentenceCount, 3);
});
test('the pattern that holds the focused word comes first and is flagged', () => {
  const r = analyze('그 사람을 찾고 있어요.', { focus: '찾고' });
  assert.equal(r.patterns[0].title, 'V-고 있다'); assert.equal(r.patterns[0].focus, true);
  assert.equal(r.words.find((w) => w.text === '찾고').focus, true);
  assert.deepEqual(r.words.find((w) => w.text === '찾고').patterns.slice(0, 1), ['V-고 있다']);
  const plain = analyze('그 사람을 찾고 있어요.');
  assert.ok(plain.patterns.every((p) => p.focus === false)); assert.ok(plain.words.every((w) => w.focus === false));
});
test('nothing to analyse: empty, blank, Latin-only and non-string input give null', () => {
  for (const t of ['', '   ', '\n', 'Hello world', '123', '...', null, undefined]) assert.equal(pack.analyzeSentence(t), null, JSON.stringify(t));
  assert.ok(pack.analyzeSentence('TV를 봐요.')); // a Latin word glued to a Korean particle is still a sentence
});

// ---- the shape of the result ------------------------------------------------------------------------------------------------
test('the result is language-neutral and complete: every field the core lays out is there', () => {
  const r = analyze('비가 와서 집에 있었어요.', { focus: '집에' });
  assert.deepEqual(Object.keys(r).sort(), ['clauses', 'facts', 'offset', 'patterns', 'sentenceCount', 'sentenceIndex', 'structure', 'text', 'words']);
  for (const f of r.facts) { assert.ok(f.id && f.label && f.value, JSON.stringify(f)); assert.ok(Object.keys(f).every((k) => ['id', 'label', 'value', 'hint'].includes(k)), JSON.stringify(f)); }
  for (const p of r.patterns) {
    assert.deepEqual(Object.keys(p).sort(), ['category', 'categoryLabel', 'confidence', 'examples', 'focus', 'id', 'kind', 'level', 'meaning', 'note', 'notes', 'text', 'title']);
    assert.ok(['pattern', 'ending'].includes(p.kind)); assert.ok(['high', 'medium', 'low'].includes(p.confidence)); assert.ok(p.categoryLabel, p.id); assert.ok(p.meaning, p.id);
  }
  for (const w of r.words) {
    assert.deepEqual(Object.keys(w).sort(), ['clause', 'confidence', 'focus', 'gloss', 'index', 'lemma', 'patterns', 'posLabel', 'role', 'roleHint', 'roleLabel', 'text']);
    assert.ok(w.roleLabel, w.text); assert.ok(w.clause >= 0 && w.clause < r.clauses.length, w.text);
  }
  for (const c of r.clauses) assert.deepEqual(Object.keys(c).sort(), ['ending', 'index', 'kind', 'kindLabel', 'label', 'predicate', 'relationLabel', 'text']);
  for (const s of r.structure) assert.deepEqual(Object.keys(s).sort(), ['label', 'role']);
  assert.deepEqual(r.words.map((w) => w.clause), [0, 0, 1, 1]); // 비가 와서 | 집에 있었어요
  assert.ok(JSON.parse(JSON.stringify(r)), 'it must survive structured cloning / JSON (it crosses the page boundary)');
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r);
});
test('{ all: true } also returns the broad patterns that a more specific one hides (diagnostics)', () => {
  const text = '밥을 먹고 싶어요.';
  const normal = titles(analyze(text)), all = titles(analyze(text, { all: true }));
  assert.deepEqual(normal, ['V-고 싶다', '-아요/어요']);
  assert.ok(all.includes('-고')); assert.ok(normal.every((t) => all.includes(t)));
  assert.equal(titles(analyze('비가 오면 안 돼요.', { all: true })).includes('-(으)면'), true);
  assert.equal(titles(analyze('비가 오면 안 돼요.')).includes('-(으)면'), false);
});

// ---- spaced vs unspaced ---------------------------------------------------------------------------------------------------------
test('a dictionary word that is verb + auxiliary is explained exactly like its spaced spelling (따뜻해졌어요 = 따뜻해 졌어요)', () => {
  const pairs = [['따뜻해졌어요.', '따뜻해 졌어요.', 'A-아/어지다'], ['도와줬어요.', '도와 줬어요.', 'V-아/어 주다']];
  for (const [joined, spaced, title] of pairs) {
    const a = analyze(joined), b = analyze(spaced);
    assert.ok(pattern(a, title), joined); assert.ok(pattern(b, title), spaced);
    assert.deepEqual([...titles(a)].sort(), [...titles(b)].sort(), joined);
    assert.equal(fact(a, 'tense'), fact(b, 'tense')); assert.equal(fact(a, 'level'), fact(b, 'level'));
    assert.deepEqual(kinds(a), kinds(b));
  }
});

// ---- honesty --------------------------------------------------------------------------------------------------------------------
test('honest confidence: a guessed spelling or an unknown word lowers the pattern that depends on it and says why', () => {
  const sp = analyze('내일 비가 올꺼에요.');
  const p = pattern(sp, 'V-(으)ㄹ 거예요 / -(으)ㄹ 것이다');
  assert.ok(p); assert.equal(p.confidence, 'medium');
  assert.ok(p.notes.some((n) => /viết tắt hoặc viết sai chính tả/.test(n)), p.notes.join(' | '));
  assert.equal(fact(sp, 'tense'), 'tương lai / ý định / phỏng đoán');
  const unk = analyze('쀍뛟쒧은 뭐예요?');
  assert.equal(unk.words[0].confidence, 'low');
  const q = pattern(unk, 'N이/가 뭐예요?');
  assert.ok(q); assert.equal(q.confidence, 'medium'); assert.ok(q.notes.some((n) => /chưa chắc chắn/.test(n)), q.notes.join(' | '));
  // a clean sentence has no notes at all
  for (const x of analyze('저는 한국어를 공부해요.').patterns) assert.deepEqual(x.notes, []);
});
test('every pattern the analyser reports is in the catalogue and carries its examples (nothing invented)', () => {
  const ids = new Set(globalThis.LinguaFlow.Korean.GrammarPatterns.PATTERNS.map((r) => r[0]));
  for (const t of ['비가 와서 집에 있었어요.', '그가 "집에 가고 싶어요"라고 했어요.', '피곤하지만 일을 해야 해요.', '날씨가 좋은데 산책할까요?', '선생님께서 오셨어요.']) {
    for (const p of analyze(t).patterns) {
      assert.ok(ids.has(p.id), `${t}: ${p.id} is not a catalogue row`);
      assert.ok(p.examples.length >= 1, `${t}: ${p.id} has no examples`);
    }
  }
});
