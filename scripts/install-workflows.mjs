#!/usr/bin/env node
/**
 * Copies the shipped GitHub Actions workflows into `.github/workflows/`.
 *
 * They live in `automation/github-workflows/` because the automation token that
 * scaffolded this repo is not allowed to create files under `.github/workflows`
 * (GitHub requires the `workflows` OAuth scope for that). Running this once with
 * your own credentials activates:
 *
 *   • upstream-sync.yml — pulls MovieBox-Tui changes every 3h and redeploys
 *   • ci.yml            — typecheck + lint + build on every push/PR
 *
 * Usage:
 *   npm run install:workflows
 *   git add .github/workflows && git commit -m "ci: enable workflows" && git push
 */
import { readdirSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "automation", "github-workflows");
const DEST = path.join(ROOT, ".github", "workflows");

if (!existsSync(SRC)) {
  console.error(`[install-workflows] missing source directory: ${SRC}`);
  process.exit(1);
}

mkdirSync(DEST, { recursive: true });
const files = readdirSync(SRC).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
for (const file of files) {
  copyFileSync(path.join(SRC, file), path.join(DEST, file));
  console.log(`[install-workflows] installed .github/workflows/${file}`);
}

console.log(`
Next steps:
  git add .github/workflows
  git commit -m "ci: enable upstream sync + CI workflows"
  git push

Then: GitHub → Actions → "Upstream sync (MovieBox-Tui)" → Run workflow.
`);
