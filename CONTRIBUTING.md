# Contributing

This repo is the fleet's shared memory. When any project learns something, it
comes back here so every other project inherits it. Two kinds of contribution:

## 1. A new tell the library should catch
If the lesson is mechanizable:
- **Deterministic and unambiguous** (a character or pattern that's always wrong in
  casual copy) → add it to `clean()` in `lib/detell.js`.
- **Structural** (a construction a human should decide about) → add an entry to the
  `STRUCTURAL` array with a `type`, a `re`, and a plain-language `hint`. Never
  auto-rewrite structure; flag it.
- Add or extend a case in `test/detell.test.js` so the rule can't regress.
- Keep it conservative: a false positive that flags real human writing erodes
  trust in the tool. When unsure, flag rather than auto-fix.

## 2. A learning worth remembering
If the lesson is judgment, not code (a room's promo rule, a launch post-mortem, a
new design tell) → add a markdown note under `knowledge/`, one idea per file, lead
with the takeaway, cite the source, and link it from `knowledge/README.md`.

## Workflow
Branch, change, run `npm test`, open a PR. Even solo: the branch-review-merge loop
keeps the shared repo trustworthy for every project that depends on it. Note in
the PR which project surfaced the learning.

## Design principles (don't drift from these)
- **Human perception, not detector evasion.** We are not gaming classifiers.
- **Clean the mechanical, flag the structural.** Rewriting rhythm strips meaning.
- **Preserve the author's voice.** This is the opposite of a "humanizer".
- **Never touch data.** When cleaning files, punctuation and prose only — never a
  number, code span, path, or technical claim.
