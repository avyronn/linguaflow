/* SubtitleManager — language-independent subtitle engine.
 *
 *   getCurrentSubtitle() -> { primary: {language, text} | null, secondary: {language, text} | null, timestamp, videoTime, source }
 *
 * Performance rules (no polling): one MutationObserver, debounced; the DOM is only re-read after a mutation burst,
 * and listeners only fire when the subtitle text actually changed (the current subtitle is cached).
 * Adapters are additive: NflxMultiSubs' SVG text and Netflix's own timed text are both read, then the
 * LanguagePack decides which line is the learning language (primary) and which is the translation (secondary).
 */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  const P = () => LF.SubtitleParser;

  class SubtitleManager extends LF.util.EventEmitter {
    /**
     * @param {{document:Document, window?:Window, languagePack:LanguagePack, nativeLanguage?:string, adapters?:object[],
     *          debounceMs?:number, watchOnly?:boolean, checkLayout?:boolean, geometry?:object, timers?:object, now?:Function}} opts
     */
    constructor(opts) {
      super();
      this.document = opts.document;
      this.window = opts.window || opts.document.defaultView;
      this.pack = opts.languagePack;
      this.nativeLanguage = opts.nativeLanguage || 'und';
      this.adapters = opts.adapters || [new LF.NflxMultiSubsAdapter({ document: this.document }), new LF.NetflixAdapter({ document: this.document })];
      this.debounceMs = opts.debounceMs == null ? 30 : opts.debounceMs;
      this.watchOnly = !!opts.watchOnly;
      const ua = (this.window && this.window.navigator && this.window.navigator.userAgent) || '';
      this.checkLayout = opts.checkLayout == null ? !/jsdom/i.test(ua) : !!opts.checkLayout;
      this.geometry = opts.geometry || P().Geometry;
      this.now = opts.now || (() => Date.now());
      this._timers = opts.timers || this.window;
      this._mo = null;
      this._started = false;
      this._sig = null;
      this._blocks = [];
      this._current = null;
      this._maps = new WeakMap(); // element -> { text, map }
      this._activeIds = '';
      this._schedule = LF.util.debounce(() => this.process(), this.debounceMs, this._timers);
    }

    // ---- lifecycle ------------------------------------------------------------------------------------------
    start() {
      if (this._started) return this;
      this._started = true;
      const MO = this.window && this.window.MutationObserver;
      if (MO) {
        this._mo = new MO(() => this._schedule());
        const target = this.document.body || this.document.documentElement;
        this._mo.observe(target, { childList: true, subtree: true, characterData: true });
      }
      this.process();
      return this;
    }
    stop() {
      this._started = false;
      if (this._mo) { this._mo.disconnect(); this._mo = null; }
      this._schedule.cancel();
    }
    setLanguagePack(pack) { this.pack = pack; this.reset(); }
    setNativeLanguage(code) { this.nativeLanguage = code || 'und'; this.reset(); }
    setCustomSelectors(list) { for (const a of this.adapters) if (a.setCustomSelectors) a.setCustomSelectors(list); this.reset(); }
    /** Forget the cache and re-read immediately. */
    reset() { this._sig = null; this._maps = new WeakMap(); if (this._started) this.process(); }
    refresh() { this._sig = null; this.process(); }

    // ---- reading --------------------------------------------------------------------------------------------
    _onWatchPage() {
      const loc = this.window && this.window.location;
      return !loc || /^\/watch(\/|$)/.test(loc.pathname || '');
    }
    isVisible(el) {
      try {
        const view = this.window;
        if (!view || !view.getComputedStyle) return true;
        const cs = view.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
        if (this.checkLayout && el.getClientRects && el.getClientRects().length === 0) return false;
        return true;
      } catch (e) { return true; }
    }
    _readBlocks() {
      const blocks = [];
      for (const a of this.adapters) {
        let list;
        try { list = a.readBlocks(); } catch (e) { LF.log.warn('adapter ' + a.id + ' failed', e); continue; }
        for (const b of list) if (this.isVisible(b.element)) blocks.push(b);
      }
      return blocks;
    }
    findVideo() {
      for (const a of this.adapters) if (a.findVideo) { const v = a.findVideo(); if (v) return v; }
      return this.document.querySelector('video');
    }

    process() {
      if (!this._started || !this.pack) return null;
      if (this.watchOnly && !this._onWatchPage()) { if (this._current) this._clear(); return null; }
      const blocks = this._readBlocks();
      const activeIds = this.adapters.filter((a) => { try { return a.isActive(); } catch (e) { return false; } }).map((a) => a.id).join('+');
      if (activeIds !== this._activeIds) { this._activeIds = activeIds; this.emit('adapters', activeIds ? activeIds.split('+') : []); }
      const sig = blocks.map((b) => b.adapter + '|' + b.kind + '|' + b.text).join('\u0001');
      const sameEls = blocks.length === this._blocks.length && blocks.every((b, i) => b.element === this._blocks[i].element);
      if (sig === this._sig) { // same text re-rendered into new nodes: refresh references silently (no event)
        if (!sameEls) { this._blocks = blocks; this._classified = P().classify(blocks, this.pack, { nativeLanguage: this.nativeLanguage }); }
        return this._current;
      }
      this._sig = sig;
      this._blocks = blocks;
      if (!blocks.length) return this._clear();
      const c = P().classify(blocks, this.pack, { nativeLanguage: this.nativeLanguage });
      const video = this.findVideo();
      this._classified = c;
      this._current = {
        primary: c.primary ? { language: c.primary.language, text: c.primary.text } : null,
        secondary: c.secondary ? { language: c.secondary.language, text: c.secondary.text } : null,
        timestamp: this.now(),
        videoTime: video && isFinite(video.currentTime) ? video.currentTime : null,
        source: Array.from(new Set(blocks.map((b) => b.adapter))).join('+'),
      };
      this.emit('subtitle', this._current);
      return this._current;
    }
    _clear() {
      const had = this._current !== null;
      this._current = null; this._classified = null; this._blocks = []; this._sig = '';
      if (had) this.emit('clear');
      return null;
    }

    // ---- API used by the learning layer ---------------------------------------------------------------------
    getCurrentSubtitle() { return this._current; }
    /** Word maps of the blocks that contain learning-language text (cached per element + text). */
    getWordMaps() {
      if (!this._classified || !this._classified.primary) return [];
      const maps = [];
      for (const b of this._classified.primary.blocks) {
        let slot = this._maps.get(b.element);
        if (!slot || slot.text !== b.text) {
          slot = { text: b.text, map: P().buildWordMap(b, this.pack, this.geometry) };
          this._maps.set(b.element, slot);
        }
        maps.push(slot.map);
      }
      return maps;
    }
    /** Word under the pointer (client coordinates), or null. */
    hitTest(x, y, slop) {
      const maps = this.getWordMaps();
      if (!maps.length) return null;
      const hit = P().hitTest(maps, x, y, slop);
      return hit ? Object.assign(hit, { subtitle: this._current }) : null;
    }

    /** Bounding box (client coordinates) of ALL subtitle lines on screen — the card stays clear of it so translations remain readable. */
    getBlocksRect() {
      const rects = [];
      for (const b of this._blocks) {
        const r = b.element.getBoundingClientRect ? b.element.getBoundingClientRect() : null;
        if (r && r.width > 0 && r.height > 0) rects.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
      }
      return rects.length ? P().union(rects) : null;
    }

    /** Diagnostic snapshot for the debug panel / bug reports. */
    describe() {
      const sel = LF.SubtitleSelectors;
      return {
        onWatchPage: this._onWatchPage(),
        adapters: this.adapters.map((a) => ({ id: a.id, active: !!a.isActive() })),
        selectors: { netflix: sel.netflix, nflxmultisubs: sel.nflxmultisubs },
        imageSubtitles: !!(this.adapters[1] && this.adapters[1].hasImageSubtitles && this.adapters[1].hasImageSubtitles()),
        blocks: this._blocks.map((b) => ({ adapter: b.adapter, kind: b.kind, tag: b.element.localName, cls: b.element.getAttribute && b.element.getAttribute('class'), text: b.text,
          score: Number(this.pack.detect(b.text).toFixed(2)) })),
        current: this._current,
        clickableWords: this.getWordMaps().map((m) => m.tokens.map((t) => t.text)),
        language: this.pack ? this.pack.getId() : null,
      };
    }
  }

  LF.SubtitleManager = SubtitleManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = SubtitleManager;
})(typeof globalThis !== 'undefined' ? globalThis : this);
