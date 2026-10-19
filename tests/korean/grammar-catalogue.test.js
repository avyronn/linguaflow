'use strict';
/* The grammar catalogue (src/languages/korean/grammar-patterns.js) is data that the analyser trusts, so it is tested like code:
 * every row must be well formed, must compile, and every example sentence it ships must make the analyser report that very row.
 * A row whose examples are not recognised cannot be released (see the header of grammar-patterns.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { koreanPack } = require('../helpers/load.js');

let pack, K, ROWS, CATS;
test.before(async () => {
  pack = await koreanPack();
  K = globalThis.LinguaFlow.Korean;
  ROWS = K.GrammarPatterns.PATTERNS;
  CATS = K.GrammarPatterns.CATEGORIES;
});

const HANGUL = /[가-힣]/;
const FLAG_WORDS = new Set(['weak', 'generic', 'end', 'future']);

/** Runs the sentence analyser over every sentence of a (possibly multi-sentence) example: callback gets each raw result. */
function eachSentence(analyzer, ko, opts, fn) {
  let off = 0;
  for (let k = 0; k < 8; k++) {
    const r = analyzer.analyze(ko, Object.assign({ focus: off }, opts));
    if (!r) break;
    fn(r);
    if (k + 1 >= r.sentenceCount) break;
    off = r.offset + r.text.length + 1;
    while (off < ko.length && /\s/.test(ko[off])) off++;
  }
}

test('catalogue: size — at least 239 constructions and 500 examples ship', () => {
  assert.ok(ROWS.length >= 239, 'rows: ' + ROWS.length);
  const n = ROWS.reduce((s, r) => s + r[6].length, 0);
  assert.ok(n >= 500, 'examples: ' + n);
});

test('catalogue: every row is [form, match, level, category, meaning, note, examples, flags?] and is well formed', () => {
  const catIds = new Set(CATS.map((c) => c[0]));
  assert.equal(catIds.size, CATS.length, 'category ids are unique');
  const forms = new Set();
  for (const r of ROWS) {
    const id = String(r[0]);
    assert.ok(r.length === 7 || r.length === 8, id + ': row length ' + r.length);
    assert.ok(typeof r[0] === 'string' && r[0].trim() === r[0] && r[0].length > 0, 'form: ' + id);
    assert.ok(!forms.has(r[0]), 'duplicate form ' + r[0]); forms.add(r[0]);
    const variants = Array.isArray(r[1]) ? r[1] : [r[1]];
    assert.ok(variants.length > 0 && variants.every((v) => typeof v === 'string' && v.trim().length > 0), id + ': match');
    assert.ok(Number.isInteger(r[2]) && r[2] >= 1 && r[2] <= 6, id + ': level ' + r[2]);
    assert.ok(catIds.has(r[3]), id + ': unknown category ' + r[3]);
    assert.ok(typeof r[4] === 'string' && r[4].trim().length > 0, id + ': meaning');
    assert.equal(typeof r[5], 'string', id + ': note is a string (may be empty)');
    assert.ok(Array.isArray(r[6]) && r[6].length >= 1, id + ': at least one example');
    for (const e of r[6]) {
      assert.ok(Array.isArray(e) && e.length === 2, id + ': example is [korean, vietnamese]');
      assert.ok(HANGUL.test(e[0]) && !/^\s|\s$/.test(e[0]), id + ': Korean text of example: ' + e[0]);
      assert.ok(typeof e[1] === 'string' && e[1].trim().length > 0, id + ': translation of ' + e[0]);
    }
    const dupe = r[6].map((e) => e[0]);
    assert.equal(new Set(dupe).size, dupe.length, id + ': the same example twice');
  }
  for (const [id] of CATS) assert.ok(ROWS.some((r) => r[3] === id), 'category without any row: ' + id);
});

test('catalogue: flags are only weak / generic / end / future / link=REL, and REL is a known clause relation', () => {
  const rels = new Set(Object.keys(K.Sentence.REL_LABEL));
  for (const r of ROWS) {
    for (const f of String(r[7] || '').split(/\s+/).filter(Boolean)) {
      const m = /^link=(\w+)$/.exec(f);
      if (m) assert.ok(rels.has(m[1]), r[0] + ': link=' + m[1]);
      else assert.ok(FLAG_WORDS.has(f), r[0] + ': flag ' + f);
    }
  }
  // the levels span the whole scale (a catalogue that is all level 3 would be useless for sorting)
  const levels = new Set(ROWS.map((r) => r[2]));
  for (const lv of [1, 2, 3, 4, 5]) assert.ok(levels.has(lv), 'no row of level ' + lv);
});

test('catalogue: every row compiles in the pattern language', () => {
  for (const r of ROWS) {
    let c;
    assert.doesNotThrow(() => { c = K.Patterns.compile(r); }, r[0]);
    assert.equal(c.form, r[0]); assert.ok(c.variants.length >= 1);
    assert.equal(c.kind, /\bend\b/.test(r[7] || '') ? 'ending' : 'pattern');
  }
});

test('catalogue: every example sentence makes the analyser report its own row', () => {
  const sa = pack.sentences;
  const failing = [];
  for (const r of ROWS) {
    for (const [ko] of r[6]) {
      const ids = [];
      eachSentence(sa, ko, { all: true }, (res) => res.patterns.forEach((p) => ids.push(p.id)));
      if (!ids.includes(r[0])) failing.push(r[0] + ' ← ' + ko + '   (found: ' + (ids.join(' · ') || 'nothing') + ')');
    }
  }
  assert.deepEqual(failing, [], 'examples that do not produce their own pattern');
});

test('catalogue: every word of every example is in the dictionary and analysed with no unknown / spaceless-guess / misspelling reading', () => {
  const sa = pack.sentences, bad = new Map();
  let words = 0;
  for (const r of ROWS) {
    for (const [ko] of r[6]) {
      eachSentence(sa, ko, {}, (res) => {
        for (const s of res.segments) {
          words++;
          if (s.type === 'unknown' || s.type === 'segmented' || s.type === 'misspelled' || s.role === 'unk') bad.set(s.text + ':' + s.type, r[0] + ' ← ' + ko);
        }
      });
    }
  }
  assert.ok(words > 1500, 'checked ' + words + ' words');
  assert.deepEqual(Array.from(bad), [], 'words the learner would see flagged as unknown inside the examples');
});

test('catalogue: a pattern is reported once per place, with a level, a meaning and a category label for the UI', () => {
  const r = pack.analyzeSentence('저는 한국어를 공부하고 싶어요.', { all: true });
  assert.ok(r, 'analysed');
  const titles = r.patterns.map((p) => p.title);
  assert.equal(new Set(titles.map((t, i) => t + '@' + r.patterns[i].text)).size, titles.length, 'no duplicates: ' + titles.join(', '));
  const want = r.patterns.find((p) => p.title === 'V-고 싶다');
  assert.ok(want, 'V-고 싶다 found among ' + titles.join(', '));
  assert.equal(want.kind, 'pattern'); assert.ok(want.level >= 1 && want.level <= 6);
  assert.ok(want.meaning && want.categoryLabel, 'meaning + category label'); assert.equal(want.confidence, 'high');
  assert.ok(want.examples.length >= 2 && want.examples[0].text && want.examples[0].translation);
});
