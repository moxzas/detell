import { test } from "node:test";
import assert from "node:assert/strict";
import { clean, cleanProse, flags, detell, emDashCount, emDashesInProse, semicolonsInProse, looksLikeSlop, looksLikeFarm } from "../lib/index.js";
import { fileURLToPath } from "node:url";
import { dirname, join as pjoin } from "node:path";
const BIN = pjoin(dirname(fileURLToPath(import.meta.url)), "..", "bin", "detell.js");

test("clean removes em-dashes", () => {
  const out = clean("It does the legwork — groups the files — and never touches originals.");
  assert.equal(emDashCount(out), 0);
});

test("clean straightens curly quotes and ellipsis", () => {
  const out = clean("“hello” it’s here…");
  assert.ok(!/[“”’…]/.test(out));
  assert.match(out, /"hello" it's here\.\.\./);
});

test("clean never introduces a semicolon as a dash replacement", () => {
  const out = clean("The engine is real — the data is illustrative.");
  assert.equal((out.match(/;/g) || []).length, 0);
});

test("clean does not alter numbers", () => {
  const src = "A-complete 0.677 vs SM2-freq 0.685 — a tie at 100,000 items.";
  const out = clean(src);
  const nums = (s) => (s.match(/[0-9]+([.,][0-9]+)*/g) || []).join("|");
  assert.equal(nums(out), nums(src));
});

test("clean leaves spaced en-dash ranges alone (dates, years, days, times)", () => {
  for (const r of ["Dec 2024 – Jan 2025", "2021 – 2023", "2023 – current", "Jul 2026 – Present", "Mon – Fri", "9am – 5pm"]) {
    assert.ok(clean(`Bartender | ${r}`).includes(r), r);
    assert.ok(cleanProse(`Bartender | ${r}\n`).includes(r), r);
  }
});

test("clean still resolves a spaced en dash used as an em dash", () => {
  const out = clean("It ships today – the rest can wait.");
  assert.ok(!/[–—]/.test(out), out);
});

test("flags catches not-X-but-Y", () => {
  const f = flags("It's not about speed, but about clarity.");
  assert.ok(f.some((x) => x.type === "not-X-but-Y"));
});

test("flags catches a surviving em-dash", () => {
  const f = flags("this — somehow — survived");
  assert.ok(f.some((x) => x.type === "em-dash left"));
});

test("flags catches a semicolon in prose", () => {
  const f = flags("The engine is real; the data is illustrative.");
  assert.ok(f.some((x) => x.type === "semicolon in prose"));
});

test("flags ignores semicolons inside code (fence and inline)", () => {
  const fenced = flags("clean prose here.\n```\nfor (i = 0; i < n; i++) {}\n```\n");
  assert.ok(!fenced.some((x) => x.type === "semicolon in prose"), "fenced code ignored");
  const inline = flags("call `a(); b()` and keep the prose clean here.");
  assert.ok(!inline.some((x) => x.type === "semicolon in prose"), "inline code ignored");
});

test("semicolonsInProse counts prose only, skipping code", () => {
  assert.equal(semicolonsInProse("one; two; three."), 2);
  assert.equal(semicolonsInProse("a `for (;;)` loop and\n```\nx; y;\n```\n"), 0);
});

test("detell returns cleaned text and flags together", () => {
  const { cleaned, flags: f } = detell("Here's the thing — it works.");
  assert.equal(emDashCount(cleaned), 0);
  assert.ok(Array.isArray(f));
});

test("looksLikeSlop needs two signals", () => {
  const slop = "Is this useful? Would it help? Should I build it? Maybe I'm too cautious, but I'd ship it.";
  assert.equal(looksLikeSlop(slop), true);
  assert.equal(looksLikeSlop("A single ordinary sentence."), false);
});

test("looksLikeFarm fires on pricing validation", () => {
  assert.equal(looksLikeFarm("Cool idea. Would you pay $20/mo for this?"), true);
});

// --- file-safe cleanProse ---

test("cleanProse preserves the trailing newline (no false 'dirty')", () => {
  const src = "A clean line.\nAnother clean line.\n";
  assert.equal(cleanProse(src), src);
});

test("cleanProse never rewrites semicolons (would corrupt code)", () => {
  const css = "  padding: 0; margin: 0 auto; color: red;\n";
  assert.equal(cleanProse(css), css);
});

test("cleanProse leaves em-dashes inside fenced code blocks alone", () => {
  const src = "prose with an em-dash — here\n```\ncode --flag and an — dash stays\n```\n";
  const out = cleanProse(src);
  assert.ok(out.includes("code --flag and an — dash stays"), "code fence untouched");
  assert.ok(!/prose with an em-dash — here/.test(out), "prose dash fixed");
});

test("cleanProse leaves inline code spans alone", () => {
  const src = "Set `content:\"—\"` but fix this — clause.\n";
  const out = cleanProse(src);
  assert.ok(out.includes("`content:\"—\"`"), "inline code untouched");
  assert.ok(!out.includes("this — clause"), "surrounding prose fixed");
});

test("emDashesInProse ignores em-dashes inside code (gate stays satisfiable)", () => {
  const src = "clean prose here.\n```\ncode — with — dashes\n```\ninline `a — b` too.\n";
  assert.equal(emDashesInProse(src), 0);
  assert.equal(emDashesInProse("an unresolved — prose dash — pair"), 2);
});

test("cleanProse does not alter numbers", () => {
  const src = "A-complete 0.677 vs 0.685 — a tie at 100,000 items.\n";
  const nums = (s) => (s.match(/[0-9]+([.,][0-9]+)*/g) || []).join("|");
  assert.equal(nums(cleanProse(src)), nums(src));
});

test("prose counters ignore HTML <script> and <style> bodies", () => {
  // Surfaced by productbrain: every marketing page carries an inline analytics
  // snippet, and its minified JS tripped the semicolon rule on all of them, so
  // the real prose flags were buried in noise.
  const page = [
    "<h1>Plan with your agent</h1>",
    "<script>",
    "  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[]);}(document,window);",
    "</script>",
    "<style>",
    "  .hero { color: #fff; font-weight: 600; }",
    "</style>",
    "<p>Nothing here is a tell.</p>",
  ].join("\n");
  assert.equal(semicolonsInProse(page), 0);
  assert.equal(emDashesInProse(page), 0);

  // Prose OUTSIDE the blocks still counts, and a dash inside them still does not.
  const mixed = [
    "<p>This sentence has a tell; it should be caught.</p>",
    "<script>var a = 1; var b — 2;</script>",
  ].join("\n");
  assert.equal(semicolonsInProse(mixed), 1);
  assert.equal(emDashesInProse(mixed), 0);

  // A page with no script/style is untouched by the masking.
  assert.equal(semicolonsInProse("<p>one; two</p>"), 1);
});

test("prose counters ignore style= and on*= attribute code, but not content=", () => {
  // `style="position:relative;overflow:hidden;"` is two semicolons of CSS, and
  // an onclick handler is JS. Neither is prose. A meta description is.
  const page = [
    '<div style="position:relative;overflow:hidden;">',
    `<a onclick="track({tier:'free'}); go();">Start</a>`,
    "</div>",
  ].join("\n");
  assert.equal(semicolonsInProse(page), 0);

  // content=, alt= and title= are read by people, so they stay in scope.
  assert.equal(
    semicolonsInProse('<meta name="description" content="One thing; then another" />'),
    1,
  );
  assert.equal(emDashesInProse('<meta name="description" content="A — B" />'), 1);

  // HTML entities end in a semicolon and are not prose punctuation.
  assert.equal(semicolonsInProse("<p>Let&rsquo;s fix that. &copy; 2026</p>"), 0);
  assert.equal(semicolonsInProse("<p>Let&rsquo;s be clear; this one counts.</p>"), 1);
});

test(".detellignore excludes machine-facing paths, by glob, for named files too", async () => {
  // Surfaced by productbrain: a sweep reached llms.txt and the LLM API guide,
  // which are parsed by agents rather than read by a person forming an
  // impression. A dash there is not a tell, and editing a contract for style is
  // a real risk. The project that owns the files declares them, rather than
  // detell guessing from filenames.
  const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { execFileSync } = await import("node:child_process");

  const dir = mkdtempSync(join(tmpdir(), "detell-ignore-"));
  try {
    mkdirSync(join(dir, "public"), { recursive: true });
    const withTell = "A sentence — with a tell.\n";
    writeFileSync(join(dir, "public", "llms.txt"), withTell);
    writeFileSync(join(dir, "GUIDE.md"), withTell);
    writeFileSync(join(dir, "README.md"), withTell);
    writeFileSync(join(dir, ".detellignore"), "# machines read these\npublic/*.txt\nGUIDE.md\n");

    const run = (args) => {
      try {
        return { code: 0, out: execFileSync(process.execPath, [BIN, ...args], { cwd: dir, encoding: "utf8" }) };
      } catch (e) {
        return { code: e.status, out: (e.stdout || "") + (e.stderr || "") };
      }
    };

    // A named file is normally scanned whatever its extension. Ignore still wins,
    // which is the case that matters: an agent runs `detell docs/GUIDE.md`.
    const named = run(["GUIDE.md", "public/llms.txt"]);
    assert.equal(named.code, 0, "ignored files must not fail the gate");
    assert.ok(!named.out.includes("GUIDE.md"), "ignored named file should not be reported");

    // A walk skips them too, and still catches the file that is in scope.
    const walked = run(["."]);
    assert.ok(walked.out.includes("README.md"), "non-ignored file must still be flagged");
    assert.ok(!walked.out.includes("llms.txt"), "ignored file must not appear in a walk");
    assert.equal(walked.code, 1, "a real tell in a scanned file still fails");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
