# Contributing to LinguaFlow

Thanks for helping! Vietnamese or English are both fine in issues and PRs.

## Setup
```bash
git clone https://github.com/<you>/linguaflow.git && cd linguaflow   # your fork of avyronn/linguaflow
npm install          # only dev dependency: jsdom (for DOM tests)
npm test             # all unit tests, ~30 s, Node >= 18
bash build.sh --lint # syntax + dictionary + tests + dist/*.zip + web-ext lint
npm run e2e          # optional: the packaged zip in a real Gecko engine (needs Firefox >= 140 + geckodriver; see tests/e2e/README.md)
```
Try it in Firefox: `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* → `manifest.json`. After editing code, press **Reload** on that page.

## Ground rules (enforced by tests)
1. **Privacy first**: no analytics, no network calls, no remote code, no new permissions. `tests/core/package.test.js` scans the source.
2. **Core is language-agnostic.** Anything specific to one language lives in `src/languages/<language>/`. The core talks to a language only through the `LanguagePack` interface (`src/core/language/language-pack.js`). The core may show what a pack returns (e.g. `analyzeSentence`, `etymology`) but must not know what a particle or a Hanja is.
3. **Never present a guess as certain.** The Korean analyzer only keeps readings that regenerate the exact surface; unknown stems must stay marked as unknown with low confidence; pattern matches that needed a non-default reading, a spelling correction or a spaceless split are reported with lowered confidence and a reason.
4. **No `innerHTML`**, no `setInterval`/fast polling in content scripts (use `MutationObserver` + debounce).
5. Every behaviour change comes with a test — and the test should **fail on the old code** (break the code once and see it go red). DOM-dependent code is tested with jsdom using stub geometry (see `tests/core/controller.test.js`); anything that depends on real layout (placement, hit-testing on real glyphs) belongs in `tests/e2e/`.
6. **Original content.** Write Vietnamese glosses and examples yourself; do not paste text from copyrighted dictionaries or textbooks. If you consult a resource to find gaps, say so in the PR and do not import its entries, glosses or examples. Anything third-party that really is included goes into `THIRD_PARTY_NOTICES.md` with its license.

## Good first contributions

### Dictionary (vocabulary)
Source files: `data/korean/dictionary.src.txt` (core, with the `#priority:` list) and `data/korean/sources/*.txt` (topic files, read in file-name order). One line per sense:
```
word|pos|meaning 1; meaning 2|flag
먹다|v|ăn; uống (thuốc)
```
* `pos`: `n pron num cnt nbound det adv int conj v adj aux cop phrase`. Verbs/adjectives in dictionary form (`먹다`); `flag` (optional) = irregular class `ㅂ ㄷ ㅅ ㅎ 르 러`, or `reg` to force regular, only when the automatic rule guesses wrong.
* The first definition of a *word + pos* pair wins; a later file cannot silently redefine it (it is reported as ignored). A word may have several lines with different `pos`.
* **No `;` inside parentheses** of a meaning (`;` separates senses; the build fails) — write a comma.
* Sino-Korean words: add `word|漢字|âm Hán-Việt` to `data/korean/hanja.txt` (one Hanja per syllable, one Hán-Việt syllable per Hanja; a test enforces it).
* Native numbers 1–4 + counter (`두명`) are generated: edit `scripts/gen-numeral-counters.js`, then `node scripts/gen-numeral-counters.js`.
* Then `npm run dict` and commit **both** the source and the generated `data/korean/dictionary.json` (CI fails if they differ). New words must not break the round-trip test (every verb must conjugate and be recognised again).

### Grammar patterns (문형)
Add a row to `src/languages/korean/grammar-patterns.js`:
```js
['V-(으)ㄹ 수 있다', 'P@-(으)ㄹ N=수+~ P=있다|없다', 2, 'ability', 'có thể …', 'ghi chú / khi dùng', [['먹을 수 있어요.', 'Tôi có thể ăn.'], ['갈 수 없어요.', 'Tôi không thể đi.']], 'optional flags']
```
* `match` is written in the small pattern language documented at the top of `src/languages/korean/patterns.js`: one slot per word (`V` verb, `A` adjective, `X` auxiliary, `P` any predicate, `N` noun, `D` adverb/determiner, `T` particle, `*` anything) plus modifiers — `=lemma`, `<not-lemma`, `@-ending`, `#fin|conn|adn|nom`, `^relation`, `+particles`, `!required-particle`, `%H|P|F` (pre-final), `$` (clause-final), `?` (optional), `;` (alternatives), `..` (a gap). An array of variants is allowed.
* Flags: `weak` (easily confused with another use → medium confidence), `generic` (hidden when a more specific pattern covers the same words), `end` (a single ending, listed under endings), `future`, `link=REL` (links clauses: cause, cond, conc, contrast, purpose, seq, simul, bg, quote …).
* Level 1–6 is a rough TOPIK-style estimate; the category must exist in `CATEGORIES`.
* Write 2–3 natural examples **using words from the bundled dictionary**. `node --test tests/korean/grammar-catalogue.test.js` checks that the row compiles, that every example makes the analyser report *this* row, and that no example word is unknown, a spaceless guess or a misspelling. A row whose examples are not recognised cannot ship.
* Sentence-structure explanations live in `grammar-guide.js` (same example rules); the labels the card shows come from `sentence.js` and `grammar-view.js` (`tests/korean/sentence.test.js`).

### Netflix DOM changes
Selectors live only in `src/core/subtitle/selectors.js`. Update them and add/adjust a fixture in `tests/helpers/dom.js` (and `tests/e2e/lib/fake-netflix.js`).

### Grammar coverage of words
Endings in `src/languages/korean/endings.js`, particles in `particles.js`, irregular rules in `conjugation.js`, spoken contractions and auxiliary verbs in `morphology.js`. Add a case to `tests/korean/`.

### Translations of the UI
`src/core/i18n.js` — Vietnamese and English must have exactly the same keys (a test checks it). Learner-facing text about the language itself (glosses, grammar labels) is written by the language pack, in the gloss language.

## Adding a language pack
See "Cách thêm language pack mới" in `README.md` (or the English summary in `README.en.md`). In short: implement `LanguagePack` in `src/languages/<name>/` (the grammar hooks `analyzeSentence` / `getGrammarReference` and `etymology` in `lookup()` are optional), add a dictionary under `data/<name>/`, list the files in `manifest.json`, `src/popup/popup.html`, `src/popup/page.html` and `web_accessible_resources`, then write tests under `tests/<name>/`. The core must not change.

## Releases
One version everywhere (a test checks it): `manifest.json`, `package.json`, **both** version fields of `package-lock.json`, `LF.VERSION` in `src/core/util.js`, and the fallback in `src/popup/popup.js`. Add a `## X.Y.Z — date` entry to `CHANGELOG.md` (a test checks that it exists). Tag `vX.Y.Z`; the *Release* workflow builds, lints and attaches the zips. Publishing to addons.mozilla.org is done manually by the maintainer. Before a release, run `bash build.sh --lint` and, if you have Firefox + geckodriver, `npm run e2e`; say plainly in the release notes what was **not** verified.
