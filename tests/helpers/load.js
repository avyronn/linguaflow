/* Loads the extension's classic scripts in manifest order into Node (same order the browser uses),
 * so unit tests exercise exactly the files that ship. Browser-only entry points are skipped. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const SKIP = new Set(['src/content/content-main.js']);

function manifestScripts() {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  return m.content_scripts[0].js.filter((f) => !SKIP.has(f));
}
function loadAll() {
  for (const f of manifestScripts()) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue; // allow partial trees while developing
    require(p);
  }
  return globalThis.LinguaFlow;
}
function dictionaryData() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'data/korean/dictionary.json'), 'utf8'));
}
/** A ready Korean pack backed by the real bundled dictionary (no browser needed). */
async function koreanPack() {
  const LF = loadAll();
  const pack = new LF.Korean.KoreanLanguagePack({ dictionaries: new LF.DictionaryManager(), data: dictionaryData() });
  await pack.init();
  return pack;
}
module.exports = { ROOT, loadAll, koreanPack, dictionaryData, manifestScripts };
