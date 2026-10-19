'use strict';
/* The Korean dictionary is built from plain-text sources (data/korean/dictionary.src.txt, data/korean/sources/*.txt, hanja.txt) by
 * scripts/build-dictionary.js, and shipped as data/korean/dictionary.json. Contributors add words by editing text files, so the build is the
 * gatekeeper: these tests pin what it rejects, how it merges, that the shipped file is exactly what the sources produce, and that nothing in
 * the shipped data is malformed. A temporary source tree is used for the negative controls (the real sources are never touched). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ROOT, dictionaryData } = require('../helpers/load.js');
const { build } = require(path.join(ROOT, 'scripts/build-dictionary.js'));
const counters = require(path.join(ROOT, 'scripts/gen-numeral-counters.js'));

const made = [];
/** a throw-away project tree: files = { 'dictionary.src.txt': '...', 'sources/10-x.txt': '...', 'hanja.txt': '...' } */
function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lf-dict-'));
  made.push(root);
  const dir = path.join(root, 'data/korean');
  fs.mkdirSync(path.join(dir, 'sources'), { recursive: true });
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  return root;
}
test.after(() => { for (const r of made) fs.rmSync(r, { recursive: true, force: true }); });

// ---- what the build rejects (negative controls) -------------------------------------------------------------------------------------
const BAD = [
  ['an unknown part of speech', '가나다|zz|x', /invalid "가나다\|zz\|x"/],
  ['a line without a meaning', '가나다|n|', /invalid/],
  ['a line without a part of speech', '가나다', /invalid/],
  ['a flag that is not an irregularity class', '가다|v|đi|xx', /bad flag "xx"/],
  ['a semicolon inside parentheses of a meaning', '가나다|n|cây (to; nhỏ)', /';' inside parentheses/],
  ['a priority word that is not in the dictionary', '가나다|n|cây\n#priority: 없는말', /priority word not in dictionary: 없는말/],
];
test('build errors: bad part of speech, missing meaning, bad flag, ";" inside parentheses, unknown priority word - each is reported on its own', () => {
  for (const [what, src, re] of BAD) {
    const { errors } = build(tree({ 'dictionary.src.txt': src + '\n' }));
    assert.equal(errors.length, 1, `${what}: ${JSON.stringify(errors)}`);
    assert.match(errors[0], re, what);
  }
});
test('build errors carry the file and the line number, so a contributor can find the row', () => {
  const root = tree({ 'dictionary.src.txt': '나무|n|cây\n', 'sources/10-more.txt': '# comment\n\n하늘|n|trời\n바다|zz|biển\n' });
  const { errors } = build(root);
  assert.equal(errors.length, 1); assert.match(errors[0], /^10-more\.txt:4: invalid/);
});
test('a ";" outside parentheses is the separator between meanings; inside parentheses it is refused; "," is fine there', () => {
  const ok = build(tree({ 'dictionary.src.txt': '가나다|n|cây (to, nhỏ); gỗ (cứng; mềm)\n'.replace('(cứng; mềm)', '(cứng, mềm)') }));
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.data.entries['가나다'].meanings, ['cây (to, nhỏ)', 'gỗ (cứng, mềm)']);
  const bad = build(tree({ 'dictionary.src.txt': '가나다|n|cây (to, nhỏ); gỗ (cứng; mềm)\n' }));
  assert.equal(bad.errors.length, 1);
});
test('hanja.txt: a line for a word that is not in the dictionary, or an incomplete line, is an error', () => {
  const src = '학생|n|học sinh\n';
  assert.deepEqual(build(tree({ 'dictionary.src.txt': src, 'hanja.txt': '학생|學生|học sinh\n' })).errors, []);
  assert.match(build(tree({ 'dictionary.src.txt': src, 'hanja.txt': '선생|先生|tiên sinh\n' })).errors[0], /hanja\.txt:1: unknown word or incomplete line/);
  assert.match(build(tree({ 'dictionary.src.txt': src, 'hanja.txt': '학생|學生\n' })).errors[0], /incomplete/);
  assert.deepEqual(build(tree({ 'dictionary.src.txt': src, 'hanja.txt': '학생|學生|học sinh\n' })).data.entries['학생'].hanja, '學生');
});

// ---- how rows are merged --------------------------------------------------------------------------------------------------------------
test('merging: the main file may repeat a word (senses are added); a file in sources/ never redefines a word+POS an earlier file has', () => {
  const root = tree({
    'dictionary.src.txt': '나무|n|cây\n나무|n|gỗ|reg|이 책상은 나무예요.::Cái bàn này bằng gỗ.\n',
    'sources/10-a.txt': '나무|n|rừng (sai)\n하늘|n|trời\n',
    'sources/20-b.txt': '하늘|n|bầu trời (bị bỏ qua)\n하늘|adv|một cách cao vời\n',
  });
  const { errors, skipped, data } = build(root);
  assert.deepEqual(errors, []);
  assert.equal(skipped, 2, 'the two re-definitions are ignored, and counted');
  assert.deepEqual(data.entries['나무'].meanings, ['cây', 'gỗ']);
  assert.deepEqual(data.entries['나무'].examples, [['이 책상은 나무예요.', 'Cái bàn này bằng gỗ.']]);
  assert.equal(data.entries['나무'].irr, 'reg');
  // a different part of speech is added, labelled, and kept apart in `alt`
  assert.equal(data.entries['하늘'].pos, 'n');
  assert.deepEqual(data.entries['하늘'].meanings, ['trời', 'phó từ: một cách cao vời']);
  assert.deepEqual(data.entries['하늘'].alt, [{ pos: 'adv', meanings: ['một cách cao vời'] }]);
  assert.equal(data.meta.entries, 2);
});
test('sources/ files are read in file-name order, so numbering decides which definition wins', () => {
  const files = { 'dictionary.src.txt': '# empty\n', 'sources/20-late.txt': '나무|n|từ file muộn\n', 'sources/10-early.txt': '나무|n|từ file sớm\n' };
  assert.deepEqual(build(tree(files)).data.entries['나무'].meanings, ['từ file sớm']);
});
test('homographs: the sense listed in PRIMARY_POS comes first whatever the order of the lines (일 = work, not "one")', () => {
  const { data } = build(tree({ 'dictionary.src.txt': '일|num|một\n일|n|công việc; việc\n' }));
  assert.equal(data.entries['일'].pos, 'n');
  assert.deepEqual(data.entries['일'].meanings, ['công việc', 'việc', 'số từ: một']);
  assert.deepEqual(data.entries['일'].alt, [{ pos: 'num', meanings: ['một'] }]);
});
test('#priority pins the most frequent words to the front of the file (rank = position), the rest keep source order', () => {
  const { data } = build(tree({ 'dictionary.src.txt': '가나|n|a\n다라|n|b\n마바|n|c\n#priority: 마바 가나\n' }));
  assert.deepEqual(Object.keys(data.entries), ['마바', '가나', '다라']);
});
test('headwords are normalised to NFC, so a decomposed Hangul spelling in a source cannot create a second, unmatched entry', () => {
  const nfd = '한국어'.normalize('NFD');
  assert.notEqual(nfd, '한국어');
  const { data } = build(tree({ 'dictionary.src.txt': nfd + '|n|tiếng Hàn\n' }));
  assert.deepEqual(Object.keys(data.entries), ['한국어']);
});
test('comments, blank lines and Windows line endings are fine', () => {
  const { errors, data } = build(tree({ 'dictionary.src.txt': '# title\r\n\r\n나무|n|cây\r\n   \r\n# end\r\n' }));
  assert.deepEqual(errors, []); assert.deepEqual(Object.keys(data.entries), ['나무']);
});

// ---- the shipped file ---------------------------------------------------------------------------------------------------------------------
test('dictionary.json is byte-for-byte what the sources produce (nobody forgot `node scripts/build-dictionary.js`)', () => {
  const { errors, data } = build(ROOT);
  assert.deepEqual(errors, []);
  assert.equal(fs.readFileSync(path.join(ROOT, 'data/korean/dictionary.json'), 'utf8'), JSON.stringify(data));
  assert.equal(data.meta.entries, Object.keys(data.entries).length);
});
test('the generated numeral + counter source (87-numeral-counters.txt) is exactly what scripts/gen-numeral-counters.js writes', () => {
  assert.equal(fs.readFileSync(counters.OUT, 'utf8'), counters.generate());
  assert.equal(counters.generate().split('\n').filter((l) => l && !l.startsWith('#')).length, counters.NUMS.length * counters.COUNTERS.length);
  assert.ok(counters.COUNTERS.every(([c, v]) => /^[가-힣]+$/.test(c) && v.length > 0));
});

const HANGUL_WORD = /^[가-힣]+$/;
test('the shipped dictionary is clean: headwords, parts of speech, meanings, senses of other parts of speech, examples, irregularity and hanja fields', () => {
  const { meta, entries } = dictionaryData();
  const POS = new Set(['n', 'pron', 'num', 'cnt', 'nbound', 'det', 'adv', 'int', 'conj', 'v', 'adj', 'aux', 'cop', 'phrase']);
  const IRR = new Set(['ㅂ', 'ㄷ', 'ㅅ', 'ㅎ', '르', '러', 'reg']);
  const bad = [];
  for (const [w, e] of Object.entries(entries)) {
    // Hangul only - except a fixed expression, which may be several words (잘 먹겠습니다)
    if (!(HANGUL_WORD.test(w) || (e.pos === 'phrase' && /^[가-힣]+( [가-힣]+)+$/.test(w)))) bad.push('headword: ' + w);
    if (!POS.has(e.pos)) bad.push('pos: ' + w);
    if (new Set(e.meanings).size !== e.meanings.length) bad.push('meaning twice: ' + w);
    for (const m of e.meanings) {
      let depth = 0, ok = true;
      for (const ch of m) { if (ch === '(') depth++; else if (ch === ')' && --depth < 0) ok = false; }
      if (depth !== 0 || !ok) bad.push(`parentheses: ${w}: ${m}`);
      if (m !== m.trim() || /\s{2,}/.test(m) || m.length > 220) bad.push(`meaning text: ${w}: ${m.slice(0, 40)}`);
    }
    for (const a of e.alt || []) {
      if (!POS.has(a.pos) || a.pos === e.pos || !a.meanings.length) bad.push('alt: ' + w);
      for (const m of a.meanings) if (!e.meanings.some((x) => x.endsWith(m))) bad.push(`alt meaning not among the meanings: ${w}: ${m}`);
    }
    for (const x of e.examples || []) if (!Array.isArray(x) || x.length !== 2 || !x[0] || !x[1]) bad.push('example: ' + w);
    if (e.irr && !IRR.has(e.irr)) bad.push('irr: ' + w);
    if (e.irr && !['v', 'adj', 'aux'].includes(e.pos) && !(e.alt || []).some((a) => ['v', 'adj'].includes(a.pos))) bad.push('irr on a non-predicate: ' + w);
    if (['v', 'adj', 'aux'].includes(e.pos) && !w.endsWith('다')) bad.push('predicate without 다: ' + w);
    if (!!e.hanja !== !!e.hv) bad.push('hanja without Sino-Vietnamese reading (or the reverse): ' + w);
    if (e.hanja && !/^[一-鿿]+[가-힣]*$/.test(e.hanja)) bad.push('hanja characters: ' + w); // (a native ending may follow: 先生님, 東쪽)
  }
  assert.deepEqual(bad.slice(0, 20), []);
  assert.equal(meta.language, 'ko'); assert.equal(meta.glossLanguage, 'vi'); assert.equal(meta.entries, Object.keys(entries).length);
});
test('the dictionary has the breadth the release promises: ~9,600 entries, thousands of verbs / adjectives, hundreds of expressions', () => {
  const { entries } = dictionaryData();
  const count = (pos) => Object.values(entries).filter((e) => e.pos === pos).length;
  assert.ok(Object.keys(entries).length >= 9500, 'entries: ' + Object.keys(entries).length);
  assert.ok(count('v') >= 1900 && count('adj') >= 700 && count('n') >= 5500 && count('adv') >= 550, `v ${count('v')} adj ${count('adj')} n ${count('n')} adv ${count('adv')}`);
  assert.ok(count('phrase') >= 100 && count('int') >= 100 && count('cnt') >= 50 && count('nbound') >= 30 && count('pron') >= 50);
  assert.ok(Object.values(entries).filter((e) => e.hanja).length >= 200, 'Sino-Korean annotations');
  assert.ok(Object.values(entries).filter((e) => e.irr).length >= 60, 'irregular verbs / adjectives are flagged');
  // the first words are the most frequent ones (rank by position)
  assert.ok(Object.keys(entries).slice(0, 200).some((w) => ['이', '그', '저', '하다', '있다', '없다'].includes(w)));
});
test('the words of the brief are all there: 어디, 사람, 많다, 한국어, 공부하다, 찾다, 있다, 왜, 이렇게, 늦다, 오늘', () => {
  const { entries } = dictionaryData();
  for (const w of ['어디', '사람', '많다', '한국어', '공부하다', '찾다', '있다', '왜', '이렇게', '늦다', '오늘', '저', '그']) assert.ok(entries[w], w);
  assert.equal(entries['어디'].meanings[0], 'đâu');
});
