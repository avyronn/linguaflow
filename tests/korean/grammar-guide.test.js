'use strict';
/* The sentence-structure guide ("Cấu trúc câu") and the grammar reference the popup shows (Korean pack → getGrammarReference).
 * Like the pattern catalogue, the guide is data the learner reads as fact, so it is tested like code: well formed, every example analysed
 * cleanly by the very analyser that labels the subtitle line, and the reference assembled from it, the catalogue, the particles and the endings
 * is complete, unambiguous (no two items share an id) and searchable (every item has something to find). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { koreanPack } = require('../helpers/load.js');

let pack, K, GUIDE, REF;
test.before(async () => {
  pack = await koreanPack();
  K = globalThis.LinguaFlow.Korean;
  GUIDE = K.GrammarGuide.GUIDE;
  REF = pack.getGrammarReference();
});
const HANGUL = /[가-힣]/;

test('guide: the topics a learner needs for reading a sentence are all there', () => {
  assert.ok(GUIDE.length >= 18, 'rows: ' + GUIDE.length);
  const ids = GUIDE.map((r) => r[0]);
  for (const want of ['order', 'particles', 'topic', 'omission', 'copula', 'modifier', 'levels', 'tense', 'negation', 'question', 'connect', 'nominal']) assert.ok(ids.includes(want), 'missing topic ' + want);
});
test('guide: every row is [id, title, level, summary, note, examples] and well formed', () => {
  const ids = new Set();
  for (const r of GUIDE) {
    assert.equal(r.length, 6, String(r[0]));
    const [id, title, level, summary, note, examples] = r;
    assert.match(id, /^[a-z]+$/, 'id ' + id); assert.ok(!ids.has(id), 'duplicate id ' + id); ids.add(id);
    assert.ok(typeof title === 'string' && title.trim() === title && title.length > 3, id + ': title');
    assert.ok(Number.isInteger(level) && level >= 1 && level <= 6, id + ': level');
    assert.ok(typeof summary === 'string' && summary.length > 20 && /[.)”]$/.test(summary), id + ': summary is a sentence');
    assert.ok(typeof note === 'string' && note.length > 40, id + ': note');
    assert.ok(Array.isArray(examples) && examples.length >= 2, id + ': at least two examples');
    const seen = new Set();
    for (const e of examples) {
      assert.ok(Array.isArray(e) && e.length === 2, id + ': example is [korean, vietnamese]');
      assert.ok(HANGUL.test(e[0]) && e[0] === e[0].trim(), id + ': ' + e[0]);
      assert.ok(typeof e[1] === 'string' && e[1].trim().length > 0 && !HANGUL.test(e[1].replace(/\(.*?\)|“.*?”/g, '')), id + ': translation of ' + e[0]);
      assert.ok(!seen.has(e[0]), id + ': the same example twice'); seen.add(e[0]);
    }
  }
});
test('guide: every example is analysed cleanly - every word known, nothing guessed, nothing below high confidence', () => {
  const sa = pack.sentences, problems = [];
  let n = 0;
  for (const row of GUIDE) {
    for (const [ko] of row[5]) {
      n++;
      let off = 0;
      for (let k = 0; k < 6; k++) {
        const r = sa.analyze(ko, { focus: off });
        if (!r) break;
        for (const s of r.segments) if (s.type === 'unknown' || s.type === 'segmented' || s.type === 'misspelled' || s.confidence !== 'high' || s.role === 'unk') problems.push(`${row[0]}: ${ko} → ${s.text} (${s.type}/${s.confidence})`);
        if (k + 1 >= r.sentenceCount) break;
        off = r.offset + r.text.length + 1;
        while (off < ko.length && /\s/.test(ko[off])) off++;
      }
    }
  }
  assert.ok(n >= 49, 'examples: ' + n);
  assert.deepEqual(problems, []);
});
test('guide: the examples show what the topic says (the analyser finds the structure the guide teaches)', () => {
  const a = (t) => pack.analyzeSentence(t);
  const order = (t) => a(t).structure.map((s) => s.role).join('>');
  assert.equal(order('저는 밥을 먹어요.'), 'topic>obj>pred'); // order: S-O-V, predicate last
  assert.equal(order('어제 학교에서 친구를 만났어요.'), 'place>obj>pred');
  assert.equal(order('친구를 어제 학교에서 만났어요.'), 'obj>place>pred'); // particles carry the role, so the order can change
  assert.ok(a('어제 본 영화가 재미있었어요.').words.some((w) => w.role === 'adn')); // modifier before the noun
  assert.equal(a('비가 와서 집에 있었어요.').clauses.map((c) => c.kind).join(), 'sub,main'); // connect
  assert.equal(a('이것은 책이에요.').words[1].role, 'predNoun'); // copula
  assert.match(a('저는 커피를 안 마셔요.').facts.find((f) => f.id === 'negation').value, /có/);
  assert.equal(a('지금 뭐 해요?').facts.find((f) => f.id === 'type').value, 'Câu hỏi');
});

// ---- the reference ----------------------------------------------------------------------------------------------------------------
test('reference: sections are structure → catalogue categories → particles → endings, every one non-empty and titled', () => {
  assert.ok(Array.isArray(REF) && REF.length >= 28);
  assert.equal(REF[0].id, 'structure'); assert.equal(REF[REF.length - 2].id, 'particles'); assert.equal(REF[REF.length - 1].id, 'endings');
  const catIds = K.GrammarPatterns.CATEGORIES.map((c) => c[0]);
  assert.deepEqual(REF.slice(1, -2).map((s) => s.id), catIds, 'one section per catalogue category, in catalogue order');
  for (const s of REF) {
    assert.deepEqual(Object.keys(s).sort(), ['id', 'items', 'title'], s.id);
    assert.ok(s.title.trim().length > 3, s.id); assert.ok(s.items.length >= 1, s.id + ' is empty');
  }
  assert.equal(REF[0].items.length, GUIDE.length);
});
test('reference: items have the fields the popup lays out; ids are unique across the whole reference', () => {
  const ids = new Set(), kinds = new Set();
  let items = 0;
  for (const s of REF) {
    for (const it of s.items) {
      items++;
      assert.ok(it.id && it.title && it.summary, `${s.id}: ${JSON.stringify(it).slice(0, 80)}`);
      assert.ok(!ids.has(it.id), 'duplicate item id ' + it.id); ids.add(it.id);
      assert.equal(typeof it.note, 'string', it.id);
      assert.ok(Number.isInteger(it.level) && it.level >= 1 && it.level <= 6, it.id + ': level ' + it.level);
      assert.ok(['guide', 'pattern', 'ending', 'particle', 'ending-table'].includes(it.kind), it.id + ': kind ' + it.kind);
      kinds.add(it.kind);
      assert.ok(Array.isArray(it.examples), it.id);
      for (const e of it.examples) assert.ok(HANGUL.test(e.text) && e.translation.trim(), it.id + ': example');
      if (it.kind === 'particle' || it.kind === 'ending-table') assert.ok(it.tag, it.id + ': a tag says what kind of item it is');
    }
  }
  assert.deepEqual([...kinds].sort(), ['ending', 'ending-table', 'guide', 'particle', 'pattern']);
  assert.ok(items >= 590, 'items: ' + items);
});
test('reference: every catalogue row appears exactly once, with its meaning, note, level and examples', () => {
  const rows = K.GrammarPatterns.PATTERNS;
  const byId = new Map(REF.flatMap((s) => s.items).map((it) => [it.id, it]));
  for (const r of rows) {
    const it = byId.get(r[0]);
    assert.ok(it, 'row missing from the reference: ' + r[0]);
    assert.equal(it.summary, r[4]); assert.equal(it.note, r[5] || ''); assert.equal(it.level, r[2]);
    assert.deepEqual(it.examples.map((e) => [e.text, e.translation]), r[6]);
    assert.equal(it.kind, /\bend\b/.test(r[7] || '') ? 'ending' : 'pattern', r[0]);
  }
  assert.equal(REF.slice(1, -2).reduce((n, s) => n + s.items.length, 0), rows.length);
});
test('reference: the particle table lists the case particles with labels; the ending table does not repeat endings that have their own row', () => {
  const particles = REF.find((s) => s.id === 'particles').items.map((i) => i.title);
  for (const p of ['-이/가', '-은/는', '-을/를', '-에', '-에서', '-에게', '-(으)로', '-와/과', '-도', '-만']) assert.ok(particles.includes(p), 'particle ' + p);
  assert.equal(new Set(particles).size, particles.length);
  const endings = REF.find((s) => s.id === 'endings').items;
  assert.ok(endings.length >= 200, 'endings: ' + endings.length);
  const inTable = new Set(endings.map((i) => i.title));
  // an ending that a catalogue row (flag `end`) already explains is not listed again
  for (const r of K.GrammarPatterns.PATTERNS) {
    if (!/\bend\b/.test(r[7] || '')) continue;
    for (const m of (Array.isArray(r[1]) ? r[1] : [r[1]])) for (const x of String(m).matchAll(/@([^ ;#$^+&%!=<]+)/g)) for (const id of x[1].split('|')) assert.ok(!inTable.has(id), `${id} is both in the catalogue (${r[0]}) and in the quick table`);
  }
  for (const e of endings) assert.ok(e.tag && e.summary, e.id);
});
test('reference: it is searchable - every item has Korean or Vietnamese text a learner can type, and nothing is empty or placeholder text', () => {
  for (const s of REF) {
    for (const it of s.items) {
      const text = [it.title, it.summary, it.note].join(' ');
      assert.ok(text.trim().length > 4, it.id);
      assert.ok(!/TODO|FIXME|lorem|undefined|\[object/i.test(text + JSON.stringify(it.examples)), it.id + ': placeholder text');
    }
  }
  // typical searches have an answer
  const flat = REF.flatMap((s) => s.items.map((i) => ({ s: s.id, i })));
  const find = (q) => flat.filter(({ i }) => (i.title + ' ' + i.summary + ' ' + i.note).toLowerCase().includes(q.toLowerCase()));
  for (const q of ['-고 싶다', '-아서/어서', '-(으)ㄹ 거예요', '-지만', '이/가', 'quá khứ', 'kính ngữ', 'nguyên nhân', 'phủ định', 'trích dẫn']) assert.ok(find(q).length >= 1, 'nothing found for ' + q);
});
test('reference: it is plain data (survives JSON), and building it twice gives the same result', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(REF)), REF);
  assert.deepEqual(pack.getGrammarReference(), REF);
});
