#!/usr/bin/env node

/**
 * Synchronize the approved CORECOORD 2026.1 web/manual assets from the
 * adjacent dashpr brand source into the tracked deploy tree.
 *
 * The source tree is intentionally not vendored wholesale. Keeping this
 * allowlist here prevents campaign/review material from entering a release.
 */

import {
  createHash,
} from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEST_ROOT = path.join(REPO_ROOT, "deploy", "brand", "2026.1");
const DEFAULT_SOURCE_ROOT = path.resolve(REPO_ROOT, "..", "dashpr", "品牌商标-芯坐标");
const RELEASE = "2026.1";
const BRAND = "CORECOORD";
const CHUNK_ROOT = path.join(REPO_ROOT, "deploy", "brand-chunks", RELEASE);
const CHUNK_MANIFEST_PATH = path.join(CHUNK_ROOT, "manifest.json");
const FONT_CHUNK_BYTES = 4 * 1024 * 1024;
const FONT_PATHS = [
  "vi-system-2026/deliverables/fonts/NotoSansMonoCJKsc-VF.ttf",
  "vi-system-2026/deliverables/fonts/NotoSansSC-VF.ttf",
];
const GENERATED_FILES = new Set(["README.md", "manifest.json", "checksums.sha256", "runtime-map.json"]);
const FORBIDDEN_PATH = /(?:^|[\\/])campaigns?(?:[\\/]|$)|maker/i;
const comparePath = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

const REQUIRED_FILES = [
  ["vi-system-2026/manual/index.html", "vi-system-2026/manual/index.html", "manual"],
  ["vi-system-2026/manual/manual.css", "vi-system-2026/manual/manual.css", "manual"],
  [
    "vi-system-2026/manual/output/pdf/CORECOORD-VI-System-2026.1-zh-CN.pdf",
    "vi-system-2026/manual/output/pdf/CORECOORD-VI-System-2026.1-zh-CN.pdf",
    "guide-document",
  ],
  [
    "vi-system-2026/deliverables/assets/svg/corecoord-coordinate-field-light.svg",
    "vi-system-2026/deliverables/assets/svg/corecoord-coordinate-field-light.svg",
    "graphic",
  ],
  [
    "vi-system-2026/deliverables/assets/svg/corecoord-stage-palette.svg",
    "vi-system-2026/deliverables/assets/svg/corecoord-stage-palette.svg",
    "graphic",
  ],
  [
    "vi-system-2026/deliverables/tokens/corecoord.css",
    "vi-system-2026/deliverables/tokens/corecoord.css",
    "token",
  ],
  [
    "vi-system-2026/deliverables/tokens/corecoord.tokens.json",
    "vi-system-2026/deliverables/tokens/corecoord.tokens.json",
    "token",
  ],
  [
    "vi-system-2026/deliverables/fonts/NotoSansSC-VF.ttf",
    "vi-system-2026/deliverables/fonts/NotoSansSC-VF.ttf",
    "font",
  ],
  [
    "vi-system-2026/deliverables/fonts/NotoSansMonoCJKsc-VF.ttf",
    "vi-system-2026/deliverables/fonts/NotoSansMonoCJKsc-VF.ttf",
    "font",
  ],
  [
    "vi-system-2026/deliverables/fonts/OFL-1.1.txt",
    "vi-system-2026/deliverables/fonts/OFL-1.1.txt",
    "font-license",
  ],
  [
    "vi-system-2026/deliverables/fonts/README.md",
    "vi-system-2026/deliverables/fonts/README.md",
    "font-documentation",
  ],
];

function usage() {
  console.log(`Usage:
  node scripts/sync-brand-assets.mjs sync [--source <brand-root>] [--no-clean]
  node scripts/sync-brand-assets.mjs assemble
  node scripts/sync-brand-assets.mjs check [--source <brand-root>]
  node scripts/sync-brand-assets.mjs materialize [--resource-root <public-root>]

The default source is ../dashpr/品牌商标-芯坐标 relative to the repository.
Set CORECOORD_BRAND_SOURCE when the brand package is elsewhere.
`);
}

function parseArgs(argv) {
  const args = [...argv];
  let command = "sync";
  if (args[0] && !args[0].startsWith("-")) command = args.shift();

  let sourceRoot = process.env.CORECOORD_BRAND_SOURCE || DEFAULT_SOURCE_ROOT;
  let sourceProvided = Boolean(process.env.CORECOORD_BRAND_SOURCE);
  let resourceRoot = process.env.CORECOORD_RESOURCE_ROOT || null;
  let clean = true;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--source") {
      sourceRoot = args[index + 1];
      if (!sourceRoot) throw new Error("--source requires a directory");
      sourceProvided = true;
      index += 1;
    } else if (arg === "--resource-root") {
      resourceRoot = args[index + 1];
      if (!resourceRoot) throw new Error("--resource-root requires a directory");
      index += 1;
    } else if (arg === "--no-clean") {
      clean = false;
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (command !== "sync" && command !== "assemble" && command !== "check" && command !== "materialize") {
    throw new Error(`Unknown command: ${command}`);
  }

  return {
    command,
    sourceRoot: path.resolve(sourceRoot),
    sourceProvided,
    resourceRoot: resourceRoot ? path.resolve(resourceRoot) : null,
    clean,
  };
}

function listFiles(sourceRoot, relativeDirectory, extensionPattern, kind, destinationDirectory = relativeDirectory) {
  const absoluteDirectory = path.join(sourceRoot, relativeDirectory);
  if (!existsSync(absoluteDirectory)) {
    throw new Error(`Missing source directory: ${absoluteDirectory}`);
  }

  return readdirSync(absoluteDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extensionPattern.test(entry.name))
    .map((entry) => {
      const source = path.posix.join(relativeDirectory, entry.name);
      const destination = path.posix.join(destinationDirectory, entry.name);
      return [source, destination, kind];
    })
    .sort((left, right) => comparePath(left[0], right[0]));
}

function buildEntries(sourceRoot) {
  const entries = [
    ...listFiles(sourceRoot, "logo-final-2026/vector", /\.svg$/i, "logo"),
    ...listFiles(sourceRoot, "logo-final-2026/icons", /\.(?:png|ico)$/i, "icon"),
    ...listFiles(
      sourceRoot,
      "vi-system-2026/deliverables/previews",
      /\.png$/i,
      "preview",
      "vi-system-2026/deliverables/previews",
    ),
    ...listFiles(
      sourceRoot,
      "vi-system-2026/deliverables/templates/course",
      /\.svg$/i,
      "course-template",
    ),
    ...listFiles(
      sourceRoot,
      "vi-system-2026/deliverables/templates/print",
      /\.svg$/i,
      "print-template",
    ),
    ...listFiles(
      sourceRoot,
      "vi-system-2026/deliverables/templates/social",
      /\.svg$/i,
      "social-template",
    ),
    ...listFiles(
      sourceRoot,
      "vi-system-2026/deliverables/templates/video",
      /\.svg$/i,
      "video-template",
    ),
    ...REQUIRED_FILES,
  ].map(([source, destination, kind]) => ({ source, destination, kind }));

  const destinations = new Set();
  for (const entry of entries) {
    if (FORBIDDEN_PATH.test(entry.source) || FORBIDDEN_PATH.test(entry.destination)) {
      throw new Error(`Refusing forbidden campaign/review asset: ${entry.source}`);
    }
    if (destinations.has(entry.destination)) {
      throw new Error(`Duplicate destination in asset allowlist: ${entry.destination}`);
    }
    destinations.add(entry.destination);
  }
  return entries;
}

function resolveInside(root, relativePath) {
  const absoluteRoot = path.resolve(root);
  const absolutePath = path.resolve(root, relativePath);
  if (absolutePath !== absoluteRoot && !absolutePath.startsWith(`${absoluteRoot}${path.sep}`)) {
    throw new Error(`Path escapes source root: ${relativePath}`);
  }
  return absolutePath;
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256(filePath) {
  return sha256Bytes(readFileSync(filePath));
}

function writeFontChunks(records) {
  const recordByPath = new Map(records.map((record) => [record.path, record]));
  rmSync(CHUNK_ROOT, { recursive: true, force: true });
  mkdirSync(CHUNK_ROOT, { recursive: true });

  const fonts = FONT_PATHS.map((fontPath) => {
    const record = recordByPath.get(fontPath);
    if (!record) throw new Error(`Font is missing from the brand manifest: ${fontPath}`);
    const sourcePath = resolveInside(DEST_ROOT, fontPath);
    const compressed = gzipSync(readFileSync(sourcePath), { level: 9, mtime: 0 });
    const chunks = [];
    for (let offset = 0, index = 0; offset < compressed.length; offset += FONT_CHUNK_BYTES, index += 1) {
      const chunk = compressed.subarray(offset, Math.min(offset + FONT_CHUNK_BYTES, compressed.length));
      const chunkPath = path.posix.join(
        "fonts",
        `${path.basename(fontPath)}.gz.part-${String(index + 1).padStart(3, "0")}`,
      );
      const absolutePath = resolveInside(CHUNK_ROOT, chunkPath);
      mkdirSync(path.dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, chunk);
      chunks.push({ path: chunkPath, bytes: chunk.length, sha256: sha256Bytes(chunk) });
    }
    return {
      path: fontPath,
      bytes: record.bytes,
      sha256: record.sha256,
      compression: "gzip",
      compressedBytes: compressed.length,
      chunks,
    };
  });

  const manifest = {
    schemaVersion: 1,
    brand: BRAND,
    release: RELEASE,
    chunkBytes: FONT_CHUNK_BYTES,
    generatedBy: "scripts/sync-brand-assets.mjs",
    fonts,
  };
  writeJson(CHUNK_MANIFEST_PATH, manifest);
  return manifest;
}

function readFontChunkManifest() {
  if (!existsSync(CHUNK_MANIFEST_PATH) || !lstatSync(CHUNK_MANIFEST_PATH).isFile()) {
    throw new Error(`Missing ${path.relative(REPO_ROOT, CHUNK_MANIFEST_PATH)}; run brand:sync first`);
  }
  try {
    return JSON.parse(readFileSync(CHUNK_MANIFEST_PATH, "utf8"));
  } catch (error) {
    throw new Error(`Invalid font chunk manifest: ${error.message}`);
  }
}

function assembleFonts() {
  const manifest = readFontChunkManifest();
  if (
    manifest.brand !== BRAND
    || manifest.release !== RELEASE
    || manifest.schemaVersion !== 1
    || manifest.chunkBytes !== FONT_CHUNK_BYTES
    || !Array.isArray(manifest.fonts)
    || manifest.fonts.length !== FONT_PATHS.length
  ) {
    throw new Error("Font chunk manifest contract does not match CORECOORD 2026.1");
  }

  const expectedChunkFiles = new Set(["manifest.json"]);
  const seenFonts = new Set();
  for (const font of manifest.fonts) {
    if (!FONT_PATHS.includes(font.path) || seenFonts.has(font.path)) {
      throw new Error(`Invalid or duplicate font chunk target: ${font.path || "(empty)"}`);
    }
    seenFonts.add(font.path);
    if (
      font.compression !== "gzip"
      || !Number.isInteger(font.bytes)
      || !Number.isInteger(font.compressedBytes)
      || !Array.isArray(font.chunks)
      || font.chunks.length === 0
    ) {
      throw new Error(`Invalid chunk metadata: ${font.path}`);
    }

    const compressedChunks = [];
    let compressedBytes = 0;
    for (const chunk of font.chunks) {
      if (!chunk.path || expectedChunkFiles.has(chunk.path)) {
        throw new Error(`Invalid or duplicate font chunk path: ${chunk.path || "(empty)"}`);
      }
      expectedChunkFiles.add(chunk.path);
      const chunkPath = resolveInside(CHUNK_ROOT, chunk.path);
      if (!existsSync(chunkPath) || !lstatSync(chunkPath).isFile()) {
        throw new Error(`Missing font chunk: ${chunk.path}`);
      }
      const chunkBytes = readFileSync(chunkPath);
      if (chunkBytes.length !== chunk.bytes || sha256Bytes(chunkBytes) !== chunk.sha256) {
        throw new Error(`Font chunk checksum mismatch: ${chunk.path}`);
      }
      compressedChunks.push(chunkBytes);
      compressedBytes += chunkBytes.length;
    }
    if (compressedBytes !== font.compressedBytes) {
      throw new Error(`Font compressed byte count mismatch: ${font.path}`);
    }

    let content;
    try {
      content = gunzipSync(Buffer.concat(compressedChunks));
    } catch (error) {
      throw new Error(`Cannot decompress font ${font.path}: ${error.message}`);
    }
    if (content.length !== font.bytes || sha256Bytes(content) !== font.sha256) {
      throw new Error(`Assembled font checksum mismatch: ${font.path}`);
    }
    const targetPath = resolveInside(DEST_ROOT, font.path);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, content);
  }
  if (seenFonts.size !== FONT_PATHS.length) throw new Error("Font chunk manifest does not cover every approved font");

  const actualChunkFiles = collectFiles(CHUNK_ROOT).sort(comparePath);
  const expected = [...expectedChunkFiles].sort(comparePath);
  if (JSON.stringify(actualChunkFiles) !== JSON.stringify(expected)) {
    throw new Error("Font chunk directory contains missing or unexpected files");
  }
  return manifest;
}

function inspectEntries(sourceRoot, entries) {
  return entries.map((entry) => {
    const sourcePath = resolveInside(sourceRoot, entry.source);
    if (!existsSync(sourcePath) || !lstatSync(sourcePath).isFile()) {
      throw new Error(`Missing source file: ${sourcePath}`);
    }
    const stat = lstatSync(sourcePath);
    return {
      path: entry.destination,
      source: entry.source,
      kind: entry.kind,
      bytes: stat.size,
      sha256: sha256(sourcePath),
    };
  }).sort((left, right) => comparePath(left.path, right.path));
}

function manifestFor(records) {
  return {
    schemaVersion: 1,
    brand: BRAND,
    release: RELEASE,
    sourcePackage: "品牌商标-芯坐标",
    sourceReleases: ["Logo Final 2026.1", "VI System 2026.1"],
    generatedBy: "scripts/sync-brand-assets.mjs",
    staticEntrypoints: {
      manual: "/assets/brand/corecoord/2026.1/vi-system-2026/manual/index.html",
      tokenCss: "/assets/brand/corecoord/2026.1/vi-system-2026/deliverables/tokens/corecoord.css",
    },
    policy: {
      approvedOnly: true,
      excluded: ["vi-system-2026/campaigns/", "MAKER review poster assets"],
    },
    files: records,
  };
}

function checksumText(records) {
  return `${records.map((record) => `${record.sha256}  ${record.path}`).join("\n")}\n`;
}

function runtimeCopy(record, fileKey) {
  return {
    sourcePath: record.path,
    fileKey,
    bytes: record.bytes,
    sha256: record.sha256,
  };
}

function buildRuntimeMap(records) {
  const map = {
    schemaVersion: 1,
    brand: BRAND,
    release: RELEASE,
    staticBase: "/assets/brand/corecoord/2026.1",
    resourceBase: "/files/corecoord",
    generatedBy: "scripts/sync-brand-assets.mjs",
    staticEntrypoints: {
      manual: "/assets/brand/corecoord/2026.1/vi-system-2026/manual/index.html",
      tokenCss: "/assets/brand/corecoord/2026.1/vi-system-2026/deliverables/tokens/corecoord.css",
    },
    categories: {
      "brand-system": { root: "files/corecoord/brand-system", copies: [] },
      guides: { root: "files/corecoord/guides", copies: [] },
      "visual-previews": { root: "files/corecoord/visual-previews", copies: [] },
      "course-templates": { root: "files/corecoord/course-templates", copies: [] },
    },
    excluded: ["vi-system-2026/campaigns/", "MAKER review poster assets"],
  };

  for (const record of records) {
    if (record.kind === "logo") {
      map.categories["brand-system"].copies.push(
        runtimeCopy(record, `files/corecoord/brand-system/logo/${path.basename(record.path)}`),
      );
    } else if (record.kind === "icon") {
      map.categories["brand-system"].copies.push(
        runtimeCopy(record, `files/corecoord/brand-system/icons/${path.basename(record.path)}`),
      );
    } else if (record.kind === "token" || record.kind === "graphic") {
      map.categories["brand-system"].copies.push(
        runtimeCopy(record, `files/corecoord/brand-system/${record.kind}/${path.basename(record.path)}`),
      );
    } else if (record.kind === "guide-document") {
      map.categories.guides.copies.push(
        runtimeCopy(record, `files/corecoord/guides/${path.basename(record.path)}`),
      );
    } else if (record.kind === "preview") {
      map.categories["visual-previews"].copies.push(
        runtimeCopy(record, `files/corecoord/visual-previews/${path.basename(record.path)}`),
      );
    } else if (record.kind.endsWith("-template")) {
      const templateGroup = record.kind.slice(0, -"-template".length);
      map.categories["course-templates"].copies.push(
        runtimeCopy(record, `files/corecoord/course-templates/${templateGroup}/${path.basename(record.path)}`),
      );
    }
  }

  for (const category of Object.values(map.categories)) {
    category.copies.sort((left, right) => comparePath(left.fileKey, right.fileKey));
  }
  return map;
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function removeGeneratedTree() {
  mkdirSync(DEST_ROOT, { recursive: true });
  for (const name of readdirSync(DEST_ROOT)) {
    if (!GENERATED_FILES.has(name)) {
      rmSync(path.join(DEST_ROOT, name), { recursive: true, force: true });
    }
  }
}

function syncAssets(sourceRoot, clean) {
  const entries = buildEntries(sourceRoot);
  const records = inspectEntries(sourceRoot, entries);

  if (clean) removeGeneratedTree();
  else mkdirSync(DEST_ROOT, { recursive: true });

  for (const record of records) {
    const sourcePath = resolveInside(sourceRoot, record.source);
    const destinationPath = resolveInside(DEST_ROOT, record.path);
    mkdirSync(path.dirname(destinationPath), { recursive: true });
    cpSync(sourcePath, destinationPath);
  }

  writeJson(path.join(DEST_ROOT, "manifest.json"), manifestFor(records));
  writeFileSync(path.join(DEST_ROOT, "checksums.sha256"), checksumText(records), "utf8");
  writeJson(path.join(DEST_ROOT, "runtime-map.json"), buildRuntimeMap(records));
  writeFontChunks(records);

  const totalBytes = records.reduce((sum, record) => sum + record.bytes, 0);
  console.log(`Synced ${records.length} CORECOORD ${RELEASE} assets (${totalBytes} bytes) to ${path.relative(REPO_ROOT, DEST_ROOT)}`);
}

function collectFiles(root, relativeDirectory = "") {
  const directory = path.join(root, relativeDirectory);
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    const absolutePath = path.join(root, relativePath);
    const stat = lstatSync(absolutePath);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) {
      throw new Error(`Managed brand tree contains a link or special file: ${relativePath}`);
    }
    if (stat.isDirectory()) return collectFiles(root, relativePath);
    return [relativePath];
  });
}

function checkAssets(sourceRoot) {
  const chunkManifest = assembleFonts();
  const manifestPath = path.join(DEST_ROOT, "manifest.json");
  const checksumsPath = path.join(DEST_ROOT, "checksums.sha256");
  const runtimeMapPath = path.join(DEST_ROOT, "runtime-map.json");
  if (!existsSync(manifestPath)) throw new Error(`Missing ${path.relative(REPO_ROOT, manifestPath)}; run brand:sync first`);
  for (const generated of GENERATED_FILES) {
    const generatedPath = path.join(DEST_ROOT, generated);
    if (existsSync(generatedPath) && !lstatSync(generatedPath).isFile()) {
      throw new Error(`Generated brand metadata must be a regular file: ${generated}`);
    }
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid manifest.json: ${error.message}`);
  }
  if (manifest.brand !== BRAND || manifest.release !== RELEASE || manifest.schemaVersion !== 1) {
    throw new Error("Manifest brand, release, or schema version does not match the checked-in contract");
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error("Manifest has no files");
  }

  for (const font of chunkManifest.fonts) {
    const record = manifest.files.find((candidate) => candidate.path === font.path);
    if (!record || record.bytes !== font.bytes || record.sha256 !== font.sha256) {
      throw new Error(`Font chunk metadata does not match manifest: ${font.path}`);
    }
  }

  const expected = new Set();
  for (const record of manifest.files) {
    if (!record.path || expected.has(record.path)) throw new Error(`Duplicate or empty manifest path: ${record.path}`);
    if (FORBIDDEN_PATH.test(record.path) || FORBIDDEN_PATH.test(record.source || "")) {
      throw new Error(`Forbidden campaign/review asset in manifest: ${record.path}`);
    }
    expected.add(record.path);
    const filePath = resolveInside(DEST_ROOT, record.path);
    if (!existsSync(filePath) || !lstatSync(filePath).isFile()) throw new Error(`Missing managed asset: ${record.path}`);
    const stat = lstatSync(filePath);
    const actualHash = sha256(filePath);
    if (stat.size !== record.bytes || actualHash !== record.sha256) {
      throw new Error(`Checksum mismatch: ${record.path}`);
    }
    if (sourceRoot) {
      const sourcePath = resolveInside(sourceRoot, record.source);
      if (!existsSync(sourcePath) || !lstatSync(sourcePath).isFile() || sha256(sourcePath) !== record.sha256) {
        throw new Error(`Source changed; re-run sync: ${record.source}`);
      }
    }
  }

  const actualFiles = collectFiles(DEST_ROOT).filter((file) => !GENERATED_FILES.has(file));
  const extras = actualFiles.filter((file) => !expected.has(file));
  const missing = [...expected].filter((file) => !actualFiles.includes(file));
  if (extras.length || missing.length) {
    throw new Error(`Managed tree differs from manifest (extras: ${extras.join(", ") || "none"}; missing: ${missing.join(", ") || "none"})`);
  }

  const expectedChecksums = checksumText([...manifest.files].sort((left, right) => comparePath(left.path, right.path)));
  if (!existsSync(checksumsPath) || readFileSync(checksumsPath, "utf8") !== expectedChecksums) {
    throw new Error("checksums.sha256 does not match manifest.json");
  }
  if (!existsSync(runtimeMapPath)) throw new Error("runtime-map.json is missing");
  let runtimeMap;
  try {
    runtimeMap = JSON.parse(readFileSync(runtimeMapPath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid runtime-map.json: ${error.message}`);
  }
  const expectedRuntimeMap = buildRuntimeMap(manifest.files);
  if (JSON.stringify(runtimeMap) !== JSON.stringify(expectedRuntimeMap)) {
    throw new Error("runtime-map.json does not match manifest.json");
  }
  console.log(`Verified ${manifest.files.length} CORECOORD ${RELEASE} assets`);
}

function materializeResources(resourceRoot) {
  const manifestPath = path.join(DEST_ROOT, "manifest.json");
  const runtimeMapPath = path.join(DEST_ROOT, "runtime-map.json");
  if (!existsSync(manifestPath) || !existsSync(runtimeMapPath)) {
    throw new Error("brand assets are not synchronized; run brand:sync first");
  }
  checkAssets();
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const runtimeMap = JSON.parse(readFileSync(runtimeMapPath, "utf8"));
  const records = new Map(manifest.files.map((record) => [record.path, record]));
  const destinationRoot = path.resolve(resourceRoot || path.join(REPO_ROOT, "public"));
  const staticTarget = resolveInside(destinationRoot, `assets/brand/corecoord/${RELEASE}`);
  // CORECOORD owns this namespace. Replace it as a unit so files removed from
  // a corrected runtime map cannot remain reachable after local materialization.
  const resourceTarget = resolveInside(destinationRoot, "files/corecoord");
  rmSync(staticTarget, { recursive: true, force: true });
  rmSync(resourceTarget, { recursive: true, force: true });
  mkdirSync(path.dirname(staticTarget), { recursive: true });
  mkdirSync(resourceTarget, { recursive: true });
  for (const name of readdirSync(DEST_ROOT)) {
    const sourcePath = path.join(DEST_ROOT, name);
    const targetPath = path.join(staticTarget, name);
    cpSync(sourcePath, targetPath, { recursive: true, force: true });
  }
  let copied = 0;
  for (const category of Object.values(runtimeMap.categories || {})) {
    for (const copy of category.copies || []) {
      const record = records.get(copy.sourcePath);
      if (!record || record.sha256 !== copy.sha256 || record.bytes !== copy.bytes) {
        throw new Error(`runtime map record is stale: ${copy.sourcePath}`);
      }
      const sourcePath = resolveInside(DEST_ROOT, copy.sourcePath);
      const targetPath = resolveInside(destinationRoot, copy.fileKey);
      mkdirSync(path.dirname(targetPath), { recursive: true });
      cpSync(sourcePath, targetPath);
      copied += 1;
    }
  }
  console.log(`Materialized ${copied} resource files and static CORECOORD ${RELEASE} package under ${path.relative(REPO_ROOT, destinationRoot) || "."}`);
}

try {
  const { command, sourceRoot, sourceProvided, resourceRoot, clean } = parseArgs(process.argv.slice(2));
  if (command === "sync") syncAssets(sourceRoot, clean);
  else if (command === "assemble") assembleFonts();
  else if (command === "check") checkAssets(sourceProvided || existsSync(sourceRoot) ? sourceRoot : undefined);
  else materializeResources(resourceRoot);
} catch (error) {
  console.error(`Brand asset ${process.argv[2] || "sync"} failed: ${error.message}`);
  process.exitCode = 1;
}
