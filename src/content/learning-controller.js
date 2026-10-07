/* LearningController — glues subtitles, language pack, overlay, vocabulary and pronunciation together.
 *
 * Interaction model (nothing is drawn on top of the subtitle):
 *   hover  -> geometry of the word under the pointer is computed on demand and a highlight box is shown
 *   click  -> the click is swallowed (the video does not toggle pause), the word is analysed, the card opens
 * Geometry is computed at event time, so it is never stale after Netflix moves/resizes the subtitle.
 */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});

  /** Pause/resume the <video> element like a user would. Never touches DRM, decoding or Netflix internals. */
  class PlayerControl {
    constructor(findVideo) { this.findVideo = findVideo; this._pausedByUs = false; }
    pause() {
      const v = this.findVideo();
      if (v && !v.paused) { try { v.pause(); this._pausedByUs = true; } catch (e) { /* ignore */ } }
    }
    resume() {
      const v = this.findVideo();
      if (this._pausedByUs && v && v.paused) { try { const p = v.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } }
      this._pausedByUs = false;
    }
    forget() { this._pausedByUs = false; }
  }

  const oneLine = (s) => String(s || '').replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const POINTER_EVENTS = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick'];

  class LearningController {
    /**
     * @param {{document:Document, window:Window, subtitles:SubtitleManager, pack:LanguagePack, overlay:LearningOverlay,
     *          vocabulary:VocabularyManager, pronunciation:Pronunciation, settings:SettingsStore, player:PlayerControl, i18n:object}} o
     */
    constructor(o) {
      Object.assign(this, { document: o.document, window: o.window || o.document.defaultView, subtitles: o.subtitles, pack: o.pack, overlay: o.overlay,
        vocab: o.vocabulary, pron: o.pronunciation, settings: o.settings, player: o.player, i18n: o.i18n });
      this._seq = 0; this._raf = 0; this._lastMove = null; this._hover = null; this._started = false; this._ready = null;
      this._bound = { move: (e) => this._onMove(e), pointer: (e) => this._onPointer(e), key: (e) => this._onKey(e), fs: () => this.overlay.attach(), resize: () => this._onResize(),
        action: (a) => this._onAction(a) };
    }
    get t() { return this.i18n.t; }
    get lang() { return this.pack.getId(); }
    setPack(pack) { this.pack = pack; this._ready = null; this.closeCard({ resume: false }); }
    ready() { if (!this._ready) this._ready = this.pack.init(); return this._ready; }

    start() {
      if (this._started) return;
      this._started = true;
      const w = this.window;
      w.addEventListener('mousemove', this._bound.move, { capture: true, passive: true });
      for (const t of POINTER_EVENTS) w.addEventListener(t, this._bound.pointer, true);
      w.addEventListener('keydown', this._bound.key, true);
      w.addEventListener('resize', this._bound.resize, { passive: true });
      this.document.addEventListener('fullscreenchange', this._bound.fs);
      this.overlay.on('action', this._bound.action);
      this.subtitles.on('clear', () => { this._hover = null; this.overlay.setHighlight(null); });
    }
    stop() {
      if (!this._started) return;
      this._started = false;
      const w = this.window;
      w.removeEventListener('mousemove', this._bound.move, { capture: true });
      for (const t of POINTER_EVENTS) w.removeEventListener(t, this._bound.pointer, true);
      w.removeEventListener('keydown', this._bound.key, true);
      w.removeEventListener('resize', this._bound.resize);
      this.document.removeEventListener('fullscreenchange', this._bound.fs);
      this.overlay.off('action', this._bound.action);
      this.overlay.setHighlight(null);
      this.closeCard({ resume: false });
    }

    enabled() {
      const s = this.settings;
      return s.value('learningMode') && s.value('clickWords') && !!this.subtitles.getCurrentSubtitle();
    }
    _hit(e) {
      if (!this.enabled() || this.overlay.containsEvent(e)) return null;
      if (typeof e.clientX !== 'number') return null;
      return this.subtitles.hitTest(e.clientX, e.clientY);
    }

    // ---- events ---------------------------------------------------------------------------------------------
    _onMove(e) {
      this._lastMove = e;
      if (this._raf) return; // at most one hit-test per frame
      const raf = this.window.requestAnimationFrame || ((fn) => this.window.setTimeout(fn, 16));
      this._raf = raf.call(this.window, () => { this._raf = 0; this.updateHover(this._lastMove); });
    }
    updateHover(e) {
      const hit = e ? this._hit(e) : null;
      this._hover = hit;
      this.overlay.setHighlight(hit ? hit.rect : null);
      return hit;
    }
    _onResize() { if (this.overlay.isCardOpen()) this.overlay.attach(); }
    _onPointer(e) {
      if (e.button !== 0 && e.type !== 'click') return;
      const hit = this._hit(e);
      if (!hit) {
        // click elsewhere on the page closes the card; the click itself still reaches Netflix (no auto-resume: the user controls playback)
        if (e.type === 'click' && this.overlay.isCardOpen() && !this.overlay.containsEvent(e)) this.closeCard({ resume: false });
        return;
      }
      e.stopImmediatePropagation();
      if (e.type === 'mousedown' || e.type === 'click' || e.type === 'dblclick') e.preventDefault();
      if (e.type === 'click') this.openWord(hit).catch((err) => LF.log.error('openWord failed', err));
    }
    _onKey(e) {
      if (e.key === 'Escape' && this.overlay.isCardOpen()) { e.stopPropagation(); this.closeCard({ resume: true }); return; }
      if (e.altKey && e.shiftKey && (e.code === 'KeyD' || e.key === 'D')) { e.preventDefault(); this.overlay.toggleDebug(this.debugInfo()); }
    }

    // ---- word card ------------------------------------------------------------------------------------------
    async openWord(hit) {
      const seq = ++this._seq;
      const surface = hit.token.text;
      const sub = hit.subtitle || this.subtitles.getCurrentSubtitle() || {};
      if (this.settings.value('pauseOnLookup')) this.player.pause();
      try { await this.ready(); } catch (e) {
        LF.log.error('language pack failed to initialise', e);
        this.overlay.showCard({ surface, lines: [], settings: this._cardSettings(), toast: this.t('toast.dictFailed') }, hit.rect);
        return;
      }
      const analysis = this.pack.analyzeWord(surface);
      const lookup = await this.pack.lookup(surface);
      const pron = this.pack.getPronunciation(surface);
      const saved = await this.vocab.find(this.lang, analysis.lemma).catch(() => null);
      if (seq !== this._seq) return; // a newer click superseded this one
      const model = {
        lang: this.lang, surface, lemma: analysis.lemma, pos: analysis.pos, posLabel: analysis.posLabel, romanization: pron.romanization,
        lines: analysis.display, summary: analysis.summary, meanings: lookup ? lookup.meanings : [],
        confidence: analysis.confidence, confidenceLabel: analysis.confidenceLabel, alternatives: analysis.alternatives,
        forms: analysis.type === 'predicate' || analysis.type === 'word' ? this.pack.getExtraForms(analysis.lemma) : [],
        sentence: oneLine(sub.primary && sub.primary.text), translation: oneLine(sub.secondary && sub.secondary.text),
        saved: !!saved, known: !!(saved && saved.known), settings: this._cardSettings(),
        externalLinks: this.settings.value('allowExternalLinks') ? this.pack.getExternalLinks(analysis.lemma || surface) : [],
      };
      this._analysis = analysis;
      this.overlay.showCard(model, hit.rect, this.subtitles.getBlocksRect ? this.subtitles.getBlocksRect() : null);
    }
    _cardSettings() {
      const s = this.settings;
      return { morphology: s.value('morphology'), vocabulary: s.value('vocabulary'), pronunciation: s.value('pronunciation'),
        showRomanization: s.value('showRomanization'), allowExternalLinks: s.value('allowExternalLinks') };
    }
    closeCard(o) {
      const resume = !o || o.resume !== false;
      this._seq++; // cancel in-flight openWord
      this.overlay.hideCard();
      if (resume && this.settings.value('resumeOnClose')) this.player.resume(); else this.player.forget();
    }

    // ---- card actions ---------------------------------------------------------------------------------------
    async _onAction(a) {
      const m = a.model;
      if (!m && a.type !== 'close') return;
      try {
        switch (a.type) {
          case 'close': this.closeCard({ resume: true }); break;
          case 'speak': await this._speak(m); break;
          case 'save': case 'known': await this._save(m, a.type === 'known'); break;
          case 'unsave': await this.vocab.remove(LF.VocabularyManager.makeId(this.lang, m.lemma)); this.overlay.updateCard({ saved: false, known: false }); break;
          case 'unknown': { const id = LF.VocabularyManager.makeId(this.lang, m.lemma); await this.vocab.setKnown(id, false); this.overlay.updateCard({ known: false, saved: true }); break; }
          case 'external': if (a.url) this.window.open(a.url, '_blank', 'noopener,noreferrer'); break;
          default: break;
        }
      } catch (e) {
        LF.log.error('action ' + a.type + ' failed', e);
        this.overlay.toast(this.t('toast.saveFailed'));
      }
    }
    async _speak(m) {
      const r = await this.pron.speak(m.surface, this.lang);
      if (r.ok) return;
      const key = { 'no-voice-for-language': 'toast.noVoice', 'no-voices': 'toast.noVoices', unsupported: 'toast.unsupported' }[r.reason] || 'toast.speechError';
      this.overlay.toast(this.t(key, { language: this.pack.getNativeName(), lang: this.pack.getSpeechLang() }));
    }
    async _save(m, markKnown) {
      const meaning = (m.meanings && m.meanings.slice(0, 2).join('; ')) || m.summary || '';
      const { item } = await this.vocab.add({ language: this.lang, word: m.surface, lemma: m.lemma || m.surface, meaning, sentence: m.sentence, translation: m.translation,
        pos: m.pos, pronunciation: m.romanization, known: markKnown ? true : undefined });
      this.overlay.updateCard({ saved: true, known: item.known });
    }

    debugInfo() {
      return { linguaflow: LF.VERSION, settings: this.settings.get(), packReady: !!(this.pack && this.pack.morphology), hover: this._hover ? this._hover.token.text : null,
        subtitles: this.subtitles.describe(), userAgent: this.window.navigator.userAgent };
    }
  }

  LF.PlayerControl = PlayerControl;
  LF.LearningController = LearningController;
  if (typeof module !== 'undefined' && module.exports) module.exports = LearningController;
})(typeof globalThis !== 'undefined' ? globalThis : this);
