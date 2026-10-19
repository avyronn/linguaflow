'use strict';
/* A fake "Netflix" for the end-to-end run: https://www.netflix.com/watch/<n> served from this machine (Firefox is told to resolve
 * www.netflix.com to 127.0.0.1 and to map port 443 to ours, so the REAL manifest match pattern fires).
 * It is NOT Netflix: it is a page with the same subtitle markup (as documented by NflxMultiSubs 2.2.1 and Netflix's timed-text renderer) and a real <video>.
 * A throw-away certificate (openssl) and a small test video (ffmpeg, or E2E_VIDEO=<file.webm>) are generated into the work directory on first use.
 * Layout mirrors the real markup (see tests/helpers/dom.js): native HTML timed text + an NflxMultiSubs-style SVG <text>, a real <video>.
 * /watch/<n>      normal page          /watch/<n>?csp=1   same page under a strict Content-Security-Policy
 * Query: ?pe=none|auto  (pointer-events of the subtitle layers; the real ones do not take clicks) */
const https = require('https'), fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const STRICT = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'";

const PAGE = (pe) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fake Netflix</title><link rel="stylesheet" href="/page.css"></head>
<body class="pe-${pe}"><div id="appMountPoint"><div class="watch-video"><div data-uia="video-canvas" class="stage" id="stage">
<video id="v" src="/video.webm" loop muted autoplay playsinline></video>
<div class="player-timedtext"><div class="player-timedtext-text-container" id="native"><span><span id="nativeLine"></span></span></div></div>
<div class="nflxmultisubs-subtitle-wrapper"><div class="nflxmultisubs-subtitle-container"><svg class="nflxmultisubs-subtitle-svg" id="svg" width="960" height="540"><text id="svgText" x="480" y="470" text-anchor="middle"></text></svg></div></div>
</div></div></div><script src="/page.js"></script></body></html>`;

const CSS = `html,body{margin:0;background:#000;color:#fff;font-family:sans-serif}
.stage{position:relative;width:960px;height:540px;margin:0 auto;background:#111;overflow:hidden}
.stage video{position:absolute;inset:0;width:100%;height:100%}
.player-timedtext{position:absolute;left:0;right:0;bottom:0;top:0}
.player-timedtext-text-container{position:absolute;left:20%;bottom:15%;font-size:30px;line-height:1.25;text-shadow:0 0 4px #000;white-space:nowrap}
.nflxmultisubs-subtitle-wrapper{position:absolute;inset:0}
.nflxmultisubs-subtitle-svg{position:absolute;left:0;top:0}
.nflxmultisubs-subtitle-svg text{fill:#ffd24d;font-size:24px;paint-order:stroke;stroke:#000;stroke-width:3px}
body.pe-none .player-timedtext,body.pe-none .nflxmultisubs-subtitle-wrapper{pointer-events:none}`;

const JS = `(function(){
  var v=document.getElementById('v'), nativeLine=document.getElementById('nativeLine'), svgText=document.getElementById('svgText');
  window.__stageClicks=0;
  // like Netflix: a click on the player toggles play / pause - a click on a subtitle word must not reach this
  document.getElementById('stage').addEventListener('click',function(){window.__stageClicks++; if(v.paused)v.play(); else v.pause();});
  window.__setSub=function(native,svg){ nativeLine.textContent=native||''; svgText.textContent=svg||''; };
  var R=function(r){return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  window.__rectHtml=function(word){ var t=nativeLine.firstChild; if(!t)return null; var i=t.data.indexOf(word); if(i<0)return null;
    var g=document.createRange(); g.setStart(t,i); g.setEnd(t,i+word.length); return R(g.getBoundingClientRect()); };
  window.__rectSvg=function(word){ var s=svgText.textContent, i=s.indexOf(word); if(i<0)return null; var a=svgText.getExtentOfChar(i), b=svgText.getExtentOfChar(i+word.length-1);
    var o=document.getElementById('svg').getBoundingClientRect(); var l=o.left+Math.min(a.x,b.x), r=o.left+Math.max(a.x+a.width,b.x+b.width); var tp=o.top+a.y;
    return {left:l,top:tp,right:r,bottom:tp+a.height,width:r-l,height:a.height}; };
  window.__lineRects=function(){ var n=nativeLine.getBoundingClientRect(), s=svgText.getBoundingClientRect(); return {native:R(n), svg:R(s), nativeText:nativeLine.textContent, svgText:svgText.textContent}; };
  window.__setSub('','');
})();`;

/** Creates (once) a self-signed certificate for www.netflix.com and a short test video in `dir`. */
function ensureFixtures(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const key = path.join(dir, 'key.pem'), cert = path.join(dir, 'cert.pem'), video = path.join(dir, 'video.webm');
  if (!fs.existsSync(key) || !fs.existsSync(cert)) {
    const r = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '30', '-subj', '/CN=www.netflix.com', '-addext', 'subjectAltName=DNS:www.netflix.com'], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('openssl is needed to create a throw-away certificate for the fake www.netflix.com:\n' + (r.stderr || r.error));
  }
  if (!fs.existsSync(video)) {
    if (process.env.E2E_VIDEO) fs.copyFileSync(process.env.E2E_VIDEO, video);
    else {
      let made = false, last = '';
      for (const codec of ['libvpx', 'libvpx-vp9']) {
        const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=15', '-t', '30', '-c:v', codec, '-b:v', '150k', '-an', video], { encoding: 'utf8' });
        if (r.status === 0) { made = true; break; }
        last = r.stderr || String(r.error);
      }
      if (!made) throw new Error('ffmpeg (with libvpx) is needed to create the test <video>; or set E2E_VIDEO=/path/to/some.webm\n' + last);
    }
  }
  return { key, cert, video };
}

function start(port, workDir) {
  const fx = ensureFixtures(workDir);
  const opts = { key: fs.readFileSync(fx.key), cert: fs.readFileSync(fx.cert) };
  const srv = https.createServer(opts, (req, res) => {
    const u = new URL(req.url, 'https://www.netflix.com');
    const send = (type, body, extra) => { res.writeHead(200, Object.assign({ 'content-type': type, 'cache-control': 'no-store' }, extra || {})); res.end(body); };
    if (u.pathname === '/page.css') return send('text/css', CSS);
    if (u.pathname === '/page.js') return send('text/javascript', JS);
    if (u.pathname === '/video.webm') {
      const f = fx.video, st = fs.statSync(f), range = req.headers.range;
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range), s = m[1] ? parseInt(m[1], 10) : 0, e = m[2] ? parseInt(m[2], 10) : st.size - 1;
        res.writeHead(206, { 'content-type': 'video/webm', 'accept-ranges': 'bytes', 'content-range': `bytes ${s}-${e}/${st.size}`, 'content-length': e - s + 1 });
        return fs.createReadStream(f, { start: s, end: e }).pipe(res);
      }
      res.writeHead(200, { 'content-type': 'video/webm', 'accept-ranges': 'bytes', 'content-length': st.size });
      return fs.createReadStream(f).pipe(res);
    }
    const pe = u.searchParams.get('pe') === 'auto' ? 'auto' : 'none';
    // LinguaFlow only acts on /watch/... (like the real site), so the strict-CSP variant is /watch/<n>?csp=1  (or ?csp=<any policy> for experiments)
    if (/^\/watch\//.test(u.pathname)) {
      const c = u.searchParams.get('csp');
      return send('text/html; charset=utf-8', PAGE(pe), c ? { 'content-security-policy': c === '1' ? STRICT : c } : undefined);
    }
    res.writeHead(404); res.end('not found');
  });
  return new Promise((resolve, reject) => { srv.once('error', reject); srv.listen(port, '127.0.0.1', () => resolve(srv)); });
}
module.exports = { start, ensureFixtures };
