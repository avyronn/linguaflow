/* LearningOverlay — the only UI injected into the Netflix page.
 *  - a hover highlight box (no text is drawn: LinguaFlow never creates a second subtitle),
 *  - a compact word card (appears only after a click),
 *  - a toast line and an optional debug panel.
 * Everything lives in one Shadow DOM host; all text is set through text nodes (no innerHTML). */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});
  const h = (tag, attrs, ...kids) => LF.util.h(tag, attrs, ...kids);

  const HOST_ID = 'linguaflow-root';
  const CARD_W = 340;

  class LearningOverlay extends LF.util.EventEmitter {
    /** @param {{document:Document, window?:Window, t?:Function}} o */
    constructor(o) {
      super();
      this.document = o.document;
      this.window = o.window || o.document.defaultView;
      this.t = o.t || ((k) => k);
      this.host = null; this.shadow = null; this.layer = null; this.hl = null; this.card = null; this.debugEl = null;
      this.model = null; this._anchor = null; this._toastTimer = null;
    }

    // ---- lifecycle -------------------------------------------------------------------------------------------
    mount() {
      if (this.host && this.host.isConnected) return;
      const doc = this.document;
      if (!this.host) {
        this.host = doc.createElement('div');
        this.host.id = HOST_ID;
        this.host.setAttribute('style', 'all: initial; position: fixed; inset: 0; width: 0; height: 0; z-index: 2147483647;');
        this.shadow = this.host.attachShadow({ mode: 'open' });
        this._applyStyles();
        this.layer = h('div', { class: 'lf-layer', __doc: doc });
        this.hl = h('div', { class: 'lf-hl', __doc: doc });
        this.layer.appendChild(this.hl);
        this.shadow.appendChild(this.layer);
      }
      this.attach();
    }
    /** Parent = fullscreen element when in fullscreen (only that subtree is visible), otherwise <body>. */
    attach() {
      const parent = this.document.fullscreenElement || this.document.body || this.document.documentElement;
      if (this.host && this.host.parentNode !== parent) parent.appendChild(this.host);
    }
    unmount() { this.hideCard(); if (this.host) this.host.remove(); }
    isMounted() { return !!this.host && this.host.isConnected; }

    _applyStyles() {
      const css = LF.OVERLAY_CSS || '';
      try { // constructable stylesheet: not subject to the page's inline-style CSP
        const SheetCtor = this.window.CSSStyleSheet;
        if (SheetCtor && 'adoptedStyleSheets' in this.shadow) {
          const sheet = new SheetCtor();
          sheet.replaceSync(css);
          this.shadow.adoptedStyleSheets = [sheet];
          return;
        }
      } catch (e) { LF.log.debug('adoptedStyleSheets unavailable, using <style>', e && e.message); }
      const style = this.document.createElement('style');
      style.textContent = css;
      this.shadow.appendChild(style);
    }
    /** True if a DOM event came from inside the overlay (so page-level handlers must ignore it). */
    containsEvent(e) {
      if (!this.host) return false;
      const path = e.composedPath ? e.composedPath() : [];
      return path.includes(this.host) || (e.target === this.host);
    }

    // ---- hover highlight -------------------------------------------------------------------------------------
    setHighlight(rect) {
      if (!rect) { if (this.hl) this.hl.style.display = 'none'; return; }
      this.mount();
      const pad = 2;
      Object.assign(this.hl.style, { display: 'block', transform: `translate(${Math.round(rect.left - pad)}px, ${Math.round(rect.top - pad)}px)`,
        width: Math.round(rect.width + pad * 2) + 'px', height: Math.round(rect.height + pad * 2) + 'px' });
    }

    // ---- card ------------------------------------------------------------------------------------------------
    isCardOpen() { return !!this.card; }
    getModel() { return this.model; }
    /** @param {object} model  @param {object} anchorRect clicked word  @param {object} [avoidRect] all subtitle lines (the card never covers them) */
    showCard(model, anchorRect, avoidRect) {
      this.mount();
      this.model = model;
      if (anchorRect) this._anchor = anchorRect;
      this._avoid = avoidRect || null;
      this._renderCard(true);
    }
    /** Re-render with a changed model (e.g. after "Save") without moving the card. */
    updateCard(patch) {
      if (!this.card) return;
      this.model = Object.assign({}, this.model, patch);
      this._renderCard(false);
    }
    hideCard() {
      if (this._toastTimer) { this.window.clearTimeout(this._toastTimer); this._toastTimer = null; }
      if (this.card) { this.card.remove(); this.card = null; }
      this.model = null; this._anchor = null; this._avoid = null;
    }
    _renderCard(reposition) {
      const keepScroll = this.card ? this.card.scrollTop : 0;
      const wasOpen = this.card && this.card.querySelector('details.lf-sent') ? this.card.querySelector('details.lf-sent').open : false;
      const old = this.card;
      const el = this._buildCard(this.model, wasOpen);
      if (old) old.replaceWith(el); else this.layer.appendChild(el);
      this.card = el;
      if (reposition || !old) this._place(); else { el.style.left = old.style.left; el.style.top = old.style.top; el.style.visibility = 'visible'; el.scrollTop = keepScroll; }
    }
    _place() {
      const win = this.window, el = this.card, a = this._anchor || { left: 20, top: 20, right: 20, bottom: 20, width: 0, height: 0 };
      const vw = win.innerWidth || 1280, vh = win.innerHeight || 720, m = 8;
      const r = el.getBoundingClientRect();
      const w = r.width || CARD_W, hgt = r.height || 240;
      const av = this._avoid;
      const above = av ? Math.min(a.top, av.top) : a.top, below = av ? Math.max(a.bottom, av.bottom) : a.bottom;
      let top = above - hgt - 10; // subtitles sit near the bottom: open upwards, clear of every subtitle line
      if (top < m) top = below + 10;
      top = LF.util.clamp(top, m, Math.max(m, vh - hgt - m));
      const left = LF.util.clamp((a.left + a.right) / 2 - w / 2, m, Math.max(m, vw - w - m));
      el.style.left = Math.round(left) + 'px';
      el.style.top = Math.round(top) + 'px';
      el.style.visibility = 'visible';
    }

    _act(type, extra) { this.emit('action', Object.assign({ type, model: this.model }, extra || {})); }

    _buildCard(m, sentenceOpen) {
      const t = this.t, doc = this.document;
      const H = (tag, attrs, ...kids) => h(tag, Object.assign({ __doc: doc }, attrs), ...kids);
      const set = m.settings || {};
      const head = H('div', { class: 'lf-head' },
        H('div', { class: 'lf-title' },
          H('div', { class: 'lf-surface', lang: m.lang || undefined }, m.surface),
          set.showRomanization !== false && m.romanization ? H('div', { class: 'lf-roman' }, m.romanization) : null),
        set.pronunciation !== false ? H('button', { class: 'lf-iconbtn', type: 'button', title: t('card.speak'), 'aria-label': t('card.speak'), onClick: () => this._act('speak') }, '🔊') : null,
        H('button', { class: 'lf-iconbtn', type: 'button', title: t('card.close'), 'aria-label': t('card.close'), onClick: () => this._act('close') }, '✕'));

      const kids = [head, H('hr', { class: 'lf-sep' })];

      // ---- morphology breakdown ----
      const lines = (m.lines || []).filter((l) => l.kind !== 'note' || l.text !== m.surface);
      if (set.morphology !== false && lines.length) {
        const rows = H('div', { class: 'lf-rows' });
        for (const l of lines) {
          rows.appendChild(H('div', { class: 'lf-rtext k-' + l.kind }, l.text));
          rows.appendChild(H('div', { class: 'lf-rgloss k-' + l.kind },
            l.gloss ? [H('span', { class: 'lf-eq' }, '='), l.gloss] : H('span', { class: 'lf-eq' }, '—'),
            l.note ? H('small', null, l.note) : null));
        }
        kids.push(rows);
        if (m.summary) kids.push(H('div', { class: 'lf-summary' }, '→ ' + m.summary));
      } else if (m.meanings && m.meanings.length) {
        kids.push(H('ul', { class: 'lf-meanings' }, m.meanings.slice(0, 4).map((x) => H('li', null, x))));
      } else kids.push(H('div', { class: 'lf-meta' }, t('card.notInDict')));

      // ---- confidence + "show base form" ----
      if (m.confidenceLabel && m.confidenceLabel !== 'high') {
        const baseBox = H('div', { class: 'lf-base', hidden: true });
        baseBox.appendChild(H('div', null, t('card.originalWord') + ': ', H('b', null, m.surface)));
        baseBox.appendChild(H('div', null, t('card.baseForm') + ': ', H('b', null, m.lemma || m.surface)));
        if (m.alternatives && m.alternatives.length) {
          baseBox.appendChild(H('div', { style: { marginTop: '4px' } }, t('card.otherReadings') + ':'));
          baseBox.appendChild(H('ul', null, m.alternatives.map((a) => H('li', null, H('b', null, a.lemma), a.summary ? ' — ' + a.summary : ''))));
        }
        const toggle = H('button', { class: 'lf-link', type: 'button' }, t('card.viewBase'));
        toggle.addEventListener('click', () => { baseBox.hidden = !baseBox.hidden; toggle.textContent = baseBox.hidden ? t('card.viewBase') : t('card.hideBase'); });
        kids.push(H('div', { class: 'lf-conf' }, H('span', { class: 'lf-pill ' + m.confidenceLabel }, t('card.conf.' + m.confidenceLabel)), toggle), baseBox);
      }

      // ---- dictionary meanings of the lemma (when the breakdown is shown) ----
      if (set.morphology !== false && lines.length && m.meanings && m.meanings.length > 1) {
        kids.push(H('hr', { class: 'lf-sep' }));
        kids.push(H('div', { class: 'lf-meta' }, [m.lemma, m.posLabel ? '· ' + m.posLabel : ''].filter(Boolean).join(' ')));
        kids.push(H('ul', { class: 'lf-meanings' }, m.meanings.slice(0, 4).map((x) => H('li', null, x))));
      }
      if (m.forms && m.forms.length) {
        kids.push(H('div', { class: 'lf-forms' }, m.forms.map((f) => H('span', null, f.label + ': ', H('b', null, f.form)))));
      }

      // ---- sentence + translation ----
      if (m.sentence) {
        const body = H('div', { class: 'lf-sentbody' }, this._highlightSentence(m.sentence, m.surface, H));
        if (m.translation) body.appendChild(H('div', { class: 'lf-trans' }, m.translation));
        const det = H('details', { class: 'lf-sent' }, H('summary', null, t('card.sentence')), body);
        if (sentenceOpen) det.open = true;
        kids.push(det);
      }

      // ---- actions ----
      if (set.vocabulary !== false) {
        kids.push(H('div', { class: 'lf-actions' },
          H('button', { class: 'lf-btn' + (m.saved ? ' on' : ''), type: 'button', onClick: () => this._act(m.saved ? 'unsave' : 'save') }, m.saved ? '✓ ' + t('card.saved') : '＋ ' + t('card.save')),
          H('button', { class: 'lf-btn' + (m.known ? ' on' : ''), type: 'button', onClick: () => this._act(m.known ? 'unknown' : 'known') }, (m.known ? '✓ ' : '') + t('card.known'))));
      }
      if (set.allowExternalLinks && m.externalLinks && m.externalLinks.length) {
        kids.push(H('div', { class: 'lf-ext' }, m.externalLinks.map((l) => H('button', { class: 'lf-link', type: 'button', onClick: () => this._act('external', { url: l.url }) }, l.label))));
      }
      if (m.toast) kids.push(H('div', { class: 'lf-toast', role: 'status' }, m.toast));

      const card = H('div', { class: 'lf-card', role: 'dialog', 'aria-label': 'LinguaFlow' }, kids);
      card.style.visibility = 'hidden';
      return card;
    }
    _highlightSentence(sentence, word, H) {
      const i = word ? sentence.indexOf(word) : -1;
      if (i < 0) return sentence;
      return [sentence.slice(0, i), H('mark', null, word), sentence.slice(i + word.length)];
    }

    /** Short message inside the card (e.g. "no Korean voice installed"). */
    toast(message, ms) {
      if (!this.card) return;
      this.updateCard({ toast: message });
      if (this._toastTimer) this.window.clearTimeout(this._toastTimer);
      this._toastTimer = this.window.setTimeout(() => { if (this.card) this.updateCard({ toast: null }); }, ms || 6000);
    }

    // ---- debug panel -----------------------------------------------------------------------------------------
    toggleDebug(info) {
      this.mount();
      if (this.debugEl) { this.debugEl.remove(); this.debugEl = null; return false; }
      const doc = this.document;
      const text = typeof info === 'string' ? info : JSON.stringify(info, null, 2);
      const pre = h('pre', { __doc: doc }, text);
      const copy = h('button', { class: 'lf-btn', type: 'button', __doc: doc, onClick: () => { try { this.window.navigator.clipboard.writeText(text); copy.textContent = '✓'; } catch (e) { /* ignore */ } } }, 'Copy');
      const close = h('button', { class: 'lf-btn', type: 'button', __doc: doc, onClick: () => this.toggleDebug() }, 'Close');
      this.debugEl = h('div', { class: 'lf-debug', __doc: doc }, h('div', { __doc: doc }, h('b', { __doc: doc }, 'LinguaFlow debug  '), copy, close), pre);
      this.layer.appendChild(this.debugEl);
      return true;
    }
    updateDebug(info) { if (this.debugEl) this.debugEl.querySelector('pre').textContent = typeof info === 'string' ? info : JSON.stringify(info, null, 2); }
    isDebugOpen() { return !!this.debugEl; }
  }

  LF.LearningOverlay = LearningOverlay;
  if (typeof module !== 'undefined' && module.exports) module.exports = LearningOverlay;
})(typeof globalThis !== 'undefined' ? globalThis : this);
