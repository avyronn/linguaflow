/* Background (event page). Tiny on purpose:
 *  1. serves packaged JSON data files to content scripts when the page's CSP blocks a direct fetch,
 *  2. handles the "toggle learning mode" keyboard command. No network access, no analytics. */
(function (root) {
  'use strict';
  const api = root.browser || root.chrome;
  const LF = root.LinguaFlow;

  // Only packaged data files may be read through this channel.
  const SAFE_PATH = /^data\/[a-z0-9_\-/]+\.json$/i;

  api.runtime.onMessage.addListener((msg, sender) => {
    if (!msg || msg.type !== 'linguaflow:getData') return undefined;
    if (sender && sender.id && sender.id !== api.runtime.id) return undefined;
    if (typeof msg.path !== 'string' || !SAFE_PATH.test(msg.path) || msg.path.includes('..')) return Promise.resolve({ ok: false, error: 'path not allowed' });
    return fetch(api.runtime.getURL(msg.path)).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then((data) => ({ ok: true, data })).catch((e) => ({ ok: false, error: String(e && e.message || e) }));
  });

  api.commands.onCommand.addListener(async (name) => {
    if (name !== 'toggle-learning-mode' || !LF || !LF.Settings) return;
    const store = LF.Settings.create(api);
    await store.load();
    await store.set({ learningMode: !store.value('learningMode') });
  });

  api.runtime.onInstalled.addListener(async () => {
    if (!LF || !LF.Settings) return;
    const store = LF.Settings.create(api);
    await store.load();
    await store.set({}); // writes defaults for any missing key
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
