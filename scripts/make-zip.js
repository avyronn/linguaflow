#!/usr/bin/env node
/* Dependency-free ZIP packager (uses only Node's zlib), so build.sh needs neither `zip` nor `unzip`.
 *   node scripts/make-zip.js extension dist/linguaflow-<version>.zip [--stage DIR]
 *   node scripts/make-zip.js source    dist/linguaflow-<version>-source.zip
 * "extension" = only what Firefox needs (manifest.json at the zip root) plus the license and the notices; --stage also copies those files to DIR (for web-ext lint).
 * "source"    = the whole project except node_modules, dist and .git. */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const EXT_ITEMS = ['manifest.json', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'README.md', 'icons', 'src', 'data/korean/dictionary.json'];
const SRC_SKIP = new Set(['node_modules', 'dist', '.git', '.DS_Store']);

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function dosTime(d) { return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() }; }

function walk(rel, out, skip) {
  const abs = path.join(ROOT, rel);
  const st = fs.statSync(abs);
  if (st.isDirectory()) {
    for (const name of fs.readdirSync(abs).sort()) { if (skip && skip.has(name)) continue; walk(path.posix.join(rel.split(path.sep).join('/'), name), out, skip); }
  } else out.push(rel.split(path.sep).join('/'));
  return out;
}

function writeZip(outPath, files) {
  const chunks = [], central = [];
  let offset = 0;
  for (const rel of files) {
    const abs = path.join(ROOT, rel), data = fs.readFileSync(abs), st = fs.statSync(abs);
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const name = Buffer.from(rel, 'utf8');
    const { time, date } = dosTime(st.mtime);
    const crc = crc32(data), method = useDeflate ? 8 : 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10); local.writeUInt16LE(date, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    chunks.push(local, name, body);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE((3 << 8) | 20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(method, 10);
    cen.writeUInt16LE(time, 12); cen.writeUInt16LE(date, 14); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(body.length, 20); cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(name.length, 28); cen.writeUInt32LE(((st.mode & 0o111 ? 0o100755 : 0o100644) << 16) >>> 0, 38); cen.writeUInt32LE(offset, 42);
    central.push(cen, name);
    offset += local.length + name.length + body.length;
  }
  const cdSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cdSize, 12); end.writeUInt32LE(offset, 16);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.concat([...chunks, ...central, end]));
}

function main() {
  const [mode, out, flag, stage] = process.argv.slice(2);
  if (!['extension', 'source'].includes(mode) || !out) { console.error('usage: make-zip.js <extension|source> <out.zip> [--stage DIR]'); process.exit(2); }
  const files = mode === 'extension' ? EXT_ITEMS.flatMap((i) => walk(i, [], null)) : walk('.', [], SRC_SKIP).map((f) => f.replace(/^\.\//, ''));
  writeZip(path.resolve(out), files);
  if (flag === '--stage' && stage) {
    fs.rmSync(stage, { recursive: true, force: true });
    for (const f of files) { const dst = path.join(stage, f); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), dst); }
  }
  console.log(`  ${mode}: ${files.length} files → ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
}
if (require.main === module) main();
module.exports = { crc32, EXT_ITEMS };
