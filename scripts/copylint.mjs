#!/usr/bin/env node
// Copy lint (implementation plan §4.2): fail CI when banned investment
// language (PRD §1.3) appears in user-facing UI source. The banned list
// lives in packages/core/src/copy.ts so product and lint share one source.

import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const UI_DIRS = [join(ROOT, "apps/web/src")];

const copySource = await readFile(join(ROOT, "packages/core/src/copy.ts"), "utf8");
const bannedBlock = copySource.match(/BANNED_COPY_TERMS = \[([\s\S]*?)\]/);
if (!bannedBlock) {
  console.error("copylint: could not read BANNED_COPY_TERMS from packages/core/src/copy.ts");
  process.exit(2);
}
const banned = [...bannedBlock[1].matchAll(/"([^"]+)"/g)].map((m) => m[1].toLowerCase());

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.(tsx|ts)$/.test(entry.name)) yield path;
  }
}

let failures = 0;
for (const dir of UI_DIRS) {
  for await (const file of walk(dir)) {
    const text = (await readFile(file, "utf8")).toLowerCase();
    for (const term of banned) {
      let idx = text.indexOf(term);
      while (idx !== -1) {
        const line = text.slice(0, idx).split("\n").length;
        console.error(`copylint: banned term "${term}" in ${relative(ROOT, file)}:${line}`);
        failures += 1;
        idx = text.indexOf(term, idx + term.length);
      }
    }
  }
}

if (failures > 0) {
  console.error(`\ncopylint: ${failures} violation(s). Use the language in packages/core/src/copy.ts (PRD §1.4).`);
  process.exit(1);
}
console.log("copylint: clean");
