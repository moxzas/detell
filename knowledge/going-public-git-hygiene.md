# Going public: the git history is public too

**Takeaway:** cleaning the *files* before a repo goes public is not enough. The
commit history, the commit messages, and the repo metadata (`.gitignore`
comments, branch names, CI config) are equally public, and they are the
most-missed source of fingerprints. Audit them the same way you audit the tip,
across ALL of history, before you flip a repo public.

## Why this note exists

Source: the Core Kanji going-public, 2026-07-21. The files were audited and
scrubbed and the repo went public. Then a skim of the **commit log** showed the
scrub had missed three layers:

- Commit subjects narrated the scrubbing itself: `De-tell the brain export`,
  `De-slop the demo landing page`. Announcing that you are removing AI tells
  reads as *covering tracks* and is worse than the tells were.
- Commit bodies re-leaked the exact strategy that had just been removed from the
  files (moat, license-timing), and exposed backstage plumbing
  (`Route backstage notes to choreography/`).
- A `Co-Authored-By: Claude` trailer sat on every commit; `.gitignore` comments
  said "agent-orchestration notes, never committed"; and 17 in-file headers named
  an AI agent as the decider with a human "pending ratification".

None of that was in the tip files. All of it required a second history rewrite
(`git filter-repo`) and a force-push, after the repo was already public.

## The mistake, generalized

Fingerprints live in three places beyond current file content:

1. **Commit messages** (subjects AND bodies), across every ref and all of
   history: process-narration ("de-tell", "de-slop", "remove AI tells",
   "humanize"), content you deleted from files but re-stated in a message,
   backstage/orchestration language, internal codenames or agent personas, and
   assistant trailers.
2. **File content in OLD commits**: anything deleted from the tip still lives in
   history. A secret here must be **rotated**, not just removed.
3. **Repo metadata**: `.gitignore` / `.gitattributes` comments, branch/tag/remote
   names, CI files, committed IDE config, and image/PDF EXIF.

## The line that matters

Openly "AI helped build this" is fine when that is the intended story. What
always embarrasses, regardless of intent:

- **"An AI agent decided and a human rubber-stamped it"** — named agent personas
  as authors of decisions, "pending <person> ratification/blessing".
- **"The author is scrubbing AI tells"** — any message or artifact that narrates
  the de-telling process.

Disclose AI on purpose if that is the story; never leak the machinery.

## Audit checklist (read-only: report, do not fix)

```
# 1. Every commit message across all refs
git log --all --format='%H%n%an <%ae>%n%B%n----'
# assistant trailers (want 0, or only what's intentional)
git log --all --format='%B' | grep -ci 'co-authored-by'
# author identity: human, or an assistant name?
git log --all --format='%an <%ae>' | sort -u

# 2. Every blob across all history (deleted-from-tip content still lives here)
git rev-list --all --objects | cut -d' ' -f1 | sort -u | while read o; do
  [ "$(git cat-file -t "$o" 2>/dev/null)" = blob ] && git cat-file -p "$o" 2>/dev/null
done > /tmp/allblobs.txt
# then grep /tmp/allblobs.txt for: secrets, agent personas, "pending * ratification",
# strategy terms, and any internal codename you find.
# Confirm sensitive paths were NEVER tracked:
git log --all --oneline -- .env <private-notes-dir>   # expect empty

# 3. Metadata
grep '#' .gitignore .gitattributes 2>/dev/null   # telling comments?
git branch -a; git tag                            # telling names?

# 4. Text tells in the messages themselves (mechanizable, below)
git log --all --format='%B' > /tmp/msgs.txt && detell /tmp/msgs.txt
```

## Remediation (name it; the audit does not execute it)

Anything found in old commits or messages needs a **history rewrite**, not a tip
edit: `git filter-repo --replace-text <file>` for blob content,
`--message-callback` to rewrite messages, then a force-push. A tip edit alone
does not remove it from history. A real secret in history must be **rotated**.

## Mechanizable part

The text-tell subset of this is already detell-able: dump the commit messages to
a file and scan them with the CLI (`git log --all --format='%B' > /tmp/msgs.txt
&& detell /tmp/msgs.txt`). Detecting backstage, re-leaked strategy, and assistant
trailers is judgment, which is what this checklist is for. A future CLI mode
(`detell --git`) could fold the message and metadata scan into one command.
