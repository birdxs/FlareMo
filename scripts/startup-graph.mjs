/**
 * Rank the worker's startup graph by source bytes.
 *
 * Walks *static* import edges only. A `wrangler` sourcemap lists a module
 * whenever its code is present in the uploaded file, which stays true for a
 * lazily-imported internal module and therefore cannot answer "does this run
 * at isolate startup". The discriminator is `kind === "import-statement"`.
 *
 * Sanity rule: any change to this script must be re-checked against packages
 * known to be on the graph (drizzle-orm, hono, better-auth). A run that reports
 * nothing at all is broken, not a clean bill of health.
 *
 * Usage: pnpm startup-graph [--pkg <name>] [--trace <package>]
 */
import { statSync } from "node:fs";
import { createRequire } from "node:module";

// esbuild is not a direct dependency of every workspace package, so resolve it
// through the root rather than hardcoding a pnpm store path that breaks on the
// next version bump.
const { build } = createRequire(import.meta.url)("esbuild");

const entry = "apps/worker/src/index.ts";
const only = process.argv.includes("--pkg")
  ? process.argv[process.argv.indexOf("--pkg") + 1]
  : null;

const result = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  metafile: true,
  format: "esm",
  platform: "neutral",
  conditions: ["worker", "browser", "import", "default"],
  mainFields: ["module", "main"],
  external: ["cloudflare:*", "node:*", "bufferutil", "utf-8-validate"],
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "error",
  tsconfig: "apps/worker/tsconfig.json",
});

const inputs = result.metafile.inputs;
const seen = new Set();

(function walk(input) {
  if (seen.has(input)) return;
  seen.add(input);
  for (const edge of inputs[input]?.imports ?? []) {
    if (edge.kind !== "import-statement") continue;
    walk(edge.path);
  }
})(entry);

// Attribute each module to its owning package, then sum. pnpm store paths look
// like node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>/... so the package name
// has to be taken from the segment after the final node_modules, not the store
// directory (which carries the version).
function packageOf(path) {
  if (path.startsWith("node_modules/.pnpm/")) {
    const tail = path.split("node_modules/").pop();
    return (tail ?? path).split("/")[0] ?? path;
  }
  if (path.startsWith("node_modules/")) {
    return path.split("node_modules/")[1]?.split("/")[0] ?? path;
  }
  if (path.startsWith("apps/") || path.startsWith("packages/")) {
    const parts = path.split("/");
    return `${parts[0]}/${parts[1]}`;
  }
  return "(entry)";
}

const byPackage = new Map();
let total = 0;
for (const input of seen) {
  let bytes = 0;
  try {
    bytes = statSync(input).size;
  } catch {
    continue;
  }
  total += bytes;
  const pkg = packageOf(input);
  const entryFor = byPackage.get(pkg) ?? { bytes: 0, files: 0 };
  entryFor.bytes += bytes;
  entryFor.files += 1;
  byPackage.set(pkg, entryFor);
}

const rows = [...byPackage.entries()].sort((a, b) => b[1].bytes - a[1].bytes);
const filter = (label, list) => {
  const filtered = only ? list.filter(([k]) => k.includes(only)) : list;
  console.log(`\n== ${label} (${filtered.length} packages) ==`);
  let sum = 0;
  for (const [pkg, { bytes, files }] of filtered.slice(0, 30)) {
    console.log(
      `${String(Math.round(bytes / 1024)).padStart(7)} KiB  ${String(files).padStart(4)} files  ${pkg}`,
    );
    sum += bytes;
  }
  console.log(
    `${String(Math.round(sum / 1024)).padStart(7)} KiB  total listed`,
  );
};

console.log(
  `static-reachable modules: ${seen.size}, total source: ${(total / 1024 / 1024).toFixed(2)} MiB`,
);
filter("by package", rows);

// Optional: report the direct static importers of a given package.
const trace = process.argv.includes("--trace")
  ? process.argv[process.argv.indexOf("--trace") + 1]
  : null;
if (trace) {
  console.log(`\n== direct static importers of ${trace} ==`);
  for (const [input, meta] of Object.entries(inputs)) {
    for (const edge of meta.imports ?? []) {
      if (edge.kind !== "import-statement") continue;
      if (packageOf(edge.path) !== trace) continue;
      console.log(
        `  ${input}\n    -> ${edge.path}${edge.original ? `  [as ${edge.original}]` : ""}`,
      );
    }
  }
}
console.log(
  `\nsanity: hono/drizzle-orm/better-auth on graph? ${[
    "hono",
    "drizzle-orm",
    "better-auth",
  ]
    .map(
      (p) =>
        `${p}=${seen.has([...seen].find((s) => packageOf(s) === p)) ? "yes" : "NO"}`,
    )
    .join(" ")}`,
);
