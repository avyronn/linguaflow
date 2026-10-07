/* Hangul utilities: syllable (de)composition and jamo helpers. Pure functions, no dependencies. */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  const K = LF.Korean || (LF.Korean = {});

  const BASE = 0xAC00, LAST = 0xD7A3;
  const CHO = Array.from('ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ');
  const JUNG = Array.from('ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ');
  const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ',
    'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const COMPOUND = { ㄳ: ['ㄱ', 'ㅅ'], ㄵ: ['ㄴ', 'ㅈ'], ㄶ: ['ㄴ', 'ㅎ'], ㄺ: ['ㄹ', 'ㄱ'], ㄻ: ['ㄹ', 'ㅁ'],
    ㄼ: ['ㄹ', 'ㅂ'], ㄽ: ['ㄹ', 'ㅅ'], ㄾ: ['ㄹ', 'ㅌ'], ㄿ: ['ㄹ', 'ㅍ'], ㅀ: ['ㄹ', 'ㅎ'], ㅄ: ['ㅂ', 'ㅅ'] };
  const MERGE = {};
  for (const k of Object.keys(COMPOUND)) MERGE[COMPOUND[k].join('')] = k;

  const isSyllable = (ch) => { if (!ch) return false; const n = ch.charCodeAt(0); return n >= BASE && n <= LAST; };
  const isCompatJamo = (ch) => { if (!ch) return false; const n = ch.charCodeAt(0); return n >= 0x3131 && n <= 0x318E; };
  const isHangul = (ch) => isSyllable(ch) || isCompatJamo(ch) || (!!ch && ch.charCodeAt(0) >= 0x1100 && ch.charCodeAt(0) <= 0x11FF);
  const hasHangul = (s) => { for (const ch of String(s || '')) if (isHangul(ch)) return true; return false; };

  function parts(ch) {
    if (!ch) return null;
    const n = ch.charCodeAt(0) - BASE;
    if (n < 0 || n > LAST - BASE) return null;
    return { c: CHO[Math.floor(n / 588)], v: JUNG[Math.floor((n % 588) / 28)], f: JONG[n % 28] };
  }
  function build(c, v, f) {
    const ci = CHO.indexOf(c), vi = JUNG.indexOf(v), fi = JONG.indexOf(f || '');
    if (ci < 0 || vi < 0 || fi < 0) return null;
    return String.fromCharCode(BASE + ci * 588 + vi * 28 + fi);
  }
  const last = (s) => (s ? s.slice(-1) : '');
  const jong = (s) => { const p = s && isSyllable(last(s)) ? parts(last(s)) : null; return p ? p.f : ''; };
  const vowel = (s) => { const p = s && isSyllable(last(s)) ? parts(last(s)) : null; return p ? p.v : ''; };
  const cho = (s) => { const p = s && isSyllable(s[0]) ? parts(s[0]) : null; return p ? p.c : ''; };
  const hasBatchim = (s) => jong(s) !== '';
  const withJong = (syl, f) => { const p = parts(syl); return p ? build(p.c, p.v, f) : syl; };
  const withoutJong = (syl) => withJong(syl, '');
  const withVowel = (syl, v) => { const p = parts(syl); return p ? build(p.c, v, p.f) : syl; };
  const dropLastJong = (s) => s.slice(0, -1) + withoutJong(last(s));
  // Add a bare consonant as the final consonant of the last syllable (ㄹ + ㅁ -> ㄻ etc.). null if impossible.
  function addJong(s, bare) {
    const syl = last(s), f = jong(syl);
    if (!f) return s.slice(0, -1) + withJong(syl, bare);
    const m = MERGE[f + bare];
    if (m) return s.slice(0, -1) + withJong(syl, m);
    if (f === bare) return s;
    return null;
  }
  const syllables = (s) => Array.from(s).filter(isSyllable);

  K.Hangul = { CHO, JUNG, JONG, COMPOUND, isSyllable, isCompatJamo, isHangul, hasHangul, parts, build, jong, vowel, cho,
    hasBatchim, withJong, withoutJong, withVowel, dropLastJong, addJong, syllables, last };
  if (typeof module !== 'undefined' && module.exports) module.exports = K.Hangul;
})(typeof globalThis !== 'undefined' ? globalThis : this);
