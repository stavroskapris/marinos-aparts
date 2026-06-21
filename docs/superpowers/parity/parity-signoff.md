# Text Parity Sign-off Log

This file records approved differences between the legacy `js/custom/lang/*.js` string values
and the Astro `src/i18n/{en,gr}.json` files. Each entry documents what changed, why, and who
approved it. Entries are referenced by `scripts/parity-text.mjs` via `APPROVED_DIFFERENCES`.

---

## 2026-06-21 — gr `location.main`: doubled curly quotes → straight quotes around 3 island names

**Approved by:** stavroskapris  
**Date:** 2026-06-21  
**Language:** `gr`  
**Key path:** `location.main` (the long location description paragraph)

### Nature of the change

The legacy string contains doubled curly/typographic single-quote pairs (`''…''`) — i.e., two
consecutive U+2018 LEFT SINGLE QUOTATION MARK / U+2019 RIGHT SINGLE QUOTATION MARK characters —
used as an approximation of Greek quotation marks around three island names:

- `''Μαύρο Όρος''`
- `''Αγ. Νικόλαος''`
- `''Μουρτεμένο''`

The Astro `gr.json` uses plain straight ASCII single quotes (`'…'`) instead:

- `'Μαύρο Όρος'`
- `'Αγ. Νικόλαος'`
- `'Μουρτεμένο'`

### Rationale

The doubled curly quotes were a legacy typo / copy-paste artifact — using two separate typographic
quote characters to simulate a single open/close pair is not correct typography in either Greek or
English. The Astro migration cleaned this up to standard single straight quotes, which is
semantically equivalent and visually cleaner.

### Decision

This is an **intentional typographic cleanup**. `gr.json` must NOT be reverted to the legacy form.
The difference is allowlisted in `scripts/parity-text.mjs` under `APPROVED_DIFFERENCES.gr`.
