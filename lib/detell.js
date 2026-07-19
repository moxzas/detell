// detell core — strip the AI-writing signature from text.
//
// The goal is HUMAN perception, not detector evasion: em dashes, semicolons,
// "it's not X, it's Y", throat-clearing, hedge adverbs and LLM pet words read
// as machine-written to a person, and that undercuts credibility wherever a
// reader assumes a human wrote it (Show HN, Reddit, a README, store copy).
//
// Two jobs, kept separate on purpose:
//   clean()  — deterministic, unambiguous fixes, safe to apply automatically
//   flags()  — structural tells FLAGGED for a human edit, never auto-rewritten
//              (rewriting rhythm/structure risks stripping meaning)
//
// Register nuance: dense em-dash use is a tell in CASUAL registers (comments,
// READMEs, marketing copy). Deliberate long-form essay style is a different
// thing — run clean() where the casual-human read matters, not to launder a
// voice that genuinely uses the dash.

// --- deterministic cleanup ---

function straightenQuotes(t) {
  return t
    .replace(/[‘’‚‛]/g, "'") // curly single / apostrophe
    .replace(/[“”„‟]/g, '"') // curly double
    .replace(/…/g, "...") // ellipsis char -> three dots
    .replace(/ /g, " "); // non-breaking space
}

// A spaced em dash is the signature. Resolve by grammar heuristic:
// - paired ("X — aside — Y")      -> commas (parenthetical)
// - single, tail is a full clause -> period + capitalise (two crammed sentences)
// - single, short tail            -> comma (light aside)
// Never a semicolon (also a tell). Unresolved cases still get replaced but the
// text is flagged so a human eyeballs it.
function replaceDashes(t) {
  let s = t;
  // en dash used as em dash, and double hyphen, normalise to em first
  s = s.replace(/\s+--\s+/g, " — ").replace(/\s+–\s+/g, " — ");

  // paired em dashes on one line -> commas
  s = s.replace(/\s—\s([^—\n]{1,60}?)\s—\s/g, ", $1, ");

  // single spaced em dash, tail bounded so it can't swallow the next dash or
  // cross a sentence boundary.
  s = s.replace(/ — (\S[^—\n]*?)(?=[.!?](?:\s|$)| — |\n|$)/g, (m, tail) => {
    const words = tail.split(/\s+/);
    const tailFirst = words.slice(0, 8).join(" ");
    const looksIndependent =
      words.length >= 5 &&
      /\b(is|are|was|were|has|have|had|does|do|did|will|would|can|could|it|its|it'?s|that'?s|they|they'?re|i|you|we|he|she|the|this|there)\b/i.test(tailFirst);
    return looksIndependent
      ? `. ${tail.charAt(0).toUpperCase()}${tail.slice(1)}`
      : `, ${tail}`;
  });

  // non-spaced em dash between words -> comma
  s = s.replace(/(\w)—(\w)/g, "$1, $2");
  return s;
}

// Semicolons joining clauses -> period + capitalise (the usual case). Flagged
// too, since a rare list-semicolon would want a comma instead.
function replaceSemicolons(t) {
  return t.replace(/([^;\n]+);\s+(\S)/g, (m, head, next) => `${head.trimEnd()}. ${next.toUpperCase()}`);
}

function tidyWhitespace(t) {
  return t.replace(/ {2,}/g, " ").replace(/ +([.,!?])/g, "$1").replace(/\n{3,}/g, "\n\n").trim();
}

export function clean(text) {
  if (!text) return text;
  let t = straightenQuotes(text);
  t = replaceDashes(t);
  t = replaceSemicolons(t);
  t = tidyWhitespace(t);
  return t;
}

// --- structural tell detection (flag, don't fix) ---

export const STRUCTURAL = [
  { type: "em-dash left", re: /—/, hint: "an em dash survived cleanup — resolve by hand" },
  { type: "semicolon left", re: /;/, hint: "a semicolon survived — likely a list; use commas" },
  { type: "not-X-but-Y", re: /\b(it'?s |that'?s |this is )?not (just |only |merely )?\b[\w ,'-]{2,45}?[,.]?\s+(but|it'?s|that'?s|they'?re|rather|instead)\b/i, hint: "the 'not X, but Y' construction is a top AI tell — recast as a plain claim" },
  { type: "throat-clearing", re: /\b(here'?s the thing|the thing is|at the end of the day|that said|needless to say|it'?s worth (noting|remembering)|make no mistake)\b/i, hint: "AI throat-clearing opener — cut it, lead with the point" },
  { type: "hedge adverb", re: /\b(notably|arguably|importantly|essentially|ultimately|fundamentally|crucially|interestingly)\b/i, hint: "hedge/filler adverb — usually deletable" },
  { type: "rule-of-three", re: /\b[\w'-]+, [\w'-]+,? and [\w'-]+[.!?]/, hint: "possible rule-of-three list — vary it or break the pattern" },
  { type: "summary ending", re: /(^|\n)\s*(in short|in summary|ultimately|at the end of the day|so,? in the end|to sum up)\b/i, hint: "restated-summary ending — end on the point instead" },
  { type: "llm pet word", re: /\b(archaeolog\w*|archeolog\w*|excavat\w*|delv(e|es|ed|ing)|tapestry|spelunk\w*|deep[- ]dive|seamless\w*|robust\w*|leverag\w*|elevate\w*|underscore\w*)\b/i, hint: "LLM pet word — say it plainly" },
];

// --- warmth flags (power-without-warmth register) ---
// Charisma = warmth x power (Cabane). Catches the cold, showing-off, lecture
// register that earns nothing. Heuristic — flag, never auto-fix.
const NAMES = /\b(Klein|Kahneman|Goldratt|Ousterhout|Cynefin|Torres|Csikszentmihalyi|Alexander|Christensen|Bostrom|Carse|Drucker|Nielsen|Ricardo|Semler|Naval)\b/;

export function warmthFlags(text) {
  if (!text) return [];
  const out = [];
  const firstSentence = (text.match(/^[^.!?]*[.!?]/) || [text])[0];
  if (!/\b(you|your|you're|you'd|you've)\b/i.test(text)) {
    out.push({ type: "warmth: monologue", snippet: firstSentence.trim().slice(0, 60), hint: "no reader in it (no 'you') — reads as talking-at, not to" });
  }
  if (NAMES.test(firstSentence) || /^(the |a )?[A-Z][a-z]+ (framework|model|principle|law|effect)\b/.test(firstSentence.trim())) {
    out.push({ type: "warmth: lecture-forward", snippet: firstSentence.trim().slice(0, 60), hint: "opens with the apparatus, not the reader's need — start from their problem" });
  }
  return out;
}

export function flags(text, { warmth = false } = {}) {
  if (!text) return [];
  const out = [];
  for (const f of STRUCTURAL) {
    const m = text.match(f.re);
    if (m) out.push({ type: f.type, snippet: (m[0] || "").trim().slice(0, 60), hint: f.hint });
  }
  return warmth ? [...out, ...warmthFlags(text)] : out;
}

// --- appropriation (reads the parent text, not just the draft) ---
// Flags an opener that restates someone else's point as its own.

const APPROP_STOP = new Set(
  "the a an and or but of to in on for with that this it its is are was were be been you your i my me we our have has had do does did not no as at so if they them when what how why lot".split(" "),
);
const stem = (w) => w.replace(/(ing|ed)$/, "").replace(/(?<!s)s$/, "");
const CREDITS = /\byou (said|put|nailed|called|wrote|already)\b|\byou'?re right\b|\bas you (say|said|point)\b|^\s*["“>]/i;
const contentWords = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !APPROP_STOP.has(w))
    .map(stem);

export function appropriationFlags(text, parentText) {
  if (!text || !parentText) return [];
  const openers = text.split(/(?<=[.!?])\s+/).slice(0, 2);
  const parentSents = parentText.split(/(?<=[.!?])\s+/);
  for (const o of openers) {
    if (CREDITS.test(o)) continue;
    const ow = new Set(contentWords(o));
    if (ow.size < 4) continue;
    for (const p of parentSents) {
      const pw = new Set(contentWords(p));
      if (pw.size < 4) continue;
      const shared = [...ow].filter((w) => pw.has(w)).length;
      if (shared / Math.min(ow.size, pw.size) >= 0.5) {
        return [{
          type: "appropriation",
          snippet: o.trim().slice(0, 60),
          hint: "opener restates the other person's point as yours — credit them and build past it",
        }];
      }
    }
  }
  return [];
}

// Coarse macro-shape classifier — used to spot a repeated template across a
// batch of texts (recurring macro-structure is what makes a history smell
// generated; recurring micro-voice is fine).
export function shapeOf(text) {
  const t = (text || "").trim();
  const words = t.split(/\s+/).filter(Boolean).length;
  const first = t.split(/(?<=[.!?])\s+/)[0] || "";
  if (words <= 60) return /\?/.test(t) ? "short-question" : "short-take";
  if (/\?\s*$/.test(first.trim())) return "question-led";
  if (/^["“>]/.test(first)) return "quote-led";
  if (/^you\b|^you'/i.test(first)) return "reader-led";
  if (/\d/.test(first)) return "number-led";
  if (/^i\b|^i'/i.test(first)) return "story-led";
  if (t.split(/\n\s*\n/).length >= 3) return "essay";
  return "take";
}

// --- slop detection on a POST/OP (not a draft you wrote) ---

export function slopFlags(text) {
  if (!text) return [];
  const out = [];
  const sents = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);

  let run = 0, maxQ = 0;
  for (const s of sents) { run = /\?$/.test(s) ? run + 1 : 0; if (run > maxQ) maxQ = run; }
  if (maxQ >= 3) out.push({ type: "slop: question-stack", hint: `${maxQ} consecutive rhetorical questions` });

  run = 0; let maxS = 0;
  for (const s of sents) {
    const w = s.split(/\s+/).length;
    run = w <= 4 && /[.!]$/.test(s) ? run + 1 : 0;
    if (run > maxS) maxS = run;
  }
  if (maxS >= 3) out.push({ type: "slop: staccato-list", hint: `${maxS} consecutive fragment-sentences` });

  if (/\bmaybe i'?m (too|being|just)\b[^.!?]*\bbut\b/i.test(text)) {
    out.push({ type: "slop: humble-closer", hint: "\"maybe I'm too X, but...\" self-deprecating closer" });
  }

  const structural = [];
  for (const f of STRUCTURAL) if (f.re.test(text)) structural.push(f.type);
  if (structural.length >= 2) out.push({ type: "slop: ai-structure", hint: structural.join(", ") });

  return out;
}

export function looksLikeSlop(text) {
  return slopFlags(text).length >= 2;
}

// --- validation-farm detection (a thread used as a free focus group) ---

export function farmFlags(text) {
  if (!text) return [];
  const out = [];
  if (/\bwould you pay\b|\bworth (paying )?\$|\bwilling to pay\b|\bwould you (buy|subscribe|sign up)\b|\bpay(ing)? for (this|it|such)\b/i.test(text))
    out.push({ type: "farm: pricing-validation", hint: "asks 'would you pay $X' — market research, not a discussion" });
  if (/\bwould you (actually |ever )?(use|open|try) (this|it|my)\b|\bis this (something|a thing) you'?d (use|want)\b|\bdoes (this|it) sound (nice|useful|interesting)\b/i.test(text))
    out.push({ type: "farm: usage-validation", hint: "asks 'would you use this' — soliciting validation of an idea" });
  if (/\bdon'?t be polite\b|\bbe brutal\b|\bbe honest with me\b|\broast (this|it|me)\b|\btear (it|this) apart\b|\bno sugar[- ]?coat/i.test(text))
    out.push({ type: "farm: feedback-bait", hint: "solicits harsh feedback — the free-focus-group tell" });
  if (/\b(i['’]?m|we['’]?re) (testing|validating|exploring|researching) (an idea|a concept|a hypothesis)\b|\bdoing (some|user|market) research (on|around|into)\b/i.test(text))
    out.push({ type: "farm: discovery-disclosure", hint: "OP says they're 'testing an idea' — customer discovery, not a discussion" });
  const numbered = (text.match(/\b\d\.\s+(would|what|which|do|are|is|how|why)\b/gi) || []).length;
  if (numbered >= 2) out.push({ type: "farm: survey-questions", hint: `${numbered} numbered questions aimed at the reader — a survey` });
  return out;
}

export function looksLikeFarm(text) {
  const f = farmFlags(text);
  return f.some((x) => x.type === "farm: pricing-validation") || f.length >= 2;
}

// Count em-dashes only (the cheap headline metric the CLI reports per file).
export function emDashCount(text) {
  return ((text || "").match(/—/g) || []).length;
}

// One call: cleaned text + the flags on the CLEANED text (so auto-fixed tells
// don't re-flag, only what genuinely needs a human eye remains). Pass a parent
// text to arm the appropriation check.
export function detell(text, { parentText = null, warmth = false } = {}) {
  const cleaned = clean(text);
  return { cleaned, flags: [...flags(cleaned, { warmth }), ...appropriationFlags(cleaned, parentText)] };
}
