/* jsdom helpers + fake Netflix / NflxMultiSubs DOM that mirrors the real markup
 * (structure taken from the NflxMultiSubs 2.2.1 source and Netflix's timed-text renderer). */
'use strict';
const { JSDOM } = require('jsdom');
const SVG_NS = 'http://www.w3.org/2000/svg';

function makeDom(html) {
  const dom = new JSDOM(html || '<!doctype html><html><body><div id="appMountPoint"></div></body></html>', { url: 'https://www.netflix.com/watch/81234567', pretendToBeVisual: true });
  return dom;
}

/** Netflix native timed text: lines separated by <br>. */
function netflixNative(doc, lines) {
  let wrap = doc.querySelector('.player-timedtext');
  if (!wrap) {
    wrap = doc.createElement('div');
    wrap.className = 'player-timedtext';
    (doc.querySelector('[data-uia="video-canvas"]') || doc.body).appendChild(wrap);
  }
  wrap.textContent = '';
  const box = doc.createElement('div');
  box.className = 'player-timedtext-text-container';
  box.setAttribute('style', 'left: 20%; bottom: 10%;');
  const outer = doc.createElement('span');
  lines.forEach((l, i) => {
    const s = doc.createElement('span'); s.textContent = l; outer.appendChild(s);
    if (i < lines.length - 1) outer.appendChild(doc.createElement('br'));
  });
  box.appendChild(outer);
  wrap.appendChild(box);
  return box;
}
function clearNative(doc) { const w = doc.querySelector('.player-timedtext'); if (w) w.remove(); }

/** NflxMultiSubs: secondary subtitle = one SVG <text>, lines joined with \n, inside the wrapper/container/svg chain. */
function multiSubs(doc, lines) {
  const canvas = doc.querySelector('[data-uia="video-canvas"]') || doc.body;
  let wrapper = doc.querySelector('.nflxmultisubs-subtitle-wrapper');
  if (!wrapper) {
    wrapper = doc.createElement('div'); wrapper.className = 'nflxmultisubs-subtitle-wrapper';
    const container = doc.createElement('div'); container.className = 'nflxmultisubs-subtitle-container';
    const svg = doc.createElementNS(SVG_NS, 'svg'); svg.setAttribute('class', 'nflxmultisubs-subtitle-svg');
    container.appendChild(svg); wrapper.appendChild(container); canvas.appendChild(wrapper);
  }
  const svg = wrapper.querySelector('svg.nflxmultisubs-subtitle-svg');
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const text = doc.createElementNS(SVG_NS, 'text');
  text.setAttribute('text-anchor', 'middle');
  text.textContent = lines.join('\n');
  svg.appendChild(text);
  return text;
}
function clearMultiSubs(doc) { const svg = doc.querySelector('svg.nflxmultisubs-subtitle-svg'); if (svg) while (svg.firstChild) svg.removeChild(svg.firstChild); }

function addVideoCanvas(doc) {
  const c = doc.createElement('div'); c.setAttribute('data-uia', 'video-canvas');
  const v = doc.createElement('video'); c.appendChild(v); doc.body.appendChild(c); return c;
}
const tick = (ms) => new Promise((r) => setTimeout(r, ms || 60));

module.exports = { makeDom, netflixNative, clearNative, multiSubs, clearMultiSubs, addVideoCanvas, tick, SVG_NS };
