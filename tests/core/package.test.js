'use strict';
/* Packaging sanity + privacy audit: what ships must load, and must never talk to the network. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('../helpers/load.js');

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const walk = (d, out) => { for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) { const p = path.posix.join(d, e.name); if (e.isDirectory()) walk(p, out); else out.push(p); } return out; };
const srcJs = walk('src', []).filter((f) => f.endsWith('.js'));

test('manifest: MV3, Firefox id, minimal permissions, Netflix only', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, 'LinguaFlow');
  assert.ok(/@/.test(manifest.browser_specific_settings.gecko.id));
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.host_permissions, ['https://www.netflix.com/*']);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://www.netflix.com/*']);
  assert.equal(manifest.content_scripts[0].all_frames, false);
  assert.ok(!('web_accessible_resources' in manifest) || manifest.web_accessible_resources.every((w) => w.matches.every((m) => m === 'https://www.netflix.com/*')));
  assert.ok(!manifest.content_security_policy, 'default extension CSP (no remote code) is kept');
  assert.ok(!(manifest.permissions || []).concat(manifest.optional_permissions || []).some((p) => /tabs|webRequest|cookies|history|downloads|<all_urls>/.test(p)));
});
test('every file referenced by the manifest exists; no duplicates in the content-script list', () => {
  const files = [].concat(manifest.content_scripts[0].js, manifest.background.scripts, Object.values(manifest.icons), Object.values(manifest.action.default_icon),
    [manifest.action.default_popup, manifest.options_ui.page], manifest.web_accessible_resources.flatMap((w) => w.resources));
  for (const f of files) assert.ok(fs.existsSync(path.join(ROOT, f)), 'missing ' + f);
  const js = manifest.content_scripts[0].js;
  assert.equal(new Set(js).size, js.length);
  for (const f of srcJs) if (!js.includes(f) && !manifest.background.scripts.includes(f) && !/popup\/popup\.js$|background\.js$/.test(f)) assert.fail(f + ' is not loaded by any context');
});
test('popup.html and page.html load existing scripts, in an order where dependencies come first', () => {
  for (const html of ['src/popup/popup.html', 'src/popup/page.html']) {
    const srcs = Array.from(read(html).matchAll(/<script src="([^"]+)"/g)).map((m) => path.posix.normalize(path.posix.join('src/popup', m[1])));
    assert.ok(srcs.length > 15);
    for (const s of srcs) assert.ok(fs.existsSync(path.join(ROOT, s)), html + ' → missing ' + s);
    assert.ok(srcs.indexOf('src/core/util.js') < srcs.indexOf('src/core/settings.js'));
    assert.ok(srcs.indexOf('src/core/language/language-pack.js') < srcs.indexOf('src/languages/korean/index.js'));
    assert.equal(srcs[srcs.length - 1], 'src/popup/popup.js');
    assert.ok(!/<script(?![^>]*\bsrc=)/.test(read(html)), 'no inline scripts (MV3 CSP)');
  }
});
test('content-script order in the manifest = dependency order (loads cleanly in a fresh VM context)', () => {
  const vm = require('vm');
  const ctx = vm.createContext({ console, setTimeout, clearTimeout, URL });
  ctx.globalThis = ctx;
  for (const f of manifest.content_scripts[0].js.filter((x) => !x.endsWith('content-main.js'))) vm.runInContext(read(f), ctx, { filename: f });
  assert.equal(typeof ctx.LinguaFlow.SubtitleManager, 'function');
  assert.ok(ctx.LinguaFlow.LanguagePackManager.has('ko'));
});
test('privacy audit: no analytics, no tracking, no network APIs beyond reading packaged files', () => {
  const FORBIDDEN = /setInterval|XMLHttpRequest|sendBeacon|WebSocket|EventSource|importScripts|\beval\s*\(|new Function|document\.write|insertAdjacentHTML|\.innerHTML\s*=|outerHTML\s*=|google-analytics|gtag\(|mixpanel|segment\.|sentry|fullstory|hotjar/i;
  const offenders = [];
  for (const f of srcJs) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    if (FORBIDDEN.test(code)) offenders.push(f + ': ' + code.match(FORBIDDEN)[0]);
    const fetches = code.match(/\bfetch\s*\(/g) || [];
    if (fetches.length && !/local-provider\.js$|background\.js$/.test(f)) offenders.push(f + ': fetch() outside the allowed data loaders');
  }
  assert.deepEqual(offenders, []);
  // fetch() may only ever target extension-packaged URLs
  assert.match(read('src/core/dictionary/local-provider.js'), /fetch\(b\.runtime\.getURL\(path\)\)/);
  assert.match(read('src/background/background.js'), /fetch\(api\.runtime\.getURL\(msg\.path\)\)/);
});
test('privacy audit: URL literals are limited to selectors docs, user-click dictionary links and the homepage', () => {
  const allowed = new Set(['src/languages/korean/index.js']);
  const bad = [];
  for (const f of srcJs) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const m = code.match(/https?:\/\/[^\s'"`)]+/g) || [];
    const external = m.filter((u) => !/^http:\/\/www\.w3\.org\//.test(u));
    if (external.length && !allowed.has(f)) bad.push(f + ': ' + external.join(', '));
  }
  assert.deepEqual(bad, []);
});
test('storage is only used with the extension storage API (no localStorage / IndexedDB / cookies)', () => {
  for (const f of srcJs) assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(read(f)), f);
});
test('required project files exist', () => {
  for (const f of ['README.md', 'LICENSE', 'build.sh', 'package.json', 'data/korean/dictionary.json', 'data/korean/dictionary.src.txt']) assert.ok(fs.existsSync(path.join(ROOT, f)), f);
  for (const d of ['src/core/subtitle', 'src/core/dictionary', 'src/core/vocabulary', 'src/core/review', 'src/core/pronunciation', 'src/core/language', 'src/languages/korean', 'src/content', 'src/popup', 'tests/korean', 'tests/subtitle', 'tests/vocabulary'])
    assert.ok(fs.existsSync(path.join(ROOT, d)), d);
  for (const f of ['index.js', 'tokenizer.js', 'morphology.js', 'particles.js', 'endings.js', 'conjugation.js', 'dictionary.js']) assert.ok(fs.existsSync(path.join(ROOT, 'src/languages/korean', f)), f);
  for (const f of ['dictionary-manager.js', 'dictionary-provider.js', 'local-provider.js']) assert.ok(fs.existsSync(path.join(ROOT, 'src/core/dictionary', f)), f);
  for (const f of ['subtitle-manager.js', 'netflix-adapter.js', 'nflxmultisubs-adapter.js', 'subtitle-parser.js']) assert.ok(fs.existsSync(path.join(ROOT, 'src/core/subtitle', f)), f);
  for (const f of ['vocabulary-manager.js', 'storage.js']) assert.ok(fs.existsSync(path.join(ROOT, 'src/core/vocabulary', f)), f);
});
