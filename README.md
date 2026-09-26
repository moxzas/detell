# detell

Strip the AI-writing signature from text, and a shared knowledge base of what
we've learned about shipping things that don't read as machine-made. One repo
every project can **call** and **contribute back to**.

Two halves:
- **`lib/`** — the callable library (`clean()`, `flags()`, `detell()`, plus
  slop/farm/appropriation detectors).
- **`knowledge/`** — the durable notes (`ai-text-tells.md`, `show-hn-design-slop.md`,
  `going-public-git-hygiene.md`), readable from the CLI.

The goal is **human perception, not detector evasion**: em-dashes, "not X but Y",
throat-clearing, hedge adverbs and LLM pet words read as machine-written to a
person, and that costs credibility wherever a reader assumes a human wrote it.

## Use it as a CLI (any project, any language)

```
detell <files/dirs...>          # scan for tells, exit 1 if any found
detell --fix <files/dirs...>    # apply the deterministic cleanup in place
detell --json <files/dirs...>   # machine-readable report
detell --warmth <files/dirs...> # also flag power-without-warmth openers
detell notes [name]             # read the knowledge base
```

Directories are walked for `.md .markdown .mdx .html .htm .txt`; a named file of
any extension is scanned as-is.

### `.detellignore`

One glob per line, `#` comments, read from the working directory. It applies to
named files as well as walked ones.

```
# text written for machines, not for a human forming an impression
public/llms.txt
public/llms-full.txt
docs/LLM_GUIDE.md
```

Use it for copy a machine parses rather than a person reads: an agent-discovery
`llms.txt`, an API contract, generated mirrors. detell judges **human
perception**, so a dash in a file nobody reads for impression is not a tell, and
sweeping one risks editing a contract for style. Because it's one binary, a Swift, Dart, or Python
project shells out to it the same way a Node one imports it. Wire it into a
pre-commit hook or CI step and it gates the punctuation tells automatically:

```
detell --fix docs/ README.md && git add -u   # example pre-commit
```

## Use it as a library (Node / JS projects)

```js
import { detell, clean, flags } from "detell";

const { cleaned, flags: tells } = detell(draft);   // cleaned text + what still needs an edit
const safe = clean(readme);                          // just the deterministic pass
```

## Install (private repo)

```
npm install github:moxzas/detell      # as a dependency
# or, for the CLI globally, from a local clone:
git clone git@github.com:moxzas/detell.git && cd detell && npm link
```

## Contribute back
When a project learns a new tell or a launch lesson, send it home: encode a
mechanizable rule in `lib/detell.js` and/or add a note under `knowledge/`. See
`CONTRIBUTING.md`. The point of a shared repo is that the whole fleet gets each
lesson once.

## What this is not
Not a "humanizer" (those paraphrase to dodge detectors and launder out the
author's voice). Not a classifier-evasion tool. It cleans mechanical tells and
flags structural ones for a human; the best de-tell is still the author's edit,
and this makes that edit lighter.
