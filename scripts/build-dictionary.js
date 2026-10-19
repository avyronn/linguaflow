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
const IRR = new Set(['ㅂ', 'ㄷ', 'ㅅ', 'ㅎ', '르', '러', 'reg']);
// Homographs: the sense listed here becomes primary (its meanings come first and are used in summaries).
const PRIMARY_POS = { 일: 'n', 이: 'det', 그: 'det', 네: 'int', 예: 'int', 저: 'pron', 나: 'pron', 배: 'n', 눈: 'n', 말: 'n', 달: 'n', 해: 'n', 차: 'n', 신: 'n', 적: 'n', 사: 'num', 오: 'num', 새: 'det', 딴: 'det' };

function parseFile(file, groups, priority, errors, seenPairs, isExtra) {
  let skipped = 0;
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (line.startsWith('#priority:')) { priority.push(...line.slice(10).trim().split(/\s+/)); return; }
    if (!line || line.startsWith('#')) return;
    const f = line.split('|');
    const word = (f[0] || '').trim().normalize('NFC'), pos = (f[1] || '').trim(), mean = (f[2] || '').trim(), flag = (f[3] || '').trim(), ex = (f[4] || '').trim();
    const where = `${path.basename(file)}:${i + 1}`;
    if (!word || !VALID_POS.has(pos) || !mean) { errors.push(`${where}: invalid "${line}"`); return; }
    if (flag && !IRR.has(flag)) { errors.push(`${where}: bad flag "${flag}"`); return; }
    // meanings are split on ';' - a ';' inside parentheses would cut the explanation in two (write ',' there)
    let depth = 0, cut = false;
    for (const ch of mean) { if (ch === '(') depth++; else if (ch === ')') depth = Math.max(0, depth - 1); else if (ch === ';' && depth > 0) cut = true; }
    if (cut) { errors.push(`${where}: ';' inside parentheses of the meaning "${mean}" (use ',')`); return; }
    const key = word + '|' + pos;
    if (isExtra && seenPairs.has(key)) { skipped++; return; } // never silently redefine a word that an earlier file already defines
    if (!isExtra) seenPairs.add(key);
    if (!groups.has(word)) groups.set(word, []);
    groups.get(word).push({ pos, meanings: mean.split(';').map((s) => s.trim()).filter(Boolean), flag, ex, extraFile: isExtra ? key : null });
  });
  return skipped;
}

/** @param {string} rootDir project root */
function build(rootDir) {
  const errors = [], priority = [], groups = new Map(), seenPairs = new Set();
  const dir = path.join(rootDir, 'data/korean');
  parseFile(path.join(dir, 'dictionary.src.txt'), groups, priority, errors, seenPairs, false);
  const srcDir = path.join(dir, 'sources');
  const extras = fs.existsSync(srcDir) ? fs.readdirSync(srcDir).filter((f) => f.endsWith('.txt')).sort() : [];
  let skipped = 0;
  for (const f of extras) {
    skipped += parseFile(path.join(srcDir, f), groups, priority, errors, seenPairs, true);
    // pairs defined by this file become "seen" for the files after it
    for (const [w, rows] of groups) for (const r of rows) if (r.extraFile) { seenPairs.add(r.extraFile); r.extraFile = null; }
  }

  const entries = new Map();
  for (const [word, rows] of groups) {
    if (PRIMARY_POS[word]) rows.sort((a, b) => (a.pos === PRIMARY_POS[word] ? 0 : 1) - (b.pos === PRIMARY_POS[word] ? 0 : 1));
    const e = { pos: rows[0].pos, meanings: [] };
    for (const r of rows) {
      const ms = r.pos === e.pos ? r.meanings : r.meanings.map((m) => `${POS_VI[r.pos]}: ${m}`);
      for (const m of ms) if (!e.meanings.includes(m)) e.meanings.push(m);
      if (r.pos !== e.pos) { // keep the senses of the other parts of speech apart (morphology picks the nominal one for "그는", ...)
        e.alt = e.alt || [];
        let g = e.alt.find((x) => x.pos === r.pos);
        if (!g) e.alt.push(g = { pos: r.pos, meanings: [] });
        for (const m of r.meanings) if (!g.meanings.includes(m)) g.meanings.push(m);
      }
      if (r.flag && !e.irr) e.irr = r.flag;
      if (r.ex) (e.examples = e.examples || []).push(r.ex.split('::').map((s) => s.trim()));
    }
    entries.set(word, e);
  }

  // Sino-Korean annotations: word|hanja|Hán-Việt
  const hanjaFile = path.join(dir, 'hanja.txt');
  if (fs.existsSync(hanjaFile)) {
    fs.readFileSync(hanjaFile, 'utf8').split(/\r?\n/).forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line.startsWith('#')) return;
      const [w, hanja, hv] = line.split('|').map((x) => (x || '').trim());
      const e = entries.get((w || '').normalize('NFC'));
      if (!e || !hanja || !hv) { errors.push(`hanja.txt:${i + 1}: unknown word or incomplete line "${line}"`); return; }
      e.hanja = hanja; e.hv = hv;
    });
  }

  const obj = {};
  for (const w of priority) {
    const k = w.normalize('NFC');
    if (!entries.has(k)) errors.push('priority word not in dictionary: ' + w);
    else obj[k] = entries.get(k);
  }
  for (const [k, v] of entries) if (!(k in obj)) obj[k] = v;
  return { errors, skipped, data: { meta: { language: 'ko', glossLanguage: 'vi', version: 2, entries: entries.size,
    license: 'MIT (original vocabulary by the LinguaFlow authors)', note: 'Entry order is a rough frequency ranking.' }, entries: obj } };
}

if (require.main === module) {
  const root = path.join(__dirname, '..');
  const { errors, skipped, data } = build(root);
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  if (skipped) console.log(`(${skipped} rows in sources/ ignored: word+POS already defined earlier)`);
  const out = path.join(root, 'data/korean/dictionary.json');
  fs.writeFileSync(out, JSON.stringify(data));
  console.log(`dictionary.json: ${data.meta.entries} entries, ${(fs.statSync(out).size / 1024).toFixed(1)} KB`);
}
module.exports = { build };
