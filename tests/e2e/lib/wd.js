'use strict';
/* A minimal W3C WebDriver client for geckodriver (no dependencies; needs Node >= 18 for the global fetch). */
const { spawn } = require('child_process');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class WD {
  constructor(port) { this.base = 'http://127.0.0.1:' + port; this.sid = null; this.proc = null; this.port = port; }
  static async launch(geckodriver, port, logFile) {
    const wd = new WD(port);
    const log = fs.openSync(logFile, 'w');
    let spawnError = null;
    wd.proc = spawn(geckodriver, ['--port', String(port), '--log', 'info'], { stdio: ['ignore', log, log] });
    wd.proc.on('error', (e) => { spawnError = e; });
    for (let i = 0; i < 60; i++) {
      if (spawnError) throw new Error(`cannot start geckodriver ("${geckodriver}"): ${spawnError.message}. Install it or set GECKODRIVER=/path/to/geckodriver`);
      try { const r = await fetch(wd.base + '/status'); if (r.ok) return wd; } catch (e) { /* not up yet */ }
      await sleep(100);
    }
    throw new Error('geckodriver did not start (see ' + logFile + ')');
  }
  async req(method, path, body) {
    const r = await fetch(this.base + path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const txt = await r.text();
    let j = {}; try { j = JSON.parse(txt); } catch (e) { j = { value: { error: 'bad json', message: txt.slice(0, 300) } }; }
    if (!r.ok || (j.value && typeof j.value === 'object' && j.value.error)) throw new Error(`${method} ${path} -> ${JSON.stringify(j.value || j).slice(0, 600)}`);
    return j.value;
  }
  s(p) { return '/session/' + this.sid + p; }
  async newSession(caps) { const v = await this.req('POST', '/session', { capabilities: { alwaysMatch: caps } }); this.sid = v.sessionId; return v; }
  go(url) { return this.req('POST', this.s('/url'), { url }); }
  url() { return this.req('GET', this.s('/url')); }
  exec(script, args) { return this.req('POST', this.s('/execute/sync'), { script, args: args || [] }); }
  execAsync(script, args) { return this.req('POST', this.s('/execute/async'), { script, args: args || [] }); }
  context(c) { return this.req('POST', this.s('/moz/context'), { context: c }); }
  installAddon(path) { return this.req('POST', this.s('/moz/addon/install'), { path, temporary: true }); }
  handles() { return this.req('GET', this.s('/window/handles')); }
  handle() { return this.req('GET', this.s('/window')); }
  switchTo(h) { return this.req('POST', this.s('/window'), { handle: h }); }
  closeTab() { return this.req('DELETE', this.s('/window')); }
  setRect(w, h) { return this.req('POST', this.s('/window/rect'), { width: w, height: h, x: 0, y: 0 }); }
  actions(seq) { return this.req('POST', this.s('/actions'), { actions: seq }); }
  releaseActions() { return this.req('DELETE', this.s('/actions')); }
  async screenshot(file) { const b64 = await this.req('GET', this.s('/screenshot')); fs.writeFileSync(file, Buffer.from(b64, 'base64')); return file; }
  async find(css) { const v = await this.req('POST', this.s('/element'), { using: 'css selector', value: css }); return v['element-6066-11e4-a52e-4f735466cecf']; }
  sendKeys(el, text) { return this.req('POST', this.s('/element/' + el + '/value'), { text }); }
  clearEl(el) { return this.req('POST', this.s('/element/' + el + '/clear'), {}); }
  async move(x, y) { await this.actions([{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions: [{ type: 'pointerMove', duration: 0, x: Math.round(x), y: Math.round(y), origin: 'viewport' }] }]); }
  async click(x, y) {
    await this.actions([{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions: [
      { type: 'pointerMove', duration: 0, x: Math.round(x), y: Math.round(y), origin: 'viewport' }, { type: 'pointerDown', button: 0 }, { type: 'pointerUp', button: 0 }] }]);
  }
  /** one key press; special keys by their WebDriver code point, e.g. '' = Escape */
  async key(k) { await this.actions([{ type: 'key', id: 'kbd', actions: [{ type: 'keyDown', value: k }, { type: 'keyUp', value: k }] }]); }
  async quit() { try { if (this.sid) await this.req('DELETE', '/session/' + this.sid); } catch (e) { /* already gone */ } if (this.proc) this.proc.kill(); }
}
module.exports = { WD, sleep };
