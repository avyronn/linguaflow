/* Language-agnostic subtitle parsing: DOM text extraction with offset maps, line classification (which line is
 * the learning language?), tokenisation through the active LanguagePack, and word geometry for hit-testing.
 *
 * Nothing here knows about Korean or Vietnamese: the LanguagePack decides what is "target language" (detect())
 * and what is clickable (tokenize()/isClickable()).
 */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const SKIP = new Set(['STYLE', 'SCRIPT', 'NOSCRIPT']);
  const BLOCK = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'SECTION', 'ARTICLE', 'TABLE', 'TR']);

  /** Flattens an element into logical text + the text nodes that produced it (offsets are exact). */
  function extractTextMap(rootEl) {
    let text = '';
    const segments = [];
    const nl = () => { if (text && !text.endsWith('\n')) text += '\n'; };
    (function walk(node) {
      for (let c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) {
          const v = c.nodeValue;
          if (v) { segments.push({ node: c, start: text.length, end: text.length + v.length }); text += v; }
        } else if (c.nodeType === 1) {
          const tag = String(c.localName || c.tagName || '').toUpperCase();
          if (SKIP.has(tag)) continue;
          if (tag === 'BR') { text += '\n'; continue; }
          const block = BLOCK.has(tag) && c.namespaceURI !== SVG_NS;
          if (block) nl();
          walk(c);
          if (block) nl();
        }
      }
    })(rootEl);
    return { text, segments };
  }

  function splitLines(text) {
    const out = [];
    let pos = 0;
    for (const part of String(text).split('\n')) {
      const t = part.trim();
      if (t) out.push({ text: t, start: pos + part.indexOf(t), end: pos + part.indexOf(t) + t.length });
      pos += part.length + 1;
    }
    return out;
  }

  const hasLetters = (s) => /\p{L}/u.test(s);
  const keyOf = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  function detectScript(s) {
    const t = String(s);
    if (/[\uAC00-\uD7A3\u1100-\u11FF\u3131-\u318E]/.test(t)) return 'Hang';
    if (/[\u3040-\u30FF]/.test(t)) return 'Jpan';
    if (/[\u4E00-\u9FFF]/.test(t)) return 'Hani';
    if (/[\u0400-\u04FF]/.test(t)) return 'Cyrl';
    if (/[\u0600-\u06FF]/.test(t)) return 'Arab';
    if (/[\u0E00-\u0E7F]/.test(t)) return 'Thai';
    if (/\p{L}/u.test(t)) return 'Latn';
    return 'Zyyy';
  }

  /**
   * Splits caption blocks into learning-language lines (primary) and everything else (secondary).
   * @param {{text:string}[]} blocks   @param {LanguagePack} pack   @param {{threshold?:number, nativeLanguage?:string}} opts
   */
  function classify(blocks, pack, opts) {
    const o = opts || {};
    const thr = o.threshold == null ? 0.5 : o.threshold;
    const pLines = [], sLines = [], pBlocks = [], sBlocks = [];
    const seenP = new Set(), seenS = new Set();
    for (const b of blocks) {
      let target = false;
      for (const ln of splitLines(b.text)) {
        const key = keyOf(ln.text);
        if (pack.detect(ln.text) >= thr) {
          target = true;
          if (!seenP.has(key)) { seenP.add(key); pLines.push(ln.text); }
        } else if (hasLetters(ln.text) && !seenS.has(key)) { seenS.add(key); sLines.push(ln.text); }
      }
      (target ? pBlocks : sBlocks).push(b);
    }
    return {
      primary: pLines.length ? { language: pack.getId(), text: pLines.join('\n'), blocks: pBlocks } : null,
      secondary: sLines.length ? { language: o.nativeLanguage || 'und', script: detectScript(sLines.join(' ')), text: sLines.join('\n'), blocks: sBlocks } : null,
    };
  }

  // ---- geometry ----------------------------------------------------------------------------------------
  const plain = (l, t, r, b) => ({ left: l, top: t, right: r, bottom: b, width: r - l, height: b - t });
  const fromDOMRect = (r) => plain(r.left, r.top, r.right, r.bottom);

  // SVG text collapses whitespace: map raw offsets to addressable character indexes.
  function svgAddressable(raw) {
    const map = new Array(raw.length).fill(-1);
    let idx = 0, prevSpace = true;
    for (let i = 0; i < raw.length; i++) {
      if (/\s/.test(raw[i])) { if (!prevSpace) { map[i] = idx++; prevSpace = true; } } else { map[i] = idx++; prevSpace = false; }
    }
    return map;
  }
  function svgTextAncestor(node) {
    for (let el = node.parentNode; el && el.nodeType === 1; el = el.parentNode) {
      if (el.namespaceURI === SVG_NS && typeof el.getExtentOfChar === 'function' && el.localName === 'text') return el;
      if (el.namespaceURI !== SVG_NS) return null;
    }
    return null;
  }
  function svgRects(piece) {
    const tx = svgTextAncestor(piece.node);
    if (!tx) return null;
    try {
      let raw = '', base = 0;
      const walker = (n) => { for (let c = n.firstChild; c; c = c.nextSibling) { if (c.nodeType === 3) { if (c === piece.node) base = raw.length; raw += c.nodeValue; } else if (c.nodeType === 1) walker(c); } };
      walker(tx);
      const map = svgAddressable(raw);
      const idxs = [];
      for (let i = piece.from; i < piece.to; i++) { const a = map[base + i]; if (a >= 0) idxs.push(a); }
      if (!idxs.length) return [];
      const ctm = tx.getScreenCTM(), svg = tx.ownerSVGElement;
      if (!ctm || !svg) return null;
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
      for (const i of idxs) {
        const e = tx.getExtentOfChar(i);
        for (const [x, y] of [[e.x, e.y], [e.x + e.width, e.y + e.height]]) {
          const pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
          const q = pt.matrixTransform(ctm);
          l = Math.min(l, q.x); r = Math.max(r, q.x); t = Math.min(t, q.y); b = Math.max(b, q.y);
        }
      }
      return isFinite(l) ? [plain(l, t, r, b)] : null;
    } catch (e) { return null; }
  }
  /** Client-space rectangles of one text piece. HTML text uses Range; SVG <text> uses the SVG text API. */
  const Geometry = {
    rectsForPiece(piece) {
      const svg = svgRects(piece);
      if (svg) return svg;
      const doc = piece.node.ownerDocument;
      const range = doc.createRange();
      range.setStart(piece.node, piece.from);
      range.setEnd(piece.node, piece.to);
      const out = [];
      const list = range.getClientRects();
      for (let i = 0; i < list.length; i++) if (list[i].width > 0 && list[i].height > 0) out.push(fromDOMRect(list[i]));
      if (range.detach) range.detach();
      return out;
    },
  };

  class WordMap {
    /** @param {{block:object, text:string, segments:object[], tokens:object[], geometry?:object}} o */
    constructor(o) { this.block = o.block; this.text = o.text; this.segments = o.segments; this.tokens = o.tokens; this.geometry = o.geometry || Geometry; }
    pieces(token) {
      const out = [];
      for (const s of this.segments) {
        const a = Math.max(token.start, s.start), b = Math.min(token.end, s.end);
        if (a < b) out.push({ node: s.node, from: a - s.start, to: b - s.start });
      }
      return out;
    }
    rectsFor(token) {
      const out = [];
      for (const p of this.pieces(token)) out.push(...this.geometry.rectsForPiece(p));
      return out;
    }
  }

  function buildWordMap(block, pack, geometry) {
    const tm = block.textMap || extractTextMap(block.element);
    const tokens = pack.tokenize(tm.text).filter((t) => pack.isClickable(t));
    return new WordMap({ block, text: tm.text, segments: tm.segments, tokens, geometry });
  }

  const union = (rects) => plain(Math.min(...rects.map((r) => r.left)), Math.min(...rects.map((r) => r.top)), Math.max(...rects.map((r) => r.right)), Math.max(...rects.map((r) => r.bottom)));

  /** Which word is under (x, y)? Geometry is computed fresh at call time, so it is never stale after layout changes. */
  function hitTest(maps, x, y, slop) {
    const s = slop == null ? 2 : slop;
    let best = null;
    for (const m of maps) {
      const el = m.block.element;
      const br = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      if (br && br.width > 0 && br.height > 0 && (x < br.left - 14 || x > br.right + 14 || y < br.top - 14 || y > br.bottom + 14)) continue;
      for (const token of m.tokens) {
        const rects = m.rectsFor(token);
        for (const r of rects) {
          if (x < r.left - s || x > r.right + s || y < r.top - s || y > r.bottom + s) continue;
          const d = Math.abs((r.left + r.right) / 2 - x) + Math.abs((r.top + r.bottom) / 2 - y);
          if (!best || d < best.d) best = { d, map: m, token, rects, rect: union(rects) };
        }
      }
    }
    return best ? { map: best.map, token: best.token, rects: best.rects, rect: best.rect } : null;
  }

  LF.SubtitleParser = { extractTextMap, splitLines, classify, detectScript, WordMap, buildWordMap, hitTest, Geometry, svgAddressable, union };
  if (typeof module !== 'undefined' && module.exports) module.exports = LF.SubtitleParser;
})(typeof globalThis !== 'undefined' ? globalThis : this);
