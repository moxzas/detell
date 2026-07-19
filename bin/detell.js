#!/usr/bin/env node
// detell CLI — de-tell files, or read the shared knowledge base.
//
//   detell <files/dirs...>        scan for AI tells, report per file
//   detell --fix <files/dirs...>  apply the deterministic cleanup in place
//   detell --json <files/dirs...> machine-readable report
//   detell notes [name]           list, or print, a knowledge-base note
//
// Any project in any language can call this: it shells out to one binary.
// Exit code is nonzero when unresolved tells remain, so it gates a pre-commit
// hook or CI step. --fix resolves the punctuation tells; structural tells are
// reported for a human, never auto-rewritten.

import { readFileSync, writeFileSync, statSync, readdirSync, existsSync } from "node:fs";
import { join, extname, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanProse, flags, emDashCount, emDashesInProse } from "../lib/detell.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KNOWLEDGE = join(ROOT, "knowledge");
const TEXT_EXT = new Set([".md", ".markdown", ".mdx", ".html", ".htm", ".txt"]);
const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage"]);

function walk(target, acc) {
  const st = statSync(target);
  if (st.isDirectory()) {
    for (const name of readdirSync(target)) {
      if (SKIP_DIR.has(name)) continue;
      walk(join(target, name), acc);
    }
  } else if (st.isFile()) {
    // an explicitly named file is always included; a walked one must be text
    acc.add(target);
  }
  return acc;
}

function collect(targets) {
  const files = new Set();
  for (const t of targets) {
    if (!existsSync(t)) { console.error(`detell: no such path: ${t}`); continue; }
    const st = statSync(t);
    if (st.isDirectory()) {
      const found = new Set();
      walk(t, found);
      for (const f of found) if (TEXT_EXT.has(extname(f).toLowerCase())) files.add(f);
    } else {
      files.add(t); // named file: any extension
    }
  }
  return [...files].sort();
}

function scanFile(path, { fix, warmth }) {
  const original = readFileSync(path, "utf8");
  const cleaned = cleanProse(original);       // file-safe: preserves newlines/code
  // Drop the punctuation-survivor flags in file mode: em-dashes-in-code are
  // reported via `remaining`, and semicolons are valid in files (we don't touch
  // them), so flagging every one is noise. Keep the genuine structural tells.
  const structural = flags(cleaned, { warmth })
    .filter((f) => f.type !== "semicolon left" && f.type !== "em-dash left");
  let wrote = false;
  if (fix && cleaned !== original) { writeFileSync(path, cleaned); wrote = true; }
  const current = fix ? cleaned : original;
  return {
    file: path,
    emDashesBefore: emDashCount(original),
    resolvable: cleaned !== original,          // prose fixes are available
    remaining: emDashesInProse(cleaned),       // prose em-dashes cleanProse couldn't resolve (rare)
    fixed: wrote,
    flags: structural,
  };
}

function notes(name) {
  if (!existsSync(KNOWLEDGE)) { console.error("detell: no knowledge/ directory found"); process.exit(1); }
  const docs = readdirSync(KNOWLEDGE).filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md");
  if (!name) {
    console.log("Knowledge base (detell notes <name> to print one):\n");
    for (const d of docs) console.log("  " + d.replace(/\.md$/, ""));
    return 0;
  }
  const match = docs.find((d) => d === name || d === `${name}.md` || d.replace(/\.md$/, "").includes(name));
  if (!match) { console.error(`detell: no note matching "${name}". Try: detell notes`); return 1; }
  process.stdout.write(readFileSync(join(KNOWLEDGE, match), "utf8"));
  return 0;
}

function help() {
  console.log(`detell — strip the AI-writing signature, and the shared knowledge base

Usage:
  detell <files/dirs...>          scan; exit 1 if punctuation fixes are available
  detell --fix <files/dirs...>    apply the file-safe cleanup in place
  detell --strict <files/dirs...> also fail on structural flags (not just em-dashes)
  detell --warmth <files/dirs...> also flag power-without-warmth openers
  detell --json <files/dirs...>   machine-readable report
  detell notes [name]             list, or print, a knowledge note
  detell --help

--fix is file-safe: it preserves newlines, never rewrites semicolons, and skips
anything inside \`\`\` fences or \`inline code\`, so it won't mangle code samples.
Directories are walked for ${[...TEXT_EXT].join(", ")}; named files are scanned as-is.`);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) { help(); process.exit(0); }

  if (argv[0] === "notes") { process.exit(notes(argv[1])); }

  const fix = argv.includes("--fix");
  const json = argv.includes("--json");
  const warmth = argv.includes("--warmth");
  const strict = argv.includes("--strict"); // also gate on structural flags
  const targets = argv.filter((a) => !a.startsWith("--"));
  if (targets.length === 0) { console.error("detell: no files given"); process.exit(2); }

  const files = collect(targets);
  const results = files.map((f) => scanFile(f, { fix, warmth }));

  if (json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const r of results) {
      const rel = relative(process.cwd(), r.file) || r.file;
      const n = r.emDashesBefore;
      const bits = [];
      if (r.fixed) bits.push(`cleaned (${n} em-dash${n === 1 ? "" : "es"} + quotes fixed)`);
      else if (r.resolvable) bits.push(`${n} em-dash${n === 1 ? "" : "es"}/quote fix${n === 1 ? "" : "es"} available (run --fix)`);
      if (r.remaining && fix) bits.push(`${r.remaining} prose em-dash${r.remaining === 1 ? "" : "es"} unresolved (manual)`);
      if (r.flags.length) bits.push(`${r.flags.length} structural flag${r.flags.length === 1 ? "" : "s"}`);
      const clean = bits.length === 0;
      console.log(`${clean ? "  ok  " : "  ⚑   "}${rel}${clean ? "" : "  — " + bits.join(", ")}`);
      for (const f of r.flags) console.log(`         ${f.type}: ${f.hint}${f.snippet ? `  [${f.snippet}]` : ""}`);
    }
  }

  // Gate (exit 1) on the deterministic axis by default: unresolved/available
  // punctuation fixes. Structural flags are advisory unless --strict.
  const dirty = results.some((r) =>
    r.remaining > 0 || (!fix && r.resolvable) || (strict && r.flags.length > 0));
  process.exit(dirty ? 1 : 0);
}

main();
