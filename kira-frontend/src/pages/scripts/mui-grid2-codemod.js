#!/usr/bin/env node
/**
 * MUI v7 Grid2 codemod:
 * - Ensure Grid is imported from "@mui/material/Grid2"
 * - Convert <Grid item xs={..} md={..}> into <Grid size={{ xs: .., md: .. }}>
 * - Remove `item`
 * - Leave <Grid container ...> alone
 *
 * Usage:
 *   node scripts/mui-grid2-codemod.js kira-frontend/src
 *   node scripts/mui-grid2-codemod.js kira-frontend/src/pages/MarketplaceV2.tsx
 */

const fs = require("fs");
const path = require("path");

const exts = new Set([".ts", ".tsx", ".js", ".jsx"]);
const root = process.argv[2] || process.cwd();

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (
      ent.name === "node_modules" ||
      ent.name === "dist" ||
      ent.name === ".next" ||
      ent.name === ".git" ||
      ent.name === "build"
    ) {
      continue;
    }
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (exts.has(path.extname(ent.name))) out.push(p);
  }
  return out;
}

function hasGridUsage(src) {
  return src.includes("<Grid") || src.includes("Grid2") || src.includes(" Grid ");
}

/**
 * Import fixes:
 * 1) Replace default import from "@mui/material/Grid" -> "@mui/material/Grid2"
 * 2) If importing Grid in { } from "@mui/material", remove it from braces and add default Grid2 import.
 * 3) If Grid2 default import already exists, avoid duplicating.
 */
function fixImports(src) {
  let out = src;

  const hasGrid2Default = /import\s+Grid\s+from\s+["']@mui\/material\/Grid2["']\s*;/.test(out);

  // Case A: import Grid from "@mui/material/Grid";
  out = out.replace(
    /import\s+Grid\s+from\s+["']@mui\/material\/Grid["']\s*;\s*\n?/g,
    () => (hasGrid2Default ? "" : `import Grid from "@mui/material/Grid2";\n`)
  );

  // Case B: import Grid from "@mui/material";  (rare)
  out = out.replace(
    /import\s+Grid\s+from\s+["']@mui\/material["']\s*;\s*\n?/g,
    () => (hasGrid2Default ? "" : `import Grid from "@mui/material/Grid2";\n`)
  );

  // Case C: import { ..., Grid, ... } from "@mui/material";
  // Remove Grid from the named import list
  const namedMuiImportRe = /import\s*\{\s*([^}]+)\s*\}\s*from\s*["']@mui\/material["']\s*;\s*\n?/g;
  out = out.replace(namedMuiImportRe, (full, inner) => {
    const parts = inner
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const filtered = parts.filter((p) => p !== "Grid" && !p.startsWith("Grid as "));
    const removedGrid = filtered.length !== parts.length;

    // Rebuild the named import (if any left)
    const rebuilt = filtered.length ? `import { ${filtered.join(", ")} } from "@mui/material";\n` : "";

    // Add Grid2 default import if we removed Grid and don't already have it
    const addGrid2 = removedGrid && !/import\s+Grid\s+from\s+["']@mui\/material\/Grid2["']/.test(out)
      ? `import Grid from "@mui/material/Grid2";\n`
      : "";

    return addGrid2 + rebuilt;
  });

  // If Grid is used but no Grid import exists at all, we won't guess.
  // (This codemod assumes you already import Grid somewhere; it standardizes it.)

  // Clean up multiple blank lines introduced
  out = out.replace(/\n{3,}/g, "\n\n");
  return out;
}

/**
 * Convert opening tags like:
 * <Grid item xs={12} md={6} ...>
 * to:
 * <Grid size={{ xs: 12, md: 6 }} ...>
 *
 * Notes:
 * - Does NOT touch tags with `container`
 * - Removes `item`
 * - Removes xs/sm/md/lg/xl props and builds size object
 * - Leaves existing size= alone
 */
function transformOpeningTag(tag) {
  if (!/^<Grid\b/.test(tag)) return tag;

  // Skip container grids
  if (/\bcontainer\b/.test(tag)) return tag;

  // Only transform if it has item or breakpoint props
  if (!/\bitem\b/.test(tag) && !/\b(xs|sm|md|lg|xl)=/.test(tag)) return tag;

  // If it already has size=, just remove item and breakpoint props (to reduce conflict)
  const alreadyHasSize = /\bsize=/.test(tag);

  // Remove `item`
  let next = tag.replace(/\sitem(\s|>)/g, (m) => (m.endsWith(">") ? ">" : " "));

  // Gather breakpoint props
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
  if (keys.length === 0) {
    // only item removed
    return next.replace(/\s{2,}/g, " ").replace(/\s>/g, ">");
  }

  // If size already exists, don't inject a second size; just clean up and return
  if (alreadyHasSize) {
    return next.replace(/\s{2,}/g, " ").replace(/\s>/g, ">");
  }

  // Build size object
  const parts = keys.map((k) => {
    const raw = found[k].trim();
    if (raw.startsWith("{") && raw.endsWith("}")) return `${k}: ${raw.slice(1, -1).trim()}`;
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      return `${k}: ${raw.slice(1, -1)}`;
    }
    return `${k}: ${raw}`;
  });

  // Inject size at the start
  next = next.replace(/^<Grid\b/, `<Grid size={{ ${parts.join(", ")} }}`);

  return next.replace(/\s{2,}/g, " ").replace(/\s>/g, ">");
}

function fixGridProps(src) {
  return src.replace(/<Grid\b[^>]*>/g, (tag) => transformOpeningTag(tag));
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
  if (!hasGridUsage(src)) continue;

  const out = transformFile(src);
  if (out !== src) {
    fs.writeFileSync(file, out, "utf8");
    changed++;
    console.log("fixed:", file);
  }
}

console.log(`\nDone. Files changed: ${changed}`);
console.log("Next: run `npm run build` inside kira-frontend, then commit + push.");
