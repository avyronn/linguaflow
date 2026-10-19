/* Korean grammar patterns (문형): multi-word constructions such as V-고 싶다, V-(으)ㄹ 수 있다, N 때문에.
 *
 * This file is the ENGINE (a tiny pattern language + a matcher). The catalogue lives in grammar-patterns.js.
 * Patterns are matched over the morphological analysis, never over raw strings, so 먹고 싶어요, 먹고싶어요 (no space)
 * and 먹고 싶지 않아요 are all recognised by the same entry.
 *
 * Pattern language — one slot per unit, slots separated by spaces:
 *
 *     slot   := CLASS modifier*  [ '?' ]          ('?' = optional slot)       alternatives of a whole slot: slot;slot
 *     CLASS  := V verb · A adjective · X auxiliary (싶다, 않다 ...) · P any predicate (V A X, bare 이다)
 *               N noun/pronoun/number/counter/bound noun · D adverb, determiner, interjection, conjunction
 *               T standalone particle · * anything
 *     =a|b   lemma is one of a, b                                     (거 is treated as 것)
 *     <a|b   lemma is NOT one of a, b
 *     @-x|-y the unit's final ending is one of the ending ids -x, -y  (ids as in endings.js, e.g. -(으)ㄹ  -아/어  -고)
 *     #kind  ending kind: fin | conn | adn | nom
 *     ^rel   connective relation: cause cond conc contrast purpose seq simul bg quote ...
 *     +a|b   what may follow the word: particles (by key, e.g. 이/가  에서  (으)로), 이다 (= noun + copula),
 *            _ (nothing)  ~ (light particles: nothing, 이/가, 은/는, 도, 만, 을/를)  * (anything). Default: nothing.
 *            (the LAST slot of a pattern defaults to anything)
 *     !a|b   the word must carry at least one of these particles       (N!께서+께서|은/는 = 께서 or 께서는, not a bare 은/는)
 *     &a|b   copula form (only with +이다): 이라고 인 일 ...
 *     %H     the word carries a pre-final marker: H honorific -(으)시-, P past -았/었-, F -겠-
 *     $      the word closes its clause (it is the last word before a comma / full stop / the end of the sentence): -아/어 as a plain
 *            sentence ending (밥 먹었어.), not as a connective (고파 죽겠다)
 *     ..     a gap: skips 0-4 units (..2 = at most 2) that belong to the same clause - for constructions whose parts are not neighbours
 *            (별로 .. 않다, 아무리 .. -아도). Never at the start or the end of a pattern.
 *
 * Example: V-(으)ㄹ 수 있다  =  "P@-(으)ㄹ N=수+~ P=있다|없다"
 */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  const K = LF.Korean || (LF.Korean = {});

  const LIGHT = ['_', '이/가', '은/는', '도', '만', '을/를'];
  const KIND = { fin: 'final', conn: 'connective', adn: 'adnominal', nom: 'nominalizer' };
  const PRED_CLS = new Set(['V', 'A', 'X', 'C']);
  const NORM = { 거: '것', 걸: '것' };
  const set = (s) => new Set(String(s).split('|').filter(Boolean));

  // ---- compile ---------------------------------------------------------------------------------------------
  function compileAlt(src) {
    const m = /^([VAXPNDTU*C])((?:[=<@#^+&%!$][^=<@#^+&%!$]*)*)$/.exec(src);
    if (!m) throw new Error('bad pattern slot: ' + src);
    const alt = { cls: m[1], lemma: null, notLemma: null, end: null, kind: null, rel: null, tail: null, need: null, cop: null, pre: null, last: false, src };
    const re = /([=<@#^+&%!$])([^=<@#^+&%!$]*)/g;
    let f;
    while ((f = re.exec(m[2]))) {
      const v = f[2];
      if (f[1] === '=') alt.lemma = set(v);
      else if (f[1] === '<') alt.notLemma = set(v);
      else if (f[1] === '!') alt.need = set(v);
      else if (f[1] === '@') alt.end = set(v);
      else if (f[1] === '#') alt.kind = new Set(v.split('|').map((k) => KIND[k] || k));
      else if (f[1] === '^') alt.rel = set(v);
      else if (f[1] === '&') alt.cop = set(v);
      else if (f[1] === '%') alt.pre = v.split('').filter(Boolean);
      else if (f[1] === '$') alt.last = true;
      else if (f[1] === '+') {
        const t = new Set();
        for (const x of v.split('|')) { if (x === '~') LIGHT.forEach((y) => t.add(y)); else if (x) t.add(x); }
        alt.tail = t;
      }
    }
    return alt;
  }
  function compileSlot(src, isLast) {
    const g = /^\.\.(\d)?$/.exec(String(src));
    if (g) return { gap: true, max: g[1] ? +g[1] : 4, opt: false, alts: [], src };
    let s = String(src), opt = false;
    if (s.endsWith('?')) { opt = true; s = s.slice(0, -1); }
    const alts = s.split(';').map(compileAlt);
    for (const a of alts) if (!a.tail) a.tail = isLast ? new Set(['*']) : new Set(['_']);
    return { alts, opt, src };
  }
  function compile(def) {
    // def = [form, match, lv, cat, meaning, note, examples, flags]   match: a string, or an array of strings (variants of the same construction)
    // flags: 'future' = the sentence it closes is about the future / an intention (sets the tense shown), 'weak' = ambiguous construction (never reported as high confidence), 'generic' = a broad construction that is hidden when a more specific pattern covers the same words, 'end' = one single ending (kind 'ending' in the reference), 'link=REL' = the pattern closes a subordinate clause with relation REL (cause, time, cond ...)
    const flags = String(def[7] || '');
    const En = K.Endings;
    let cx = false;
    const variants = (Array.isArray(def[1]) ? def[1] : [def[1]]).map((src) => {
      const toks = String(src).trim().split(/\s+/);
      const slots = toks.map((t, i) => compileSlot(t, i === toks.length - 1));
      if (slots[0].gap || slots[slots.length - 1].gap) throw new Error('a gap cannot start or end a pattern: ' + src);
      // a pattern whose non-final slots hold a connective / final ending (먹고 싶다, 가면 안 되다) is ONE complex predicate: no clause boundary inside it
      if (slots.slice(0, -1).some((sl) => sl.alts.some((a) => a.end && [...a.end].some((id) => { const e = En && En.BY_ID.get(id); return e && (e.kind === 'connective' || e.kind === 'final'); })))) cx = true;
      return { src, slots };
    });
    const link = (/\blink=(\w+)/.exec(flags) || [])[1] || null;
    return { id: def[0], form: def[0], match: variants.map((v) => v.src).join(' | '), lv: def[2], cat: def[3], meaning: def[4], note: def[5] || '', ex: def[6] || [],
      cx, link, weak: /\bweak\b/.test(flags), generic: /\bgeneric\b/.test(flags), future: /\bfuture\b/.test(flags), kind: /\bend\b/.test(flags) ? 'ending' : 'pattern', variants };
  }

  // ---- unit <-> slot ---------------------------------------------------------------------------------------
  function classOK(slotCls, u) {
    if (slotCls === '*') return 0;
    if (slotCls === 'P') return PRED_CLS.has(u.cls) ? 0 : -1;
    if (slotCls === 'N') return u.cls === 'N' ? 0 : (u.cls === 'U' ? 1 : -1);
    // the auxiliary half of ONE written word (먹어보고, 도와주고, 따뜻해지고) is the verb of that word: V-고 싶다 / V-고 있다 / V-지 못하다 must see 먹어보고 싶어요 like 먹어 보고 싶어요
    if (slotCls === 'V' && u.cls === 'X' && u.compound === 'aux') return 0;
    return slotCls === u.cls ? 0 : -1;
  }
  function tailOK(allowed, u) {
    if (allowed.has('*')) return true;
    const tail = (u.tail || []).filter((k) => k !== '들'); // the plural marker does not change what may follow
    if (!tail.length) return allowed.has('_');
    return tail.every((k) => allowed.has(k));
  }
  /** -1 = no match, otherwise a small penalty (0 = clean match). */
  function altMatch(alt, u, ctx) {
    const c = classOK(alt.cls, u);
    if (c < 0) return -1;
    if (alt.last && !(ctx && ctx.last)) return -1;
    if (alt.lemma) {
      const ok = alt.lemma.has(u.lemma) || (u.norm && alt.lemma.has(u.norm)) || (u.cls === 'U' && alt.lemma.has(u.text));
      if (!ok) return -1;
    }
    if (alt.notLemma && (alt.notLemma.has(u.lemma) || (u.norm && alt.notLemma.has(u.norm)))) return -1;
    if (alt.need && !(u.tail || []).some((k) => alt.need.has(k))) return -1;
    if (alt.end && !(u.end && alt.end.has(u.end))) return -1;
    if (alt.kind && !(u.endKind && alt.kind.has(u.endKind))) return -1;
    if (alt.rel && !(u.rel && alt.rel.has(u.rel))) return -1;
    if (alt.cop && !(u.cop && alt.cop.has(u.cop))) return -1;
    if (alt.pre && !alt.pre.every((x) => (u.pre && u.pre.includes(x)) || (x === 'H' && u.hon))) return -1;
    if (!tailOK(alt.tail, u)) return -1;
    return c;
  }
  function slotMatch(slot, u, ctx) {
    let best = -1;
    for (const a of slot.alts) { const r = altMatch(a, u, ctx); if (r >= 0 && (best < 0 || r < best)) best = r; }
    return best;
  }

  // ---- matcher ---------------------------------------------------------------------------------------------
  // a gap may skip anything except a unit that ends a sentence (-아요, -ㅂ니다 ...); linking finals such as -지 / -아/어 are fine
  const GAP_FINAL_OK = new Set(['-지', '-아/어', '-고']);
  const gapSkippable = (u) => !(u.endKind === 'final' && !GAP_FINAL_OK.has(u.end));

  /** seg: [{ eo, readings:[{ units:[unit] }] }]  (one barrier-free stretch of eojeol)
   *  returns raw matches [{ pat, path:[{i,r,u}], gaps:[{i,r,u}], penalty }] (path = the units that fill the pattern's slots; gaps = the units a '..' slot skipped) */
  function matchSegment(pats, seg) {
    const out = [];
    const nextOf = (p) => {
      const rd = seg[p.i].readings[p.r];
      if (p.u + 1 < rd.units.length) return [{ i: p.i, r: p.r, u: p.u + 1 }];
      if (p.i + 1 >= seg.length) return [];
      return seg[p.i + 1].readings.map((_, r) => ({ i: p.i + 1, r, u: 0 })).filter((q) => seg[q.i].readings[q.r].units.length);
    };
    // the neighbour reached by skipping one unit: always the primary reading (skipped words are not analysed by the pattern)
    const skipOne = (p) => {
      const rd = seg[p.i].readings[p.r];
      if (p.u + 1 < rd.units.length) return { i: p.i, r: p.r, u: p.u + 1 };
      for (let i = p.i + 1; i < seg.length; i++) { if (seg[i].readings[0] && seg[i].readings[0].units.length) return { i, r: 0, u: 0 }; }
      return null;
    };
    for (const pat of pats) {
      const seen = new Map(); // first|last position -> best match
      for (const variant of pat.variants) {
        const slots = variant.slots;
        const rec = (si, pos, path, pen, gaps) => {
          if (si === slots.length) {
            if (!path.length) return;
            const last = path[path.length - 1];
            const key = path[0].i + '|' + last.i + '|' + path[0].u + '|' + last.u;
            const old = seen.get(key);
            const score = pen + path.reduce((n, q) => n + q.r, 0) + gaps.length * 0.1;
            if (!old || score < old.score) seen.set(key, { pat, variant, path: path.slice(), gaps: gaps.slice(), penalty: score, score });
            return;
          }
          const slot = slots[si];
          if (slot.gap) { // skip 0..max units, then go on with the next slot
            let cur = pos;
            const skipped = [];
            for (let k = 0; k <= slot.max && cur; k++) {
              rec(si + 1, cur, path, pen, gaps.concat(skipped));
              const u = seg[cur.i].readings[cur.r].units[cur.u];
              if (cur.r !== 0 || !gapSkippable(u)) break; // only the primary reading is skipped (other readings are tried by their own branch)
              skipped.push(cur);
              cur = skipOne(cur);
            }
            return;
          }
          if (slot.opt) rec(si + 1, pos, path, pen, gaps);
          if (!pos) return;
          const u = seg[pos.i].readings[pos.r].units[pos.u];
          const m = slotMatch(slot, u, { last: pos.i === seg.length - 1 && pos.u === seg[pos.i].readings[pos.r].units.length - 1 });
          if (m < 0) return;
          const here = { i: pos.i, r: pos.r, u: pos.u, s: si };
          const nexts = si + 1 === slots.length ? [null] : nextOf(pos);
          if (!nexts.length) { // end of stream: only optional slots may remain
            if (slots.slice(si + 1).every((s) => s.opt)) rec(slots.length, null, path.concat([here]), pen + m, gaps);
            return;
          }
          for (const nx of nexts) rec(si + 1, nx, path.concat([here]), pen + m, gaps);
        };
        for (let i = 0; i < seg.length; i++) {
          for (let r = 0; r < seg[i].readings.length; r++) {
            for (let u = 0; u < seg[i].readings[r].units.length; u++) rec(0, { i, r, u }, [], 0, []);
          }
        }
      }
      for (const v of seen.values()) out.push(v);
    }
    return out;
  }

  K.Patterns = { compile, compileSlot, compileAlt, matchSegment, slotMatch, altMatch, LIGHT, NORM };
  if (typeof module !== 'undefined' && module.exports) module.exports = K.Patterns;
})(typeof globalThis !== 'undefined' ? globalThis : this);
