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
  const MIN_CARD_H = 120; // the card is never made shorter than this to make room (in a very small player it scrolls inside this height)

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
      this._renderCard();
    }
    /** Re-render with a changed model (e.g. after "Save") without moving the card. */
    updateCard(patch) {
      if (!this.card) return;
      this.model = Object.assign({}, this.model, patch);
      this._renderCard();
    }
    hideCard() {
      if (this._toastTimer) { this.window.clearTimeout(this._toastTimer); this._toastTimer = null; }
      if (this.card) { this.card.remove(); this.card = null; }
      this.model = null; this._anchor = null; this._avoid = null;
    }
    _renderCard() {
      const keepScroll = this.card ? this.card.scrollTop : 0;
      // every <details> the learner opened stays open when the card is redrawn (after "Save", a toast ...); null = first drawing -> defaults
      const open = this.card ? new Set(Array.from(this.card.querySelectorAll('details[data-key]')).filter((d) => d.open).map((d) => d.getAttribute('data-key'))) : null;
      const old = this.card;
      const el = this._buildCard(this.model, open);
      if (old) old.replaceWith(el); else this.layer.appendChild(el);
      this.card = el;
      this._place();
      if (old) el.scrollTop = keepScroll;
    }
    /** The card goes on the side of the subtitle lines that has room for it - above is preferred, subtitles sit at the bottom of the player - and never over
     *  them: when it is taller than the room on either side it is shortened (it scrolls inside) instead of being pushed over the subtitles. Called again
     *  whenever the content changes height (a section is opened, the card is redrawn), so the edge facing the subtitles stays where it was. */
    _place() {
      const win = this.window, el = this.card;
      if (!el) return;
      const a = this._anchor || { left: 20, top: 20, right: 20, bottom: 20, width: 0, height: 0 };
      const vw = win.innerWidth || 1280, vh = win.innerHeight || 720, m = 8, gap = 10;
      const av = this._avoid;
      const above = av ? Math.min(a.top, av.top) : a.top, below = av ? Math.max(a.bottom, av.bottom) : a.bottom;
      const scroll = el.scrollTop;
      el.style.maxHeight = ''; // its natural height (the stylesheet still caps it)
      const r = el.getBoundingClientRect();
      const w = r.width || CARD_W, natural = r.height || 240;
      const roomAbove = above - gap - m, roomBelow = vh - below - gap - m;
      const up = natural <= roomAbove || (natural > roomBelow && roomAbove >= roomBelow);
      const room = up ? roomAbove : roomBelow;
      let hgt = natural;
      if (natural > room) { hgt = Math.max(MIN_CARD_H, Math.floor(room)); el.style.maxHeight = hgt + 'px'; }
      const top = LF.util.clamp(up ? above - gap - hgt : below + gap, m, Math.max(m, vh - hgt - m));
      const left = LF.util.clamp((a.left + a.right) / 2 - w / 2, m, Math.max(m, vw - w - m));
      el.style.left = Math.round(left) + 'px';
      el.style.top = Math.round(top) + 'px';
      el.style.visibility = 'visible';
      el.scrollTop = scroll;
    }

    _act(type, extra) { this.emit('action', Object.assign({ type, model: this.model }, extra || {})); }

    _buildCard(m, openKeys) {
      const t = this.t, doc = this.document;
      const H = (tag, attrs, ...kids) => h(tag, Object.assign({ __doc: doc }, attrs), ...kids);
      const set = m.settings || {};
      const isOpen = (key, dflt) => (openKeys ? openKeys.has(key) : !!dflt);
      const fold = (key, dflt, summary, body, cls) => {
        const d = H('details', { class: cls || 'lf-det', 'data-key': key }, H('summary', null, summary), body);
        if (isOpen(key, dflt)) d.open = true;
        d.addEventListener('toggle', () => { if (this.card && this.card.contains(d)) this._place(); }); // opening a section changes the height: keep clear of the subtitles
        return d;
      };
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

      // ---- where the word comes from (Korean: the Hanja and the Hán-Việt reading, which let a Vietnamese learner recognise Sino-Korean words); text comes from the pack ----
      const ety = m.etymology;
      if (ety && ety.text) {
        kids.push(H('div', { class: 'lf-ety' },
          ety.label ? H('span', { class: 'lf-ek' }, ety.label) : null,
          H('span', { class: 'lf-et', lang: m.lang || undefined }, ety.text),
          ety.reading ? H('span', { class: 'lf-er' }, ety.reading) : null,
          ety.root ? H('span', { class: 'lf-eroot' }, '(' + (ety.rootLabel ? ety.rootLabel + ': ' : ''), H('span', { lang: m.lang || undefined }, ety.root), ')') : null));
      }

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
        kids.push(fold('sent', false, t('card.sentence'), body, 'lf-det lf-sent'));
      }

      // ---- grammar: the patterns the clicked word belongs to first, the rest of the sentence collapsed, then the structure of the sentence ----
      const g = m.grammar;
      if (set.grammar !== false && g && (g.patterns.length || g.words.length)) {
        const rank = (p) => (p.kind === 'ending' ? 1 : 0);
        const mine = g.patterns.filter((p) => p.focus).sort((a, b) => rank(a) - rank(b));
        const rest = g.patterns.filter((p) => !p.focus).sort((a, b) => rank(a) - rank(b));
        if (g.patterns.length) {
          const body = H('div', { class: 'lf-gbody' });
          if (g.sentenceCount > 1) body.appendChild(H('div', { class: 'lf-meta' }, t('card.sentenceN', { i: g.sentenceIndex + 1, n: g.sentenceCount }) + ': ' + g.text));
          if (mine.length) mine.forEach((p, i) => body.appendChild(this._patternBlock(p, 'm' + i, H, fold, m.lang)));
          else body.appendChild(H('div', { class: 'lf-meta' }, t('card.grammar.empty')));
          kids.push(fold('gram', true, t('card.grammar') + (mine.length ? ' · ' + mine.length : ''), body, 'lf-det lf-gram'));
        }
        if (rest.length) {
          kids.push(fold('gramOther', false, t('card.grammar.other') + ' · ' + rest.length,
            H('div', { class: 'lf-gbody' }, rest.map((p, i) => this._patternBlock(p, 'o' + i, H, fold, m.lang))), 'lf-det lf-gram'));
        }
        kids.push(fold('struct', false, t('card.structure'), this._structureBody(g, H, m.lang), 'lf-det lf-gram'));
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
    /** One grammar pattern: form · level · confidence, meaning, the words it matched, and (collapsed) explanation + examples. */
    _patternBlock(p, key, H, fold, lang) {
      const t = this.t;
      const kids = [
        H('div', { class: 'lf-pt' },
          H('span', { class: 'lf-pform' }, p.title),
          p.level ? H('span', { class: 'lf-lv' }, t('card.grammar.level', { n: p.level })) : null,
          p.kind === 'ending' ? H('span', { class: 'lf-tag' }, t('card.grammar.ending')) : null,
          p.confidence && p.confidence !== 'high' ? H('span', { class: 'lf-pill ' + p.confidence }, t('card.grammar.conf.' + p.confidence)) : null),
        H('div', { class: 'lf-pm' }, p.meaning)];
      if (p.text) kids.push(H('div', { class: 'lf-ptext' }, t('card.grammar.matched') + ': ', H('span', { class: 'lf-ko', lang: lang || undefined }, p.text)));
      for (const n of p.notes || []) kids.push(H('div', { class: 'lf-pnote' }, n));
      const ex = p.examples || [];
      if (p.note || ex.length) {
        kids.push(fold('pat:' + key, false, t('card.grammar.detail'), H('div', { class: 'lf-pbody' },
          p.note ? H('p', null, p.note) : null,
          ex.length ? H('ul', { class: 'lf-exs' }, ex.map((e) => H('li', null, H('span', { class: 'lf-ko', lang: lang || undefined }, e.text), e.translation ? H('span', { class: 'lf-exvi' }, e.translation) : null))) : null), 'lf-det lf-pdet'));
      }
      return H('div', { class: 'lf-pat' + (p.focus ? ' focus' : '') }, kids);
    }
    /** What can be read from the sentence as a whole: facts, clauses, the role of each word, the order skeleton. */
    _structureBody(g, H, lang) {
      const t = this.t;
      const box = H('div', { class: 'lf-sbody' });
      if (g.facts.length) {
        box.appendChild(H('div', { class: 'lf-sh' }, t('card.structure.facts')));
        box.appendChild(H('dl', { class: 'lf-facts' }, g.facts.map((f) => [H('dt', null, f.label), H('dd', null, f.value, f.hint ? H('small', null, f.hint) : null)])));
      }
      if (g.clauses.length > 1) {
        box.appendChild(H('div', { class: 'lf-sh' }, t('card.structure.clauses')));
        box.appendChild(H('ol', { class: 'lf-clauses' }, g.clauses.map((c) => H('li', null, H('span', { class: 'lf-ko', lang: lang || undefined }, c.text),
          H('small', null, [c.kindLabel, c.relationLabel].filter(Boolean).join(' · '))))));
      }
      if (g.words.length) {
        box.appendChild(H('div', { class: 'lf-sh' }, t('card.structure.words')));
        box.appendChild(H('div', { class: 'lf-roles' }, g.words.map((w) => [
          H('span', { class: 'lf-rw' + (w.focus ? ' focus' : ''), lang: lang || undefined }, w.text),
          H('span', { class: 'lf-rr', title: w.roleHint || undefined }, w.roleLabel + (w.gloss ? ' — ' + w.gloss : ''))])));
      }
      if (g.structure.length) {
        box.appendChild(H('div', { class: 'lf-sh' }, t('card.structure.order')));
        box.appendChild(H('div', { class: 'lf-skel' }, g.structure.map((s, i) => [i ? H('span', { class: 'lf-arrow' }, '→') : null, H('span', { class: 'lf-chip' }, s.label)])));
      }
      box.appendChild(H('div', { class: 'lf-meta lf-sn' }, t('card.structure.note')));
      return box;
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
