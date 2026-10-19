## What does this change?

## Checklist
- [ ] `bash build.sh --lint` passes (syntax, dictionary, tests, web-ext lint)
- [ ] New behaviour has a test, and the test fails on the old code
- [ ] No new network access, tracking, `innerHTML`, `setInterval` (the privacy audit test enforces this)
- [ ] Core code stays language-agnostic (no `if (language === ...)` in `src/core`)
- [ ] Dictionary / grammar additions are **original wording** (not copied from a dictionary or textbook); if I consulted an outside resource to find gaps, I say which one below and imported nothing from it; anything third-party that is included is in `THIRD_PARTY_NOTICES.md`
- [ ] If the dictionary changed: I ran `npm run dict` and committed both the source `.txt` files and the generated `data/korean/dictionary.json`
- [ ] If this touches what is shown on the card or in the popup: I say below whether I looked at it in a real browser or only ran the tests

## Not verified (be honest)
