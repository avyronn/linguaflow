# Third-party notices and data provenance

LinguaFlow's extension package contains **no third-party code, fonts, images, dictionaries or word lists**. Everything in it was written or drawn for this project and is released under the MIT license (see `LICENSE`). This file says exactly where that statement needs a footnote, so nobody has to take it on faith. If you find something here that is wrong or missing, please open an issue.

## What is in the extension package

| Part | Origin |
|---|---|
| Code (`src/`) | Written for the project. No runtime dependencies, no bundled libraries. |
| Icons (`icons/`) | Drawn for the project (`icon.svg` and PNG renders of it; `heart.svg`, the heart of "Made with ♥ by AVYRON"). |
| `data/korean/dictionary.json` | Compiled by `scripts/build-dictionary.js` from the project's own source files: `data/korean/dictionary.src.txt`, `data/korean/sources/*.txt`, `data/korean/hanja.txt` (and `87-numeral-counters.txt`, which `scripts/gen-numeral-counters.js` generates). |
| Speech | The browser's Web Speech API (the voices of your operating system). No voice or audio is bundled. |

## The Korean–Vietnamese data

* **Authorship.** Headwords, Vietnamese glosses, part-of-speech labels, grammar explanations, notes and every example sentence were **written for this project with AI assistance (Claude)**. They were not copied from a dictionary or a textbook.
* **No native-speaker review.** None of the Korean or Vietnamese content has been reviewed by a native speaker, a Korean teacher or a linguist. The test suite checks *consistency* (the build rules, that every grammar example is recognised as the pattern it illustrates, that every word of an example is in the dictionary, that every Hanja has one Hán-Việt syllable) — it cannot check naturalness or correctness of meaning. Errors are possible. Reports with the file and line are welcome.
* **Reference material that was only consulted.** While extending the vocabulary, two outside resources were looked at to find out *which common words were still missing*:
  * **KENGDIC**, a Korean–English dictionary released by Joe Speigle and contributors under MPL 2.0 / LGPL 2.0 or later (according to its own README) — used as a list of level-marked headwords with English glosses;
  * a **Korean word-frequency list** derived from film/TV subtitles (its exact upstream source was not verified, so it is not named here) — used to judge which words are common.

  They were read as lists to compare against, never imported: **no entry, gloss, example, ordering or file from either of them is part of this repository or of the extension package**, and every Vietnamese gloss was written independently. The order of entries in `dictionary.json` follows the project's own priority list and file order. If you contribute vocabulary, please do the same — see `CONTRIBUTING.md`.
* **Hanja and Hán-Việt (`hanja.txt`, 200 words).** Written from general knowledge of Sino-Korean vocabulary and Sino-Vietnamese readings. A test checks that each syllable has exactly one Hanja and each Hanja exactly one Hán-Việt syllable, which caught at least one real mistake; it does not replace review by someone who knows both readings.
* **Level labels (Lv 1–6) on grammar patterns** are the project's own estimate in the style of TOPIK levels. They are not an official TOPIK list.

## Names, trademarks and compatibility

"Netflix", "NflxMultiSubs" and "Firefox" belong to their owners; LinguaFlow is independent and not affiliated with them. To make LinguaFlow work next to NflxMultiSubs, the DOM structure that NflxMultiSubs 2.2.1 creates for its secondary subtitle, and the markup of Netflix's timed-text renderer, were *read* and are described in `src/core/subtitle/selectors.js`. No code, asset or text from either project is included.

## Development-time tools (not part of the extension package)

These are used by people who build or test the project and are installed from their own sources; none is bundled or redistributed here.

* **jsdom** (MIT) and its dependencies — dev dependency of the unit tests (`npm install`).
* **web-ext** (Mozilla, MPL 2.0) — run through `npx` by `bash build.sh --lint`.
* **geckodriver** (Mozilla, MPL 2.0) and a Gecko-based browser — used by the optional end-to-end test in `tests/e2e/` (`npm run e2e`). The author's runs used Zen Browser on Linux; nothing from it is included.
* **openssl** and **ffmpeg** — used by `tests/e2e/` to create a throw-away certificate and a short test video on first run; both files are generated into `dist/` and never committed.
