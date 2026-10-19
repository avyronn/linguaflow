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
  for (const f of ['README.md', 'README.en.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'THIRD_PARTY_NOTICES.md', 'SECURITY.md', 'LICENSE', 'build.sh', 'package.json', 'data/korean/dictionary.json', 'data/korean/dictionary.src.txt', 'data/korean/hanja.txt']) assert.ok(fs.existsSync(path.join(ROOT, f)), f);
  for (const f of ['README.md', 'run.js', 'lib/wd.js', 'lib/fake-netflix.js', 'lib/boot.js']) assert.ok(fs.existsSync(path.join(ROOT, 'tests/e2e', f)), 'tests/e2e/' + f);
  for (const d of ['src/core/subtitle', 'src/core/dictionary', 'src/core/vocabulary', 'src/core/review', 'src/core/pronunciation', 'src/core/language', 'src/languages/korean', 'src/content', 'src/popup', 'tests/korean', 'tests/subtitle', 'tests/vocabulary'])
    assert.ok(fs.existsSync(path.join(ROOT, d)), d);
  for (const f of ['index.js', 'tokenizer.js', 'morphology.js', 'particles.js', 'endings.js', 'conjugation.js', 'dictionary.js', 'numerals.js', 'patterns.js', 'grammar-patterns.js', 'grammar-guide.js', 'grammar-view.js', 'sentence.js']) assert.ok(fs.existsSync(path.join(ROOT, 'src/languages/korean', f)), f);
  for (const f of ['build-dictionary.js', 'check-syntax.js', 'gen-numeral-counters.js', 'make-zip.js', 'run-tests.js']) assert.ok(fs.existsSync(path.join(ROOT, 'scripts', f)), f);
  for (const f of ['dictionary-manager.js', 'dictionary-provider.js', 'local-provider.js']) assert.ok(fs.existsSync(path.join(ROOT, 'src/core/dictionary', f)), f);
  for (const f of ['subtitle-manager.js', 'netflix-adapter.js', 'nflxmultisubs-adapter.js', 'subtitle-parser.js']) assert.ok(fs.existsSync(path.join(ROOT, 'src/core/subtitle', f)), f);
  for (const f of ['vocabulary-manager.js', 'storage.js']) assert.ok(fs.existsSync(path.join(ROOT, 'src/core/vocabulary', f)), f);
});

test('one version everywhere: manifest.json = package.json = package-lock.json = LF.VERSION (shown in the popup and the diagnostics)', () => {
  const pkg = JSON.parse(read('package.json')), lock = JSON.parse(read('package-lock.json'));
  const inSource = /LF\.VERSION\s*=\s*'([^']+)'/.exec(read('src/core/util.js'))[1];
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(pkg.version, manifest.version); assert.equal(lock.version, manifest.version); assert.equal(lock.packages[''].version, manifest.version); assert.equal(inSource, manifest.version);
  assert.match(read('src/popup/popup.js'), new RegExp("LF\\.VERSION \\|\\| '" + manifest.version.replace(/\./g, '\\.') + "'"), 'the popup fallback shows the same version');
});
test('release documents: the changelog has an entry for this version; the extension zip carries the license and the data notices', () => {
  assert.match(read('CHANGELOG.md'), new RegExp('^## ' + manifest.version.replace(/\./g, '\\.') + '(\\s|$)', 'm'), 'CHANGELOG.md has no "## ' + manifest.version + '" entry');
  const { EXT_ITEMS } = require(path.join(ROOT, 'scripts/make-zip.js'));
  for (const item of ['manifest.json', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'src', 'icons', 'data/korean/dictionary.json']) assert.ok(EXT_ITEMS.includes(item), 'the extension zip must contain ' + item);
  for (const item of EXT_ITEMS) assert.ok(fs.existsSync(path.join(ROOT, item)), 'EXT_ITEMS lists a missing path: ' + item);
  // the zip ships only what Firefox needs: no tests, scripts, source dictionary files or node_modules
  assert.ok(!EXT_ITEMS.some((i) => /^(tests|scripts|node_modules|dist|\.github)\b|dictionary\.src|sources\//.test(i)), 'the extension zip must not contain development files');
});
test('authorship: AVYRON is the author in the manifest; the heart icon is plain vector art; every local file the popup pages use exists; the credit links are safe', () => {
  assert.equal(manifest.author, 'AVYRON');
  assert.deepEqual(manifest.developer, { name: 'AVYRON' }); // "by AVYRON" on about:addons. (No developer.url: Firefox would then show the profile instead of the project as the add-on's homepage.)
  assert.equal(manifest.homepage_url, 'https://github.com/avyronn/linguaflow');
  const svg = read('icons/heart.svg');
  assert.match(svg, /^<svg[^>]*\sxmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.ok(!/<script|<image|<foreignObject|\son[a-z]+\s*=|href\s*=\s*["']?(https?:|data:)/i.test(svg), 'the icon is plain vector art: no script, event handler, bitmap or external reference');
  for (const html of ['src/popup/popup.html', 'src/popup/page.html']) {
    const doc = read(html);
    for (const m of doc.matchAll(/\b(?:src|href)="([^"#]+)"/g)) {
      if (/^(https?:|mailto:)/.test(m[1])) continue;
      assert.ok(fs.existsSync(path.join(ROOT, 'src/popup', m[1])), html + ' references a file that does not exist: ' + m[1]);
    }
    assert.match(doc, /Made with[\s\S]*icons\/heart\.svg[\s\S]*>by<[\s\S]*>AVYRON</, html + ': the credit line is missing');
    // a link in an extension page opens only when the person clicks it, in a new tab, without handing this page to the target
    for (const m of doc.matchAll(/<a\b[^>]*>/g)) assert.match(m[0], /target="_blank" rel="noopener noreferrer"/, html + ': unsafe link ' + m[0]);
  }
});
test('interface texts: Vietnamese and English have exactly the same keys and placeholders; every key the code asks for exists', () => {
  const { STRINGS } = require(path.join(ROOT, 'src/core/i18n.js'));
  const vi = Object.keys(STRINGS.vi).sort(), en = Object.keys(STRINGS.en).sort();
  assert.deepEqual(vi.filter((k) => !(k in STRINGS.en)), [], 'keys missing from English');
  assert.deepEqual(en.filter((k) => !(k in STRINGS.vi)), [], 'keys missing from Vietnamese');
  const holes = (s) => (String(s).match(/\{[a-zA-Z]+\}/g) || []).sort().join();
  assert.deepEqual(vi.filter((k) => holes(STRINGS.vi[k]) !== holes(STRINGS.en[k])), [], 'placeholders differ between languages');
  for (const k of vi) { assert.ok(String(STRINGS.vi[k]).trim().length > 0 && String(STRINGS.en[k]).trim().length > 0, 'empty text: ' + k); }
  const used = new Set(), prefixes = new Set();
  for (const f of walk('src', []).filter((x) => /\.(js|html)$/.test(x))) {
    const code = read(f);
    for (const m of code.matchAll(/\bt\('([a-zA-Z0-9_.]*[a-zA-Z0-9_])'/g)) used.add(m[1]); // (a key ending in a dot is the start of a dynamic key: handled below)
    for (const m of code.matchAll(/\bt\('([a-zA-Z0-9_.]+\.)'\s*\+/g)) prefixes.add(m[1]);
    for (const m of code.matchAll(/data-i18n(?:-[a-z]+)?="([a-zA-Z0-9_.]+)"/g)) used.add(m[1]);
  }
  assert.ok(used.size > 80, 'keys found in the code: ' + used.size);
  assert.deepEqual([...used].filter((k) => !(k in STRINGS.vi)), [], 'keys used in the code but not defined');
  for (const p of prefixes) assert.ok(vi.some((k) => k.startsWith(p)), 'no text for the dynamic key ' + p + '…');
});
