/* Korean pronunciation (발음 규칙) and Revised Romanization (국어의 로마자 표기법).
 * Implemented rules: final-consonant neutralization, liaison (연음), consonant-cluster simplification,
 * ㅎ aspiration/weakening, nasalization (비음화), lateralization (유음화), palatalization (구개음화),
 * tensification (경음화, shown in Hangul output but — like the official RR — not in romanization).
 * Not handled: ㄴ-insertion in compounds, Sino-Korean exceptions, spoken-style reductions.
 */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  const K = LF.Korean || (LF.Korean = {});
  const H = K.Hangul;

  const INIT = { ㄱ: 'g', ㄲ: 'kk', ㄴ: 'n', ㄷ: 'd', ㄸ: 'tt', ㄹ: 'r', ㅁ: 'm', ㅂ: 'b', ㅃ: 'pp', ㅅ: 's', ㅆ: 'ss', ㅇ: '', ㅈ: 'j', ㅉ: 'jj', ㅊ: 'ch', ㅋ: 'k', ㅌ: 't', ㅍ: 'p', ㅎ: 'h' };
  const VOW = { ㅏ: 'a', ㅐ: 'ae', ㅑ: 'ya', ㅒ: 'yae', ㅓ: 'eo', ㅔ: 'e', ㅕ: 'yeo', ㅖ: 'ye', ㅗ: 'o', ㅘ: 'wa', ㅙ: 'wae', ㅚ: 'oe', ㅛ: 'yo', ㅜ: 'u', ㅝ: 'wo', ㅞ: 'we', ㅟ: 'wi', ㅠ: 'yu', ㅡ: 'eu', ㅢ: 'ui', ㅣ: 'i' };
  const FIN = { ㄱ: 'k', ㄲ: 'k', ㄳ: 'k', ㄺ: 'k', ㅋ: 'k', ㄴ: 'n', ㄵ: 'n', ㄶ: 'n', ㄷ: 't', ㅅ: 't', ㅆ: 't', ㅈ: 't', ㅊ: 't', ㅌ: 't', ㅎ: 't',
    ㄹ: 'l', ㄼ: 'l', ㄽ: 'l', ㄾ: 'l', ㅀ: 'l', ㅁ: 'm', ㄻ: 'm', ㅂ: 'p', ㅍ: 'p', ㅄ: 'p', ㄿ: 'p', ㅇ: 'ng' };
  const REP = { ㄲ: 'ㄱ', ㅋ: 'ㄱ', ㄳ: 'ㄱ', ㄺ: 'ㄱ', ㅅ: 'ㄷ', ㅆ: 'ㄷ', ㅈ: 'ㄷ', ㅊ: 'ㄷ', ㅌ: 'ㄷ', ㅎ: 'ㄷ', ㄵ: 'ㄴ', ㄶ: 'ㄴ', ㄼ: 'ㄹ', ㄽ: 'ㄹ', ㄾ: 'ㄹ', ㅀ: 'ㄹ',
    ㄻ: 'ㅁ', ㅍ: 'ㅂ', ㅄ: 'ㅂ', ㄿ: 'ㅂ' };
  const ASPIRATED = { ㄱ: 'ㅋ', ㄷ: 'ㅌ', ㅂ: 'ㅍ', ㅈ: 'ㅊ' };
  const TENSE = { ㄱ: 'ㄲ', ㄷ: 'ㄸ', ㅂ: 'ㅃ', ㅅ: 'ㅆ', ㅈ: 'ㅉ' };

  // Apply sound rules to one run of Hangul syllables. opts: {tensify, stemEnd}
  function applyRules(text, opts) {
    const o = opts || {};
    const S = Array.from(text).map((ch) => H.parts(ch));
    for (let i = 0; i < S.length - 1; i++) {
      const a = S[i], b = S[i + 1];
      let f = a.f, nc = b.c;
      if (!f) continue;
      const origF = f;
      // palatalization: 같이 -> 가치, 굳이 -> 구지, 닫히다 -> 다치다
      if ((f === 'ㄷ' || f === 'ㅌ') && b.v === 'ㅣ' && (nc === 'ㅇ' || nc === 'ㅎ')) {
        a.f = ''; b.c = f === 'ㅌ' || nc === 'ㅎ' ? 'ㅊ' : 'ㅈ';
        continue;
      }
      // liaison
      if (nc === 'ㅇ' && f !== 'ㅇ') {
        if (H.COMPOUND[f]) {
          const [f1, f2] = H.COMPOUND[f];
          if (f2 === 'ㅎ') { a.f = ''; b.c = f1; } // 많아 -> 마나, 싫어 -> 시러
          else { a.f = f1; b.c = f2 === 'ㅅ' && o.tensify !== false ? 'ㅆ' : f2; } // 읽어 -> 일거, 없어 -> 업써
        } else if (f === 'ㅎ') { a.f = ''; } // 좋아 -> 조아
        else { a.f = ''; b.c = f; }
        continue;
      }
      // cluster simplification (before a consonant)
      if (H.COMPOUND[f]) {
        const [f1, f2] = H.COMPOUND[f];
        if (f2 === 'ㅎ') {
          f = f1;
          if (ASPIRATED[nc] && nc !== 'ㅂ') { b.c = ASPIRATED[nc]; nc = b.c; } // 많고 -> 만코
          else if (nc === 'ㅅ' && o.tensify !== false) { b.c = 'ㅆ'; nc = 'ㅆ'; }
        } else if (f === 'ㄺ' && nc === 'ㄱ') f = 'ㄹ'; // 읽고 -> 일꼬
        else f = REP[f];
      } else if (f === 'ㅎ') {
        if (nc === 'ㄱ' || nc === 'ㄷ' || nc === 'ㅈ') { b.c = ASPIRATED[nc]; a.f = ''; continue; } // 좋다 -> 조타
        if (nc === 'ㅅ') { if (o.tensify !== false) b.c = 'ㅆ'; a.f = ''; continue; }
        f = 'ㄷ'; // 놓는 -> 논는 (via nasalization below)
      } else if (nc === 'ㅎ' && (origF === 'ㅈ' || origF === 'ㅊ')) { // 젖히다 -> 저치다
        a.f = ''; b.c = 'ㅊ'; continue;
      } else if (REP[f]) f = REP[f];

      if (nc === 'ㅎ' && ASPIRATED[f] && f !== 'ㅈ') { a.f = ''; b.c = ASPIRATED[f]; continue; } // 축하 -> 추카, 입학 -> 이팍
      // nasalization / lateralization
      if ((f === 'ㄱ' || f === 'ㄷ' || f === 'ㅂ') && (nc === 'ㄴ' || nc === 'ㅁ')) f = { ㄱ: 'ㅇ', ㄷ: 'ㄴ', ㅂ: 'ㅁ' }[f];
      else if (nc === 'ㄹ' && f !== 'ㄹ') {
        if (f === 'ㄴ') { f = 'ㄹ'; } // 신라 -> 실라
        else { b.c = 'ㄴ'; nc = 'ㄴ'; if (f === 'ㄱ' || f === 'ㄷ' || f === 'ㅂ') f = { ㄱ: 'ㅇ', ㄷ: 'ㄴ', ㅂ: 'ㅁ' }[f]; } // 독립 -> 동닙
      } else if (f === 'ㄹ' && nc === 'ㄴ') { b.c = 'ㄹ'; nc = 'ㄹ'; } // 칼날 -> 칼랄
      // tensification (not applied if the consonant was nasalized)
      else if (o.tensify !== false && (f === 'ㄱ' || f === 'ㄷ' || f === 'ㅂ') && TENSE[nc]) b.c = TENSE[nc];
      else if (o.tensify !== false && (f === 'ㄴ' || f === 'ㅁ') && o.stemEnd === i && TENSE[nc] && nc !== 'ㅂ') b.c = TENSE[nc]; // 안다 -> 안따
      a.f = f;
    }
    // word-final consonant: neutralize
    const lastS = S[S.length - 1];
    if (lastS && lastS.f) lastS.f = REP[lastS.f] || lastS.f;
    return S;
  }

  function hangulRuns(text) {
    const runs = [];
    let cur = null;
    for (const ch of text) {
      const syl = H.isSyllable(ch);
      if (cur && cur.syl === syl) cur.t += ch; else { cur = { syl, t: ch }; runs.push(cur); }
    }
    return runs;
  }

  /** Pronounced form in Hangul, e.g. 먹었습니다 -> 머걷씀니다 */
  function pronounce(text, opts) {
    return hangulRuns(String(text).normalize('NFC')).map((r) => r.syl
      ? applyRules(r.t, opts).map((p) => H.build(p.c, p.v, p.f)).join('') : r.t).join('');
  }

  /** Revised Romanization of the pronounced form (tensification is not reflected, as in the official rules). */
  function romanize(text, opts) {
    return hangulRuns(String(text).normalize('NFC')).map((r) => {
      if (!r.syl) return r.t;
      const S = applyRules(r.t, Object.assign({}, opts, { tensify: false }));
      let out = '', prevL = false;
      for (const p of S) {
        let c = INIT[p.c];
        if (p.c === 'ㄹ') c = prevL ? 'l' : 'r';
        out += c + VOW[p.v] + (p.f ? FIN[p.f] : '');
        prevL = p.f === 'ㄹ' || FIN[p.f] === 'l';
      }
      return out;
    }).join('');
  }

  K.Romanization = { pronounce, romanize };
  if (typeof module !== 'undefined' && module.exports) module.exports = K.Romanization;
})(typeof globalThis !== 'undefined' ? globalThis : this);
