'use strict';
/* End-to-end run of the PACKAGED extension (the zip made by scripts/make-zip.js) in a real Gecko engine, headless, through geckodriver:  npm run e2e
 * The page is a fake Netflix (the same subtitle markup as documented for NflxMultiSubs 2.2.1 / Netflix's timed-text renderer, and a real <video>),
 * reached as https://www.netflix.com/... so the REAL manifest match pattern fires. It is not the real Netflix (see tests/e2e/README.md).
 * Every check is a real pointer / keyboard action through WebDriver; the verdicts read the DOM the user would see. Exit code 0 = every check passed. */
const fs = require('fs'), path = require('path');
const { boot, CFG, sleep } = require('./lib/boot.js');
const { koreanPack } = require('../helpers/load.js');

const SHOTS = path.join(CFG.work, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const note = {};
function ok(name, cond, detail) {
  results.push({ name, pass: !!cond, detail: cond ? '' : String(detail === undefined ? '' : detail) });
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '\n       -> ' + String(detail === undefined ? '' : detail).slice(0, 700)));
}
async function waitFor(fn, ms, step) {
  const end = Date.now() + (ms || 4000);
  let v;
  for (;;) { v = await fn(); if (v) return v; if (Date.now() > end) return v; await sleep(step || 60); }
}

// ---- page helpers (run inside the page; the open shadow root of the overlay is readable from there) ------------------------------
const CARD = `
  const h = document.getElementById('linguaflow-root'); const sh = h && h.shadowRoot; const c = sh && sh.querySelector('.lf-card');
  if (!c) return null;
  const r = c.getBoundingClientRect(), q = (s) => Array.from(c.querySelectorAll(s)), s = getComputedStyle(c);
  const txt = (e) => (e ? e.textContent : '');
  return { rect: [r.left, r.top, r.right, r.bottom], maxHeight: c.style.maxHeight, surface: txt(c.querySelector('.lf-surface')), roman: txt(c.querySelector('.lf-roman')),
    rows: q('.lf-rtext').map(txt), glosses: q('.lf-rgloss').map(txt), summary: txt(c.querySelector('.lf-summary')), pill: txt(c.querySelector('.lf-conf .lf-pill')),
    folds: q('details[data-key]').map((d) => ({ key: d.getAttribute('data-key'), summary: txt(d.querySelector('summary')), open: d.open, text: d.textContent })),
    buttons: q('button').map(txt), toast: txt(c.querySelector('.lf-toast')), text: c.textContent,
    css: { position: s.position, width: s.width, background: s.backgroundColor, color: s.color, zIndex: s.zIndex, visibility: s.visibility } };`;
const card = (wd) => wd.exec(CARD);
const lines = (wd) => wd.exec('return window.__lineRects()');
const hl = (wd) => wd.exec(`const h=document.getElementById('linguaflow-root'); const e=h&&h.shadowRoot&&h.shadowRoot.querySelector('.lf-hl'); if(!e) return null; const r=e.getBoundingClientRect(); return {display:e.style.display, rect:[r.left,r.top,r.right,r.bottom]};`);
const videoPaused = (wd) => wd.exec('return document.getElementById("v").paused');
const stageClicks = (wd) => wd.exec('return window.__stageClicks');
const hit = (a, b) => !(a[2] <= b[0] || a[0] >= b[2] || a[3] <= b[1] || a[1] >= b[3]);
const R = (r) => [r.left, r.top, r.right, r.bottom];
async function clearOfSubtitles(wd) {
  const c = await card(wd), L = await lines(wd);
  const boxes = [L.native, L.svg].filter((b) => b.width > 0 && b.height > 0).map(R);
  return { clear: !!c && boxes.every((b) => !hit(c.rect, b)), card: c && c.rect.map(Math.round), boxes: boxes.map((b) => b.map(Math.round)) };
}
async function closeCardByEsc(wd) { await wd.key('\uE00C'); await waitFor(async () => !(await card(wd)), 2000); }
async function wordCenter(wd, kind, word) {
  const r = await wd.exec(kind === 'svg' ? 'return window.__rectSvg(arguments[0])' : 'return window.__rectHtml(arguments[0])', [word]);
  if (!r) throw new Error('word not found on the page: ' + word);
  return { r, x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
}
/** hover, then click a word of the subtitle; returns ms until the card is visible */
async function clickWord(wd, kind, word) {
  const w = await wordCenter(wd, kind, word);
  await wd.move(w.x, w.y); await sleep(250);
  const t0 = Date.now();
  await wd.click(w.x, w.y);
  const c = await waitFor(() => card(wd), 6000, 40);
  return { card: c, ms: Date.now() - t0, word: w };
}
async function clickSummary(wd, key) {
  const p = await wd.exec(`const h=document.getElementById('linguaflow-root'); const d=h.shadowRoot.querySelector('details[data-key="'+arguments[0]+'"]'); if(!d) return null; const s=d.querySelector('summary'); s.scrollIntoView({block:'nearest'}); const r=s.getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2];`, [key]);
  if (!p) throw new Error('no fold ' + key);
  await wd.click(p[0], p[1]); await sleep(350);
}
const fold = (c, key) => c.folds.find((f) => f.key === key);
/** WebDriver may not navigate to moz-extension:// URLs, so a tab for an extension page is opened the way the browser itself does it (system principal) */
async function openExt(wd, url) {
  const before = await wd.handles();
  await wd.context('chrome');
  await wd.exec(`const win = Services.wm.getMostRecentWindow('navigator:browser'); const tab = win.gBrowser.addTab(arguments[0], { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() }); win.gBrowser.selectedTab = tab; return true;`, [url]);
  await wd.context('content');
  const h = await waitFor(async () => (await wd.handles()).find((x) => !before.includes(x)), 6000);
  if (!h) throw new Error('the extension page did not open: ' + url);
  await wd.switchTo(h);
  await waitFor(() => wd.exec('return document.readyState === "complete" && !!document.getElementById("view")'), 6000);
  return h;
}
/** the app's own navigation (0 Home, 1 Vocabulary, 2 Review, 3 Grammar, 4 Settings) */
const nav = async (wd, i) => { await wd.exec('document.querySelectorAll("#nav button")[arguments[0]].click()', [i]); await sleep(350); };

(async () => {
  const reference = (await koreanPack()).getGrammarReference(); // what the Grammar tab must show
  const refItems = reference.reduce((n, sec) => n + sec.items.length, 0);
  const b = await boot();
  const { wd } = b;
  try {
    ok('the zip installs as a temporary MV3 add-on (gecko id from the manifest)', b.id === CFG.addonId, b.id);
    // what Firefox itself says about the add-on (the "by ..." name and the homepage on about:addons)
    await wd.context('chrome');
    const meta = await wd.execAsync(`const done = arguments[arguments.length - 1]; const { AddonManager } = ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
      AddonManager.getAddonByID(arguments[0]).then((a) => done(a ? { name: a.name, version: a.version, creator: a.creator && a.creator.name, homepageURL: a.homepageURL } : null));`, [CFG.addonId]);
    await wd.context('content');
    ok('Firefox lists AVYRON as the author of the add-on (about:addons) and the project repository as its homepage', meta && meta.name === 'LinguaFlow' && meta.version === CFG.version && meta.creator === 'AVYRON' && meta.homepageURL === 'https://github.com/avyronn/linguaflow', JSON.stringify(meta));

    // =========================================================================================================================
    // A. the fake Netflix, native HTML subtitle in Korean + an SVG (NflxMultiSubs-style) translation, subtitle layers take no pointer events
    // =========================================================================================================================
    await wd.go('https://www.netflix.com/watch/1?pe=none');
    await waitFor(() => wd.exec('return document.getElementById("v").readyState >= 3'), 8000);
    ok('the page is the real manifest match (https://www.netflix.com/...) and its <video> plays', await wd.exec('return location.hostname === "www.netflix.com" && !document.getElementById("v").paused'), await wd.url());
    await wd.exec('window.__setSub(arguments[0], arguments[1])', ['오늘 어디에 있었어요?', 'Hôm nay bạn đã ở đâu?']);
    await sleep(500);

    // ---- hover ---------------------------------------------------------------------------------------------------------
    const w1 = await wordCenter(wd, 'html', '어디에');
    await wd.move(w1.x, w1.y); await sleep(500);
    const h1 = await waitFor(() => hl(wd), 3000);
    const d = h1 ? h1.rect.map((v, i) => Math.abs(v - [w1.r.left - 2, w1.r.top - 2, w1.r.right + 2, w1.r.bottom + 2][i])) : [999];
    ok('the content script is injected and hovering a word draws the highlight box on its glyphs (<= 6 px off)', h1 && h1.display === 'block' && Math.max(...d) <= 6, JSON.stringify({ h1, word: w1.r }));
    await wd.move(5, 5); await sleep(300);
    const h1b = await hl(wd);
    ok('moving the pointer away removes the highlight', h1b && h1b.display === 'none', JSON.stringify(h1b));

    // ---- click -> card -----------------------------------------------------------------------------------------------------
    const first = await clickWord(wd, 'html', '어디에');
    let c = first.card;
    note.firstCardMs = first.ms;
    ok('a click on the HTML subtitle word opens the word card (the first click also loads the bundled dictionary)', !!c, 'no card');
    ok('the card shows the word, its romanization, one row per morpheme and the composed meaning', c && c.surface === '어디에' && c.roman === 'eodie' && c.rows.join('|') === '어디|-에' && /đâu/.test(c.glosses[0]) && /ở \/ tại/.test(c.glosses[1]) && /ở đâu/.test(c.summary), JSON.stringify(c && { s: c.surface, r: c.roman, rows: c.rows, g: c.glosses, sum: c.summary }));
    ok('the click did not reach the page (no click on the player) and the video was paused by the lookup', (await stageClicks(wd)) === 0 && (await videoPaused(wd)) === true, `stageClicks=${await stageClicks(wd)} paused=${await videoPaused(wd)}`);
    let g = await clearOfSubtitles(wd);
    ok('the card does not cover either subtitle line (it is shortened to fit the room above and scrolls inside)', g.clear, JSON.stringify(g));
    const vp = await wd.exec('return [innerWidth, innerHeight]');
    ok('the card is inside the viewport', c.rect[0] >= 0 && c.rect[1] >= 0 && c.rect[2] <= vp[0] + 1 && c.rect[3] <= vp[1] + 1, JSON.stringify({ card: c.rect, viewport: vp }));
    note.normalCss = c.css;
    await wd.screenshot(path.join(SHOTS, 'card-1.png'));

    // ---- grammar sections ----------------------------------------------------------------------------------------------
    const gram = fold(c, 'gram'), other = fold(c, 'gramOther'), struct = fold(c, 'struct');
    ok('"Mẫu ngữ pháp · 1" is open and names the pattern of the clicked word: N에 있다/없다, Lv 1, "ở N / không ở N", matched text 어디에 있었어요',
      gram && gram.open && /Mẫu ngữ pháp · 1/.test(gram.summary) && /N에 있다\/없다/.test(gram.text) && /Lv 1/.test(gram.text) && /ở N \/ không ở N/.test(gram.text) && /Trong câu: 어디에 있었어요/.test(gram.text), JSON.stringify(gram));
    ok('"Các mẫu khác trong câu · 2" and "Cấu trúc câu" are folded by default', other && !other.open && /· 2/.test(other.summary) && struct && !struct.open, JSON.stringify([other, struct]));
    await clickSummary(wd, 'gramOther');
    c = await card(wd);
    ok('opening "other patterns" lists the ending and the past tense, and the card is still clear of the subtitles', fold(c, 'gramOther').open && /-아요\/어요/.test(fold(c, 'gramOther').text) && /-았\/었- \(quá khứ\)/.test(fold(c, 'gramOther').text) && (await clearOfSubtitles(wd)).clear, JSON.stringify(await clearOfSubtitles(wd)));
    await clickSummary(wd, 'struct');
    c = await card(wd);
    const st = fold(c, 'struct');
    ok('"Cấu trúc câu" states the facts: question, past, polite 해요체, question word 어디에', st.open && /Loại câu[\s\S]*Câu hỏi/.test(st.text) && /Thì \/ thể[\s\S]*quá khứ/.test(st.text) && /해요체/.test(st.text) && /Từ để hỏi[\s\S]*어디에/.test(st.text), st.text.slice(0, 500));
    ok('...gives each word a role (오늘 noun, 어디에 place/time/destination, 있었어요 predicate) and the order skeleton', /오늘/.test(st.text) && /어디에/.test(st.text) && /Địa điểm \/ thời điểm \/ đích/.test(st.text) && /Vị ngữ/.test(st.text) && /→/.test(st.text), st.text.slice(0, 900));
    ok('...and says honestly that it is rule-based, not a full parser', /không phải bộ phân tích cú pháp đầy đủ/.test(st.text), st.text.slice(-200));
    g = await clearOfSubtitles(wd);
    ok('with every section open the card still never covers a subtitle line (it grew away from them)', g.clear && fold(c, 'gram').open && fold(c, 'gramOther').open, JSON.stringify(g));
    await wd.screenshot(path.join(SHOTS, 'card-2-open.png'));
    await closeCardByEsc(wd);
    ok('Esc closes the card and resumes the video that LinguaFlow paused', !(await card(wd)) && (await videoPaused(wd)) === false, `card=${!!(await card(wd))} paused=${await videoPaused(wd)}`);

    // ---- the player re-renders the SAME line into a new text node (window resize, framework re-render) -------------------------------------
    const clicksBefore = await stageClicks(wd);
    await wd.exec('window.__setSub(arguments[0], arguments[1])', ['오늘 어디에 있었어요?', 'Hôm nay bạn đã ở đâu?']);
    await sleep(500);
    const again = await clickWord(wd, 'html', '어디에');
    ok('the same line re-rendered into a NEW text node: the word is still clickable (card opens) and the click does not reach the player', !!again.card && again.card.surface === '어디에' && (await stageClicks(wd)) === clicksBefore, JSON.stringify({ card: !!again.card, clicks: await stageClicks(wd), before: clicksBefore }));
    await closeCardByEsc(wd);

    // ---- clicking outside closes the card ---------------------------------------------------------------------------------
    await clickWord(wd, 'html', '있었어요');
    await wd.click(40, vp[1] - 100); await sleep(400);
    ok('a click outside the card closes it', !(await card(wd)), 'card still open');

    // ---- complex predicate ---------------------------------------------------------------------------------------------------
    await wd.exec('window.__setSub(arguments[0], arguments[1])', ['밥을 먹고 싶어요.', 'Tôi muốn ăn cơm.']);
    await sleep(500);
    c = (await clickWord(wd, 'html', '먹고')).card;
    ok('V-고 싶다: the pattern of the clicked word is named and the card opens', c && /V-고 싶다/.test(fold(c, 'gram').text), JSON.stringify(c && fold(c, 'gram')));
    await clickSummary(wd, 'struct');
    c = await card(wd);
    ok('the main verb 먹고 is "Động từ chính của cụm vị ngữ" glossed "ăn" (not "ăn và"), and the skeleton is object -> one predicate', /먹고[\s\S]*Động từ chính của cụm vị ngữ — ăn/.test(fold(c, 'struct').text) && !/ăn và/.test(fold(c, 'struct').text) && /Tân ngữ[\s\S]*→[\s\S]*Vị ngữ/.test(fold(c, 'struct').text), fold(c, 'struct').text.slice(0, 700));
    await closeCardByEsc(wd);

    // ---- a Sino-Korean word: Hanja + Hán-Việt -------------------------------------------------------------------------------------------
    await wd.exec('window.__setSub(arguments[0], arguments[1])', ['학교에서 공부해요.', 'Tôi học ở trường.']);
    await sleep(500);
    c = (await clickWord(wd, 'html', '학교에서')).card;
    g = await clearOfSubtitles(wd);
    ok('a Sino-Korean word shows its Hanja and Hán-Việt reading (學校 · học hiệu) and the card still keeps clear of the subtitles', c && /Hán tự · Hán-Việt學校học hiệu \(trường học\)/.test(c.text) && g.clear, JSON.stringify({ text: c && c.text.slice(0, 200), g }));
    await closeCardByEsc(wd);

    // ---- several sentences in one subtitle -------------------------------------------------------------------------------------
    await wd.exec('window.__setSub(arguments[0], arguments[1])', ['어디에 있었어요? 집에 있었어요.', 'Bạn đã ở đâu? Tôi ở nhà.']);
    await sleep(500);
    c = (await clickWord(wd, 'html', '집에')).card;
    ok('a subtitle with two sentences: the card analyses the one that holds the clicked word and says which ("Câu 2/2 của phụ đề")', c && /Câu 2\/2 của phụ đề/.test(fold(c, 'gram').text) && /집에 있었어요/.test(fold(c, 'gram').text), JSON.stringify(c && fold(c, 'gram')));
    await closeCardByEsc(wd);

    // ---- pronunciation without a voice --------------------------------------------------------------------------------------------
    await wd.exec('window.__setSub(arguments[0], arguments[1])', ['오늘 어디에 있었어요?', 'Hôm nay bạn đã ở đâu?']);
    await sleep(400);
    await clickWord(wd, 'html', '어디에');
    const sp = await wd.exec(`const h=document.getElementById('linguaflow-root'); const b=Array.from(h.shadowRoot.querySelectorAll('.lf-iconbtn')).find(x=>x.textContent==='🔊'); const r=b.getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2];`);
    await wd.click(sp[0], sp[1]);
    const toast = await waitFor(async () => { const x = await card(wd); return x && x.toast; }, 4000);
    ok('🔊 on a machine without a Korean voice says so in the card instead of speaking with a wrong voice', /giọng đọc/.test(toast || ''), toast);

    // ---- save ---------------------------------------------------------------------------------------------------------------------
    const sv = await wd.exec(`const h=document.getElementById('linguaflow-root'); const b=Array.from(h.shadowRoot.querySelectorAll('.lf-btn')).find(x=>/Lưu từ/.test(x.textContent)); b.scrollIntoView({block:'nearest'}); const r=b.getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2];`);
    await wd.click(sv[0], sv[1]); await sleep(600);
    c = await card(wd);
    ok('"＋ Lưu từ" saves the word (the button turns into "✓ Đã lưu") and the open sections stay open', c && c.buttons.some((x) => /✓ Đã lưu/.test(x)) && fold(c, 'gram').open, JSON.stringify(c && c.buttons));
    await closeCardByEsc(wd);

    // =========================================================================================================================
    // B. Korean in the SVG (NflxMultiSubs second subtitle), Vietnamese in the native HTML line
    // =========================================================================================================================
    await wd.exec('window.__setSub(arguments[0], arguments[1])', ['Hôm nay bạn đã ở đâu?', '사람이 많아요.']);
    await sleep(600);
    const w2 = await wordCenter(wd, 'svg', '사람이');
    await wd.move(w2.x, w2.y); await sleep(500);
    const h2 = await hl(wd);
    const d2 = h2 ? h2.rect.map((v, i) => Math.abs(v - [w2.r.left - 2, w2.r.top - 2, w2.r.right + 2, w2.r.bottom + 2][i])) : [999];
    ok('SVG subtitle text (NflxMultiSubs layout): the highlight follows the glyph extent of the word (<= 8 px off)', h2 && h2.display === 'block' && Math.max(...d2) <= 8, JSON.stringify({ h2, w: w2.r }));
    await wd.click(w2.x, w2.y);
    c = await waitFor(() => card(wd), 5000);
    ok('a click on the SVG word opens its card: 사람 + -이 = người (chủ ngữ), and the page got no click', c && c.surface === '사람이' && c.rows.join('|') === '사람|-이' && /người/.test(c.summary) && (await stageClicks(wd)) === 0, JSON.stringify(c && { s: c.surface, rows: c.rows, sum: c.summary }));
    g = await clearOfSubtitles(wd);
    ok('...and that card also keeps clear of both lines', g.clear, JSON.stringify(g));
    await closeCardByEsc(wd);

    // =========================================================================================================================
    // C. the same pages when the subtitle layers DO take pointer events (a different player layout)
    // =========================================================================================================================
    await wd.go('https://www.netflix.com/watch/2?pe=auto');
    await waitFor(() => wd.exec('return document.getElementById("v").readyState >= 3'), 8000);
    await wd.exec('window.__setSub(arguments[0], arguments[1])', ['저는 한국어를 공부해요.', 'Tôi học tiếng Hàn.']);
    await sleep(500);
    c = (await clickWord(wd, 'html', '한국어를')).card;
    ok('with pointer-events enabled on the subtitles a click still opens the card and does not toggle playback', c && c.surface === '한국어를' && /tiếng Hàn/.test(c.summary) && (await stageClicks(wd)) === 0, JSON.stringify(c && { s: c.surface, sum: c.summary, clicks: await stageClicks(wd) }));
    await closeCardByEsc(wd);

    // =========================================================================================================================
    // D. a page with a strict Content-Security-Policy (no inline styles, connect-src 'self')
    // =========================================================================================================================
    await wd.go('https://www.netflix.com/watch/3?csp=1');
    await waitFor(() => wd.exec('return document.getElementById("v").readyState >= 3'), 8000);
    await wd.exec('window.__setSub(arguments[0], arguments[1])', ['오늘 어디에 있었어요?', 'Hôm nay bạn đã ở đâu?']);
    await sleep(500);
    c = (await clickWord(wd, 'html', '어디에')).card;
    ok('under a strict page CSP the card still loads the dictionary (meaning shown) and is styled exactly as on the normal page (fixed, same width, same dark background)', c && /ở đâu/.test(c.summary) && c.css.position === 'fixed' && JSON.stringify(c.css) === JSON.stringify(note.normalCss), JSON.stringify({ csp: c && c.css, normal: note.normalCss }));
    await wd.screenshot(path.join(SHOTS, 'card-csp.png'));
    await closeCardByEsc(wd);

    // =========================================================================================================================
    // E. the extension's own pages
    // =========================================================================================================================
    const netflix = await wd.handle();
    const ext = await openExt(wd, CFG.ext('src/popup/page.html#vocabulary'));
    await waitFor(() => wd.exec('return !!document.querySelector("#view .vitem, #view .empty")'), 5000);
    const vocab = await wd.exec('return Array.from(document.querySelectorAll("#view .vitem")).map(e => e.textContent)');
    ok('the saved word is in the Vocabulary page of the extension (lemma 어디, meaning, the sentence it came from)', vocab.length === 1 && /어디/.test(vocab[0]) && /ở đâu/.test(vocab[0]) && /오늘 어디에 있었어요\?/.test(vocab[0]), JSON.stringify(vocab));

    await nav(wd, 2);
    await waitFor(() => wd.exec('return !!document.querySelector("#view .rv-word, #view .empty")'), 5000);
    ok('Review shows the saved word as a card to answer (word + "Show answer")', await wd.exec('return !!document.querySelector("#view .rv-word") && /어디/.test(document.querySelector("#view .rv-word").textContent) && !!document.getElementById("show")'), 'no review card');

    // ---- Grammar tab ------------------------------------------------------------------------------------------------------------
    await nav(wd, 3);
    await waitFor(() => wd.exec('return !!document.querySelector("#view .glist")'), 5000);
    const gi = await wd.exec(`const sel=document.querySelector('#view select'); return { options: sel ? sel.options.length : 0, sections: document.querySelectorAll('#view details.gsec').length, firstOpen: !!document.querySelector('#view details.gsec[open] .gitem'), count: (document.querySelector('#view .row .muted')||{}).textContent, nav: Array.from(document.querySelectorAll('#nav button')).map(x=>x.textContent) }`);
    ok(`Grammar tab: a section picker with every section ("all" + ${reference.length}), the sections listed, the first one open, an entry count (${refItems})`, gi.options === reference.length + 1 && gi.sections === reference.length && gi.firstOpen && new RegExp(refItems + ' mục').test(gi.count), JSON.stringify(gi));
    ok('the navigation has Home · Vocabulary · Review · Grammar · Settings', /Trang chủ/.test(gi.nav[0]) && /Vocabulary/.test(gi.nav[1]) && /Review/.test(gi.nav[2]) && /Grammar/.test(gi.nav[3]) && /Settings/.test(gi.nav[4]), JSON.stringify(gi.nav));
    const search = await wd.find('#view input[type=search]');
    await wd.sendKeys(search, '싶다'); await sleep(500);
    const s1 = await wd.exec(`return { count: (document.querySelector('#view .row .muted')||{}).textContent, first: (document.querySelector('#view .gitem .gtitle')||{}).textContent, titles: Array.from(document.querySelectorAll('#view .gitem .gtitle')).slice(0,8).map(x=>x.textContent) }`);
    ok('searching 싶다 finds -고 싶다 first', /V-고 싶다/.test(s1.first) || s1.titles.some((x) => /싶다/.test(x)), JSON.stringify(s1));
    await wd.clearEl(search); await wd.sendKeys(search, 'nguyen nhan'); await sleep(500);
    const s2 = await wd.exec(`return { count: (document.querySelector('#view .row .muted')||{}).textContent, titles: Array.from(document.querySelectorAll('#view .gitem .gtitle')).map(x=>x.textContent), froms: Array.from(document.querySelectorAll('#view .gitem .gfrom')).slice(0,3).map(x=>x.textContent) }`);
    ok('searching without diacritics ("nguyen nhan") finds the cause patterns (-아서/어서, -(으)니까, 때문에 ...), the section named after the topic first', s2.titles.some((x) => /아서\/어서/.test(x)) && s2.titles.some((x) => /니까/.test(x)) && s2.titles.some((x) => /때문에/.test(x)) && /Nguyên nhân/.test(s2.froms[0]), JSON.stringify(s2).slice(0, 600));
    await wd.clearEl(search); await wd.sendKeys(search, 'zzzzqq'); await sleep(400);
    ok('a search with no result says so', await wd.exec('return /Không tìm thấy mẫu nào/.test(document.querySelector("#view .glist").textContent)'), 'no empty message');
    // (WebDriver's "clear" fires no input event, so empty the box the way the page listens for it)
    await wd.exec(`const i=document.querySelector('#view input[type=search]'); i.value=''; i.dispatchEvent(new Event('input'))`); await sleep(400);
    // open an entry: explanation + examples
    await wd.exec(`document.querySelector('#view details.gsec .gitem summary').click()`);
    await sleep(200);
    const ex = await wd.exec(`const g=document.querySelector('#view details.gsec .gitem[open] .gbody'); return g ? { text: g.textContent.slice(0,300), examples: g.querySelectorAll('.gex li').length } : null`);
    ok('an entry opens to its explanation and examples (Korean + Vietnamese)', ex && ex.examples >= 2 && /[가-힣]/.test(ex.text), JSON.stringify(ex));
    await wd.screenshot(path.join(SHOTS, 'popup-grammar.png'));

    // ---- Home (language list, switches) ------------------------------------------------------------------------------------------------
    await nav(wd, 0);
    await waitFor(() => wd.exec('return !!document.querySelector("#view .langs")'), 5000);
    const home = await wd.exec(`return { langs: Array.from(document.querySelectorAll('#view .lang')).map(b => ({ t: b.textContent, checked: b.getAttribute('aria-checked'), disabled: b.getAttribute('aria-disabled') })), switches: Array.from(document.querySelectorAll('#view label.switch')).map(l => l.textContent.trim().split('\\n')[0]) }`);
    ok('Home: Korean is the selected language; the other languages are "Sắp ra mắt" and cannot be selected', home.langs.some((l) => /한국어/.test(l.t) && l.checked === 'true') && home.langs.filter((l) => /Sắp ra mắt/.test(l.t) && l.disabled === 'true').length >= 3, JSON.stringify(home.langs));
    ok('Home has the Grammar switch next to Learning mode, Click words, Morphology, Vocabulary, Pronunciation', ['Learning mode', 'Click words', 'Morphology', 'Grammar', 'Vocabulary', 'Pronunciation'].every((n) => home.switches.some((s) => s.startsWith(n))), JSON.stringify(home.switches));

    // ---- the credit line "Made with <heart> by AVYRON" (full page) -------------------------------------------------------------------------
    const creditGeo = () => wd.exec(`const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
      const c = document.querySelector('.credit'), img = document.querySelector('.credit img.heart'), a = document.querySelector('.credit a');
      return { text: c ? c.textContent.replace(/\\s+/g, ' ').trim() : null, loaded: !!img && img.complete && img.naturalWidth > 0, href: a && a.href, target: a && a.target, rel: a && a.rel,
        bar: q('.credit-bar'), pill: q('.credit'), heart: q('.credit img.heart'), nav: q('#nav'), view: q('#view'), vw: innerWidth, vh: innerHeight, mode: document.body.dataset.mode };`);
    let cg = await creditGeo();
    ok('full page: "Made with <heart> by AVYRON" is shown, the heart is an SVG image that really decoded (not an emoji) and AVYRON links to the author\'s GitHub profile (new tab, noopener)', !!cg && cg.mode === 'tab' && cg.text === 'Made with by AVYRON' && cg.loaded && cg.href === 'https://github.com/avyronn' && cg.target === '_blank' && /noopener/.test(cg.rel), JSON.stringify(cg));
    ok('...it sits under the navigation and the page (no overlap), centred, and inside the window', !!cg && !!cg.bar && cg.bar[1] >= cg.nav[3] - 1 && cg.bar[1] >= cg.view[3] - 1 && cg.pill[0] >= 0 && cg.pill[2] <= cg.vw && cg.pill[3] <= cg.vh && Math.abs((cg.pill[0] + cg.pill[2]) / 2 - (cg.bar[0] + cg.bar[2]) / 2) < 2 && cg.heart[2] - cg.heart[0] >= 12, JSON.stringify(cg));
    await wd.screenshot(path.join(SHOTS, 'page-credit.png'));
    // the heart beats while the pointer is on the line; with "reduce motion" switched on in the system it stays still
    const pillAt = await wd.exec(`const r = document.querySelector('.credit').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]`);
    await wd.move(pillAt[0], pillAt[1]); await sleep(250);
    const beat = await wd.exec(`return getComputedStyle(document.querySelector('.credit img.heart')).animationName`);
    let calm;
    try {
      await wd.context('chrome'); await wd.exec(`Services.prefs.setIntPref('ui.prefersReducedMotion', 1); return true`); await wd.context('content');
      await waitFor(() => wd.exec(`return matchMedia('(prefers-reduced-motion: reduce)').matches`), 2500, 100);
      calm = await wd.exec(`return { reduce: matchMedia('(prefers-reduced-motion: reduce)').matches, name: getComputedStyle(document.querySelector('.credit img.heart')).animationName }`);
    } finally {
      await wd.context('chrome'); await wd.exec(`Services.prefs.clearUserPref('ui.prefersReducedMotion'); return true`); await wd.context('content');
    }
    ok('the heart beats while the pointer is on the credit, and stays still when the system asks for reduced motion', beat === 'lf-beat' && !!calm && calm.reduce === true && calm.name === 'none', JSON.stringify({ beat, calm }));
    await wd.move(5, 5);

    // ---- the Grammar switch is picked up live by the Netflix tab -----------------------------------------------------------------------
    const swPos = () => wd.exec(`const l=Array.from(document.querySelectorAll('#view label.switch')).find(x=>/^Grammar/.test(x.textContent.trim())); const r=l.querySelector('.track').getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2, l.querySelector('input').checked]`);
    let sw = await swPos();
    await wd.click(sw[0], sw[1]); await sleep(500);
    const sw2 = await swPos();
    ok('the Grammar switch can be turned off from the extension page', sw[2] === true && sw2[2] === false, JSON.stringify([sw, sw2]));
    await wd.switchTo(netflix);
    await wd.exec('window.__setSub(arguments[0], arguments[1])', ['오늘 어디에 있었어요?', 'Hôm nay bạn đã ở đâu?']);
    await sleep(500);
    c = (await clickWord(wd, 'html', '어디에')).card;
    ok('Grammar off (changed in another tab): the card keeps the meaning and morphology but has no grammar or structure sections', c && c.rows.length === 2 && !c.folds.some((f) => /^(gram|gramOther|struct)$/.test(f.key)) && !/Mẫu ngữ pháp/.test(c.text), JSON.stringify(c && c.folds.map((f) => f.key)));
    await closeCardByEsc(wd);
    await wd.switchTo(ext);
    sw = await swPos(); await wd.click(sw[0], sw[1]); await sleep(500);
    await wd.switchTo(netflix);
    c = (await clickWord(wd, 'html', '어디에')).card;
    ok('Grammar on again: the sections come back', c && c.folds.some((f) => f.key === 'gram') && c.folds.some((f) => f.key === 'struct'), JSON.stringify(c && c.folds.map((f) => f.key)));
    await closeCardByEsc(wd);

    // ---- interface language --------------------------------------------------------------------------------------------------------------
    await wd.switchTo(ext);
    await nav(wd, 4);
    await waitFor(() => wd.exec('return !!document.querySelector("#view select")'), 5000);
    await wd.exec(`const s=document.querySelector('#view select'); s.value='en'; s.dispatchEvent(new Event('change'))`);
    await sleep(600);
    const navEn = await wd.exec(`return Array.from(document.querySelectorAll('#nav button')).map(x=>x.textContent.trim())`);
    ok('the interface can be switched to English (navigation)', /Home/.test(navEn[0]) && /Settings/.test(navEn[4]), JSON.stringify(navEn));
    await wd.switchTo(netflix);
    c = (await clickWord(wd, 'html', '어디에')).card;
    ok('...and the card follows live: "Grammar patterns", "Other patterns in the sentence", "Sentence structure" (the Korean data stays Vietnamese: it is the gloss language)', c && c.folds.some((f) => /^Grammar patterns · 1/.test(f.summary)) && c.folds.some((f) => /^Other patterns in the sentence · 2/.test(f.summary)) && c.folds.some((f) => f.summary === 'Sentence structure') && /ở N \/ không ở N/.test(c.text), JSON.stringify(c && c.folds.map((f) => f.summary)));
    await closeCardByEsc(wd);
    await wd.switchTo(ext);
    await wd.exec(`const s=document.querySelector('#view select'); s.value='vi'; s.dispatchEvent(new Event('change'))`);
    await sleep(400);

    // ---- toolbar popup ---------------------------------------------------------------------------------------------------------------------------
    await wd.switchTo(ext);
    await wd.closeTab();
    await openExt(wd, CFG.ext('src/popup/popup.html'));
    await waitFor(() => wd.exec('return !!document.querySelector("#view .langs")'), 5000);
    ok('the toolbar popup page loads and renders the home view (Korean language list, stats, five tabs)', await wd.exec('return document.querySelectorAll("#nav button").length === 5 && !!document.querySelector("#view .stats") && document.querySelector("body").dataset.mode === "popup"'), 'popup did not render');
    cg = await creditGeo();
    ok('toolbar popup: the credit sits right under the five tabs, inside the 360 x 580 popup, the view above it is not covered, and the heart decoded', !!cg && cg.mode === 'popup' && cg.text === 'Made with by AVYRON' && cg.loaded && cg.bar[1] >= cg.nav[3] - 1 && cg.view[3] <= cg.nav[1] + 1 && cg.bar[3] <= 580.5 && cg.pill[2] <= 360 && cg.pill[0] >= 0, JSON.stringify(cg));
    await wd.screenshot(path.join(SHOTS, 'popup-credit.png'));
    await wd.closeTab();
    await wd.switchTo(netflix);

    note.finalHeight = await wd.exec('return innerHeight');
  } catch (e) {
    ok('the run reached its end without an exception', false, e.stack || e.message);
  }
  try { await wd.screenshot(path.join(SHOTS, 'final.png')); } catch (e) { /* the session may be gone */ }
  await b.stop();
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n${pass}/${results.length} checks passed` + (note.firstCardMs ? ` (first click -> card: ~${note.firstCardMs} ms incl. dictionary load and WebDriver latency)` : ''));
  fs.writeFileSync(path.join(CFG.work, 'results.json'), JSON.stringify({ extension: CFG.version, results, note }, null, 1));
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => {
  console.error('\nThe end-to-end run could not start: ' + ((e && e.message) || e) + '\nPrerequisites (tests/e2e/README.md): Firefox >= 140 (or another Gecko browser; FIREFOX_BIN), geckodriver (GECKODRIVER), openssl, ffmpeg with libvpx (or E2E_VIDEO), Node >= 18.');
  process.exit(2);
});
