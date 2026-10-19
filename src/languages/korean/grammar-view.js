/* Korean grammar — presentation layer.
 *   presentSentence(raw)  turns the analyser's result (sentence.js) into the language-neutral SentenceAnalysis that the core lays out
 *                         (see LanguagePack.analyzeSentence): facts, patterns, words, clauses, structure.
 *   buildReference()      the searchable grammar reference of the popup: sentence-structure guide, the pattern catalogue by category,
 *                         particles and a quick table of the remaining verb endings.
 * All learner-facing text is Vietnamese (the gloss language of this pack). */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  const K = LF.Korean || (LF.Korean = {});

  const KIND_LABEL = { main: 'Mệnh đề chính', sub: 'Mệnh đề phụ', quote: 'Lời được dẫn', open: 'Bỏ lửng / chưa kết thúc', frag: 'Mảnh câu' };
  const ENDING_TAG = { final: 'đuôi cuối câu', connective: 'đuôi liên kết', adnominal: 'đuôi định ngữ', nominalizer: 'danh từ hóa' };
  const PARTICLE_TAG = { case: 'trợ từ cách', aux: 'trợ từ bổ trợ', comp: 'trợ từ so sánh', polite: 'trợ từ lịch sự', voc: 'trợ từ gọi', plural: 'hậu tố số nhiều', suffix: 'hậu tố', contr: 'dạng rút gọn' };

  // `via` codes of a pattern report (sentence.js) -> a sentence for the learner
  const VIA_TEXT = {
    alt: (w) => `“${w}” được đọc theo cách phân tích thứ hai (không phải cách mặc định) vì mẫu này cần như vậy — có thể nhầm.`,
    segmented: (w) => `“${w}” viết liền nhiều từ nên đã được tách ra bằng ước đoán.`,
    spelling: (w) => `“${w}” có vẻ viết tắt hoặc viết sai chính tả; đã đoán dạng đúng.`,
    unknown: (w) => `“${w}” không có trong từ điển.`,
    uncertain: (w) => `Phân tích của “${w}” chưa chắc chắn.`,
    weak: () => 'Cấu trúc này dễ bị nhầm với một cách dùng khác — hãy đối chiếu với câu dịch.',
  };
  function viaNotes(via) {
    const out = [];
    for (const v of via || []) {
      const i = v.indexOf(':');
      const code = i < 0 ? v : v.slice(0, i), word = i < 0 ? '' : v.slice(i + 1);
      const f = VIA_TEXT[code];
      if (f) out.push(f(word));
    }
    return out;
  }

  const catName = (id) => { const c = (K.GrammarPatterns.CATEGORIES || []).find((x) => x[0] === id); return c ? c[1] : ''; };
  const exOf = (list) => (list || []).map((e) => ({ text: e[0], translation: e[1] }));

  /** raw = SentenceAnalyzer.analyze() result */
  function presentSentence(raw) {
    if (!raw) return null;
    const S = K.Sentence;
    const info = raw.info || {};
    const facts = [];
    if (info.typeLabel) facts.push({ id: 'type', label: 'Loại câu', value: info.typeLabel, hint: info.typeNote || (info.flexible ? 'đuôi này dùng được cho cả câu kể, câu hỏi và câu rủ — ngữ điệu quyết định' : '') });
    if (info.levelLabel) facts.push({ id: 'level', label: 'Mức độ lịch sự', value: info.levelLabel, hint: info.levelHint || '' });
    if (info.tenseLabel) facts.push({ id: 'tense', label: 'Thì / thể', value: info.tenseLabel });
    if (info.honorific) facts.push({ id: 'honorific', label: 'Kính ngữ', value: 'có (chủ ngữ là người đáng kính)' });
    if (info.negative) facts.push({ id: 'negation', label: 'Phủ định', value: 'có', hint: info.negNote || '' });
    if (info.questionWords && info.questionWords.length) facts.push({ id: 'qwords', label: 'Từ để hỏi', value: info.questionWords.join(', ') });

    const patterns = (raw.patterns || []).map((p) => ({
      id: p.id, title: p.form, meaning: p.meaning, note: p.note, level: p.lv, category: p.cat, categoryLabel: catName(p.cat), kind: p.kind === 'ending' ? 'ending' : 'pattern',
      text: p.text, confidence: p.confidence, notes: p.confidence === 'high' ? [] : viaNotes(p.via.concat(p.weak ? ['weak'] : [])), focus: !!p.focus, examples: exOf(p.ex),
    }));
    const words = (raw.segments || []).map((s) => ({
      index: s.i, text: s.text, role: s.role, roleLabel: s.roleLabel, roleHint: s.roleHint, lemma: s.lemma, posLabel: s.posLabel, gloss: s.gloss,
      confidence: s.confidence, clause: s.clause, focus: !!s.focus, patterns: s.patterns.slice(),
    }));
    const clauses = (raw.clauses || []).map((c, i) => ({
      index: i, text: c.text, kind: c.kind, kindLabel: KIND_LABEL[c.kind] || '', relationLabel: c.relLabel || '', predicate: c.pred || '', ending: c.ending || '', label: c.label || '',
    }));
    const structure = [];
    for (const r of (raw.order && raw.order.roles) || []) { if (S.ROLE[r]) structure.push({ role: r, label: S.ROLE[r][0] }); }
    return { text: raw.text, offset: raw.offset, sentenceCount: raw.sentenceCount, sentenceIndex: raw.sentenceIndex, facts, patterns, words, clauses, structure };
  }

  /** The grammar reference. @returns {[{id, title, items:[{id, title, summary, note, level, kind, tag?, examples}]}]} */
  function buildReference() {
    const out = [];
    const GP = K.GrammarPatterns, GG = K.GrammarGuide;
    if (GG) {
      out.push({ id: 'structure', title: 'Cấu trúc câu', items: GG.GUIDE.map((r) => ({ id: 'structure:' + r[0], title: r[1], summary: r[3], note: r[4], level: r[2], kind: 'guide', examples: exOf(r[5]) })) });
    }
    const endingIdsInCatalogue = new Set();
    for (const [id, name] of GP.CATEGORIES) {
      const rows = GP.PATTERNS.filter((r) => r[3] === id);
      if (!rows.length) continue;
      out.push({ id, title: name, items: rows.map((r) => ({ id: r[0], title: r[0], summary: r[4], note: r[5] || '', level: r[2], kind: /\bend\b/.test(r[7] || '') ? 'ending' : 'pattern', examples: exOf(r[6]) })) });
    }
    // endings that already have a catalogue entry of their own are not repeated in the quick table
    if (K.Patterns && K.Sentence) {
      for (const r of GP.PATTERNS) {
        if (!/\bend\b/.test(r[7] || '')) continue;
        for (const m of (Array.isArray(r[1]) ? r[1] : [r[1]])) for (const x of String(m).matchAll(/@([^ ;#$^+&%!=<]+)/g)) x[1].split('|').forEach((id) => endingIdsInCatalogue.add(id));
      }
    }
    const P = K.Particles && K.Particles.PARTICLES;
    if (P) {
      const seen = new Set(), items = [];
      for (const p of P) {
        if (seen.has(p.key) || !p.label) continue;
        seen.add(p.key);
        items.push({ id: 'particle:' + p.key, title: '-' + p.key, summary: p.label, note: p.note || '', level: 1, kind: 'particle', tag: PARTICLE_TAG[p.kind] || 'trợ từ', examples: [] });
      }
      out.push({ id: 'particles', title: 'Trợ từ (조사)', items });
    }
    const E = K.Endings && K.Endings.ENDINGS;
    if (E) {
      const items = [];
      for (const e of E) {
        if (endingIdsInCatalogue.has(e.id) || !e.label) continue;
        items.push({ id: 'ending:' + e.id, title: e.id, summary: e.label, note: e.note || '', level: e.lv || 3, kind: 'ending-table', tag: ENDING_TAG[e.kind] || 'đuôi từ', examples: exOf(e.ex) });
      }
      out.push({ id: 'endings', title: 'Bảng tra nhanh các đuôi từ còn lại (어미)', items });
    }
    return out;
  }

  K.GrammarView = { presentSentence, buildReference, viaNotes, KIND_LABEL };
  if (typeof module !== 'undefined' && module.exports) module.exports = K.GrammarView;
})(typeof globalThis !== 'undefined' ? globalThis : this);
