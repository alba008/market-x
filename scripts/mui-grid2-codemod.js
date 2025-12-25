#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const exts = new Set([".ts", ".tsx", ".js", ".jsx"]);
const root = process.argv[2] || process.cwd();

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", ".next", ".git", "build"].includes(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (exts.has(path.extname(ent.name))) out.push(p);
  }
  return out;
}

function fixImports(src) {
  let out = src;

  // Replace default Grid import to Grid2
  out = out.replace(
    /import\s+Grid\s+from\s+["']@mui\/material\/Grid["']\s*;\s*\n?/g,
    `import Grid from "@mui/material/Grid2";\n`
  );

  // Remove Grid from named imports and add Grid2 if needed
  out = out.replace(
    /import\s*\{\s*([^}]+)\s*\}\s*from\s*["']@mui\/material["']\s*;\s*\n?/g,
    (full, inner) => {
      const parts = inner.split(",").map(s => s.trim()).filter(Boolean);
      const filtered = parts.filter(p => p !== "Grid");
      const removed = filtered.length !== parts.length;

      const rebuilt = filtered.length
        ? `import { ${filtered.join(", ")} } from "@mui/material";\n`
        : "";

      const hasGrid2 = /import\s+Grid\s+from\s+["']@mui\/material\/Grid2["']/.test(out);
      const addGrid2 = removed && !hasGrid2 ? `import Grid from "@mui/material/Grid2";\n` : "";

      return addGrid2 + rebuilt;
    }
  );

  out = out.replace(/\n{3,}/g, "\n\n");
  return out;
}

function transformOpeningTag(tag) {
  // skip container grids
  if (/\bcontainer\b/.test(tag)) return tag;

  // only if it has item or breakpoint props
  if (!/\bitem\b/.test(tag) && !/\b(xs|sm|md|lg|xl)=/.test(tag)) return tag;

  // remove item
  let next = tag.replace(/\sitem(\s|>)/g, (m) => (m.endsWith(">") ? ">" : " "));

  // gather breakpoints
  const bp = ["xs", "sm", "md", "lg", "xl"];
  const found = {};
  for (const b of bp) {
    const re = new RegExp(`\\s${b}=(\\{[^}]*\\}|"[^"]*"|'[^']*')`, "g");
    const m = re.exec(next);
    if (m) {
      found[b] = m[1];
      next = next.replace(new RegExp(`\\s${b}=(\\{[^}]*\\}|"[^"]*"|'[^']*')`, "g"), "");
    }
  }

  const keys = Object.keys(found);
  if (keys.length === 0) return next.replace(/\s{2,}/g, " ").replace(/\s>/g, ">");

  if (/\bsize=/.test(next)) return next.replace(/\s{2,}/g, " ").replace(/\s>/g, ">");

  const parts = keys.map((k) => {
    const raw = found[k].trim();
    if (raw.startsWith("{") && raw.endsWith("}")) return `${k}: ${raw.slice(1, -1).trim()}`;
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      return `${k}: ${raw.slice(1, -1)}`;
    }
    return `${k}: ${raw}`;
  });

  next = next.replace(/^<Grid\b/, `<Grid size={{ ${parts.join(", ")} }}`);
  return next.replace(/\s{2,}/g, " ").replace(/\s>/g, ">");
}

function fixGridProps(src) {
  return src.replace(/<Grid\b[^>]*>/g, transformOpeningTag);
}

function transformFile(src) {
  let out = src;
  out = fixImports(out);
  out = fixGridProps(out);
  return out;
}

const files = fs.existsSync(root) && fs.statSync(root).isFile() ? [root] : walk(root);
let changed = 0;

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  if (!src.includes("<Grid")) continue;
  const out = transformFile(src);
  if (out !== src) {
    fs.writeFileSync(file, out, "utf8");
    console.log("fixed:", file);
    changed++;
  }
}

console.log(`\nDone. Files changed: ${changed}`);
