/* The ONLY place that knows Netflix / NflxMultiSubs DOM details. If Netflix changes its markup, edit the
 * selectors here — or paste extra CSS selectors in LinguaFlow → Settings → "Custom subtitle selectors"
 * (no code change needed). See README → "If Netflix changes its DOM".
 *
 * Verified sources (not guesses):
 *  - NflxMultiSubs 2.2.1 (github.com/dannvix/NflxMultiSubs, 2021) renders the SECONDARY subtitle as an SVG
 *    <text> inside  div[data-uia="video-canvas"] > .nflxmultisubs-subtitle-wrapper > .nflxmultisubs-subtitle-container
 *    > svg.nflxmultisubs-subtitle-svg  (one <text>, lines joined with "\n"), and keeps the PRIMARY (native Netflix)
 *    subtitle in .player-timedtext, wrapped in .nflxmultisubs-primary-wrapper.
 *  - Netflix native renderer: .player-timedtext > .player-timedtext-text-container > span (lines separated by <br>).
 * Image-based subtitles (some Asian languages) are bitmaps: there is no text to read, so they cannot be made clickable.
 */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});

  const SubtitleSelectors = {
    netflix: {
      container: '.player-timedtext',
      textBox: ['.player-timedtext-text-container'],
      imageBased: '.image-based-subtitles',
      playerRoot: ['[data-uia="video-canvas"]', '.watch-video--player-view', '.NFPlayer', '.watch-video', '#appMountPoint'],
      video: 'video',
    },
    nflxmultisubs: {
      wrapper: '.nflxmultisubs-subtitle-wrapper',
      container: '.nflxmultisubs-subtitle-container',
      svg: 'svg.nflxmultisubs-subtitle-svg',
      text: 'text',
      primaryWrapper: '.nflxmultisubs-primary-wrapper',
    },
    /** One CSS selector per line; blank lines and #comments are ignored. */
    parseCustom(str) {
      return String(str || '').split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
    },
    /** Drops selectors the browser rejects (so a typo in Settings can never break detection). */
    validate(doc, list) {
      return list.filter((s) => { try { doc.querySelector(s); return true; } catch (e) { return false; } });
    },
  };

  LF.SubtitleSelectors = SubtitleSelectors;
  if (typeof module !== 'undefined' && module.exports) module.exports = SubtitleSelectors;
})(typeof globalThis !== 'undefined' ? globalThis : this);
