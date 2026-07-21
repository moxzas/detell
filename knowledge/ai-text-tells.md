# AI text tells — the field guide the library encodes

The text axis. `lib/detell.js` automates most of this; this doc is the *why*, so
a human (or a contributing project) understands what the code is looking for and
can add to it. Design tells live in `show-hn-design-slop.md`.

## The governing idea
The goal is **human perception, not detector evasion.** Em-dashes are not even a
reliable classifier signal, but they read as machine-written to a *person* on
Show HN, Reddit, or a README, and that undercuts credibility wherever the reader
assumes a human wrote it. So: clean the mechanical tells, flag the structural
ones for a human, and never launder a genuine voice.

Two layers, and the order matters:
1. **Generation is the highest-leverage fix.** Instruct the model up front:
   straight quotes, periods and commas, varied sentence length, no "not X but Y",
   no throat-clearing, no rule-of-three. A draft that comes out clean needs no
   pass. `detell` is the safety net, not the strategy.
2. **The deterministic pass** (`clean()`) auto-fixes the unambiguous; `flags()`
   surfaces the structural tells for a human edit.

## Auto-fixed by `clean()` (deterministic, safe)
- **Curly quotes / smart apostrophes / ellipsis char / non-breaking space** →
  straight equivalents.
- **Em-dashes**, context-aware: a paired aside (`— X —`) becomes commas; a single
  dash with a full-clause tail becomes a period + capital (two crammed sentences);
  a short tail becomes a comma. **Never a semicolon** — the usual fallback is
  itself a tell. A blind swap breaks grammar, which is why this is grammar-aware
  and still flags anything it could not resolve.
- **Semicolons** in a comment string, joining clauses → period + capital (a rare
  list-semicolon wants a comma instead, so it is also flagged). In a *file*,
  semicolons are flagged rather than auto-fixed (see below), because the file may
  contain code where a semicolon is just syntax.

## Flagged by `flags()` (structural — a human edits, code never rewrites)
Rewriting rhythm or structure risks stripping meaning, so these are surfaced, not
auto-changed:
- **"not X, but Y"** — the single most recognizable construction. Recast as a
  plain claim.
- **Semicolons in prose.** A semicolon joining two clauses reads as Grammarly or
  LLM polish (people who hand-punctuate rarely reach for it). It is prose-aware,
  so a semicolon inside a code sample never fires. Split into two sentences, or
  use a comma.
- **Throat-clearing openers** — "here's the thing", "the thing is", "that said",
  "make no mistake". Cut it; lead with the point.
- **Hedge adverbs** — "notably, arguably, importantly, essentially, ultimately,
  fundamentally, crucially, interestingly". Usually deletable.
- **Rule-of-three lists** — "X, Y, and Z." as a closing cadence. Vary it or break
  the pattern.
- **Restated-summary endings** — "in short", "in summary", "to sum up". End on the
  point instead.
- **LLM pet words** — delve, tapestry, deep-dive, seamless, robust, leverage,
  elevate, underscore, archaeology/excavate. Say it plainly.

## Warmth flags (optional, `--warmth`)
Charisma = warmth × power. The failure mode is power-heavy, warmth-light: opening
with the apparatus (a named framework, a "the X principle" construction) instead
of the reader's need, or a monologue with no "you" in it. Flagged, never fixed.

## What NOT to do
- **Don't use "humanizer" tools** (Undetectable.ai and friends). They paraphrase
  to dodge detectors, degrade the prose, and launder out the author's voice — the
  one thing worth keeping.
- **Don't blindly find-and-replace em-dashes.** All-comma reads flat and creates
  splices; all-period makes fragments. Vary the punctuation to the sentence.
- **Don't de-tell disclosed AI output.** If a doc openly says a machine produced
  it (e.g. an AI-generated plan tree), a hand-polished version reads *stranger*,
  not cleaner. The tell only costs you where a human is assumed.

## Register nuance
Dense em-dash use is a tell in **casual** registers (comments, READMEs, store
copy). Deliberate long-form essay style is a different thing — run `clean()` where
the casual-human read matters, not to strip a voice that genuinely uses the dash.
