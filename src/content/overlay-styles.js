/* Styles for the learning overlay. Injected into a Shadow DOM, so Netflix's CSS cannot leak in and ours cannot leak out.
 * Palette (ink on a dark video player): ink #12151B · porcelain #EDF0F4 · celadon #7FD6C2 (particles, accents)
 * · saffron #F0B44C (endings) · vermilion #F0745F (warnings). Korean text falls back to Noto Sans KR / Malgun Gothic. */
(function (root) {
  'use strict';
  const LF = root.LinguaFlow || (root.LinguaFlow = {});

  LF.OVERLAY_CSS = `
:host { all: initial; }
*, *::before, *::after { box-sizing: border-box; }
.lf-layer {
  position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;
  font-family: system-ui, -apple-system, "Segoe UI", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans", sans-serif;
  --ink: #12151B; --ink2: #1B2029; --line: #2C3442; --text: #EDF0F4; --muted: #98A2B3;
  --celadon: #7FD6C2; --saffron: #F0B44C; --vermilion: #F0745F;
}
.lf-hl {
  position: fixed; left: 0; top: 0; display: none; pointer-events: none; border-radius: 5px;
  background: rgba(127, 214, 194, .26); box-shadow: 0 0 0 1px rgba(127, 214, 194, .95), 0 2px 10px rgba(0, 0, 0, .45);
}
.lf-card {
  position: fixed; left: 0; top: 0; width: 340px; max-width: calc(100vw - 16px); max-height: min(72vh, 540px); overflow: auto;
  visibility: hidden; pointer-events: auto; color: var(--text); background: rgba(18, 21, 27, .97);
  border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 14px 44px rgba(0, 0, 0, .6);
  font-size: 14px; line-height: 1.42; padding: 12px 14px 12px; letter-spacing: .01em;
  scrollbar-width: thin; scrollbar-color: var(--line) transparent;
}
.lf-head { display: flex; align-items: flex-start; gap: 8px; }
.lf-title { flex: 1; min-width: 0; }
.lf-surface { font-size: 24px; font-weight: 650; line-height: 1.2; word-break: keep-all; overflow-wrap: anywhere; }
.lf-roman { margin-top: 2px; font-size: 12px; color: var(--muted); }
.lf-iconbtn {
  all: unset; box-sizing: border-box; width: 30px; height: 30px; display: grid; place-items: center; cursor: pointer;
  border-radius: 8px; color: var(--text); font-size: 15px; line-height: 1;
}
.lf-iconbtn:hover, .lf-iconbtn:focus-visible { background: var(--ink2); outline: 1px solid var(--line); }
.lf-sep { height: 1px; background: var(--line); margin: 10px 0; border: 0; }
.lf-rows { display: grid; grid-template-columns: max-content 1fr; column-gap: 12px; row-gap: 4px; align-items: baseline; }
.lf-rtext { font-size: 16px; font-weight: 600; word-break: keep-all; }
.lf-rgloss { color: #D5DBE4; }
.lf-rgloss small { display: block; color: var(--muted); font-size: 11.5px; margin-top: 1px; }
.k-stem .lf-rtext, .k-lemma .lf-rtext { color: var(--text); }
.k-particle .lf-rtext, .k-copula .lf-rtext { color: var(--celadon); }
.k-ending .lf-rtext { color: var(--saffron); }
.k-note .lf-rtext { color: var(--muted); font-weight: 500; }
.lf-eq { color: var(--muted); font-weight: 400; margin: 0 4px 0 0; }
.lf-summary { margin-top: 8px; font-weight: 650; color: var(--celadon); }
.lf-conf { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 8px; font-size: 12px; }
.lf-pill { padding: 2px 8px; border-radius: 999px; border: 1px solid currentColor; font-weight: 600; }
.lf-pill.low { color: var(--vermilion); } .lf-pill.medium { color: var(--saffron); }
.lf-link { all: unset; cursor: pointer; color: var(--celadon); text-decoration: underline; text-underline-offset: 2px; font-size: 12px; }
.lf-link:hover, .lf-link:focus-visible { color: #fff; }
.lf-base { margin-top: 8px; padding: 8px 10px; background: var(--ink2); border: 1px solid var(--line); border-radius: 8px; font-size: 12.5px; color: #D5DBE4; }
.lf-base b { color: var(--text); }
.lf-base ul { margin: 4px 0 0; padding-left: 16px; }
.lf-meanings { margin: 0; padding-left: 18px; }
.lf-meanings li { margin: 1px 0; }
.lf-meta { color: var(--muted); font-size: 12px; margin-bottom: 4px; }
.lf-forms { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 12px; color: var(--muted); }
.lf-forms b { color: #D5DBE4; font-weight: 600; }
details.lf-sent { margin-top: 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--ink2); }
details.lf-sent > summary { cursor: pointer; padding: 6px 10px; font-size: 12.5px; color: #D5DBE4; list-style: none; }
details.lf-sent > summary::-webkit-details-marker { display: none; }
details.lf-sent > summary::before { content: "▸ "; color: var(--muted); }
details.lf-sent[open] > summary::before { content: "▾ "; }
.lf-sentbody { padding: 2px 10px 8px; font-size: 13.5px; }
.lf-sentbody mark { background: rgba(127, 214, 194, .25); color: var(--text); border-radius: 3px; padding: 0 2px; }
.lf-trans { margin-top: 4px; color: #C3CBD6; font-style: italic; }
.lf-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.lf-btn {
  all: unset; box-sizing: border-box; cursor: pointer; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--line);
  background: var(--ink2); color: var(--text); font-size: 13px; font-weight: 600;
}
.lf-btn:hover, .lf-btn:focus-visible { border-color: var(--celadon); }
.lf-btn.on { background: var(--celadon); color: #0C1A16; border-color: var(--celadon); }
.lf-toast { margin-top: 10px; padding: 7px 10px; border-radius: 8px; font-size: 12.5px; background: rgba(240, 116, 95, .14); border: 1px solid rgba(240, 116, 95, .6); color: #FFD9D2; }
.lf-ext { margin-top: 8px; font-size: 12px; color: var(--muted); display: flex; gap: 10px; flex-wrap: wrap; }
.lf-debug {
  position: fixed; right: 12px; top: 12px; width: min(520px, calc(100vw - 24px)); max-height: 70vh; overflow: auto; pointer-events: auto;
  background: rgba(10, 12, 16, .96); color: #CFE; border: 1px solid var(--line); border-radius: 10px; padding: 10px; font: 11.5px/1.45 ui-monospace, Menlo, Consolas, monospace;
}
.lf-debug pre { margin: 6px 0 0; white-space: pre-wrap; word-break: break-word; }
.lf-debug .lf-btn { padding: 3px 9px; font-size: 12px; margin-right: 6px; }
@media (prefers-reduced-motion: no-preference) { .lf-card { transition: opacity .08s ease; } }
`;
  if (typeof module !== 'undefined' && module.exports) module.exports = LF.OVERLAY_CSS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
