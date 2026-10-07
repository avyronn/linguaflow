/* Korean particles (조사). Data + a parser for particle chains such as 에서는, 에게도, 사람들이.
 * Labels are Vietnamese (gloss language of the V1 dictionary). */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  const K = LF.Korean || (LF.Korean = {});
  const H = () => K.Hangul;

  // kind: plural | case | aux (bổ trợ) | comp (comparative-like) | polite | voc
  // req : phonological requirement on the preceding syllable
  //       '*' any, 'c' needs final consonant, 'v' needs vowel ending, 'cl' final consonant but not ㄹ, 'vl' vowel or ㄹ
  // compose: how the particle merges into a Vietnamese summary: {pre} before the noun, {post} after, {paren} in brackets
  // [form, req, key, kind, label (vi), compose]
  const RAW = [
    ['이', 'c', '이/가', 'case', 'trợ từ chủ ngữ', { paren: 'chủ ngữ' }],
    ['가', 'v', '이/가', 'case', 'trợ từ chủ ngữ', { paren: 'chủ ngữ' }],
    ['은', 'c', '은/는', 'aux', 'trợ từ chủ đề (thì / là)', { paren: 'chủ đề' }],
    ['는', 'v', '은/는', 'aux', 'trợ từ chủ đề (thì / là)', { paren: 'chủ đề' }],
    ['을', 'c', '을/를', 'case', 'trợ từ tân ngữ', { paren: 'tân ngữ' }],
    ['를', 'v', '을/를', 'case', 'trợ từ tân ngữ', { paren: 'tân ngữ' }],
    ['의', '*', '의', 'case', 'của (sở hữu)', { pre: 'của' }],
    ['에', '*', '에', 'case', 'ở / tại / vào lúc / đến', { pre: 'ở' }],
    ['에서', '*', '에서', 'case', 'ở / tại (nơi diễn ra hành động) / từ', { pre: 'ở' }],
    ['에게서', '*', '에게서', 'case', 'từ (một người)', { pre: 'từ' }],
    ['한테서', '*', '한테서', 'case', 'từ (một người, thân mật)', { pre: 'từ' }],
    ['에게', '*', '에게', 'case', 'cho / với (một người)', { pre: 'cho' }],
    ['한테', '*', '한테', 'case', 'cho / với (một người, thân mật)', { pre: 'cho' }],
    ['께', '*', '께', 'case', 'cho (một người, kính ngữ)', { pre: 'cho' }],
    ['으로부터', 'cl', '(으)로부터', 'case', 'từ (nguồn gốc)', { pre: 'từ' }],
    ['로부터', 'vl', '(으)로부터', 'case', 'từ (nguồn gốc)', { pre: 'từ' }],
    ['으로서', 'cl', '(으)로서', 'case', 'với tư cách là', { pre: 'với tư cách' }],
    ['로서', 'vl', '(으)로서', 'case', 'với tư cách là', { pre: 'với tư cách' }],
    ['으로써', 'cl', '(으)로써', 'case', 'bằng (phương tiện)', { pre: 'bằng' }],
    ['로써', 'vl', '(으)로써', 'case', 'bằng (phương tiện)', { pre: 'bằng' }],
    ['으로', 'cl', '(으)로', 'case', 'bằng / về phía / hướng đến / thành', { paren: 'bằng / hướng đến' }],
    ['로', 'vl', '(으)로', 'case', 'bằng / về phía / hướng đến / thành', { paren: 'bằng / hướng đến' }],
    ['과', 'c', '와/과', 'case', 'và / cùng với', { pre: 'cùng với' }],
    ['와', 'v', '와/과', 'case', 'và / cùng với', { pre: 'cùng với' }],
    ['이랑', 'c', '(이)랑', 'case', 'và / cùng với (thân mật)', { pre: 'cùng với' }],
    ['랑', 'v', '(이)랑', 'case', 'và / cùng với (thân mật)', { pre: 'cùng với' }],
    ['하고', '*', '하고', 'case', 'và / cùng với', { pre: 'cùng với' }],
    ['보다', '*', '보다', 'comp', 'hơn / so với', { pre: 'hơn' }],
    ['처럼', '*', '처럼', 'comp', 'như', { pre: 'như' }],
    ['같이', '*', '같이', 'comp', 'như / cùng', { pre: 'như' }],
    ['만큼', '*', '만큼', 'comp', 'bằng / đến mức', { pre: 'bằng' }],
    ['대로', '*', '대로', 'comp', 'theo / như', { pre: 'theo' }],
    ['도', '*', '도', 'aux', 'cũng', { paren: 'cũng' }],
    ['만', '*', '만', 'aux', 'chỉ', { pre: 'chỉ' }],
    ['까지', '*', '까지', 'aux', 'đến / cả', { pre: 'đến' }],
    ['부터', '*', '부터', 'aux', 'từ / bắt đầu từ', { pre: 'từ' }],
    ['마저', '*', '마저', 'aux', 'ngay cả', { pre: 'ngay cả' }],
    ['조차', '*', '조차', 'aux', 'ngay cả', { pre: 'ngay cả' }],
    ['마다', '*', '마다', 'aux', 'mỗi', { pre: 'mỗi' }],
    ['밖에', '*', '밖에', 'aux', 'ngoài … ra (đi với phủ định)', { pre: 'chỉ có' }],
    ['뿐', '*', '뿐', 'aux', 'chỉ', { pre: 'chỉ' }],
    ['쯤', '*', '쯤', 'aux', 'khoảng', { pre: 'khoảng' }],
    ['씩', '*', '씩', 'aux', 'mỗi / từng', { pre: 'mỗi' }],
    ['이나', 'c', '(이)나', 'aux', 'hoặc / tận / những', { paren: 'hoặc / tận' }],
    ['나', 'v', '(이)나', 'aux', 'hoặc / tận / những', { paren: 'hoặc / tận' }],
    ['이라도', 'c', '(이)라도', 'aux', 'dù là / ít nhất cũng', { paren: 'dù là' }],
    ['라도', 'v', '(이)라도', 'aux', 'dù là / ít nhất cũng', { paren: 'dù là' }],
    ['이야말로', 'c', '(이)야말로', 'aux', 'chính là', { pre: 'chính' }],
    ['야말로', 'v', '(이)야말로', 'aux', 'chính là', { pre: 'chính' }],
    ['들', '*', '들', 'plural', 'số nhiều (nhiều …)', { paren: 'số nhiều' }],
    ['아', 'c', '아/야', 'voc', 'hô ngữ (gọi tên, thân mật)', { paren: 'gọi' }],
    ['야', 'v', '아/야', 'voc', 'hô ngữ (gọi tên, thân mật)', { paren: 'gọi' }],
    ['요', '*', '요', 'polite', 'đuôi lịch sự -요', { paren: 'lịch sự' }],
  ];

  const PARTICLES = RAW.map(([form, req, key, kind, label, compose]) => ({ form, req, key, kind, label, compose, type: 'particle' }));
  const LOW_PRIOR = new Set(['아/야', '나', '이나', '야', '아']); // frequent false positives on word endings

  function okReq(req, prev) {
    if (req === '*' || !prev) return true;
    const last = prev.slice(-1);
    const hg = H();
    if (!hg.isSyllable(last)) return true; // digits / latin: cannot decide
    const f = hg.jong(last);
    switch (req) {
      case 'c': return f !== '';
      case 'v': return f === '';
      case 'cl': return f !== '' && f !== 'ㄹ';
      case 'vl': return f === '' || f === 'ㄹ';
      default: return true;
    }
  }

  // Adjacency between consecutive particles in a chain.
  function canFollow(prev, next) {
    if (!prev) return true;
    if (prev.kind === 'polite') return false;
    if (next.kind === 'polite') return true;
    if (next.kind === 'plural') return false;
    if (prev.kind === 'plural') return true;
    if (prev.kind === 'voc') return false;
    // 에서는, 에게도, 으로만 ... and 에서의, 으로의, 와의 ...
    if (prev.kind === 'case') return next.kind === 'aux' || (next.kind === 'case' && next.key === '의' && prev.key !== '의');
    if (prev.kind === 'aux') {
      if (prev.key === '은/는') return next.kind === 'aux' && next.key !== '은/는';
      // 만이, 까지가, 부터의 ...
      return next.kind === 'aux' || (next.kind === 'case' && ['이/가', '을/를', '의'].includes(next.key));
    }
    if (prev.kind === 'comp') return next.kind === 'aux' || (next.kind === 'case' && next.key === '의');
    return false;
  }

  /** All ways to read `tail` as a chain of particles attached to `stem` (max depth 3). */
  function parseChain(stem, tail, maxDepth) {
    const out = [];
    const limit = maxDepth || 3;
    (function dfs(pos, prevText, prevP, acc) {
      if (pos === tail.length) { if (acc.length) out.push(acc.slice()); return; }
      if (acc.length >= limit) return;
      for (const p of PARTICLES) {
        if (!tail.startsWith(p.form, pos)) continue;
        if (!okReq(p.req, prevText)) continue;
        if (!canFollow(prevP, p)) continue;
        acc.push(p);
        dfs(pos + p.form.length, p.form, p, acc);
        acc.pop();
      }
    })(0, stem, null, []);
    return out;
  }

  K.Particles = { PARTICLES, LOW_PRIOR, okReq, canFollow, parseChain };
  if (typeof module !== 'undefined' && module.exports) module.exports = K.Particles;
})(typeof globalThis !== 'undefined' ? globalThis : this);
