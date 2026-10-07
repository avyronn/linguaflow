/* Korean morphological analyzer.
 *
 * Strategy: propose candidate (stem + endings) readings, then keep only those that REGENERATE the exact surface
 * with the forward conjugation engine (conjugation.js). A reading whose stem is in the dictionary is
 * "known"; anything else is explicitly marked as a guess with a lower confidence. The analyzer never
 * returns a made-up reading as certain: low confidence is reported as such.
 *
 * Reading types: word (exact dictionary hit) | nominal (noun + particles) | predicate (verb/adjective + endings)
 *                | copula (noun + 이다) | compound (V-아/어 + auxiliary, e.g. 도와주세요) | unknown
 */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  const K = LF.Korean || (LF.Korean = {});
  const H = K.Hangul, P = K.Particles, En = K.Endings, Cj = K.Conjugation;

  const POS_LABEL = { v: 'động từ', adj: 'tính từ', n: 'danh từ', pron: 'đại từ', num: 'số từ', cnt: 'đơn vị đếm', adv: 'phó từ',
    det: 'định từ', int: 'thán từ', conj: 'liên từ', aux: 'trợ động từ', cop: 'từ “là”', nbound: 'danh từ phụ thuộc', phrase: 'cụm từ' };

  // Contracted pronoun + particle forms: surface -> [base word, particle]
  const CONTRACTIONS = {
    제가: ['저', '가'], 내가: ['나', '가'], 네가: ['너', '가'], 난: ['나', '는'], 넌: ['너', '는'], 날: ['나', '를'], 널: ['너', '를'],
    뭘: ['뭐', '를'], 걸: ['것', '을'], 건: ['것', '은'], 게: ['것', '이'], 이게: ['이것', '이'], 그게: ['그것', '이'], 저게: ['저것', '이'],
    이건: ['이것', '은'], 그건: ['그것', '은'], 저건: ['저것', '은'], 이걸: ['이것', '을'], 그걸: ['그것', '을'], 저걸: ['저것', '을'],
    여긴: ['여기', '는'], 거긴: ['거기', '는'], 저긴: ['저기', '는'], 누가: ['누구', '가'], 얜: ['이 애', '는'], 걘: ['그 애', '는'],
  };

  // Auxiliary verbs used as V-아/어 + aux inside one eojeol (도와주세요, 먹어봐요, 가고싶어요 ...)
  const AUX = {
    주: { pat: '{x} giúp / {x} cho người khác', label: '-아/어 주다: làm việc gì đó cho người khác' },
    드리: { pat: '{x} giúp (khiêm nhường)', label: '-아/어 드리다: làm giúp (khiêm nhường)' },
    보: { pat: 'thử {x}', label: '-아/어 보다: thử làm' },
    버리: { pat: '{x} mất / {x} hết', label: '-아/어 버리다: làm xong hẳn / lỡ làm' },
    놓: { pat: '{x} sẵn', label: '-아/어 놓다: làm sẵn, để trạng thái đó' },
    두: { pat: '{x} sẵn / để nguyên', label: '-아/어 두다: làm sẵn, để nguyên' },
    가: { pat: '{x} đi (tiếp diễn)', label: '-아/어 가다: tiếp tục dần dần' },
    오: { pat: '{x} lại (từ trước đến nay)', label: '-아/어 오다: đã … đến giờ' },
    있: { pat: 'đang {x}', label: '-아/어 있다 / -고 있다: đang (ở trạng thái)' },
    싶: { pat: 'muốn {x}', label: '-고 싶다: muốn làm' },
  };
  const NON_NOMINAL = new Set(['det', 'int', 'conj', 'phrase']);
  const SINO_NUM = new Set(['일', '이', '삼', '사', '오', '육', '칠', '팔', '구', '십', '백', '천', '만', '억', '영', '공']);
  const AUX_CONNECTIVES = new Set(['-아/어', '-고']);
  const TRAIL_AUX = new Set(['는', '은', '도', '만']);

  const clampN = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const nfd = (s) => s.normalize('NFD');
  const FINAL_COMPAT = { 'ᆨ': 'ㄱ', 'ᆫ': 'ㄴ', 'ᆮ': 'ㄷ', 'ᆯ': 'ㄹ', 'ᆷ': 'ㅁ', 'ᆸ': 'ㅂ', 'ᆺ': 'ㅅ', 'ᆻ': 'ㅆ', 'ᆼ': 'ㅇ' };
  const toCompat = (s) => s.normalize('NFC').replace(/[\u11A8-\u11C2]/g, (c) => FINAL_COMPAT[c] || c);

  function firstMeaning(entry) { return entry && entry.meanings && entry.meanings.length ? entry.meanings[0] : ''; }
  // First meaning without a trailing "(note)": used when composing summaries so we never print "(…) (…)".
  function coreMeaning(entry) {
    const m = firstMeaning(entry);
    const c = m.replace(/\s*\([^)]*\)\s*$/, '').trim();
    return c || m;
  }
  // One concise gloss per morpheme line (the card lists every dictionary meaning separately).
  function shortGloss(entry) { return firstMeaning(entry); }
  function tenseWords(combo) {
    const c = combo.filter((x) => x !== 'H').join('');
    return { '': [], P: ['đã'], F: ['sẽ'], PF: ['chắc là đã'], PP: ['đã từng'], PPF: ['chắc là đã từng'] }[c] || [];
  }
  function say(core, o) {
    const words = [];
    if (o.pre) words.push(o.pre);
    for (const t of o.tense || []) if (t !== o.pre) words.push(t);
    words.push(core);
    if (o.post) words.push(o.post);
    const parens = (o.parens || []).filter(Boolean);
    return words.join(' ') + (parens.length ? ' (' + parens.join(', ') + ')' : '');
  }
  function composeNominal(core, chain) {
    let out = core;
    const parens = [];
    for (const p of chain) {
      if (p.compose.pre) out = p.compose.pre + ' ' + out;
      if (p.compose.post) out = out + ' ' + p.compose.post;
      if (p.compose.paren) parens.push(p.compose.paren);
    }
    return out + (parens.length ? ' (' + parens.join(', ') + ')' : '');
  }
  const specView = (spec, pos) => {
    const bp = spec.byPos && spec.byPos[pos];
    return bp ? { label: bp.label || spec.label, compose: Object.assign({}, spec.compose, bp.compose || {}) } : { label: spec.label, compose: spec.compose };
  };

  const TYPE_CONF = { word: 0.97, contraction: 0.9, nominal: 0.92, predicate: 0.92, copula: 0.86, compound: 0.76, synth: 0.62,
    unknownPredicate: 0.5, unknownNominal: 0.45, unknownCopula: 0.5, unknown: 0.3 };

  class KoreanMorphology {
    constructor(dictionary) {
      this.dict = dictionary;
      this._cache = new Map();
    }

    // ---- public ---------------------------------------------------------------------------------------
    analyze(surface) {
      const w = String(surface == null ? '' : surface).normalize('NFC').trim();
      if (!w) return this._unknown('');
      if (this._cache.has(w)) return this._cache.get(w);
      const result = this._analyze(w);
      if (this._cache.size > 3000) this._cache.clear();
      this._cache.set(w, result);
      return result;
    }
    candidates(surface) { return this._collect(String(surface).normalize('NFC').trim()); }

    // ---- candidate collection ---------------------------------------------------------------------------
    _collect(w) {
      const c = [];
      this._exact(w, c);
      this._contraction(w, c);
      this._nominal(w, c);
      this._copula(w, c);
      this._predicate(w, c);
      const best = c.reduce((m, x) => Math.max(m, x.score), 0);
      if (best < 78) this._compound(w, c);
      if (best < 60) this._unknownCandidates(w, c);
      c.sort((a, b) => b.score - a.score);
      return c;
    }
    _rankBonus(lemma) {
      const prov = this.dict.manager.getProviders(this.dict.language)[0];
      const r = prov && prov.rank ? prov.rank(lemma) : Infinity;
      return r === Infinity ? 0 : Math.max(0, 8 * (1 - Math.log(r + 1) / Math.log(2500)));
    }
    _exact(w, out) {
      const e = this.dict.get(w);
      if (!e) return;
      out.push({ type: 'word', lemma: w, entry: e, known: true, score: 90 + this._rankBonus(w), conf: TYPE_CONF.word });
    }
    _contraction(w, out) {
      const t = CONTRACTIONS[w];
      if (!t) return;
      const base = this.dict.get(t[0]) || this.dict.get(t[0].replace(' ', ''));
      const particle = P.PARTICLES.find((p) => p.form === t[1]);
      if (!particle) return;
      out.push({ type: 'nominal', stemText: w, lemma: t[0], entry: base, known: !!base, chain: [particle], contracted: t, score: 86, conf: TYPE_CONF.contraction });
    }
    _nominal(w, out) {
      for (let k = 1; k < w.length; k++) {
        const stem = w.slice(0, k), tail = w.slice(k);
        const e = this.dict.get(stem);
        const known = !!e && !this.dict.isPredicate(e) && !NON_NOMINAL.has(e.pos);
        if (!known && (stem.length < 2 || !H.hasHangul(stem))) continue;
        for (const chain of P.parseChain(stem, tail)) {
          const low = chain.some((p) => P.LOW_PRIOR.has(p.key));
          if (known) {
            const numPenalty = e.pos === 'num' && SINO_NUM.has(stem) ? 9 : 0;
            out.push({ type: 'nominal', stemText: stem, lemma: stem, entry: e, known: true, chain, tail,
              score: 80 + this._rankBonus(stem) - 2 * (chain.length - 1) - (low ? 12 : 0) - numPenalty,
              conf: TYPE_CONF.nominal - 0.02 * (chain.length - 1) - (low ? 0.15 : 0) });
          } else if (!low && chain[0].kind !== 'polite' && chain[0].kind !== 'plural') {
            out.push({ type: 'nominal', stemText: stem, lemma: stem, entry: null, known: false, chain, tail, score: 35 - chain.length, conf: TYPE_CONF.unknownNominal });
          }
        }
      }
    }
    _copula(w, out) {
      const STRONG = new Set(['입니다', '입니까', '이에요', '예요', '이세요', '이었어요', '였어요', '이었습니다', '였습니다']);
      for (let k = 1; k < w.length; k++) {
        const noun = w.slice(0, k), tail = w.slice(k);
        const e = this.dict.get(noun);
        const known = !!e && !this.dict.isPredicate(e) && !NON_NOMINAL.has(e.pos);
        const batchim = H.hasBatchim(noun);
        for (const f of En.COPULA) {
          const ok = (f.c === tail) || (!batchim && f.v === tail);
          if (!ok) continue;
          if (batchim && f.c !== tail) continue;
          if (known) out.push({ type: 'copula', stemText: noun, lemma: noun, entry: e, known: true, copula: f, tail, score: 76 + this._rankBonus(noun), conf: TYPE_CONF.copula });
          else if (noun.length >= 1 && H.hasHangul(noun) && STRONG.has(tail)) out.push({ type: 'copula', stemText: noun, lemma: noun, entry: null, known: false, copula: f, tail, score: 42, conf: TYPE_CONF.unknownCopula });
        }
      }
    }

    // ---- predicates ------------------------------------------------------------------------------------
    _stemInfoFromEntry(lemma, entry) {
      const stem = lemma.slice(0, -1);
      const pos = entry.pos === 'adj' || entry.pos === 'cop' ? 'adj' : 'v';
      const irr = entry.irregular === 'reg' ? null : (entry.irregular || Cj.defaultIrr(stem, pos));
      return { text: stem, irr, pos };
    }
    _knownStems(w) {
      const bucket = this.dict.predicatesByInitial.get(H.cho(w)) || [];
      const out = [];
      for (const b of bucket) {
        if (b.lemma === '이다') continue;
        out.push({ info: this._stemInfoFromEntry(b.lemma, b.entry), lemma: b.lemma, entry: b.entry, known: true });
      }
      return out;
    }
    _unknownStems(w) {
      const texts = new Set();
      const syl = Array.from(w).filter(H.isSyllable);
      for (let k = 1; k <= syl.length && texts.size < 60; k++) {
        const last = syl[k - 1], p = H.parts(last), head = syl.slice(0, k - 1).join('');
        texts.add(head + last);
        if (p.f) {
          texts.add(head + H.withoutJong(last));
          if (['ㅂ', 'ㄴ', 'ㄹ', 'ㅁ', 'ㅆ'].includes(p.f)) texts.add(head + H.withJong(last, 'ㄹ'));
          if (p.f === 'ㄹ') texts.add(head + H.withJong(last, 'ㄷ'));
        }
        for (const base of new Set([last, H.withoutJong(last)])) {
          const q = H.parts(base);
          if (!q || q.f) continue;
          const alt = { ㅘ: 'ㅗ', ㅝ: 'ㅜ', ㅙ: 'ㅚ', ㅕ: 'ㅣ', ㅓ: 'ㅡ', ㅏ: 'ㅡ' }[q.v];
          if (alt) texts.add(head + H.build(q.c, alt, ''));
          if (q.v === 'ㅐ' && q.c === 'ㅎ') texts.add(head + '하');
          if (q.v === 'ㅐ' || q.v === 'ㅒ' || q.v === 'ㅖ') for (const v of { ㅐ: ['ㅓ', 'ㅏ'], ㅒ: ['ㅑ'], ㅖ: ['ㅕ'] }[q.v]) texts.add(head + H.build(q.c, v, 'ㅎ'));
          texts.add(head + H.withJong(base, 'ㅅ')); // ㅅ-irregular 지어 -> 짓
          if (k >= 2 && q.c === 'ㅇ' && (q.v === 'ㅝ' || q.v === 'ㅘ' || q.v === 'ㅜ')) { // ㅂ-irregular 추워 -> 춥
            const prev = syl[k - 2];
            if (!H.jong(prev)) texts.add(syl.slice(0, k - 2).join('') + H.withJong(prev, 'ㅂ'));
          }
          if (k >= 2 && q.c === 'ㄹ' && (q.v === 'ㅏ' || q.v === 'ㅓ') && H.jong(syl[k - 2]) === 'ㄹ') // 르-irregular 몰라 -> 모르
            texts.add(syl.slice(0, k - 2).join('') + H.withoutJong(syl[k - 2]) + '르');
        }
      }
      const out = [];
      for (const t of texts) {
        if (!t || this.dict.has(t + '다')) continue; // known stems are handled by the dictionary route
        for (const irr of Cj.candidateIrrs(t)) for (const pos of ['v', 'adj']) {
          let entry = null, synth = null;
          const nounPart = t.endsWith('하') || t.endsWith('되') ? t.slice(0, -1) : '';
          if (nounPart) {
            const ne = this.dict.get(nounPart);
            if (ne && this.dict.isNominal(ne)) {
              synth = { pos: 'v', meanings: [(t.endsWith('하') ? 'làm / thực hiện “' : 'trở nên / được “') + firstMeaning(ne) + '”'], synthesized: true };
              entry = synth;
            }
          }
          out.push({ info: { text: t, irr, pos }, lemma: t + '다', entry, known: false, synthesized: !!synth });
        }
      }
      return out;
    }
    _comboFilter(w) {
      const hasSS = Array.from(w).some((ch) => H.isSyllable(ch) && H.jong(ch) === 'ㅆ');
      const hasHon = /[시셔셨세십]/.test(w), hasF = w.includes('겠');
      return En.COMBOS.filter((c) => {
        if ((c.includes('P') || c.includes('F')) && !hasSS) return false;
        if (c.includes('F') && !hasF) return false;
        if (c.includes('H') && !hasHon) return false;
        return true;
      });
    }
    /** Core matcher: which (stem, chain, ending) regenerate w exactly? */
    _match(w, stems, opts) {
      const o = opts || {};
      const combos = this._comboFilter(w);
      const specs = En.ENDINGS.filter((e) => (e.tail === '' || w.endsWith(e.tail)) && (!o.specIds || o.specIds.has(e.id)));
      const out = [];
      for (const s of stems) {
        for (const combo of combos) {
          const infos = Cj.chainInfos(s.info, combo);
          if (!infos.length) continue;
          for (const spec of specs) {
            if (o.needStrong && !(spec.strong || combo.length)) continue;
            if (!Cj.specAllowed(s.info, combo, spec)) continue;
            for (let ii = 0; ii < infos.length; ii++) {
              const si = Cj.attachFinal(infos[ii], spec).indexOf(w);
              if (si >= 0) { out.push({ stem: s, combo, spec, chainText: infos[ii].text, variant: ii + si }); break; }
            }
          }
        }
      }
      return out;
    }
    _predicate(w, out) {
      if (w.length < 2) { /* single syllables are covered by exact / nominal routes, but 가/와/봐 ... also conjugate */ }
      const known = this._match(w, this._knownStems(w));
      for (const m of known) out.push(this._predCandidate(m, w, true));
      if (!known.length || known.every((m) => m.stem.entry && m.stem.entry.rank > 2500)) {
        const guess = this._match(w, this._unknownStems(w), { needStrong: true });
        const seen = new Set();
        for (const m of guess) {
          const key = m.stem.lemma + '|' + m.spec.id + '|' + m.combo.join('');
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(this._predCandidate(m, w, false));
          if (seen.size > 12) break;
        }
      }
      this._predicateTrailing(w, out);
    }
    _predCandidate(m, w, known) {
      const irrGuess = !known && m.stem.info.irr ? 0.08 : 0;
      const synth = m.stem.synthesized;
      const score = known ? 80 + this._rankBonus(m.stem.lemma) - 0.4 * m.combo.length - (m.spec.strong || m.combo.length ? 0 : 1) - (m.variant > 0 ? 3 : 0) - (m.combo.includes('H') ? 3 : 0)
        : (synth ? 62 : 40) - (irrGuess ? 5 : 0);
      return { type: 'predicate', lemma: m.stem.lemma, stemText: m.stem.info.text, entry: m.stem.entry, known: known || !!synth, synthesized: !!synth,
        info: m.stem.info, combo: m.combo, spec: m.spec, chainText: m.chainText, score,
        conf: known ? TYPE_CONF.predicate : (synth ? TYPE_CONF.synth : TYPE_CONF.unknownPredicate - irrGuess) };
    }
    // 먹기를, 가지는, 먹고도 ... : a predicate form followed by particles
    _predicateTrailing(w, out) {
      for (let t = 1; t <= 4 && t < w.length - 1; t++) {
        const headStr = w.slice(0, w.length - t), tail = w.slice(w.length - t);
        const chains = P.parseChain(headStr, tail, 2).filter((ch) => ch.every((p) => p.kind !== 'polite' && p.kind !== 'plural'));
        if (!chains.length) continue;
        const nomOK = headStr.endsWith('기');
        const ids = nomOK ? new Set(['-기']) : new Set(['-고', '-지', '-게', '-아/어']);
        const ms = this._match(headStr, this._knownStems(headStr), { specIds: ids });
        for (const m of ms) for (const ch of chains) {
          if (!nomOK && !ch.every((p) => p.kind === 'aux' && TRAIL_AUX.has(p.form))) continue;
          const c = this._predCandidate(m, headStr, true);
          c.trailing = nomOK ? ch : ch.map((p) => (p.form === '는' || p.form === '은' ? Object.assign({}, p, { compose: { paren: 'nhấn mạnh' }, label: 'trợ từ nhấn mạnh / đối chiếu' } ) : p));
          c.score -= 3; c.conf -= 0.04;
          out.push(c);
        }
      }
    }
    _compound(w, out) {
      const auxStems = [];
      for (const stemText of Object.keys(AUX)) {
        const e = this.dict.get(stemText + '다');
        if (e) auxStems.push({ info: this._stemInfoFromEntry(stemText + '다', e), lemma: stemText + '다', entry: e, known: true });
      }
      if (!auxStems.length) return;
      for (let k = 2; k <= w.length - 1; k++) {
        const headStr = w.slice(0, k), tailStr = w.slice(k);
        const tails = this._match(tailStr, auxStems);
        if (!tails.length) continue;
        const heads = this._match(headStr, this._knownStems(headStr), { specIds: AUX_CONNECTIVES });
        for (const h of heads) for (const t of tails) {
          out.push({ type: 'compound', head: this._predCandidate(h, headStr, true), tail: this._predCandidate(t, tailStr, true), headStr, tailStr,
            lemma: h.stem.lemma, entry: h.stem.entry, known: true, score: 72 - 0.2 * k, conf: TYPE_CONF.compound });
        }
      }
    }
    _unknownCandidates(w, out) {
      out.push({ type: 'unknown', lemma: w, entry: null, known: false, score: 20, conf: TYPE_CONF.unknown });
    }
    _unknown(w) {
      return this._toAnalysis({ type: 'unknown', lemma: w, entry: null, known: false, score: 0, conf: TYPE_CONF.unknown }, w, []);
    }

    // ---- candidate -> Analysis -----------------------------------------------------------------------------
    _analyze(w) {
      const cands = this._collect(w);
      if (!cands.length) return this._unknown(w);
      const sig = (c) => [c.type, c.lemma, c.spec && c.spec.id, c.chain && c.chain.map((p) => p.form).join('+'), c.copula && c.copula.c, c.combo && c.combo.join('')].join('|');
      const uniq = [], seen = new Set();
      for (const c of cands) { const s = sig(c); if (!seen.has(s)) { seen.add(s); uniq.push(c); } }
      const best = uniq[0];
      const analysis = this._toAnalysis(best, w, uniq.slice(1));
      if (best.type === 'word' && best.entry && best.entry.pos === 'phrase') {
        const parse = uniq.find((c) => c.type !== 'word' && c.known);
        if (parse) {
          const sub = this._toAnalysis(parse, w, []);
          analysis.display[0].kind = 'lemma';
          analysis.display[0].note = 'cụm cố định — phân tích ngữ pháp bên dưới';
          analysis.display = analysis.display.concat(sub.display);
          analysis.features.push('phrase');
        }
      }
      const rival = uniq.find((c) => c.known && best.score - c.score < (c.type !== best.type ? 9 : 3) && (c.lemma !== best.lemma || c.type !== best.type));
      if (rival && best.type !== 'word' && best.type !== 'compound') { analysis.confidence = Math.min(analysis.confidence, 0.74); analysis.warnings.push('ambiguous'); }
      analysis.confidenceLabel = analysis.confidence >= 0.8 ? 'high' : analysis.confidence >= 0.55 ? 'medium' : 'low';
      return analysis;
    }
    _gloss(entry, known) { return known && entry ? shortGloss(entry) : ''; }
    _toAnalysis(c, w, others) {
      const a = { surface: w, type: c.type, lemma: c.lemma, pos: c.entry ? c.entry.pos : null, known: !!c.known, entry: c.entry || null,
        confidence: clampN(c.conf, 0, 1), confidenceLabel: 'low', score: c.score, display: [], summary: '', warnings: [], alternatives: [],
        features: [], stemHint: null };
      const line = (text, gloss, kind, note) => a.display.push({ text, gloss, kind, note: note || undefined });
      const NOT_FOUND = '(chưa có trong từ điển cục bộ)';

      if (c.type === 'word') {
        const isPred = this.dict.isPredicate(c.entry) && w.endsWith('다');
        a.summary = coreMeaning(c.entry);
        line(w, shortGloss(c.entry), isPred ? 'lemma' : 'stem', isPred ? 'dạng từ điển' : '');
        a.features.push(isPred ? 'dictionary-form' : 'base');
      } else if (c.type === 'nominal') {
        const g = c.known ? shortGloss(c.entry) : NOT_FOUND;
        if (c.contracted) line(w, c.contracted[0] + ' + -' + c.contracted[1], 'note', 'dạng rút gọn');
        line(c.contracted ? c.contracted[0] : c.stemText, g, 'stem');
        for (const p of c.chain) line('-' + p.form, p.label, 'particle');
        a.summary = c.known ? composeNominal(coreMeaning(c.entry), c.chain) : '';
        a.features.push('noun+particle');
        a.stemHint = c.stemText;
      } else if (c.type === 'copula') {
        const g = c.known ? shortGloss(c.entry) : NOT_FOUND;
        line(c.stemText, g, 'stem');
        line('-' + c.tail, c.copula.label, 'copula', '이다 = là');
        const cm = c.copula.compose;
        a.summary = c.known ? say(coreMeaning(c.entry), { pre: cm.pre, post: cm.post, parens: [cm.style, cm.paren] }) : '';
        a.features.push('noun+copula');
      } else if (c.type === 'predicate') {
        this._predicateLines(a, c, line, NOT_FOUND);
      } else if (c.type === 'compound') {
        const h = c.head, t = c.tail;
        const hg = h.known ? coreMeaning(h.entry) : '';
        line(h.lemma, this._gloss(h.entry, h.known), 'lemma');
        line(c.headStr + '-', 'nối với trợ động từ (-아/어)', 'stem');
        const auxKey = t.stemText, aux = AUX[auxKey];
        line(t.lemma, shortGloss(t.entry), 'lemma', aux ? aux.label : '');
        this._endingLines(a, t, line, c.tailStr);
        const core = aux ? aux.pat.replace(/\{x\}/g, hg || h.lemma) : hg;
        const v = specView(t.spec, 'v');
        a.summary = say(core, { pre: v.compose.pre, tense: tenseWords(t.combo), post: v.compose.post, parens: [v.compose.style, t.combo.includes('H') ? 'kính ngữ' : ''] });
        a.features.push('V-aux');
        a.lemma = h.lemma; a.entry = h.entry; a.pos = h.entry ? h.entry.pos : null;
      } else {
        line(w, NOT_FOUND, 'stem');
        a.warnings.push('not-in-dictionary');
      }
      a.posLabel = POS_LABEL[a.pos] || '';
      if (!c.known && c.type !== 'unknown') a.warnings.push('stem-not-in-dictionary');
      if (a.confidence < 0.55) a.warnings.push('low-confidence');
      a.confidenceLabel = a.confidence >= 0.8 ? 'high' : a.confidence >= 0.55 ? 'medium' : 'low';
      const seenAlt = new Set([c.type + '|' + c.lemma]);
      a.alternatives = [];
      for (const o of others) {
        const key = o.type + '|' + o.lemma;
        if (seenAlt.has(key) || (c.known && !o.known)) continue; // never offer guesses next to a dictionary-backed reading
        seenAlt.add(key);
        a.alternatives.push(this._lite(o, w));
        if (a.alternatives.length >= 3) break;
      }
      return a;
    }
    _lite(o, w) {
      const a = this._toAnalysis(o, w, []);
      return { lemma: a.lemma, type: a.type, summary: a.summary, display: a.display, confidence: a.confidence, known: a.known, pos: a.pos };
    }
    _predicateLines(a, c, line, NOT_FOUND) {
      const pos = c.info.pos;
      const view = specView(c.spec, pos);
      const g = c.known ? shortGloss(c.entry) : NOT_FOUND;
      const first = c.known ? coreMeaning(c.entry) : '';
      line(c.lemma, g, 'lemma', c.synthesized ? 'suy ra từ danh từ + 하다/되다' : (c.known ? '' : 'đoán từ gốc'));
      const tw = tenseWords(c.combo);
      if (c.combo.length) {
        const grp = say(first, { tense: tw, parens: [c.combo.includes('H') ? 'kính ngữ' : ''] });
        line(c.chainText + '-', c.known ? grp : '', 'stem', c.combo.map((x) => En.PREFINAL[x].id + ' = ' + En.PREFINAL[x].label).join('; '));
      }
      this._endingLines(a, c, line, a.surface);
      if (c.trailing) for (const p of c.trailing) line('-' + p.form, p.label, 'particle');
      let summary = say(first, { pre: view.compose.pre, tense: tw, post: view.compose.post, parens: [view.compose.style, c.combo.includes('H') ? 'kính ngữ' : '', view.compose.paren] });
      if (c.trailing) summary = composeNominal(summary.replace(/\s*\(.*\)$/, ''), c.trailing);
      a.summary = c.known ? summary : '';
      a.features.push(c.info.pos === 'adj' ? 'adjective-conjugation' : 'verb-conjugation');
      if (c.info.irr) a.features.push('irregular-' + c.info.irr);
      for (const code of c.combo) a.features.push('prefinal-' + code);
      a.features.push('ending:' + c.spec.id);
      a.stemHint = c.stemText;
      a.pos = c.entry ? c.entry.pos : (c.info.pos === 'adj' ? 'adj' : 'v');
    }
    // Adds the final-ending line. `surface` is the string produced by chain + ending (jamo-level remainder is shown,
    // e.g. 갑니다 -> -ㅂ니다, 먹었습니다 -> -습니다); contracted forms fall back to the canonical ending id.
    _endingLines(a, c, line, surface) {
      const spec = c.spec;
      const view = specView(spec, c.info ? c.info.pos : 'v');
      const chainText = c.chainText;
      let rem = null;
      if (chainText && surface !== chainText && nfd(surface).startsWith(nfd(chainText))) rem = toCompat(nfd(surface).slice(nfd(chainText).length));
      if (rem && c.trailing) {
        const trail = c.trailing.map((p) => p.form).join('');
        if (rem.endsWith(trail)) rem = rem.slice(0, rem.length - trail.length);
      }
      const text = rem && rem.length ? '-' + rem : spec.id;
      const note = rem && rem.length ? (text !== spec.id ? spec.id : '') : 'dạng rút gọn khi nối với gốc từ';
      line(text, view.label, 'ending', note);
    }
  }

  K.Morphology = { KoreanMorphology, shortGloss, firstMeaning, POS_LABEL, CONTRACTIONS, AUX };
  if (typeof module !== 'undefined' && module.exports) module.exports = K.Morphology;
})(typeof globalThis !== 'undefined' ? globalThis : this);
