# Knowledge base

"Things of note" that every project can read and every project can add to. This
is the durable memory of what we've learned about shipping things that don't read
as machine-made — the counterpart to the `lib/` code.

Read a note from anywhere with the CLI:

```
detell notes                      # list the notes
detell notes show-hn-design-slop  # print one
```

## Current notes
- **`ai-text-tells.md`** — the text axis: what the library detects and why.
- **`show-hn-design-slop.md`** — the design axis: the Krebs 16-pattern Show HN
  audit, as a pre-launch checklist.
- **`going-public-git-hygiene.md`** — the history axis: commit messages, old
  blobs, and repo metadata are public too; audit them before flipping a repo
  public.

## Adding a note
When a project learns something worth keeping (a new tell, a room's rule, a
launch post-mortem), add a markdown file here and link it from this list. Keep
one idea per file, lead with the takeaway, and cite the source. If the learning
is mechanizable, also encode it in `lib/detell.js` (see `CONTRIBUTING.md`).
