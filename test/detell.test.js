import { test } from "node:test";
import assert from "node:assert/strict";
import { clean, cleanProse, flags, detell, emDashCount, emDashesInProse, looksLikeSlop, looksLikeFarm } from "../lib/index.js";

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
