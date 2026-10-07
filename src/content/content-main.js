/* Content-script entry point for https://www.netflix.com/*. Builds the object graph and keeps it in sync with Settings.
 * Everything is wrapped so that a LinguaFlow failure can never break the Netflix page. */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow;
  if (!LF || LF.__booted) return;
  LF.__booted = true;

  const api = root.browser || root.chrome;
  const doc = root.document;

  async function main() {
    const settings = LF.Settings.create(api);
    await settings.load();
    const s0 = settings.get();
    LF.log.enabled = !!s0.debug;
    const i18n = LF.i18n.create(s0.uiLanguage);

    const langId = LF.LanguagePackManager.resolve(s0.language);
    let pack = LF.LanguagePackManager.get(langId);
    if (!pack) { LF.log.warn('no language pack installed'); return; }

    const subtitles = new LF.SubtitleManager({ document: doc, window: root, languagePack: pack, nativeLanguage: s0.nativeLanguage, watchOnly: true });
    subtitles.setCustomSelectors(LF.SubtitleSelectors.parseCustom(s0.customSelectors));
    const overlay = new LF.LearningOverlay({ document: doc, window: root, t: i18n.t });
    const vocabulary = new LF.VocabularyManager({ storage: new LF.VocabularyStorage(api.storage.local) });
    const pronunciation = new LF.Pronunciation({ getRate: () => settings.value('speechRate') });
    const player = new LF.PlayerControl(() => subtitles.findVideo());
    const controller = new LF.LearningController({ document: doc, window: root, subtitles, pack, overlay, vocabulary, pronunciation, settings, player, i18n });

    pack.init().catch((e) => LF.log.error('language pack init failed', e)); // warm up; the controller awaits it again on first click
    subtitles.start();
    controller.start();

    settings.on('change', (s) => {
      LF.log.enabled = !!s.debug;
      i18n.setLanguage(s.uiLanguage);
      subtitles.setNativeLanguage(s.nativeLanguage);
      subtitles.setCustomSelectors(LF.SubtitleSelectors.parseCustom(s.customSelectors));
      const wanted = LF.LanguagePackManager.resolve(s.language);
      if (wanted && wanted !== pack.getId()) {
        pack = LF.LanguagePackManager.get(wanted);
        subtitles.setLanguagePack(pack);
        controller.setPack(pack);
        pack.init().catch((e) => LF.log.error('language pack init failed', e));
      }
      if (!s.learningMode || !s.clickWords) { overlay.setHighlight(null); controller.closeCard({ resume: false }); }
    });
    LF.__app = { settings, subtitles, overlay, controller, vocabulary }; // handy for the diagnostics panel
    LF.log.info('ready', LF.VERSION);
  }

  main().catch((e) => LF.log.error('LinguaFlow failed to start', e));
})(typeof globalThis !== 'undefined' ? globalThis : this);
