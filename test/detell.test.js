import { test } from "node:test";
import assert from "node:assert/strict";
import { clean, flags, detell, emDashCount, looksLikeSlop, looksLikeFarm } from "../lib/index.js";

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
