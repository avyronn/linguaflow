/* NetflixAdapter: reads the subtitle the Netflix player has ALREADY rendered into the DOM (timed text).
 * Read-only: it never touches video, DRM, playback or the account — it only looks at DOM text. */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});

  /** Keep only the innermost matches (drop an element if it contains another matched element). */
  function innermost(els) { return els.filter((e) => !els.some((f) => f !== e && e.contains(f))); }

  class NetflixAdapter {
    constructor(opts) {
      const o = opts || {};
      this.document = o.document || root.document;
      this.sel = LF.SubtitleSelectors;
      this.extra = [];
    }
    get id() { return 'netflix'; }
    setCustomSelectors(list) { this.extra = this.sel.validate(this.document, list || []); }
    /** True when Netflix's own timed-text container (or a custom one) is in the page. */
    isActive() {
      const d = this.document;
      return !!d.querySelector(this.sel.netflix.container) || this.extra.some((s) => !!d.querySelector(s));
    }
    findPlayerRoot() {
      for (const s of this.sel.netflix.playerRoot) { const el = this.document.querySelector(s); if (el) return el; }
      const v = this.document.querySelector(this.sel.netflix.video);
      return v ? (v.parentElement || v) : null;
    }
    findVideo() { return this.document.querySelector(this.sel.netflix.video); }
    hasImageSubtitles() { return !!this.document.querySelector(this.sel.netflix.imageBased); }
    readBlocks() {
      const d = this.document;
      let els = [];
      for (const s of this.sel.netflix.textBox.concat(this.extra)) {
        let list;
        try { list = d.querySelectorAll(s); } catch (e) { continue; }
        for (const el of list) if (!els.includes(el)) els.push(el);
      }
      if (!els.length) els = Array.from(d.querySelectorAll(this.sel.netflix.container));
      const out = [];
      for (const el of innermost(els)) {
        const tm = LF.SubtitleParser.extractTextMap(el);
        if (tm.text.trim()) out.push({ adapter: this.id, kind: 'html', element: el, text: tm.text, textMap: tm });
      }
      return out;
    }
  }

  LF.NetflixAdapter = NetflixAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = NetflixAdapter;
})(typeof globalThis !== 'undefined' ? globalThis : this);
