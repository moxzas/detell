import { test } from "node:test";
import assert from "node:assert/strict";
import { clean, cleanProse, flags, detell, emDashCount, emDashesInProse, semicolonsInProse, looksLikeSlop, looksLikeFarm } from "../lib/index.js";

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
