'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { koreanPack, dictionaryData, ROOT } = require('../helpers/load.js');
const { build } = require(path.join(ROOT, 'scripts/build-dictionary.js'));

test('dictionary.json is in sync with dictionary.src.txt and has no build errors', () => {
  const { errors, data } = build(ROOT);
  assert.deepEqual(errors, []);
  assert.deepEqual(data.entries, dictionaryData().entries, 'run `npm run dict` after editing dictionary.src.txt');
  assert.equal(data.meta.entries, Object.keys(data.entries).length);
  assert.ok(data.meta.entries >= 1300);
});
test('dictionary entries are well-formed', () => {
  const { entries } = dictionaryData();
  const POS = new Set(['n', 'pron', 'num', 'cnt', 'nbound', 'det', 'adv', 'int', 'conj', 'v', 'adj', 'aux', 'cop', 'phrase']);
  const bad = [];
  for (const [w, e] of Object.entries(entries)) {
    if (w !== w.normalize('NFC')) bad.push('not NFC: ' + w);
    if (!POS.has(e.pos)) bad.push('pos: ' + w);
    if (!Array.isArray(e.meanings) || !e.meanings.length || e.meanings.some((m) => !m || m !== m.trim())) bad.push('meanings: ' + w);
    if (['v', 'adj', 'aux', 'cop'].includes(e.pos) && !w.endsWith('다')) bad.push('predicate without 다: ' + w);
    if (e.irr && !['ㅂ', 'ㄷ', 'ㅅ', 'ㅎ', '르', '러', 'reg'].includes(e.irr)) bad.push('irr: ' + w);
  }
  assert.deepEqual(bad, []);
});
test('every predicate lemma round-trips: conjugate it, analyse the result, get the lemma back', async () => {
  const pack = await koreanPack();
  const LF = globalThis.LinguaFlow, K = LF.Korean;
  const Y = K.Endings.ENDINGS.find((e) => e.id === '-아요/어요'), B = K.Endings.ENDINGS.find((e) => e.id === '-ㅂ니다/습니다');
  const bad = [];
  let n = 0;
  for (const [lemma, e] of pack.dictionary.manager.entries('ko')) {
    if (!['v', 'adj', 'aux'].includes(e.pos) || lemma === '이다' || lemma.length < 2) continue;
    const info = pack.morphology._stemInfoFromEntry(lemma, pack.dictionary.get(lemma));
    for (const [combo, spec] of [[[], Y], [['P'], Y], [[], B]]) {
      for (const form of K.Conjugation.conjugate(info, combo, spec)) {
        n++;
        const a = pack.analyzeWord(form);
        const ok = a.lemma === lemma || a.alternatives.some((x) => x.lemma === lemma) || (a.type === 'word');
        if (!ok) bad.push(`${lemma} → ${form}: got ${a.lemma}/${a.type}`);
      }
    }
  }
  assert.ok(n > 1000, 'expected many forms, got ' + n);
  assert.deepEqual(bad.slice(0, 15), []);
});
test('lookup of unknown words resolves to null at the dictionary level (no fake entries)', async () => {
  const pack = await koreanPack();
  assert.equal(await pack.dictionary.lookup('쿼카'), null);
  assert.equal(pack.dictionary.get('먹다').pos, 'v');
  assert.equal(pack.dictionary.get('일').pos, 'n'); // homograph: primary sense first
  assert.ok(pack.dictionary.get('일').meanings.some((m) => m.startsWith('số từ:')));
});

test('hanja.txt: every Sino-Korean word has one Hanja per syllable and one Hán-Việt syllable per Hanja', () => {
  const { entries } = dictionaryData();
  const rows = Object.entries(entries).filter(([, e]) => e.hanja);
  assert.ok(rows.length >= 200, 'the starter set of Sino-Korean words is present');
  const bad = [];
  for (const [w, e] of rows) {
    const han = (e.hanja.match(/[\u4E00-\u9FFF]/g) || []).length;
    const syllables = e.hv ? e.hv.replace(/\s*\(.*\)\s*$/, '').trim().split(/\s+/).length : 0;
    if (!han) bad.push(w + ': no Hanja in "' + e.hanja + '"');
    else if (e.hanja.length !== w.length) bad.push(w + ': ' + e.hanja + ' does not match the syllables of the word');
    else if (syllables !== han) bad.push(w + ': ' + e.hv + ' has ' + syllables + ' syllable(s) for ' + han + ' Hanja');
  }
  assert.deepEqual(bad, []);
});
test('lookup() carries the etymology line (Hanja + Hán-Việt) of a word; a 하다 / 되다 verb borrows it from its Sino-Korean noun (and says which)', async () => {
  const pack = await koreanPack();
  const own = await pack.lookup('학교에서');
  assert.deepEqual([own.lemma, own.etymology], ['학교', { label: 'Hán tự · Hán-Việt', text: '學校', reading: 'học hiệu (trường học)', root: null, rootLabel: null }]);
  const verb = await pack.lookup('준비했어요');
  assert.deepEqual([verb.lemma, verb.etymology], ['준비하다', { label: 'Hán tự · Hán-Việt', text: '準備', reading: 'chuẩn bị', root: '준비', rootLabel: 'từ gốc' }]);
  const passive = await pack.lookup('시작됐어요');
  assert.deepEqual([passive.lemma, passive.etymology.text, passive.etymology.root], ['시작되다', '始作', '시작']);
  for (const w of ['사람이', '오늘', '하다', '먹었어요', '쿵쾅쿵쾅']) { // native words, the bare verb 하다 and an unknown word: nothing is invented
    assert.equal((await pack.lookup(w)).etymology, null, w);
  }
});
