# LinguaFlow — *Learn languages while watching.*

🔗 [github.com/avyronn/linguaflow](https://github.com/avyronn/linguaflow) · [Releases](https://github.com/avyronn/linguaflow/releases) · [Issues](https://github.com/avyronn/linguaflow/issues)

🇻🇳 Tiếng Việt: [README.md](README.md) (full guide) · 🤝 [CONTRIBUTING.md](CONTRIBUTING.md) · 📜 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) · 📝 [CHANGELOG.md](CHANGELOG.md)

<p>Made with <img src="icons/heart.svg" width="16" height="16" alt="love" align="absmiddle"> by <a href="https://github.com/avyronn"><b>AVYRON</b></a></p>

A Firefox extension (Manifest V3) that turns Netflix subtitles into a language-learning tool. **Click any word in a subtitle** to get its meaning, a morphological breakdown (stem + particles + endings), the Hanja and Sino-Vietnamese reading of Sino-Korean words, pronunciation, the **grammar patterns and the sentence structure** of the line you are watching, and save the word to a spaced-repetition review deck. **V1 ships a Korean language pack with Vietnamese glosses**; the architecture is *Core → Language Pack → Korean*, so other languages are new packs, not rewrites.

- **100 % local**: no accounts, analytics, tracking or uploads. Data lives in `browser.storage.local`. Enforced by an automated source audit. (The *Made with ♥ by AVYRON* line under the popup is a plain link to the author's GitHub profile: it opens a new tab only when you click it; the heart is an SVG drawn for the project, `icons/heart.svg`, not an emoji.)
- **Works with NflxMultiSubs**: LinguaFlow never draws a second subtitle; it reads the text Netflix/NflxMultiSubs already rendered (HTML or SVG) and adds click targets.
- Does not touch DRM, decoding, accounts or authentication. The only player interaction is pausing/resuming the `<video>` element while a word card is open (optional).
- **Honest about quality:** the Korean–Vietnamese content (meanings, grammar explanations, examples, Sino-Vietnamese readings) was written for this project with AI assistance and has **not been reviewed by a native speaker or a Korean teacher**. The tests keep the data *consistent*; they cannot prove it is *natural*. Please report mistakes.

## Install (Firefox ≥ 140)
1. Download `linguaflow-<version>.zip` from [Releases](https://github.com/avyronn/linguaflow/releases) (or build it: `git clone https://github.com/avyronn/linguaflow.git && cd linguaflow && bash build.sh`).
2. `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → pick the zip or `manifest.json`.
3. Temporary add-ons disappear when Firefox closes. For permanent use: Developer Edition/ESR/Nightly with `xpinstall.signatures.required=false`, or self-sign as "unlisted" on addons.mozilla.org.
4. If nothing happens on Netflix: `about:addons` → LinguaFlow → Permissions → allow `www.netflix.com`.

Pronunciation uses your OS speech voices (Linux: `sudo apt install speech-dispatcher speech-dispatcher-espeak-ng espeak-ng`). If no Korean voice exists the card says so instead of using a wrong voice.

## Use
Hover a Korean word → highlight. Click → word card (the video pauses; the card keeps clear of the subtitle lines and scrolls inside when it is tall). `Esc` closes and resumes. The card shows: the morphemes with their glosses and the composed meaning · *Hanja · Hán-Việt* for Sino-Korean words · the original sentence and its translation · **Grammar patterns** (the constructions that contain the clicked word, e.g. `V-고 싶다`, with level, explanation and examples) · other patterns in the sentence · **Sentence structure** (kind of sentence, speech level, tense, the role of each word, clauses with their relation, the word-order skeleton). **Save** adds the word to Review; **Known** keeps it but skips review.

Popup tabs: Home (language, feature switches incl. *Grammar*), Vocabulary (search, JSON/CSV export/import), Review (Again/Hard/Good/Easy), **Grammar** (searchable reference: 28 sections, 591 entries; Vietnamese search works without diacritics) and Settings. `Alt+Shift+L` toggles learning mode, `Alt+Shift+D` opens a diagnostics panel.

## What the Korean pack contains (numbers are read from the code)
* **Dictionary**: 9,587 entries (nouns 5,741 · verbs 1,987 · adjectives 736 · adverbs 591 …), written for the project; 200 Sino-Korean words carry Hanja + Hán-Việt (plus 60 `-하다`/`-되다` verbs built on them).
* **Morphology**: 95 particle entries, 341 endings (+ 138 forms of `이다`), irregular conjugation (ㅂ ㄷ ㅅ ㅎ 르, ㅡ/ㄹ drops, 하다/되다), spoken contractions, auxiliary verbs written together (`먹어봐요`), numerals + counters, honorific/humble vocabulary, romanization. Only readings that regenerate the exact surface are kept; ambiguous forms are flagged, unknown stems are marked *low confidence* instead of being guessed.
* **Grammar**: a catalogue of 242 patterns (문형) with 509 example sentences in 25 categories, levels 1–6 (a TOPIK-like estimate assigned by the project, not an official list), matched on the morphological analysis so spacing variants (`먹고싶어요`) work; an 18-topic sentence-structure guide; a rule-based sentence analyser (shallow, **not** a full parser). Every example sentence must be recognised as its own pattern by the test suite.

Limits: the word card has no context to choose between homographs (it says *ambiguous* and lists the readings); spaceless run-ons, unusual numeral + counter forms and some spoken contractions can be mis-split (always with lowered confidence); 242 patterns are **not** all of Korean grammar; the dictionary is finite (unknown words are labelled as such); image-based subtitles cannot be read. Full list: README.md §3.5.

## Honest status
Verified (Linux dev environment, 2026-10-19, Node 22): 254 unit tests (Node + jsdom), syntax check of 75 files, `web-ext lint` 10.8.0 on the exact files of the extension package (**0 errors, 0 warnings, 0 notices** — a static check, not proof that it works), and **51 end-to-end checks in a real Gecko engine** (Zen Browser 1.23.3b, headless) against a fake Netflix page with real layout (HTML and SVG subtitle text, real `<video>`, pause/resume, cross-tab settings sync, strict page CSP, the card never covering a subtitle line, the "by AVYRON" author as Firefox reports it, the credit line under the popup). The end-to-end suite is in the repo (`npm run e2e`, see `tests/e2e/README.md`) and found two real bugs the unit tests could not see; both are fixed and covered.
**Not** verified: real Netflix playback (needs an account and DRM) and a real NflxMultiSubs install (its DOM was reproduced from its 2.2.1 source); real speech voices; true fullscreen; stock Firefox (tested on a Gecko-based fork); any review by native speakers. If Netflix changes its markup, use the diagnostics panel and the *Custom subtitle selectors* setting (README §6), or update `src/core/subtitle/selectors.js`.

## Develop
```bash
npm install
npm test                 # all unit tests, ~30 s (Node >= 18)
npm run dict             # rebuild data/korean/dictionary.json from dictionary.src.txt + sources/*.txt + hanja.txt
npm run e2e              # real-Gecko end-to-end run (needs Firefox >= 140 + geckodriver; tests/e2e/README.md)
bash build.sh --lint     # check + dictionary + tests + zips + web-ext lint → dist/
```
Layout: `src/core/` (language-agnostic: subtitle, dictionary, vocabulary, review, pronunciation, language), `src/languages/korean/`, `src/content/` (overlay + controller), `src/popup/`, `data/`, `tests/`, `tests/e2e/`. Adding vocabulary or grammar: [CONTRIBUTING.md](CONTRIBUTING.md).

## Adding a language pack
Implement `LinguaFlow.LanguagePack` (`getId getName getNativeName getSpeechLang detect tokenize analyzeWord lookup getPronunciation getWordForm getBaseForm`, optionally `getExtraForms`, `getExternalLinks`, `analyzeSentence`, `getGrammarReference`, and an `etymology` line in `lookup()`) in `src/languages/<name>/index.js`, add `data/<name>/dictionary.json`, list the files in `manifest.json` (before `overlay-styles.js`), `popup.html`, `page.html` and `web_accessible_resources`, register with `LinguaFlow.LanguagePackManager.register(...)`. The language then becomes selectable automatically; the core does not change (`tests/core/language-pack.test.js` proves this with a stub Japanese pack). A pack without `analyzeSentence` simply has no grammar part. For Japanese, `Intl.Segmenter('ja')` gives offline word segmentation.

## License
MIT. "Netflix" and "NflxMultiSubs" belong to their owners; LinguaFlow is independent and contains none of their code. Where the data comes from, and what was only consulted: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
