'use strict';
/* Starts the fake Netflix, geckodriver and a headless Gecko browser, and installs the PACKAGED extension (the zip made by scripts/make-zip.js).
 *   FIREFOX_BIN   path of firefox (or another Gecko browser >= 140); default: whatever geckodriver finds
 *   GECKODRIVER   path of geckodriver;                               default: "geckodriver" from PATH
 *   EXT_ZIP       test this zip instead of building one from the working tree
 *   E2E_PORT / E2E_WD_PORT   ports of the fake site (8443) and of geckodriver (4444)
 *   E2E_HEADFUL=1 show the browser window (needs a display; under CI use xvfb-run) */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { WD, sleep } = require('./wd.js');
const server = require('./fake-netflix.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const WORK = path.join(ROOT, 'dist', 'e2e');
const CFG = {
  root: ROOT, work: WORK, version: manifest.version,
  firefox: process.env.FIREFOX_BIN || '',
  geckodriver: process.env.GECKODRIVER || 'geckodriver',
  zip: process.env.EXT_ZIP || path.join(WORK, 'linguaflow-under-test.zip'),
  port: Number(process.env.E2E_PORT) || 8443,
  wdPort: Number(process.env.E2E_WD_PORT) || 4444,
  addonId: manifest.browser_specific_settings.gecko.id,
  uuid: 'e2e00000-0000-4000-8000-0000000000a1', // fixed, so the test can open moz-extension://<uuid>/... pages
  headful: !!process.env.E2E_HEADFUL,
};
CFG.ext = (p) => `moz-extension://${CFG.uuid}/${p}`;

function ensureZip() {
  if (process.env.EXT_ZIP) return CFG.zip;
  fs.mkdirSync(WORK, { recursive: true });
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'make-zip.js'), 'extension', CFG.zip], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('could not build the extension zip:\n' + (r.stderr || r.stdout));
  return CFG.zip;
}

async function boot(opts) {
  const o = Object.assign({ width: 1280, height: 900 }, opts);
  const zip = ensureZip();
  const srv = await server.start(CFG.port, WORK);
  let wd;
  try {
    wd = await WD.launch(CFG.geckodriver, CFG.wdPort, path.join(WORK, 'geckodriver.log'));
    const prefs = {
      'network.dns.localDomains': 'www.netflix.com',          // www.netflix.com -> 127.0.0.1 ...
      'network.socket.forcePort': '443=' + CFG.port,          // ... and port 443 -> our fake site, so the real manifest match applies
      'network.proxy.type': 0,
      'extensions.webextensions.uuids': JSON.stringify({ [CFG.addonId]: CFG.uuid }),
      'media.autoplay.default': 0, 'media.autoplay.blocking_policy': 0,
      'app.update.enabled': false, 'datareporting.policy.dataSubmissionEnabled': false, 'toolkit.telemetry.enabled': false,
      'browser.shell.checkDefaultBrowser': false, 'extensions.update.enabled': false, 'devtools.console.stdout.content': true,
    };
    const ff = { args: (CFG.headful ? [] : ['-headless']).concat('-remote-allow-system-access'), prefs, log: { level: 'warn' } };
    if (CFG.firefox) ff.binary = CFG.firefox;
    await wd.newSession({ browserName: 'firefox', acceptInsecureCerts: true, pageLoadStrategy: 'normal', 'moz:firefoxOptions': ff });
    await wd.setRect(o.width, o.height).catch(() => {});
    const id = await wd.installAddon(zip);
    return { wd, srv, id, zip, stop: async () => { await wd.quit(); srv.close(); } };
  } catch (e) {
    if (wd) await wd.quit();
    srv.close();
    throw e;
  }
}
module.exports = { boot, CFG, sleep };
