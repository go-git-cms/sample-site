// Cache-bust the editor bundle in public/admin/index.html.
//
// `gitcms-ide build` emits app.js and app.css with deliberately stable names —
// three files a self-hoster can drop on any static host without thinking about
// chunk graphs. That is right for something deployed once, and wrong for
// something `make docs-dev` rebuilds on every run: the names never change, so a
// browser that cached app.js keeps running it, and the editor silently stays on
// the previous build's baked-in API_URL / WORKSPACE_ID / REPOSITORY_ID. The
// failure looks nothing like a caching problem — you get "Could not load
// repositories" from a workspace id you already deleted from cms.config.mjs.
//
// So each asset URL gets ?v=<hash of its own bytes>. Unchanged bundle, unchanged
// URL, still cached; rebuilt bundle, new URL, refetched. index.html itself is
// served no-store by src/pages/admin/[...path].astro, which is what makes the
// new URL reach the browser at all.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(process.argv[2] ?? "public/admin");
const indexFile = path.join(dir, "index.html");

if (!fs.existsSync(indexFile)) {
  console.error(`stamp-admin: no index.html in ${dir}`);
  process.exit(1);
}

const short = (file) =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 8);

let html = fs.readFileSync(indexFile, "utf8");
const stamped = [];

// Only the editor's own assets are rewritten. The font stylesheet is absolute
// and belongs to Google; anything else in there is not ours to version.
for (const asset of ["app.js", "app.css"]) {
  const file = path.join(dir, asset);
  if (!fs.existsSync(file)) continue;
  const v = short(file);
  // Match the asset with any existing ?v=, so re-stamping the same build is
  // idempotent rather than accumulating query strings.
  const re = new RegExp(`(/admin/${asset.replace(".", "\\.")})(\\?v=[a-f0-9]+)?`, "g");
  html = html.replace(re, `$1?v=${v}`);
  stamped.push(`${asset}?v=${v}`);
}

fs.writeFileSync(indexFile, html);
console.log(`stamped ${stamped.join(" ") || "(nothing)"}`);
