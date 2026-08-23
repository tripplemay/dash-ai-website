// Copy the small Better Auth dependency closure needed by seed.mjs into a
// standalone release. Next bundles Better Auth for request handlers, but a
// separately executed migration/seed script still resolves normal packages.
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = path.resolve(process.argv[2] || path.join(repoRoot, ".seed-runtime-node_modules"));
const initialPackages = ["better-auth", "better-sqlite3"];

function packageRoot(name, fromDirectory) {
  const resolver = createRequire(path.join(fromDirectory, "package.json"));
  let entry;
  try {
    entry = resolver.resolve(name);
  } catch (error) {
    const wrapped = new Error(`cannot resolve seed runtime dependency: ${name}`);
    wrapped.cause = error;
    throw wrapped;
  }

  let current = path.dirname(entry);
  while (true) {
    const packageFile = path.join(current, "package.json");
    try {
      const metadata = JSON.parse(readFileSync(packageFile, "utf8"));
      if (metadata.name === name) return { directory: current, metadata };
    } catch {
      // Keep walking until the package boundary is found.
    }
    const parent = path.dirname(current);
    if (parent === current) throw new Error(`package metadata not found: ${name}`);
    current = parent;
  }
}

const queue = initialPackages.map((name) => ({
  name,
  fromDirectory: repoRoot,
  parentTarget: null,
  optional: false,
}));
const destinationSources = new Map();
const copied = [];

await fs.mkdir(destination, { recursive: true });

while (queue.length) {
  const item = queue.shift();
  let resolved;
  try {
    resolved = packageRoot(item.name, item.fromDirectory);
  } catch (error) {
    if (item.optional) continue;
    throw error;
  }

  const source = resolved.directory;
  const target = item.parentTarget
    ? path.join(item.parentTarget, "node_modules", item.name)
    : path.join(destination, item.name);
  const existing = destinationSources.get(target);
  if (existing) {
    if (existing !== source) throw new Error(`dependency target collision: ${target}`);
    continue;
  }

  // If an identical package is already visible from an ancestor, Node's
  // normal resolution will use it and no nested copy is needed. This also
  // prevents cyclic dependency graphs from growing indefinitely.
  let ancestor = path.dirname(target);
  let reuse = false;
  while (ancestor.startsWith(destination)) {
    const candidate = path.join(ancestor, "node_modules", item.name);
    if (destinationSources.get(candidate) === source) {
      reuse = true;
      break;
    }
    if (ancestor === destination) break;
    ancestor = path.dirname(ancestor);
  }
  if (reuse) continue;

  destinationSources.set(target, source);
  await fs.rm(target, { recursive: true, force: true });
  await fs.cp(source, target, {
    recursive: true,
    dereference: true,
    filter: (entry) => path.basename(entry) !== "node_modules",
  });
  copied.push({ name: item.name, version: resolved.metadata.version });

  const dependencies = Object.keys(resolved.metadata.dependencies || {});
  const optionalDependencies = Object.keys(resolved.metadata.optionalDependencies || {});
  for (const dependency of dependencies) {
    queue.push({ name: dependency, fromDirectory: source, parentTarget: target, optional: false });
  }
  for (const dependency of optionalDependencies) {
    queue.push({ name: dependency, fromDirectory: source, parentTarget: target, optional: true });
  }
}

console.log(`seed runtime packages copied: ${copied.length}`);
