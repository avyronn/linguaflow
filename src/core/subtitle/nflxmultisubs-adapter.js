/* NflxMultiSubsAdapter: reads the secondary subtitle that the NflxMultiSubs extension draws as SVG <text>.
 * LinguaFlow never draws a second subtitle on top of it — it only reads this text and adds click targets.
 * (The primary subtitle stays in Netflix's own DOM and is read by NetflixAdapter.) */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});

  class NflxMultiSubsAdapter {
    constructor(opts) {
      const o = opts || {};
      this.document = o.document || root.document;
      this.sel = LF.SubtitleSelectors;
    }
    get id() { return 'nflxmultisubs'; }
    setCustomSelectors() { /* custom selectors are handled by NetflixAdapter */ }
    isActive() {
      const s = this.sel.nflxmultisubs;
      return !!this.document.querySelector(s.wrapper) || !!this.document.querySelector(s.svg);
    }
    findPlayerRoot() {
      const el = this.document.querySelector(this.sel.nflxmultisubs.wrapper);
      return el ? (el.parentElement || el) : null;
    }
    readBlocks() {
      const out = [];
      const s = this.sel.nflxmultisubs;
      for (const svg of this.document.querySelectorAll(s.svg)) {
        for (const t of svg.querySelectorAll(s.text)) {
          const tm = LF.SubtitleParser.extractTextMap(t);
          if (tm.text.trim()) out.push({ adapter: this.id, kind: 'svg-text', element: t, text: tm.text, textMap: tm });
        }
      }
      return out;
    }
  }

  LF.NflxMultiSubsAdapter = NflxMultiSubsAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = NflxMultiSubsAdapter;
})(typeof globalThis !== 'undefined' ? globalThis : this);
