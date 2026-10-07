#!/usr/bin/env node
/* Compiles data/korean/dictionary.src.txt -> data/korean/dictionary.json.
 *
 * Source line:  headword|pos|meaning 1; meaning 2|flag|example (ko::vi)
 *   - A headword may repeat: later senses are merged (with a POS label when the POS differs).
 *   - "#priority: w1 w2 ..." lines pin the most frequent words to the front (rank = position in the JSON).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const POS_VI = { n: 'danh từ', pron: 'đại từ', num: 'số từ', cnt: 'đơn vị đếm', nbound: 'danh từ phụ thuộc', det: 'định từ', adv: 'phó từ',
  int: 'thán từ', conj: 'liên từ', v: 'động từ', adj: 'tính từ', aux: 'trợ động từ', cop: 'từ “là”', phrase: 'cụm từ' };
const VALID_POS = new Set(Object.keys(POS_VI));
const IRR = new Set(['ㅂ', 'ㄷ', 'ㅅ', 'ㅎ', '르', 'reg']);
// Homographs: the sense listed here becomes primary (its meanings come first and are used in summaries).
const PRIMARY_POS = { 일: 'n', 이: 'det', 그: 'det', 네: 'int', 예: 'int', 저: 'pron', 나: 'pron', 배: 'n', 눈: 'n', 말: 'n', 달: 'n', 해: 'n', 차: 'n', 신: 'n', 적: 'n', 사: 'num', 오: 'num' };

function build(srcPath) {
  const errors = [];
  const priority = [];
  const groups = new Map(); // headword -> rows (in file order); Map keeps first-appearance order
  fs.readFileSync(srcPath, 'utf8').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (line.startsWith('#priority:')) { priority.push(...line.slice(10).trim().split(/\s+/)); return; }
    if (!line || line.startsWith('#')) return;
    const f = line.split('|');
    const word = (f[0] || '').trim().normalize('NFC'), pos = (f[1] || '').trim(), mean = (f[2] || '').trim(), flag = (f[3] || '').trim(), ex = (f[4] || '').trim();
    if (!word || !VALID_POS.has(pos) || !mean) { errors.push(`line ${i + 1}: invalid "${line}"`); return; }
    if (flag && !IRR.has(flag)) { errors.push(`line ${i + 1}: bad flag "${flag}"`); return; }
    if (!groups.has(word)) groups.set(word, []);
    groups.get(word).push({ pos, meanings: mean.split(';').map((s) => s.trim()).filter(Boolean), flag, ex });
  });

  const entries = new Map();
  for (const [word, rows] of groups) {
    if (PRIMARY_POS[word]) rows.sort((a, b) => (a.pos === PRIMARY_POS[word] ? 0 : 1) - (b.pos === PRIMARY_POS[word] ? 0 : 1));
    const e = { pos: rows[0].pos, meanings: [] };
    for (const r of rows) {
      const ms = r.pos === e.pos ? r.meanings : r.meanings.map((m) => `${POS_VI[r.pos]}: ${m}`);
      for (const m of ms) if (!e.meanings.includes(m)) e.meanings.push(m);
      if (r.flag && !e.irr) e.irr = r.flag;
      if (r.ex) (e.examples = e.examples || []).push(r.ex.split('::').map((s) => s.trim()));
    }
    entries.set(word, e);
  }

  const obj = {};
  for (const w of priority) {
    const k = w.normalize('NFC');
    if (!entries.has(k)) errors.push('priority word not in dictionary: ' + w);
    else obj[k] = entries.get(k);
  }
  for (const [k, v] of entries) if (!(k in obj)) obj[k] = v;
  return { errors, data: { meta: { language: 'ko', glossLanguage: 'vi', version: 1, entries: entries.size,
    license: 'MIT (original starter vocabulary by the LinguaFlow authors)', note: 'Entry order is a rough frequency ranking.' }, entries: obj } };
}

if (require.main === module) {
  const root = path.join(__dirname, '..');
  const { errors, data } = build(path.join(root, 'data/korean/dictionary.src.txt'));
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  const out = path.join(root, 'data/korean/dictionary.json');
  fs.writeFileSync(out, JSON.stringify(data));
  console.log(`dictionary.json: ${data.meta.entries} entries, ${(fs.statSync(out).size / 1024).toFixed(1)} KB`);
}
module.exports = { build };
