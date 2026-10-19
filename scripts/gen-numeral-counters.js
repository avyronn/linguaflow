#!/usr/bin/env node
/* Generates data/korean/sources/87-numeral-counters.txt: the native determiners 한 두 세 네 (1-4) written together with a counter
 * (두명, 세잔, 네시간 ...). Spaced writing ("두 명") is the standard, but subtitles often join them; listing the joined forms
 * makes them known words with the right gloss instead of leaving them to the best-effort spaceless segmentation.
 * Usage: node scripts/gen-numeral-counters.js   (rewrites the source file; then run scripts/build-dictionary.js) */
'use strict';
const fs = require('fs');
const path = require('path');

const NUMS = [['한', 'một'], ['두', 'hai'], ['세', 'ba'], ['네', 'bốn']];
// counter -> Vietnamese noun phrase that follows the number
const COUNTERS = [
  ['개', 'cái'], ['명', 'người'], ['사람', 'người'], ['분', 'vị (kính ngữ)'], ['마리', 'con'], ['권', 'quyển'], ['장', 'tờ; tấm'], ['잔', 'ly; chén'],
  ['병', 'chai'], ['컵', 'cốc'], ['그릇', 'bát'], ['접시', 'đĩa'], ['봉지', 'túi'], ['상자', 'hộp'], ['송이', 'bông; chùm'], ['켤레', 'đôi (giày, tất)'],
  ['조각', 'miếng; mảnh'], ['가지', 'loại; thứ'], ['군데', 'chỗ'], ['곳', 'chỗ; nơi'], ['대', 'chiếc (xe, máy)'], ['층', 'tầng'], ['번', 'lần'],
  ['번째', 'lần thứ; thứ'], ['시', 'giờ'], ['시간', 'tiếng; giờ'], ['살', 'tuổi'], ['달', 'tháng'], ['해', 'năm'], ['주일', 'tuần'], ['주', 'tuần'], ['날', 'ngày'],
];
/** The text of the generated source file (pure: nothing is written here, so a test can compare it with the committed file). */
function generate() {
  const lines = ['# ===== số đếm thuần Hàn 1–4 viết liền với đơn vị đếm (sinh tự động bởi scripts/gen-numeral-counters.js) ====='];
  for (const [n, nv] of NUMS) {
    for (const [c, cv] of COUNTERS) {
      const mean = c === '번째' ? `thứ ${nv}; lần thứ ${nv}` : cv.split('; ').map((x) => nv + ' ' + x).join('; ');
      lines.push(`${n}${c}|n|${mean} (= ${n} ${c})`);
    }
  }
  return lines.join('\n') + '\n';
}
const OUT = path.join(__dirname, '..', 'data/korean/sources/87-numeral-counters.txt');

if (require.main === module) {
  const text = generate();
  fs.writeFileSync(OUT, text);
  console.log('wrote', text.split('\n').filter((l) => l && !l.startsWith('#')).length, 'rows to', path.relative(process.cwd(), OUT));
}
module.exports = { generate, OUT, NUMS, COUNTERS };
