/* LinguaFlow popup + full-page app (Home · Vocabulary · Review · Settings).
 * Same code for the toolbar popup (data-mode="popup") and the full tab (data-mode="tab").
 * All data lives in browser.storage.local; nothing is sent anywhere. */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow;
  const api = root.browser || root.chrome;
  const doc = root.document;
  const h = (tag, attrs, ...kids) => LF.util.h(tag, attrs, ...kids);

  const NAV = [['home', '⌂', 'nav.home'], ['vocabulary', '☰', 'nav.vocabulary'], ['review', '↻', 'nav.review'], ['settings', '⚙', 'nav.settings']];
  const S = { settings: null, vocab: null, i18n: null, view: 'home', pron: null, filter: 'all', query: '', review: null, cleanup: null };
  const t = (k, p) => S.i18n.t(k, p);

  const $view = () => doc.getElementById('view');
  const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); };
  const lang = () => LF.LanguagePackManager.resolve(S.settings.value('language'));
  const pack = () => LF.LanguagePackManager.get(lang());
  const fmtDate = (ts) => (ts ? new Date(ts).toLocaleString(S.i18n.lang === 'en' ? 'en-GB' : 'vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—');

  function status(message) {
    const v = $view();
    const old = v.querySelector('.status');
    if (old) old.remove();
    const el = h('div', { class: 'status', role: 'status' }, message);
    v.appendChild(el);
    root.setTimeout(() => el.remove(), 6000);
  }
  async function speak(text) {
    const r = await S.pron.speak(text, lang());
    if (r.ok) return;
    const p = pack();
    status(t({ 'no-voice-for-language': 'toast.noVoice', 'no-voices': 'toast.noVoices', unsupported: 'toast.unsupported' }[r.reason] || 'toast.speechError', p ? { language: p.getNativeName(), lang: p.getSpeechLang() } : undefined));
  }

  // ---- shell ---------------------------------------------------------------------------------------------------
  function renderNav() {
    const nav = doc.getElementById('nav');
    clear(nav);
    for (const [id, ico, key] of NAV) {
      nav.appendChild(h('button', { type: 'button', 'aria-current': S.view === id ? 'page' : undefined, onClick: () => show(id) }, h('span', { class: 'ico', 'aria-hidden': 'true' }, ico), t(key)));
    }
  }
  async function show(view) {
    if (S.cleanup) { S.cleanup(); S.cleanup = null; }
    S.view = NAV.some((n) => n[0] === view) ? view : 'home';
    try { root.history.replaceState(null, '', '#' + S.view); } catch (e) { /* remembering the view in the URL is optional */ }
    renderNav();
    const v = $view();
    clear(v);
    const node = await ({ home: renderHome, vocabulary: renderVocabulary, review: renderReview, settings: renderSettings }[S.view])();
    clear(v);
    v.appendChild(node);
  }

  // ---- Home ----------------------------------------------------------------------------------------------------
  function switchRow(key, label, hint) {
    const input = h('input', { type: 'checkbox', checked: S.settings.value(key) ? true : undefined });
    input.checked = !!S.settings.value(key);
    input.addEventListener('change', () => S.settings.set({ [key]: input.checked }));
    return h('label', { class: 'switch' }, input, h('span', { class: 'track' }), h('span', { class: 'label' }, label, hint ? h('span', { class: 'hint' }, hint) : null));
  }
  async function renderHome() {
    const langs = LF.LanguagePackManager.listAll();
    const current = lang();
    const langList = h('div', { class: 'langs', role: 'radiogroup', 'aria-label': t('home.language') }, langs.map((l) => {
      const on = l.available && l.id === current;
      const btn = h('button', { class: 'lang', type: 'button', role: 'radio', title: l.name, 'aria-checked': String(on), 'aria-disabled': l.available ? undefined : 'true' },
        h('span', { class: 'flag' }, l.flag),
        h('span', { class: 'names' }, h('b', null, l.nativeName), h('span', null, l.name)),
        h('span', { class: 'badge' + (on ? ' on' : '') }, l.available ? (on ? t('lang.current') : '') : t('lang.comingSoon')));
      if (l.available) btn.addEventListener('click', async () => { await S.settings.set({ language: l.id }); show('home'); });
      else btn.addEventListener('click', (e) => e.preventDefault()); // packs that do not exist cannot be selected
      return btn;
    }));
    const stats = await S.vocab.stats(current);
    return h('div', null,
      h('div', { class: 'section' }, h('h2', null, t('home.language')), langList),
      h('div', { class: 'section' },
        switchRow('learningMode', t('opt.learningMode'), t('opt.learningMode.hint')),
        switchRow('clickWords', t('opt.clickWords')), switchRow('morphology', t('opt.morphology')),
        switchRow('vocabulary', t('opt.vocabulary')), switchRow('pronunciation', t('opt.pronunciation'))),
      h('div', { class: 'stats' }, t('home.stats', { total: stats.total, due: stats.due })),
      h('p', { class: 'muted small' }, t('home.hint', { language: pack() ? pack().getNativeName() : '' })));
  }

  // ---- Vocabulary ----------------------------------------------------------------------------------------------
  function download(name, text, type) {
    const url = root.URL.createObjectURL(new root.Blob([text], { type }));
    const a = h('a', { href: url, download: name });
    doc.body.appendChild(a); a.click(); a.remove();
    root.setTimeout(() => root.URL.revokeObjectURL(url), 2000);
  }
  async function renderVocabulary() {
    const box = h('div');
    const list = h('div', { class: 'vlist' });
    const count = h('span', { class: 'muted small' });
    const chips = ['all', 'learning', 'known'].map((f) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(S.filter === f),
      onClick: () => { S.filter = f; chips.forEach((c, i) => c.setAttribute('aria-pressed', String(['all', 'learning', 'known'][i] === f))); draw(); } }, t('vocab.filter.' + f)));
    const search = h('input', { type: 'search', placeholder: t('vocab.search'), value: S.query, 'aria-label': t('vocab.search') });
    search.addEventListener('input', () => { S.query = search.value; draw(); });
    const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      try { const r = await S.vocab.importJSON(await f.text()); status(t('vocab.importDone', r)); draw(); } catch (e) { status(t('vocab.importFail', { error: e.message })); }
      fileInput.value = '';
    });
    async function draw() {
      const items = await S.vocab.list({ language: lang(), known: S.filter === 'all' ? undefined : S.filter === 'known', query: S.query || undefined });
      clear(list);
      count.textContent = t('vocab.count', { n: items.length });
      if (!items.length) list.appendChild(h('div', { class: 'empty' }, t('vocab.empty')));
      for (const it of items.slice(0, 300)) list.appendChild(vocabItem(it));
    }
    function vocabItem(it) {
      const rom = pack() ? pack().getPronunciation(it.lemma).romanization : '';
      return h('div', { class: 'vitem' + (it.known ? ' known' : ''), dataset: { id: it.id } },
        h('div', { class: 'vtop' }, h('span', { class: 'vword', lang: it.language }, it.lemma), it.word !== it.lemma ? h('span', { class: 'vform' }, it.word) : null, h('span', { class: 'vform' }, rom)),
        it.meaning ? h('div', { class: 'vmeaning' }, it.meaning) : null,
        it.sentence ? h('div', { class: 'vsent' }, it.sentence, it.translation ? h('i', null, it.translation) : null) : null,
        h('div', { class: 'vmeta' },
          h('button', { class: 'btn', type: 'button', title: t('review.speak'), onClick: () => speak(it.lemma) }, '🔊'),
          h('button', { class: 'btn', type: 'button', onClick: async () => { await S.vocab.setKnown(it.id, !it.known); draw(); } }, it.known ? t('vocab.markLearning') : t('vocab.markKnown')),
          h('button', { class: 'btn danger', type: 'button', onClick: async () => { await S.vocab.remove(it.id); draw(); } }, t('vocab.delete')),
          h('span', null, it.known ? '' : t('vocab.next') + ': ' + fmtDate(it.nextReview)), h('span', null, '· ' + t('vocab.reviewed', { n: it.reviewCount || 0 }))));
    }
    box.append(search, h('div', { class: 'chips' }, chips, h('span', { class: 'grow' }), count), list,
      h('div', { class: 'row', style: { marginTop: '14px' } },
        h('button', { class: 'btn', type: 'button', onClick: async () => download('linguaflow-vocabulary.json', await S.vocab.exportJSON(lang()), 'application/json') }, t('vocab.exportJson')),
        h('button', { class: 'btn', type: 'button', onClick: async () => download('linguaflow-vocabulary.csv', await S.vocab.exportCsv(lang()), 'text/csv') }, t('vocab.exportCsv')),
        h('button', { class: 'btn', type: 'button', onClick: () => fileInput.click() }, t('vocab.import')), fileInput));
    await draw();
    const off = S.vocab.on('change', draw);
    S.cleanup = off;
    return box;
  }

  // ---- Review --------------------------------------------------------------------------------------------------
  async function renderReview() {
    const queue = await S.vocab.getDue(lang(), { limit: 50, newLimit: 20 });
    const box = h('div', { class: 'rv' });
    const total = queue.length;
    let idx = 0, revealed = false;
    function draw() {
      clear(box);
      if (!total) { box.appendChild(h('div', { class: 'empty' }, t('review.empty'))); return; }
      if (idx >= total) { box.appendChild(h('div', { class: 'empty' }, t('review.done'))); return; }
      const it = queue[idx];
      const p = pack();
      const rom = p && S.settings.value('showRomanization') ? p.getPronunciation(it.lemma).romanization : '';
      box.appendChild(h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': idx }, h('div', { style: { width: Math.round((idx / total) * 100) + '%' } })));
      box.appendChild(h('div', { class: 'rv-front' },
        h('div', { class: 'rv-word', lang: it.language }, it.lemma), rom ? h('div', { class: 'rv-rom' }, rom) : null,
        S.settings.value('pronunciation') ? h('button', { class: 'btn', type: 'button', style: { marginTop: '10px' }, onClick: () => speak(it.lemma) }, '🔊 ' + t('review.speak')) : null));
      if (!revealed) {
        box.appendChild(h('button', { class: 'btn primary', type: 'button', id: 'show', style: { width: '100%', padding: '10px' }, onClick: () => { revealed = true; draw(); } }, t('review.show')));
        box.appendChild(h('div', { class: 'muted small', style: { marginTop: '10px' } }, t('review.progress', { n: total - idx })));
        return;
      }
      const ctx = it.sentence ? h('div', { class: 'rv-ctx' }, h('div', { class: 'muted small' }, t('review.context')),
        highlight(it.sentence, [it.word, it.lemma]), it.translation ? h('i', null, it.translation) : null) : null;
      box.appendChild(h('div', { class: 'rv-back' }, h('div', { class: 'rv-meaning' }, it.meaning || '—'), ctx));
      const prev = LF.ReviewEngine.previewIntervals(it, Date.now());
      box.appendChild(h('div', { class: 'grades' }, prev.map((g, i) => h('button', { class: 'btn ' + g.grade, type: 'button', title: (i + 1) + '', onClick: () => grade(g.grade) }, t('review.' + g.grade), h('small', null, g.label)))));
    }
    function highlight(sentence, words) {
      const w = words.filter(Boolean).find((x) => sentence.includes(x));
      if (!w) return sentence;
      const i = sentence.indexOf(w);
      return [sentence.slice(0, i), h('mark', null, w), sentence.slice(i + w.length)];
    }
    async function grade(g) {
      await S.vocab.review(queue[idx].id, g);
      idx++; revealed = false; draw();
    }
    const onKey = (e) => {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); revealed = true; draw(); }
      else if (revealed && ['1', '2', '3', '4'].includes(e.key) && idx < total) grade(LF.ReviewEngine.GRADE_NAMES[Number(e.key) - 1]);
    };
    doc.addEventListener('keydown', onKey);
    S.cleanup = () => doc.removeEventListener('keydown', onKey);
    draw();
    return box;
  }

  // ---- Settings ------------------------------------------------------------------------------------------------
  async function renderSettings() {
    const uiSel = h('select', { 'aria-label': t('set.ui') }, h('option', { value: 'vi' }, 'Tiếng Việt'), h('option', { value: 'en' }, 'English'));
    uiSel.value = S.settings.value('uiLanguage');
    uiSel.addEventListener('change', async () => { await S.settings.set({ uiLanguage: uiSel.value }); S.i18n.setLanguage(uiSel.value); show('settings'); });

    const rate = h('input', { type: 'range', min: '0.5', max: '1.5', step: '0.1', value: String(S.settings.value('speechRate')), 'aria-label': t('set.rate') });
    const rateLabel = h('span', { class: 'muted small' }, S.settings.value('speechRate') + '×');
    rate.addEventListener('input', () => { rateLabel.textContent = rate.value + '×'; });
    rate.addEventListener('change', () => S.settings.set({ speechRate: Number(rate.value) }));

    const sel = h('textarea', { spellcheck: 'false', 'aria-label': t('set.selectors'), placeholder: '.player-timedtext-text-container\n#my-custom-subtitle' });
    sel.value = S.settings.value('customSelectors');
    sel.addEventListener('change', () => S.settings.set({ customSelectors: sel.value }));

    const stats = await S.vocab.stats(lang());
    const v = LF.VERSION || '1.0.0';
    return h('div', null,
      h('div', { class: 'section' }, h('h2', null, t('set.ui')), uiSel),
      h('div', { class: 'section' },
        switchRow('pauseOnLookup', t('set.pause')), switchRow('resumeOnClose', t('set.resume')), switchRow('showRomanization', t('set.romanization')),
        switchRow('allowExternalLinks', t('set.external')), switchRow('debug', t('set.debug'))),
      h('div', { class: 'section' }, h('h2', null, t('set.rate')), h('div', { class: 'row' }, h('div', { class: 'grow' }, rate), rateLabel)),
      h('div', { class: 'section' }, h('h2', null, t('set.selectors')), sel, h('p', { class: 'muted small' }, t('set.selectors.hint'))),
      h('div', { class: 'section' }, h('h2', null, t('set.data')), h('p', { class: 'muted small' }, t('set.data.hint')),
        h('p', { class: 'small' }, t('home.stats', { total: stats.total, due: stats.due })),
        h('div', { class: 'row' },
          h('button', { class: 'btn', type: 'button', onClick: async () => { await S.settings.reset(); S.i18n.setLanguage(S.settings.value('uiLanguage')); show('settings'); } }, t('set.reset')),
          h('button', { class: 'btn danger', type: 'button', onClick: async () => { if (root.confirm(t('set.deleteAll.confirm'))) { await S.vocab.clear(); show('settings'); } } }, t('set.deleteAll')))),
      h('p', { class: 'muted small' }, 'LinguaFlow ' + v + ' · MIT'));
  }

  // ---- boot ----------------------------------------------------------------------------------------------------
  async function init() {
    S.settings = LF.Settings.create(api);
    await S.settings.load();
    S.i18n = LF.i18n.create(S.settings.value('uiLanguage'));
    S.vocab = new LF.VocabularyManager({ storage: new LF.VocabularyStorage(api.storage.local) });
    S.pron = new LF.Pronunciation({ getRate: () => S.settings.value('speechRate') });
    doc.getElementById('openTab').addEventListener('click', () => { api.tabs.create({ url: api.runtime.getURL('src/popup/page.html') + '#' + S.view }); root.close(); });
    doc.getElementById('openTab').title = t('home.openTab');
    S.settings.on('change', () => { if (S.view === 'home') show('home'); });
    await show((root.location.hash || '').slice(1) || 'home');
  }
  LF.PopupApp = { init, show, state: S };
  if (typeof module === 'undefined') init().catch((e) => { root.console.error(e); const v = $view(); if (v) v.textContent = 'LinguaFlow: ' + e.message; });
})(typeof globalThis !== 'undefined' ? globalThis : this);
