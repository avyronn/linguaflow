/* Korean sentence analysis (shallow, rule based, honest about what it is).
 *
 * Input: a subtitle line. Output, for the sentence that contains the clicked word:
 *   info      sentence type, speech level, tense, honorific, negation (read from the last predicate and from patterns)
 *   segments  one entry per word: role (subject / topic / object / place ...), gloss, reading used
 *   clauses   predicate-headed chunks with their relation (cause, condition, contrast, quotation, modifier ...)
 *   patterns  grammar patterns (문형) found, with the clicked word's patterns first
 *   order     the word-order skeleton (topic · object · predicate)
 *
 * It is NOT a full parser: roles come from particles and endings, clause boundaries from connective endings. Where the
 * choice of reading (간 = noun "gan" or 가다 + -(으)ㄴ?) matters, the grammar patterns decide, and a pattern that needed
 * a non-default reading is reported with lower confidence.
 */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  const K = LF.Korean || (LF.Korean = {});

  // ---- label tables (Vietnamese) --------------------------------------------------------------------------------
  const TYPE_LABEL = {
    decl: 'Câu trần thuật', ques: 'Câu hỏi', imper: 'Câu mệnh lệnh / yêu cầu', prop: 'Câu rủ rê (cùng làm)', intent: 'Câu nêu ý định / hứa hẹn',
    excl: 'Câu cảm thán (ngạc nhiên, chợt nhận ra)', guess: 'Câu phỏng đoán', fragment: 'Câu bỏ lửng / chưa kết thúc', phrase: 'Cụm cố định / câu chào',
  };
  const LEVEL_LABEL = {
    hapsyo: ['Trang trọng (합쇼체)', '-ㅂ니다/-습니다 · với người trên, trong công việc, thông báo'],
    haeyo: ['Lịch sự thân mật (해요체)', '-아요/-어요 · hằng ngày, với người lớn tuổi hoặc mới quen'],
    hae: ['Thân mật (해체, 반말)', '-아/-어, -지 · với bạn bè, người nhỏ tuổi'],
    haera: ['Trống không (해라체)', '-다, -니, -냐, -아라 · văn viết, nói với trẻ em hoặc người rất thân'],
    hao: ['Kiểu cổ (하오체)', '-(으)오, -소 · thường gặp trong phim cổ trang'],
    hage: ['Kiểu cổ (하게체)', '-네, -게, -는가 · người lớn nói với người nhỏ hơn, phim cổ trang'],
  };
  const TENSE_LABEL = { present: 'hiện tại / trạng thái', past: 'quá khứ', future: 'tương lai / ý định / phỏng đoán', 'past-guess': 'phỏng đoán về quá khứ',
    'past-perfect': 'đã từng / đã xong từ trước', must: 'bắt buộc' };
  const REL_LABEL = {
    cause: 'nguyên nhân / lý do (… nên)', cond: 'điều kiện (nếu …)', conc: 'nhượng bộ (dù … vẫn)', contrast: 'đối lập (… nhưng)', purpose: 'mục đích (để …)',
    seq: 'nối tiếp (… rồi …)', simul: 'đồng thời (vừa … vừa …)', bg: 'bối cảnh (… thì / … nhưng)', quote: 'trích dẫn / câu hỏi gián tiếp', list: 'liệt kê (… và …)',
    time: 'thời gian (khi … / trong khi … / sau khi …)', alt: 'lựa chọn (… hoặc …)', imm: 'ngay khi (… là …)', degree: 'mức độ (càng … càng …)', manner: 'cách thức (như …)', intent: 'ý định / quyết định',
  };
  const ROLE = {
    subj: ['Chủ ngữ', 'người / vật thực hiện hoặc ở trạng thái (-이/-가)'],
    topic: ['Chủ đề', 'điều đang được nói tới, hoặc đối chiếu (-은/-는)'],
    obj: ['Tân ngữ', 'đối tượng chịu tác động (-을/-를)'],
    gen: ['Định ngữ sở hữu', '“của” (-의)'],
    loc: ['Địa điểm / thời điểm / đích', 'nơi tồn tại, nơi đến, thời điểm (-에)'],
    place: ['Nơi xảy ra hành động', 'nơi làm việc gì đó, hoặc nơi xuất phát (-에서)'],
    from: ['Điểm xuất phát', '“từ …” (-에서부터)'],
    recip: ['Người nhận', '“cho / với ai” (-에게, -한테, -께)'],
    source: ['Nguồn gốc', '“từ ai” (-에게서, -한테서, -(으)로부터)'],
    means: ['Phương tiện / hướng / lý do', '“bằng, về phía, vì” (-(으)로)'],
    capacity: ['Tư cách', '“với tư cách là” (-(으)로서)'],
    comit: ['Cùng với / và', '“cùng, và” (-와/-과, -하고, -(이)랑)'],
    compar: ['So sánh / giống', '“hơn, như, bằng” (-보다, -처럼, -만큼 …)'],
    adv: ['Bổ ngữ có trợ từ', 'trợ từ bổ nghĩa (-도 cũng, -만 chỉ, -까지 đến …)'],
    noun: ['Danh từ', 'không có trợ từ (có thể là chủ ngữ / tân ngữ bị lược trợ từ, hoặc bổ nghĩa cho từ sau)'],
    bound: ['Danh từ phụ thuộc', 'luôn đứng sau một định ngữ: 갈 수, 먹을 것, 간 적 …'],
    pred: ['Vị ngữ', 'từ kết thúc câu, nói điều gì về chủ ngữ'],
    predHead: ['Động từ chính của cụm vị ngữ', 'đi cùng một động từ phụ đứng sau (먹고 싶다, 가 보다 …); cả cụm làm vị ngữ'],
    predNoun: ['Vị ngữ danh từ', 'danh từ + 이다 = “là …”'],
    sub: ['Vị ngữ mệnh đề phụ', 'động từ / tính từ nối sang mệnh đề sau'],
    adn: ['Định ngữ', 'bổ nghĩa cho danh từ đứng sau'],
    nom: ['Danh từ hóa', 'biến động từ / tính từ thành danh từ (-기, -(으)ㅁ)'],
    advb: ['Trạng từ', 'bổ nghĩa cho động từ / tính từ'],
    det: ['Định từ', 'đứng trước danh từ (이, 그, 저, 무슨 …)'],
    int: ['Thán từ', 'tiếng gọi, cảm thán'],
    conj: ['Liên từ', 'nối câu'],
    ptcl: ['Trợ từ đứng riêng', 'thường dính vào từ đứng trước'],
    aux: ['Động từ phụ', 'đi kèm động từ trước, tạo nghĩa thêm'],
    unk: ['Từ chưa rõ', 'không có trong từ điển cục bộ (có thể là tên riêng)'],
  };
  const PARTICLE_ROLE = {
    '이/가': 'subj', 께서: 'subj', '은/는': 'topic', '을/를': 'obj', 의: 'gen', 에: 'loc', 에서: 'place', 에서부터: 'from', 에게: 'recip', 한테: 'recip', 께: 'recip',
    에게서: 'source', 한테서: 'source', '(으)로부터': 'source', '(으)로': 'means', '(으)로써': 'means', '(으)로서': 'capacity', '와/과': 'comit', '(이)랑': 'comit',
    하고: 'comit', 보다: 'compar', 처럼: 'compar', 같이: 'compar', 만큼: 'compar', 대로: 'compar', '에다(가)': 'loc', 에게로: 'recip', 한테로: 'recip',
    에는: 'loc', 에서는: 'place', 에게는: 'recip', 한테는: 'recip', 하고는: 'comit', '(으)로는': 'means', '(으)로서는': 'capacity',
  };
  const QUESTION_WORDS = new Set(['뭐', '무엇', '무슨', '누구', '누가', '어디', '언제', '왜', '어떻게', '어떤', '어느', '얼마', '얼마나', '몇', '어째서', '어찌', '웬', '어쩌다', '어떡해', '어떡하다']);
  const NEG_LEMMAS = new Set(['안', '못', '아니다']);

  // ---- units: the flat, matchable view of one reading ---------------------------------------------------------
  const NOMINAL_POS = new Set(['n', 'pron', 'num', 'cnt', 'nbound']);
  const clsOfPos = (pos, a) => {
    if (pos === 'v') return 'V';
    if (pos === 'adj' || pos === 'cop') return 'A';
    if (pos === 'aux') return 'X';
    if (a && a.features && a.features.includes('adjective-conjugation')) return 'A';
    return 'V';
  };
  const copForm = (id) => String(id || '').replace(/^이다\s*/, '');
  const norm = (lemma) => (K.Patterns && K.Patterns.NORM[lemma]) || null;

  function endFields(e) {
    return e ? { e, end: e.id, endKind: e.kind, rel: e.rel, sent: e.sent, lvl: e.lvl } : { e: null, end: '', endKind: null, rel: null, sent: null, lvl: null };
  }

  /** Units of ONE reading (an Analysis from morphology.analyze / readings). */
  function unitsOf(a, rank) {
    const g = a.grammar || {};
    const role = g.role || a.type;
    const common = { text: a.surface, known: !!a.known, a, rank: rank || 0, spelling: a.type === 'misspelled' };
    const HON_END = /^-\(으\)(세요|십시오|시오|시옵|소서)/;
    const tailOf = () => (g.particles || []).map((p) => p.key);
    switch (role) {
      case 'word': {
        if (NOMINAL_POS.has(a.pos)) return [Object.assign({}, common, { cls: 'N', lemma: a.lemma, pos: a.pos, norm: norm(a.lemma), tail: [], ...endFields(null) })];
        if (a.pos === 'v' || a.pos === 'adj' || a.pos === 'aux' || a.pos === 'cop') {
          const dictForm = /다$/.test(a.surface);
          const e = dictForm ? { id: '-다', kind: 'final', lvl: 'haera', sent: 'decl', rel: null, label: 'dạng từ điển / văn phong trống không', lv: 1 } : null;
          return [Object.assign({}, common, { cls: clsOfPos(a.pos, a), lemma: a.lemma, pos: a.pos, tail: [], dict: true, pre: [], tense: 'present', hon: !!g.honorific, ...endFields(e) })];
        }
        return [Object.assign({}, common, { cls: 'D', lemma: a.lemma, pos: a.pos, phrase: a.pos === 'phrase', tail: [], ...endFields(null) })];
      }
      case 'nominal':
        return [Object.assign({}, common, { cls: 'N', lemma: a.lemma, pos: a.pos || 'n', norm: norm(a.lemma), tail: tailOf(), ...endFields(null) })];
      case 'particle':
        return [Object.assign({}, common, { cls: 'T', lemma: a.surface, pos: 'ptcl', tail: tailOf(), ...endFields(null) })];
      case 'copula': {
        const e = g.ending || null;
        if ((a.features || []).includes('copula-only')) return [Object.assign({}, common, { cls: 'C', lemma: '이다', pos: 'cop', tail: [], cop: copForm(e && e.id), pre: [], tense: 'present', ...endFields(e), end: '이다' })];
        return [Object.assign({}, common, { cls: 'N', lemma: a.lemma, pos: a.pos || 'n', norm: norm(a.lemma), tail: ['이다'], cop: copForm(e && e.id), ...endFields(e), end: '' })];
      }
      case 'predicate':
        return [Object.assign({}, common, { cls: clsOfPos(a.pos, a), lemma: a.lemma, pos: a.pos, pre: g.prefinal || [], tense: g.tense, hon: !!g.honorific || !!(g.ending && HON_END.test(g.ending.id)), tail: tailOf(), ...endFields(g.ending) })];
      case 'compound': {
        const head = Object.assign({}, common, { cls: clsOfPos(a.pos, a), lemma: g.headLemma, pos: a.pos, pre: [], tense: 'present', tail: [], ...endFields(g.headEnding), compound: 'head' });
        const aux = Object.assign({}, common, { cls: 'X', lemma: g.auxLemma, pos: 'aux', pre: g.prefinal || [], tense: g.tense, hon: !!g.honorific, tail: tailOf(), ...endFields(g.ending), compound: 'aux' });
        return [head, aux];
      }
      case 'segmented': {
        const out = [];
        for (const p of a.parts || []) for (const u of unitsOf(p, rank)) { u.seg = true; u.spelling = u.spelling || a.type === 'misspelled'; out.push(u); }
        return out.length ? out : [Object.assign({}, common, { cls: 'U', lemma: a.surface, tail: [], ...endFields(null) })];
      }
      default:
        return [Object.assign({}, common, { cls: 'U', lemma: a.surface, pos: null, tail: [], ...endFields(null) })];
    }
  }

  // auxiliaries that may be hidden inside a dictionary word, with the part of speech the first part must have
  const LEX_AUX = [['지다', 'adj'], ['드리다', 'v'], ['주다', 'v'], ['버리다', 'v']];

  const isPredUnit = (u) => !!u.e && (u.cls !== 'N' || (u.tail || []).includes('이다'));

  // ---- the analyser ---------------------------------------------------------------------------------------------
  const ALT_ENDING_GAP = 4.5, ALT_ENDING_GAP_FINAL = 7; // max score gap to the best reading for a single-ending entry (in the last word of a clause a worse reading is tolerated: 뭐 해?)
  const SENT_END = /[.?!…。？！]/;
  const BARRIER = /[,;:，、；：]/;
  const CLOSERS = /^[\s"'”’)\]」』»]+$/;
  // The quotation marker written right after a closing quote: “가자!”라고 했어요, 「좋아」라는 말. It belongs to the quote that precedes it
  // (so a “?” or “!” inside the quotation does not end the sentence), and the clause of the quotation ends with it.
  const QUOTE_AFTER = /^이?라(?:고|는|곤|며|면서)/;
  const QUOTE_OPEN = { '”': '“', '’': '‘', '」': '「', '』': '『', '»': '«', '"': '"', "'": "'" }; // closing quote -> the opening quote it pairs with
  const QUOTE_MARKERS = new Set(['라고', '라는', '라고는', '라곤', '라고도', '라며', '라면서', '이라고', '이라는', '이라고는', '이라곤', '이라고도', '이라며', '이라면서']);

  class SentenceAnalyzer {
    /** @param {KoreanMorphology} morphology  @param {object[]} catalogue  raw pattern tuples (grammar-patterns.js) */
    constructor(morphology, catalogue) {
      this.morph = morphology;
      this.patterns = (catalogue || []).map((d) => K.Patterns.compile(d));
      this.byId = new Map(this.patterns.map((p) => [p.id, p]));
    }

    analyze(text, opts) {
      const o = opts || {};
      const s = String(text == null ? '' : text);
      const sentences = this._split(s);
      if (!sentences.length) return null;
      const f = this._focusOffset(o.focus, s);
      let pick = 0;
      if (f != null) { const i = sentences.findIndex((x) => f >= x.start && f < x.end + 1); if (i >= 0) pick = i; }
      this._keepHidden = !!o.all; // (diagnostics / tests: also return the patterns that were hidden by a more specific one, flagged `hidden`)
      const r = this._analyzeSentence(sentences[pick], s, f);
      r.sentenceCount = sentences.length;
      r.sentenceIndex = pick;
      return r;
    }
    _focusOffset(focus, s) {
      if (focus == null) return null;
      if (typeof focus === 'number') return focus;
      if (typeof focus === 'string') { const i = s.indexOf(focus); return i >= 0 ? i : null; }
      if (typeof focus.start === 'number') return focus.start;
      return null;
    }
    // split into sentences of tokens (punctuation attached to the sentence it ends)
    _split(s) {
      const toks = K.Tokenizer.tokenize(s);
      const out = [];
      let cur = null;
      const open = () => { if (!cur) cur = { toks: [], start: 0, end: 0 }; return cur; };
      for (let i = 0; i < toks.length; i++) {
        const t = toks[i];
        if (t.type === 'space') { if (cur) cur.toks.push(t); continue; }
        const c = open();
        if (!c.toks.some((x) => x.type !== 'space')) c.start = t.start;
        c.toks.push(t); c.end = t.end;
        if (t.type === 'punct' && SENT_END.test(t.text)) {
          while (i + 1 < toks.length && (toks[i + 1].type === 'space' || (toks[i + 1].type === 'punct' && CLOSERS.test(toks[i + 1].text)))) { i++; c.toks.push(toks[i]); if (toks[i].type !== 'space') c.end = toks[i].end; }
          const lastTok = toks[i], nx = toks[i + 1];
          if (nx && nx.type === 'word' && lastTok.type === 'punct' && /["'”’)\]」』»]$/.test(lastTok.text) && lastTok.end === nx.start && QUOTE_AFTER.test(nx.text)) continue; // “가자!”라고 했어요: the sentence goes on after the closing quote
          out.push(c); cur = null;
        }
      }
      if (cur && cur.toks.some((x) => x.type === 'word' || x.type === 'number' || x.type === 'latin')) out.push(cur);
      return out.filter((x) => x.toks.some((t) => t.type === 'word'));
    }

    // Dictionary words that are really "verb + auxiliary" (따뜻해지다 = 따뜻하다 + -아/어 + 지다, 도와주다 = 돕다 + -아/어 + 주다) are
    // opened up into two units, exactly as the spaced spelling (따뜻해 지다, 도와 주다) is analysed - so the same grammar entry matches both.
    _unitsFor(a, rank) {
      const units = unitsOf(a, rank);
      if (units.length !== 1) return units;
      const u = units[0];
      if ((u.cls !== 'V' && u.cls !== 'A') || u.compound || u.seg) return units;
      const hit = this._lexSplit(u.lemma);
      if (!hit) return units;
      const e = K.Endings && K.Endings.BY_ID.get('-아/어');
      const head = Object.assign({}, u, { cls: hit.cls, lemma: hit.base, pos: hit.pos, pre: [], tense: 'present', hon: false, tail: [], dict: false, compound: 'head', split: true }, endFields(e));
      const aux = Object.assign({}, u, { cls: 'X', lemma: hit.aux, pos: 'aux', compound: 'aux', split: true });
      return [head, aux];
    }
    _lexSplit(lemma) {
      const c = this._splitCache || (this._splitCache = new Map());
      if (c.has(lemma)) return c.get(lemma);
      let res = null;
      for (const [aux, basePos] of LEX_AUX) {
        if (lemma.length <= aux.length + 1 || !lemma.endsWith(aux)) continue;
        const a = this.morph.analyze(lemma.slice(0, -aux.length));
        const g = a && a.grammar;
        if (!a || !a.known || a.type !== 'predicate' || !g || !g.ending || g.ending.id !== '-아/어' || (g.prefinal && g.prefinal.length)) continue;
        if (a.pos !== basePos) continue;
        res = { base: a.lemma, pos: a.pos, cls: clsOfPos(a.pos, a), aux };
        break;
      }
      c.set(lemma, res);
      return res;
    }

    _lattice(sent) {
      // eojeol entries (words, numbers, Latin words); punctuation that splits clauses becomes a barrier (null)
      const items = [];
      let eo = 0;
      for (const t of sent.toks) {
        if (t.type === 'word') {
          // alternative readings that would need an archaic copula (나요 = 나 + 이오 ...) are not offered; the primary reading is always kept
          const readings = this.morph.readings(t.text, 4).map((a, r) => ({ a, units: this._unitsFor(a, r) }))
            .filter((rd, r) => r === 0 || !rd.units.some((u) => u.cop && ((u.lvl === 'hao' || u.lvl === 'hage') || (u.lemma || '').length <= 1))); // ... nor a copula glued to a one-syllable word (그래요 = 그 + 이래요)
          // a fixed expression that is also an inflected predicate (안녕하세요, 감사합니다, 알겠습니다): its grammar is the predicate's, but alone it is still "a fixed phrase"
          if (readings[0] && readings[0].a && readings[0].a.pos === 'phrase') readings.slice(1).forEach((rd) => rd.units.forEach((u) => { u.idiom = true; }));
          items.push({ eo: eo++, text: t.text, start: t.start, end: t.end, type: 'word', readings });
        } else if (t.type === 'number' || t.type === 'latin') {
          const u = { cls: 'N', text: t.text, lemma: t.text, pos: 'n', tail: [], known: false, foreign: true, rank: 0, a: null, e: null, end: '', endKind: null, rel: null, sent: null, lvl: null };
          items.push({ eo: eo++, text: t.text, start: t.start, end: t.end, type: t.type, readings: [{ a: null, units: [u] }] });
        } else if (t.type === 'punct' && BARRIER.test(t.text)) items.push(null);
      }
      return items;
    }

    _analyzeSentence(sent, full, focusOff) {
      const items = this._lattice(sent);
      const words = items.filter(Boolean);
      // barrier-free stretches
      const stretches = [];
      let cur = [];
      for (const it of items) { if (it === null) { if (cur.length) stretches.push(cur); cur = []; } else cur.push(it); }
      if (cur.length) stretches.push(cur);
      let raw = [];
      for (const st of stretches) {
        const m = K.Patterns.matchSegment(this.patterns, st.map((x) => ({ eo: x.eo, readings: x.readings })));
        for (const x of m) x.stretch = st;
        raw = raw.concat(m);
      }
      // A single-ending entry (-(으)면, -아/어, -게 ...) is only shown for a reading that is (nearly) as good as the best one:
      // 밤새 (adverb) must not be explained as 밤새다 + -아/어, nor 새 (determiner) as 새다 + -아/어.
      raw = raw.filter((m) => m.pat.kind !== 'ending' || m.path.every((q) => {
        if (!q.r) return true;
        const w = m.stretch[q.i], best = w.readings[0].a, used = w.readings[q.r].a;
        if (!best || !used || (best.entry && best.entry.pos === 'phrase')) return true; // (a dictionary phrase such as 앉으세요 is itself an inflected form)
        const gap = best.score - used.score;
        return gap <= ALT_ENDING_GAP || (q.i === m.stretch.length - 1 && gap <= ALT_ENDING_GAP_FINAL);
      }));
      // resolve: lowest penalty and longest first; an eojeol keeps ONE reading
      const matches = raw.map((m) => {
        const first = m.path[0], last = m.path[m.path.length - 1];
        const a = m.stretch[first.i].eo, b = m.stretch[last.i].eo;
        return Object.assign(m, { eoFrom: a, eoTo: b, len: m.path.length });
      }).sort((x, y) => (+!!x.pat.generic - +!!y.pat.generic) || x.penalty - y.penalty || y.len - x.len); // broad (generic) patterns lock their readings last
      const lock = new Map(), accepted = [], dup = new Set();
      for (const m of matches) {
        const need = new Map();
        for (const q of m.path) need.set(m.stretch[q.i].eo, q.r);
        let ok = true;
        for (const [eo, r] of need) { const c = lock.get(eo); if (c !== undefined && c !== r) { ok = false; break; } }
        if (!ok) continue;
        const key = m.pat.id + '|' + m.eoFrom + '|' + m.eoTo;
        if (dup.has(key)) continue;
        dup.add(key);
        for (const [eo, r] of need) lock.set(eo, r);
        accepted.push(m);
      }
      const chosen = (w) => (lock.has(w.eo) ? lock.get(w.eo) : 0);

      // the unit stream with chosen readings
      const stream = [];
      for (const w of words) {
        const rd = w.readings[chosen(w)] || w.readings[0];
        rd.units.forEach((u) => stream.push(Object.assign({}, u, { eo: w.eo })));
      }
      const focusEo = focusOff == null ? -1 : (words.find((w) => focusOff >= w.start && focusOff < w.end) || { eo: -1 }).eo;

      const patterns = this._reportPatterns(accepted, words, chosen, focusEo, full);
      const clauses = this._clauses(stream, words, accepted, full);
      // the words in front of the last word of a complex predicate (먹고 싶다, 가 보다, 오고 있다) are its main verb: the -고 / -아/어 on them is part of
      // the construction, not a clause of its own (the same patterns keep _clauses from closing a clause there)
      const heads = new Map();
      for (const m of accepted) {
        if (!m.pat.cx) continue;
        const eos = [...new Set(m.path.map((q) => m.stretch[q.i].eo))];
        eos.slice(0, -1).forEach((e) => { if (!heads.has(e)) heads.set(e, m.pat); });
      }
      const segments = this._segments(words, chosen, clauses, patterns, focusEo, heads);
      const info = this._info(stream, words, patterns, full, sent, this._quotedEos(full, words));
      const order = this._order(segments, clauses);
      return { text: full.slice(sent.start, sent.end), offset: sent.start, focusEo, info, segments, clauses, patterns, order };
    }

    // ---- patterns ----------------------------------------------------------------------------------------------
    _reportPatterns(accepted, words, chosen, focusEo, full) {
      const out = accepted.map((m) => {
        const p = m.pat;
        const eos = [...new Set(m.path.map((q) => m.stretch[q.i].eo))];
        const ws = eos.map((e) => words.find((w) => w.eo === e));
        const via = [];
        let conf = 'high';
        const down = (why) => { conf = 'medium'; if (!via.includes(why)) via.push(why); };
        for (const q of m.path) {
          const w = words.find((x) => x.eo === m.stretch[q.i].eo);
          const rd = w.readings[q.r], u = rd.units[q.u];
          if (q.r > 0) { // the pattern itself chose a reading that is not the best one: say so, and distrust it when it is much worse
            if (!via.includes('alt:' + w.text)) via.push('alt:' + w.text);
            const best = w.readings[0].a, used = rd.a;
            if (best && used && best.score - used.score > 12) down('alt:' + w.text);
          }
          if (u.seg) down('segmented:' + w.text);
          if (u.spelling) down('spelling:' + w.text);
          if (u.cls === 'U') down('unknown:' + w.text);
          if (u.a && u.a.confidenceLabel === 'low') down('uncertain:' + w.text);
        }
        if (p.weak && conf === 'high') conf = 'medium';
        const from = ws[0].start, to = ws[ws.length - 1].end;
        return { id: p.id, form: p.form, meaning: p.meaning, note: p.note, lv: p.lv, cat: p.cat, kind: p.kind, ex: p.ex, from, to, text: full.slice(from, to), eo: [eos[0], eos[eos.length - 1]], confidence: conf, via,
          focus: focusEo >= 0 && eos.includes(focusEo), cx: !!p.cx, generic: !!p.generic, weak: !!p.weak, future: !!p.future, _m: m };
      });
      // A broad construction (V-는 것, N이/가 있다 ...) is hidden when a more specific pattern covers the same words
      // (a generic one is also hidden by a larger generic one that contains it: V-(으)ㄴ 적이 있다 hides N이/가 있다).
      // A single-ending entry (-(으)면, -고 ...) describes the ending of ONE word: it is only hidden by a pattern that itself uses that very ending
      // (V-(으)면 안 되다), never by one that merely contains the same word (N이/가 있다 contains 없으니까 but says nothing about -(으)니까).
      const usesEnding = (y, q) => { const sl = y._m.variant && y._m.variant.slots[q.s]; return !!sl && !!sl.alts && sl.alts.some((a) => a.end || a.kind || a.rel); };
      const sharesEnding = (x, y) => x._m.path.some((qx) => y._m.path.some((qy) => qx.i === qy.i && qx.u === qy.u && qx.r === qy.r && usesEnding(y, qy)));
      const hidden = (x) => x.generic && out.some((y) => y !== x && (x.kind === 'ending'
        ? sharesEnding(x, y) && (!y.generic || y._m.len > x._m.len)
        : y.eo[0] <= x.eo[0] && y.eo[1] >= x.eo[1] && (!y.generic || y._m.len > x._m.len)));
      const kept = (this._keepHidden ? out.map((x) => Object.assign(x, { hidden: hidden(x) })) : out.filter((x) => !hidden(x)));
      kept.sort((a, b) => (b.focus - a.focus) || a.from - b.from || (b.to - b.from) - (a.to - a.from));
      return kept;
    }

    // ---- clauses -----------------------------------------------------------------------------------------------
    // A clause ends at a final or connective ending (or at the last word of a pattern that links clauses, V-기 때문에, V-(으)ㄹ 때).
    // Adnominal / nominalised forms stay inside their clause: their role is shown on the word itself.
    _clauses(stream, words, accepted, full) {
      const merged = new Set(), links = new Map(), eoUnits = new Map();
      stream.forEach((u, i) => { if (!eoUnits.has(u.eo)) eoUnits.set(u.eo, []); eoUnits.get(u.eo).push(i); });
      const idxOf = (m) => m.path.map((q) => (eoUnits.get(m.stretch[q.i].eo) || [])[q.u]).filter((x) => x != null);
      for (const m of accepted) {
        if (!m.pat.cx && !m.pat.link) continue;
        const idx = idxOf(m);
        if (!idx.length) continue;
        idx.slice(0, -1).forEach((i) => merged.add(i));
        if (m.pat.link) links.set(idx[idx.length - 1], m.pat);
      }
      const bounds = [];
      stream.forEach((u, i) => {
        const lk = links.get(i);
        if (lk) { bounds.push({ i, eo: u.eo, kind: 'sub', rel: lk.link, ending: lk.form, label: lk.meaning }); return; }
        if (!isPredUnit(u) || merged.has(i) || u.compound === 'head') return;
        if (u.endKind !== 'final' && u.endKind !== 'connective') return;
        const next = stream[i + 1];
        if (next && next.eo === u.eo && isPredUnit(next)) return; // several predicates inside one spaceless word: the last one closes the clause
        // “집에 가고 싶어요”라고: a quotation that ends here; the marker after the closing quote is part of it
        const quoted = !!next && next.eo === u.eo + 1 && !!next.phrase && QUOTE_MARKERS.has(next.lemma);
        if (quoted) { bounds.push({ i, eo: next.eo, kind: 'quote', rel: 'quote', marked: true, ending: u.end || ('이다 ' + (u.cop || '')), label: u.e ? u.e.label : '' }); return; }
        bounds.push({ i, eo: u.eo, kind: u.endKind === 'final' ? 'final' : 'sub', rel: u.endKind === 'connective' ? (u.rel || null) : null, ending: u.end || ('이다 ' + (u.cop || '')), label: u.e ? u.e.label : '' });
      });
      const clauses = [];
      let startEo = words.length ? words[0].eo : 0;
      const lastReal = bounds.reduce((m, b, k) => (b.marked ? m : k), -1); // (a quotation that follows the main predicate - 말했어요: “…”라고 - does not take its place)
      bounds.forEach((b, k) => {
        let kind = b.kind;
        if (b.kind === 'final') kind = k === lastReal ? 'main' : 'sub';
        else if (b.rel === 'quote' && !links.has(b.i)) kind = 'quote';
        let pi = b.i;
        while (pi > 0 && !(stream[pi].cls === 'V' || stream[pi].cls === 'A' || stream[pi].cls === 'X' || isPredUnit(stream[pi]))) pi--;
        clauses.push({ fromEo: startEo, toEo: b.eo, kind, rel: b.rel, pred: stream[pi] ? stream[pi].lemma : null, ending: b.ending, label: b.label, marked: !!b.marked });
        startEo = b.eo + 1;
      });
      const lastEo = words.length ? words[words.length - 1].eo : -1;
      if (startEo <= lastEo) {
        if (clauses.length && clauses[clauses.length - 1].kind === 'main') clauses[clauses.length - 1].toEo = lastEo; // words trailing the final predicate stay with it
        else clauses.push({ fromEo: startEo, toEo: lastEo, kind: 'frag', rel: null, pred: null, ending: null, label: '' });
      }
      const lastC = clauses[clauses.length - 1];
      if (lastC && (lastC.kind === 'sub' || (lastC.kind === 'quote' && !lastC.marked)) && lastC.toEo === lastEo) lastC.kind = 'open'; // …는데 / …고 left hanging: a suspended sentence
      for (const c of clauses) {
        const ws = words.filter((w) => w.eo >= c.fromEo && w.eo <= c.toEo);
        // the clause as it was written (a number or Latin word glued to its particle - TV를 - is two items for the matcher, one word for the reader)
        c.text = full && ws.length ? full.slice(ws[0].start, ws[ws.length - 1].end).replace(/\s+/g, ' ') : ws.map((w) => w.text).join(' ');
        c.relLabel = c.rel ? (REL_LABEL[c.rel] || '') : '';
      }
      return clauses;
    }

    // ---- segments ----------------------------------------------------------------------------------------------
    _segments(words, chosen, clauses, patterns, focusEo, heads) {
      const covered = new Map();
      for (const p of patterns) for (let e = p.eo[0]; e <= p.eo[1]; e++) { if (!covered.has(e)) covered.set(e, []); covered.get(e).push(p.id); }
      return words.map((w) => {
        const r = chosen(w);
        const rd = w.readings[r] || w.readings[0];
        const a = rd.a;
        const units = rd.units;
        let role = this._roleOf(units, a, words, w);
        let roleHint = ROLE[role] ? ROLE[role][1] : '';
        let gloss = a ? (a.summary || '') : '';
        const hd = heads && heads.get(w.eo);
        const lastU = units[units.length - 1];
        if (hd && (role === 'sub' || role === 'pred') && lastU && (lastU.cls === 'V' || lastU.cls === 'A' || lastU.cls === 'X')) {
          // 먹고 (in 먹고 싶어요) is "to eat" here, not "to eat and": the connective ending belongs to the construction, which the pattern explains
          role = 'predHead';
          roleHint = ROLE.predHead[1] + ' — ' + hd.form + ' (' + hd.meaning + ')';
          if (a && a.entry && a.type === 'predicate') gloss = K.Morphology.coreMeaning(a.entry) || gloss;
        }
        const ci = clauses.findIndex((c) => w.eo >= c.fromEo && w.eo <= c.toEo);
        return { i: w.eo, text: w.text, start: w.start, end: w.end, role, roleLabel: ROLE[role] ? ROLE[role][0] : '', roleHint,
          lemma: a ? a.lemma : w.text, pos: a ? a.pos : null, posLabel: a ? a.posLabel : '', gloss, type: a ? a.type : w.type,
          reading: r, confidence: a ? a.confidenceLabel : 'high', clause: ci, focus: w.eo === focusEo, patterns: covered.get(w.eo) || [] };
      });
    }
    _roleOf(units, a, words, w) {
      const last = units[units.length - 1];
      if (!a) return 'noun';
      if (last.cls === 'U') return 'unk';
      if (last.cls === 'T') return 'ptcl';
      if (last.cls === 'D') {
        if (last.phrase && QUOTE_MARKERS.has(last.lemma)) return 'ptcl'; // 라고 / 이라는 … after a closing quote
        return { adv: 'advb', det: 'det', int: 'int', conj: 'conj' }[last.pos] || (last.phrase ? 'int' : 'advb');
      }
      if (isPredUnit(last)) {
        if (last.cls === 'N' || last.cls === 'C') return last.endKind === 'final' ? 'predNoun' : (last.endKind === 'adnominal' ? 'adn' : last.endKind === 'nominalizer' ? 'nom' : 'sub');
        if (last.endKind === 'final') return 'pred';
        if (last.endKind === 'adnominal') return 'adn';
        if (last.endKind === 'nominalizer') return 'nom';
        return 'sub';
      }
      if (last.cls === 'N') {
        const tail = last.tail || [];
        if (!tail.length) return last.pos === 'nbound' ? 'bound' : 'noun';
        for (const k of tail) if (PARTICLE_ROLE[k]) return PARTICLE_ROLE[k];
        return 'adv';
      }
      if (last.cls === 'V' || last.cls === 'A' || last.cls === 'X') return last.dict ? 'pred' : 'sub';
      return 'noun';
    }

    // The words written inside a quotation that is closed right before a quotation marker (“왜 그래?”라고 물었어요): they are a sentence of their own,
    // so they do not decide the type, tense, politeness or negation of the sentence that quotes them.
    _quotedEos(full, words) {
      const inside = new Set();
      for (const m of words) {
        if (m.start < 2 || !QUOTE_AFTER.test(m.text)) continue;
        const open = QUOTE_OPEN[full[m.start - 1]];
        if (!open) continue;
        const from = full.lastIndexOf(open, m.start - 2);
        if (from < 0) continue;
        for (const w of words) if (w.start >= from && w.end <= m.start - 1) inside.add(w.eo);
      }
      return inside;
    }

    // ---- sentence facts ----------------------------------------------------------------------------------------
    _info(stream, words, patterns, full, sent, quoted) {
      // what is said inside a quotation (“왜 그래?”라고 물었어요) is not the type / tense / politeness of the sentence that quotes it - unless nothing else is left
      if (quoted && quoted.size) {
        const rest = stream.filter((u) => !quoted.has(u.eo));
        if (rest.length) { stream = rest; patterns = patterns.filter((p) => !(quoted.has(p.eo[0]) && quoted.has(p.eo[1]))); }
      }
      const info = { type: null, typeLabel: '', typeNote: '', level: null, levelLabel: '', levelHint: '', tense: null, tenseLabel: '', honorific: false, negative: false, negNote: '', question: false, notes: [] };
      const preds = stream.map((u, i) => ({ u, i })).filter((x) => isPredUnit(x.u) && x.u.endKind);
      const lastP = preds.length ? preds[preds.length - 1].u : null;
      const textEnd = full.slice(sent.start, sent.end).trim();
      const hasQM = /[?？]\s*["'”’)\]」』]*$/.test(textEnd);
      const qWord = stream.some((u) => QUESTION_WORDS.has(u.lemma) || QUESTION_WORDS.has(u.norm || ''));
      if (stream.length === 1 && stream[0].phrase) {
        info.type = 'phrase';
      } else if (lastP) {
        const e = lastP.e;
        info.level = e.lvl || null;
        let t = e.sent || (e.kind === 'final' ? 'decl' : 'fragment');
        if (lastP.endKind === 'connective' && !e.sent) t = 'fragment';
        if (lastP.endKind === 'adnominal' || lastP.endKind === 'nominalizer') t = 'fragment';
        const flexible = t === 'decl' && (e.lvl === 'haeyo' || e.lvl === 'hae') && lastP.endKind === 'final' && !lastP.dict;
        if (hasQM && t !== 'ques') { t = 'ques'; info.typeNote = 'có dấu “?” — đuôi câu này được hỏi bằng ngữ điệu lên giọng'; }
        else if (flexible && qWord) { t = 'ques'; info.typeNote = 'có từ để hỏi nên nhiều khả năng là câu hỏi (đuôi này dùng cho cả kể và hỏi, ngữ điệu quyết định)'; }
        info.flexible = flexible && t === 'decl';
        info.type = t;
        info.tense = lastP.tense || (lastP.pre && lastP.pre.length ? null : 'present');
        info.honorific = stream.some((u) => u.hon) || false;
        // 안녕하세요 / 감사합니다 / 알겠습니다: a fixed expression, not an order or a statement (앉으세요 stays an order; 괜찮으세요? stays a question)
        if (stream.length === 1 && stream[0].idiom && (lastP.sent !== 'imper' || lastP.lemma === '안녕하다') && !hasQM) { info.type = 'phrase'; info.typeNote = ''; info.flexible = false; info.honorific = false; }
        // patterns can refine the tense: V-(으)ㄹ 거예요, -(으)ㄹ게요, V-(으)려고 하다 ... (flag `future` in the catalogue) are about what is going to happen
        if (patterns.some((p) => p.future)) { if (!info.tense || info.tense === 'present') info.tense = 'future'; }
      } else if (hasQM) { info.type = 'ques'; }
      else info.type = words.length ? 'fragment' : null;
      if (info.type) { info.typeLabel = TYPE_LABEL[info.type] || ''; }
      if (info.level && LEVEL_LABEL[info.level]) { info.levelLabel = LEVEL_LABEL[info.level][0]; info.levelHint = LEVEL_LABEL[info.level][1]; }
      if (info.tense) info.tenseLabel = TENSE_LABEL[info.tense] || '';
      info.question = info.type === 'ques' || qWord;
      info.questionWords = stream.filter((u) => QUESTION_WORDS.has(u.lemma) || QUESTION_WORDS.has(u.norm || '')).map((u) => u.text);
      // negation: 안 / 못 in front of a predicate, -지 않다 / -지 못하다 / -지 말다, 아니다 (read from the patterns that were found)
      const negPat = patterns.find((p) => p.cat === 'neg');
      const negWord = stream.find((u) => u.cls === 'D' && (u.lemma === '안' || u.lemma === '못'));
      const noun = stream.find((u) => NEG_LEMMAS.has(u.lemma) && isPredUnit(u));
      if (negPat) { info.negative = true; info.negNote = negPat.form; }
      else if (negWord) { info.negative = true; info.negNote = negWord.lemma + ' + động từ'; }
      else if (noun) { info.negative = true; info.negNote = noun.lemma; }
      return info;
    }

    _order(segments, clauses) {
      const main = [...clauses].reverse().find((c) => c.kind === 'main') || (clauses.length ? clauses[clauses.length - 1] : null);
      const inMain = segments.filter((s) => !main || (s.i >= main.fromEo && s.i <= main.toEo));
      const seq = [];
      for (const s of inMain) { if (['subj', 'topic', 'obj', 'pred', 'predNoun', 'place', 'loc', 'recip', 'means', 'comit', 'source', 'compar'].includes(s.role)) seq.push(s.role); }
      return { roles: seq, mainClause: main ? clauses.indexOf(main) : -1 };
    }
  }

  K.Sentence = { SentenceAnalyzer, unitsOf, isPredUnit, TYPE_LABEL, LEVEL_LABEL, TENSE_LABEL, REL_LABEL, ROLE, PARTICLE_ROLE, QUESTION_WORDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = K.Sentence;
})(typeof globalThis !== 'undefined' ? globalThis : this);
