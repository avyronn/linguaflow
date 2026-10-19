/* Korean numerals written as one word, e.g. 삼십오 (35), 이천이십사 (2024), 열두 (12), 스물세 (23).
 *   parse(str) -> { value, kind: 'sino' | 'native' } | null      (null = not a number)
 *   entry(str, parsed) -> a dictionary-shaped entry for the number
 * The dictionary only lists the single-word numbers (일, 십, 열, 스물 ...); this module recognises the compounds so that
 * "삼십오분" or "열두시" can be split into number + unit instead of being reported as an unknown word. */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  const K = LF.Korean || (LF.Korean = {});

  const SINO_DIGIT = { 영: 0, 공: 0, 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 };
  const SINO_SMALL = { 십: 10, 백: 100, 천: 1000 };
  const SINO_BIG = { 만: 1e4, 억: 1e8, 조: 1e12 };
  // native numbers: units (as a number / before a counter) and tens. 스무 (20) only stands alone; 석 / 넉 only stand alone too.
  const NATIVE_ONES = [['하나', 1], ['한', 1], ['둘', 2], ['두', 2], ['셋', 3], ['세', 3], ['넷', 4], ['네', 4], ['다섯', 5], ['여섯', 6], ['일곱', 7], ['여덟', 8], ['아홉', 9]];
  const NATIVE_ALONE = [['석', 3], ['넉', 4], ['스무', 20]];
  const NATIVE_TENS = [['열', 10], ['스물', 20], ['서른', 30], ['마흔', 40], ['쉰', 50], ['예순', 60], ['일흔', 70], ['여든', 80], ['아흔', 90]];

  function parseSino(str) {
    const chars = Array.from(str);
    let total = 0, section = 0, cur = null, lastSmall = 10000, lastBig = Infinity;
    for (const ch of chars) {
      if (Object.prototype.hasOwnProperty.call(SINO_DIGIT, ch)) {
        if (cur !== null) return null; // 이삼 / 공일공: digits side by side are not one number
        cur = SINO_DIGIT[ch];
      } else if (Object.prototype.hasOwnProperty.call(SINO_SMALL, ch)) {
        const u = SINO_SMALL[ch];
        if (u >= lastSmall) return null; // 십백, 십십: units go from large to small
        if (cur === 0) return null;
        section += (cur === null ? 1 : cur) * u; cur = null; lastSmall = u;
      } else if (Object.prototype.hasOwnProperty.call(SINO_BIG, ch)) {
        const u = SINO_BIG[ch];
        if (u >= lastBig) return null;
        section += cur === null ? 0 : cur;
        total += (section === 0 ? 1 : section) * u; section = 0; cur = null; lastSmall = 10000; lastBig = u;
      } else return null;
    }
    return total + section + (cur === null ? 0 : cur);
  }

  function parseNative(str) {
    for (const [f, v] of NATIVE_TENS.concat(NATIVE_ALONE, NATIVE_ONES)) if (str === f) return v;
    for (const [t, tv] of NATIVE_TENS) {
      if (!str.startsWith(t) || str.length === t.length) continue;
      const rest = str.slice(t.length);
      for (const [o, ov] of NATIVE_ONES) if (o === rest) return tv + ov;
    }
    return null;
  }

  /** @returns {{value:number, kind:'sino'|'native'}|null} */
  function parse(str) {
    const s = String(str || '').normalize('NFC');
    if (!s || !/^[가-힣]+$/.test(s)) return null;
    const native = parseNative(s);
    if (native !== null) return { value: native, kind: 'native' };
    const sino = parseSino(s);
    if (sino !== null) return { value: sino, kind: 'sino' };
    return null;
  }

  const fmt = (n) => (n >= 10000 ? n.toLocaleString('en-US') : String(n));
  function entry(str, parsed) {
    const kindLabel = parsed.kind === 'native' ? 'số thuần Hàn' : 'số Hán Hàn';
    return { word: str, pos: 'num', meanings: [fmt(parsed.value) + ' (' + kindLabel + ')'], synthesized: true, numeral: parsed };
  }

  K.Numerals = { parse, entry };
  if (typeof module !== 'undefined' && module.exports) module.exports = K.Numerals;
})(typeof globalThis !== 'undefined' ? globalThis : this);
