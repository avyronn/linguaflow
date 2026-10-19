# End-to-end test (real Gecko engine)

The unit tests (`npm test`) run in Node + jsdom, which has **no layout engine**: it cannot tell whether a highlight box lands on the glyphs of a word, whether the word card covers the subtitle, or whether the packaged extension even loads. This suite fills that gap. It installs the **packaged zip** into a real, headless Gecko browser through geckodriver and drives it with real pointer and keyboard events.

```bash
npm run e2e            # ~30 s; builds the zip from the working tree, then runs ~50 checks
```

Prerequisites

| Needed | Notes |
|---|---|
| Firefox ≥ 140 (or another Gecko browser) | `FIREFOX_BIN=/path/to/firefox` if it is not what geckodriver finds by itself |
| [geckodriver](https://github.com/mozilla/geckodriver/releases) | on `PATH`, or `GECKODRIVER=/path/to/geckodriver` |
| `openssl` | creates a throw-away certificate for the fake `www.netflix.com` (into `dist/e2e/`) |
| `ffmpeg` with libvpx | creates a 30 s test video once; or `E2E_VIDEO=/path/to/any.webm` |
| Node ≥ 18 | global `fetch` is used for the WebDriver client; no extra npm packages |

Other variables: `EXT_ZIP=<zip>` tests that zip instead of building one; `E2E_PORT` (8443) and `E2E_WD_PORT` (4444); `E2E_HEADFUL=1` shows the window (use `xvfb-run -a npm run e2e` on a machine without a display). Everything it writes (certificate, video, the zip under test, screenshots, `results.json`, `geckodriver.log`) goes to `dist/e2e/`, which is git-ignored. The exit code is 0 only when every check passed.

## How it works

* `lib/fake-netflix.js` serves `https://www.netflix.com/watch/<n>` from this machine. Firefox is started with `network.dns.localDomains=www.netflix.com` and `network.socket.forcePort=443=<port>`, so the **real** `matches` pattern of the manifest fires. The page has the subtitle markup that NflxMultiSubs 2.2.1 and Netflix's timed-text renderer are documented to produce (a native HTML line plus an SVG `<text>`), a real playing `<video>` that toggles on click like the player does, and variants: `?pe=auto` (subtitle layers take pointer events), `?csp=1` (strict Content-Security-Policy).
* `run.js` clicks and types through WebDriver and reads back what a user would see (the overlay's shadow DOM is `open`, so the page-side helpers can measure it).
* Extension pages (`moz-extension://…`) cannot be opened by WebDriver navigation, so a tab is opened from the browser chrome context (`-remote-allow-system-access`) and driven from there.

## What it checks

* the zip installs (id from the manifest), the content script is injected on the real URL pattern;
* hover highlight on the glyphs of an HTML word and of an SVG word (≤ 6–8 px), removed when the pointer leaves;
* click → word card with the morphemes, the romanization, the composed meaning; the click does not reach the player; the video is paused by the lookup and resumed by `Esc`; a click outside closes the card;
* the grammar sections of the card (pattern of the clicked word, other patterns, sentence structure) incl. complex predicates (`V-고 싶다`), two sentences in one subtitle, and that **the card never covers either subtitle line** (also with every section open);
* the same line re-rendered into a new text node (resize / framework re-render) stays clickable — a bug this suite found;
* `🔊` on a machine without a Korean voice says so; `＋ Lưu từ` saves and the word shows up in the Vocabulary page and as a Review card;
* subtitle layers with and without pointer events; a strict page CSP;
* the extension pages: Grammar tab (sections, search with and without diacritics, an entry opening to its examples), language list, the Grammar switch picked up live by the Netflix tab, English UI, the toolbar popup;
* authorship: the author and homepage Firefox itself reports for the add-on (what `about:addons` shows), and the "Made with ♥ by AVYRON" credit on the full page and in the 360 × 580 popup — placement without overlap, the SVG heart really decoded, the beat on hover, and no animation when the system asks for reduced motion (set through the `ui.prefersReducedMotion` preference).

## What it does **not** verify

* The real Netflix (needs an account and DRM) and a real NflxMultiSubs install — only their documented markup is reproduced, and Netflix can change it at any time.
* Real speech voices (it only checks the "no Korean voice" message), true fullscreen, other operating systems.
* Which browsers were tried: the author's runs used Zen Browser 1.23.3b (a Gecko fork, Firefox 158 engine) on Linux. Stock Firefox is expected to behave the same but has not been run by the author.

## Adding a check

Add it to `run.js` next to a similar one. Prefer asserting on what the user sees (text, geometry) over internal state, and keep numbers out of the assertions unless they come from the data (the Grammar tab check reads the expected sections from the language pack itself). A check that has never failed proves little: break the code once and make sure it turns red.
