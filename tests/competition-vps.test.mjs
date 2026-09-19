import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../scripts/competition-monitor-vps.sh", import.meta.url));

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "competition-vps-test-"));
  const repo = path.join(root, "repo");
  const remote = path.join(root, "remote.git");
  const bin = path.join(root, "bin");
  fs.mkdirSync(bin);
  fs.mkdirSync(path.join(repo, "scripts/competitions/content"), { recursive: true });
  fs.writeFileSync(path.join(repo, "scripts/competitions/content/demo.json"), "{}\n");
  fs.writeFileSync(path.join(repo, "scripts/competitions-content.json"), "{}\n");
  fs.writeFileSync(path.join(repo, "untouched.txt"), "baseline\n");
  // Stub only the external crawler/quality commands; git uses a real local bare remote.
  fs.writeFileSync(path.join(bin, "node"), '#!/bin/sh\nif [ "$FAIL_GATE" = "1" ] && [ "$1" = "scripts/validate-competitions.mjs" ]; then exit 1; fi\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, "flock"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  const env = {
    ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null",
    DASH_MONITOR_HOME: root, NODE_BIN_DIR: bin, DASH_MONITOR_WEBHOOK_URL: "",
    GIT_AUTHOR_NAME: "Test Bot", GIT_AUTHOR_EMAIL: "test@example.invalid",
    GIT_COMMITTER_NAME: "Test Bot", GIT_COMMITTER_EMAIL: "test@example.invalid",
  };
  function git(args, cwd = repo) {
    const result = spawnSync("git", args, { cwd, env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  git(["init", "--bare", remote], root);
  git(["init", "-b", "main"]);
  git(["add", "."]);
  git(["commit", "-m", "initial"]);
  git(["remote", "add", "origin", remote]);
  git(["push", "-u", "origin", "main"]);
  const run = (extra = {}) => spawnSync("bash", [script], { cwd: repo, env: { ...env, ...extra }, encoding: "utf8" });
  return { root, repo, remote, git, run, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test("an existing unpublished commit is pushed even when the crawler finds nothing", () => {
  const f = fixture();
  try {
    fs.writeFileSync(path.join(f.repo, "scripts/competitions/content/demo.json"), '{"revision":2}\n');
    f.git(["add", "."]);
    f.git(["commit", "-m", "pending"]);
    const sha = f.git(["rev-parse", "HEAD"]);
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(f.git(["rev-parse", "main"], f.remote), sha);
  } finally { f.cleanup(); }
});

test("a rejected push is retained and retried on the next otherwise unchanged run", () => {
  const f = fixture();
  try {
    fs.writeFileSync(path.join(f.repo, "scripts/competitions/content/demo.json"), '{"revision":2}\n');
    f.git(["add", "."]);
    f.git(["commit", "-m", "pending"]);
    const sha = f.git(["rev-parse", "HEAD"]);
    const hook = path.join(f.remote, "hooks/pre-receive");
    fs.writeFileSync(hook, "#!/bin/sh\nexit 1\n", { mode: 0o755 });
    assert.notEqual(f.run().status, 0);
    assert.equal(f.git(["rev-parse", "HEAD"]), sha);
    fs.unlinkSync(hook);
    const retry = f.run();
    assert.equal(retry.status, 0, retry.stderr);
    assert.equal(f.git(["rev-parse", "main"], f.remote), sha);
  } finally { f.cleanup(); }
});

test("uncommitted content survives a failed gate and is recovered on retry", () => {
  const f = fixture();
  try {
    const file = path.join(f.repo, "scripts/competitions/content/demo.json");
    const changed = '{"revision":2}\n';
    fs.writeFileSync(file, changed);
    const before = f.git(["rev-parse", "main"], f.remote);
    assert.notEqual(f.run({ FAIL_GATE: "1" }).status, 0);
    assert.equal(fs.readFileSync(file, "utf8"), changed);
    assert.equal(f.git(["rev-parse", "main"], f.remote), before);
    const retry = f.run();
    assert.equal(retry.status, 0, retry.stderr);
    assert.notEqual(f.git(["rev-parse", "main"], f.remote), before);
    assert.equal(fs.readFileSync(file, "utf8"), changed);
  } finally { f.cleanup(); }
});

test("unrelated work is neither discarded nor committed", () => {
  const f = fixture();
  try {
    const file = path.join(f.repo, "untouched.txt");
    fs.writeFileSync(file, "user change\n");
    const before = f.git(["rev-parse", "HEAD"]);
    assert.notEqual(f.run().status, 0);
    assert.equal(fs.readFileSync(file, "utf8"), "user change\n");
    assert.equal(f.git(["rev-parse", "HEAD"]), before);
  } finally { f.cleanup(); }
});
