/* Korean conjugation engine (forward direction): stem + endings -> surface strings.
 * The analyzer (morphology.js) proposes candidate stems/endings and keeps only those whose regenerated
 * surface equals the input exactly, so correctness of this file is what makes analyses trustworthy.
 *
 * StemInfo = { text, irr, pos, afterPrefinal }
 *   text          stem without 다 (NFC)
 *   irr           null | 'ㅂ' | 'ㄷ' | 'ㅅ' | 'ㅎ' | '르' | '우'
 *   pos           'v' | 'adj' | undefined
 *   afterPrefinal 'honorific' | 'ss' (stem already carries -시- / -았었- / -겠-)
 */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  const K = LF.Korean || (LF.Korean = {});
  const H = K.Hangul;
  const En = () => K.Endings;

  const isBare = (c) => !!c && c.charCodeAt(0) >= 0x3131 && c.charCodeAt(0) <= 0x314E;
  const onsetOf = (text) => { const c = text[0]; if (!c) return ''; if (isBare(c)) return c; const p = H.parts(c); return p ? p.c : ''; };
  const dropsL = (onset) => onset === 'ㄴ' || onset === 'ㅂ' || onset === 'ㅅ';

  // ---- irregular classes ---------------------------------------------------------------------------
  const REG_B_LAST = new Set(['입', '잡', '좁', '씹', '집', '뽑', '접', '꼽', '업']);
  const IRR_D_SUFFIX = ['듣', '걷', '싣', '깨닫', '붇', '긷', '일컫'];
  const IRR_D_EXACT = new Set(['묻']);
  const IRR_S_SUFFIX = ['짓', '낫', '붓', '잇', '긋', '젓', '잣'];
  const REG_REU = new Set(['따르', '치르', '들르', '다다르', '우러르', '으르']);
  const HON_LEX = new Set(['드시', '계시', '주무시', '잡수시']); // lexical honorific verbs: 드세요, 계세요 ...

  function defaultIrr(stem, pos) {
    if (!stem) return null;
    const last = H.last(stem), f = H.jong(stem);
    if (f === 'ㅂ') return REG_B_LAST.has(last) ? null : 'ㅂ';
    if (f === 'ㄷ') return IRR_D_EXACT.has(stem) || IRR_D_SUFFIX.some((w) => stem.endsWith(w)) ? 'ㄷ' : null;
    if (f === 'ㅅ') return IRR_S_SUFFIX.some((w) => stem.endsWith(w)) ? 'ㅅ' : null;
    if (f === 'ㅎ') return pos === 'adj' && last !== '좋' ? 'ㅎ' : null;
    if (last === '르' && stem.length >= 2 && !REG_REU.has(stem)) return '르';
    if (stem === '푸') return '우';
    return null;
  }
  // For stems that are not in the dictionary: every irregular class that is phonologically possible.
  function candidateIrrs(stem) {
    const out = [null], f = H.jong(stem), last = H.last(stem);
    if (f === 'ㅂ') out.push('ㅂ');
    if (f === 'ㄷ') out.push('ㄷ');
    if (f === 'ㅅ') out.push('ㅅ');
    if (f === 'ㅎ') out.push('ㅎ');
    if (last === '르' && stem.length >= 2) out.push('르');
    return out;
  }

  const isYang = (v) => v === 'ㅏ' || v === 'ㅗ';
  const harmony = (t) => (isYang(H.vowel(t)) ? '아' : '어');
  const swapLast = (t, repl) => t.slice(0, -1) + repl;

  /** 아/어-fused forms of a stem: F such that F+요 = 해요체, F+ㅆ = past stem. First element is the standard form. */
  function aoFuseAll(info) {
    const t = info.text;
    if (!t) return [];
    if (info.afterPrefinal === 'ss') return [t + '어'];
    if (info.afterPrefinal === 'honorific') return [swapLast(t, H.withVowel(H.last(t), 'ㅕ'))]; // 가시 + 어 -> 가셔
    const irr = info.irr, last = H.last(t), p = H.parts(last);
    if (!p) return [t + harmony(t)];
    if (irr === 'ㅂ' && p.f === 'ㅂ') return [swapLast(t, H.withoutJong(last)) + (/(돕|곱)$/.test(t) ? '와' : '워')]; // 춥 -> 추워, 돕 -> 도와
    if (irr === 'ㄷ' && p.f === 'ㄷ') return [swapLast(t, H.withJong(last, 'ㄹ')) + harmony(t)]; // 듣 -> 들어
    if (irr === 'ㅅ' && p.f === 'ㅅ') return [swapLast(t, H.withoutJong(last)) + harmony(t)]; // 짓 -> 지어, 낫 -> 나아
    if (irr === 'ㅎ' && p.f === 'ㅎ') { // 그렇 -> 그래, 파랗 -> 파래, 하얗 -> 하얘
      const map = { ㅏ: 'ㅐ', ㅓ: 'ㅐ', ㅑ: 'ㅒ', ㅕ: 'ㅖ' };
      return [swapLast(t, H.build(p.c, map[p.v] || 'ㅐ', ''))];
    }
    if (irr === '르' && last === '르' && t.length >= 2) { // 모르 -> 몰라, 부르 -> 불러
      const prev = t[t.length - 2];
      return [t.slice(0, -2) + H.withJong(prev, 'ㄹ') + (harmony(prev) === '아' ? '라' : '러')];
    }
    if (irr === '우' && t === '푸') return ['퍼'];
    if (p.v === 'ㅡ' && p.f === '') { // ㅡ-drop: 쓰 -> 써, 아프 -> 아파, 따르 -> 따라
      const prevV = t.length >= 2 ? H.vowel(t.slice(0, -1)) : '';
      return [swapLast(t, H.withVowel(last, isYang(prevV) ? 'ㅏ' : 'ㅓ'))];
    }
    if (p.f === '') {
      if (last === '하') return [swapLast(t, '해'), t + '여'];
      switch (p.v) {
        case 'ㅏ': case 'ㅓ': case 'ㅐ': case 'ㅔ': case 'ㅕ': return [t];
        case 'ㅗ': return [swapLast(t, H.withVowel(last, 'ㅘ')), t + harmony(t)];
        case 'ㅜ': return [swapLast(t, H.withVowel(last, 'ㅝ')), t + '어'];
        case 'ㅣ': return [swapLast(t, H.withVowel(last, 'ㅕ')), t + '어'];
        case 'ㅚ': return [swapLast(t, H.withVowel(last, 'ㅙ')), t + '어'];
        default: return [t + harmony(t)];
      }
    }
    return [t + harmony(t)];
  }

  function join(t, text) {
    if (!text) return t;
    const c = text[0];
    if (isBare(c)) { const m = H.addJong(t, c); return m === null ? null : m + text.slice(1); }
    return t + text;
  }
  function consInsert(t, text) { // 으 is inserted after a consonant-final stem
    const c = text[0];
    if (isBare(c)) return t + H.build('ㅇ', 'ㅡ', c) + text.slice(1);
    return t + '으' + text;
  }

  function attachC(info, text) {
    let t = info.text;
    if (!info.afterPrefinal && H.jong(t) === 'ㄹ' && dropsL(onsetOf(text))) t = H.dropLastJong(t);
    return t + text;
  }
  function attachU(info, text) {
    let t = info.text;
    const irr = info.afterPrefinal ? null : info.irr;
    const f = H.jong(t), last = H.last(t), onset = onsetOf(text);
    if (HON_LEX.has(t) && (text.startsWith('세요') || text.startsWith('십시오'))) t = t.slice(0, -1);
    if (irr === 'ㅂ' && f === 'ㅂ') return join(swapLast(t, H.withoutJong(last)) + '우', text);
    if (irr === 'ㄷ' && f === 'ㄷ') return consInsert(swapLast(t, H.withJong(last, 'ㄹ')), text);
    if (irr === 'ㅅ' && f === 'ㅅ') return consInsert(swapLast(t, H.withoutJong(last)), text);
    if (irr === 'ㅎ' && f === 'ㅎ') return join(swapLast(t, H.withoutJong(last)), text);
    const f2 = H.jong(t);
    if (f2 === '' || f2 === 'ㄹ') {
      if (f2 === 'ㄹ' && dropsL(onset)) t = H.dropLastJong(t);
      return join(t, text);
    }
    return consInsert(t, text);
  }
  function attachF(info, text) {
    const [v, c] = text.split('|');
    let t = info.text;
    const f = H.jong(t);
    if (f === '') return join(t, v);
    if (f === 'ㄹ') { if (dropsL(onsetOf(v))) t = H.dropLastJong(t); return join(t, v); }
    return t + c;
  }
  function attachA(info, text) {
    const outs = [];
    if (info.text === '아니' && !info.afterPrefinal) { // 아니다: 아니에요 / 아니야 / 아니라서 (listed first = standard form)
      if (text === '요') outs.push('아니에요');
      if (text === '') outs.push('아니야', '아냐');
      if (text === '서') outs.push('아니라서');
    }
    for (const F of aoFuseAll(info)) outs.push(F + text);
    return outs;
  }
  function attachFinal(info, spec) {
    switch (spec.mode) {
      case 'c': return [attachC(info, spec.text)];
      case 'u': return [attachU(info, spec.text)];
      case 'a': return attachA(info, spec.text);
      case 'f': return [attachF(info, spec.text)];
      default: return [];
    }
  }

  function applyPrefinal(info, code) {
    const base = { irr: null, pos: info.pos };
    if (code === 'H') {
      if (HON_LEX.has(info.text) || info.afterPrefinal === 'honorific') return [];
      const t = attachU(info, '시');
      return t ? [Object.assign({ text: t, afterPrefinal: 'honorific' }, base)] : [];
    }
    if (code === 'P') {
      return aoFuseAll(info).map((F) => Object.assign({ text: swapLast(F, H.withJong(H.last(F), 'ㅆ')), afterPrefinal: 'ss' }, base));
    }
    if (code === 'F') return [Object.assign({ text: info.text + '겠', afterPrefinal: 'ss' }, base)];
    return [];
  }
  function chainInfos(info, combo) {
    let cur = [info];
    for (const code of combo) {
      const next = [];
      for (const i of cur) next.push(...applyPrefinal(i, code));
      cur = next;
    }
    return cur;
  }

  // 있다/없다 (맛있다, 재미없다 ...) take the verb-style endings 는/는다/는데.
  const effectivePos = (info) => (/[있없]$/.test(info.text) ? 'v' : info.pos);
  function specAllowed(info, combo, spec) {
    const tensed = combo.includes('P') || combo.includes('F');
    if (spec.needsBare && tensed) return false;
    if (spec.bare && !tensed) { const pos = effectivePos(info); if (pos && pos !== spec.bare) return false; }
    return true;
  }

  /** All surfaces for stem + pre-final chain + final ending (a Set of NFC strings). */
  function conjugate(info, combo, spec) {
    const out = new Set();
    if (!specAllowed(info, combo, spec)) return out;
    for (const i of chainInfos(info, combo)) for (const s of attachFinal(i, spec)) if (s) out.add(s);
    return out;
  }

  /** A handful of useful forms for display (cards / debugging). */
  function commonForms(info) {
    const find = (id) => En().ENDINGS.find((e) => e.id === id);
    const pick = (combo, id) => { const s = conjugate(info, combo, find(id)); return s.size ? Array.from(s)[0] : null; };
    return [
      { label: 'Hiện tại (lịch sự)', form: pick([], '-아요/어요') },
      { label: 'Quá khứ (lịch sự)', form: pick(['P'], '-아요/어요') },
      { label: 'Trang trọng', form: pick([], '-ㅂ니다/습니다') },
      { label: 'Nối “và” (-고)', form: pick([], '-고') },
      { label: 'Nếu (-(으)면)', form: pick([], '-(으)면') },
      { label: 'Định ngữ (-(으)ㄴ)', form: pick([], '-(으)ㄴ') },
    ].filter((x) => x.form);
  }

  K.Conjugation = { defaultIrr, candidateIrrs, aoFuseAll, applyPrefinal, chainInfos, attachFinal, conjugate, specAllowed,
    effectivePos, commonForms, HON_LEX, join };
  if (typeof module !== 'undefined' && module.exports) module.exports = K.Conjugation;
})(typeof globalThis !== 'undefined' ? globalThis : this);
