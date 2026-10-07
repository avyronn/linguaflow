/* Korean tokenizer (eojeol level). Splits subtitle text into Hangul words, numbers, Latin words, jamo
 * (ㅋㅋ, ㅠㅠ), punctuation, symbols and spaces — so "있었어요?" becomes 있었어요 + ?, and "1945년" becomes
 * 1945 + 년. Offsets always refer to the ORIGINAL string (no normalization) so tokens can be mapped back
 * onto DOM text nodes. Morpheme-level splitting (어디 + 에) is done later by morphology.js.
 */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  const K = LF.Korean || (LF.Korean = {});

  const RE_SPACE = /[\s\u200B-\u200F\u2028\u2029\u2060\uFEFF]/u;
  const RE_DIGIT = /\p{Nd}/u;
  const RE_LETTER = /[\p{L}\p{M}]/u;
  const RE_PUNCT = /\p{P}/u;

  function classOf(ch) {
    const cp = ch.codePointAt(0);
    if ((cp >= 0xAC00 && cp <= 0xD7A3) || (cp >= 0x1100 && cp <= 0x11FF) || (cp >= 0xA960 && cp <= 0xA97F) || (cp >= 0xD7B0 && cp <= 0xD7FF)) return 'word';
    if (cp >= 0x3131 && cp <= 0x318E) return 'jamo';
    if (RE_SPACE.test(ch)) return 'space';
    if (RE_DIGIT.test(ch)) return 'number';
    if (RE_LETTER.test(ch)) return 'latin'; // every non-Hangul letter (Latin, Vietnamese, Kana, Han ...)
    if (RE_PUNCT.test(ch)) return 'punct';
    return 'symbol';
  }

  /** @returns {{text:string,start:number,end:number,type:string,clickable:boolean}[]} */
  function tokenize(text) {
    const s = String(text == null ? '' : text);
    const out = [];
    let cur = null, i = 0;
    for (const ch of s) {
      const t = classOf(ch);
      // combining marks stick to the preceding letter run (Vietnamese NFD text)
      const isMark = /\p{M}/u.test(ch) && cur && cur.type === 'latin';
      if (cur && (cur.type === t || isMark)) { cur.text += ch; cur.end = i + ch.length; }
      else { cur = { text: ch, start: i, end: i + ch.length, type: t, clickable: t === 'word' }; out.push(cur); }
      i += ch.length;
    }
    return out;
  }

  const words = (text) => tokenize(text).filter((t) => t.clickable);

  K.Tokenizer = { tokenize, words, classOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = K.Tokenizer;
})(typeof globalThis !== 'undefined' ? globalThis : this);
