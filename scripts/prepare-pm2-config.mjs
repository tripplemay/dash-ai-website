// Generate a short-lived PM2 config with deployment-owned runtime values.
// The source ecosystem file may predate the current release contract; keep
// its secret-bearing values and merge only the values that must follow the
// active release and public origin.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const [sourcePath, outputPath, publicOrigin, releaseId] = process.argv.slice(2);

if (!sourcePath || !outputPath || !publicOrigin || !releaseId) {
  throw new Error("usage: node prepare-pm2-config.mjs <source> <output> <origin> <release>");
}

let origin;
try {
  origin = new URL(publicOrigin);
} catch {
  throw new Error("public origin must be an absolute URL");
}
if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash) {
  throw new Error("public origin must be an HTTPS origin");
}

const require = createRequire(path.resolve(sourcePath));
const source = require(path.resolve(sourcePath));
const sourceApps = Array.isArray(source?.apps) ? source.apps : [source];
if (!sourceApps.length || sourceApps.some((app) => !app || typeof app !== "object")) {
  throw new Error("PM2 ecosystem does not contain an app definition");
}

const apps = sourceApps.map((app) => {
  const inherited = { ...(app.env || {}), ...(app.env_production || {}) };
  const runtime = {
    ...inherited,
    NODE_ENV: "production",
    PORT: "3517",
    HOSTNAME: "127.0.0.1",
    DASH_AUTH_DB: "/opt/dash-pr/dash-auth.db",
    BETTER_AUTH_URL: origin.origin,
    DASH_PUBLIC_ORIGIN: origin.origin,
    DASH_RELEASE_ID: releaseId,
  };
  return {
    ...app,
    env: { ...(app.env || {}), ...runtime },
    env_production: { ...(app.env_production || {}), ...runtime },
  };
});

const generated = Array.isArray(source?.apps)
  ? { ...source, apps }
  : { ...apps[0] };
const output = path.resolve(outputPath);
fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
const serialized = `module.exports = ${JSON.stringify(generated, null, 2)};\n`;
fs.writeFileSync(output, serialized, { mode: 0o600 });
fs.chmodSync(output, 0o600);
