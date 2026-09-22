"""Versioned, local-only video production ledger. Python 3.9+ / stdlib."""
import contextlib
import hashlib
import json
import math
import re
import shutil
import sqlite3
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path


LAYERS = ("visual", "voice", "music", "ui")


class Conflict(ValueError):
    pass


def now():
    return datetime.now(timezone.utc).isoformat()


def uid(prefix):
    return prefix + "-" + uuid.uuid4().hex[:12]


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def run(argv, timeout=120):
    p = subprocess.run(argv, capture_output=True, text=True, timeout=timeout)
    if p.returncode:
        raise ValueError(p.stderr[-4000:] or "Command failed: " + argv[0])
    return p.stdout


def probe(path):
    data = json.loads(run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)]))
    streams = [{k: s[k] for k in ("codec_type", "codec_name", "width", "height", "r_frame_rate", "avg_frame_rate", "nb_frames", "duration", "sample_rate", "channels") if k in s} for s in data["streams"]]
    if not streams:
        raise ValueError("No media streams")
    return {"duration": float(data.get("format", {}).get("duration", 0)), "streams": streams}


def inside(path, root):
    path, root = Path(path).resolve(), Path(root).resolve()
    try:
        path.relative_to(root)
    except ValueError:
        raise ValueError("Path escapes registered root")
    return path


def nonempty(value, name):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(name + " is required")
    return value.strip()


def amount(value):
    if isinstance(value, bool):
        raise ValueError("Invalid cost")
    value = float(value)
    if not math.isfinite(value) or value < 0:
        raise ValueError("Cost must be finite and nonnegative")
    return value


class Project:
    def __init__(self, path):
        self.path = Path(path).resolve()
        self.db = self.path / ".video-production" / "state.sqlite"

    @classmethod
    def create(cls, path, title, brief=None):
        title = nonempty(title, "title")
        brief = brief or {}
        required = brief.get("required_layers", list(LAYERS))
        if not isinstance(required, list) or not required or any(layer not in LAYERS for layer in required):
            raise ValueError("required_layers must contain supported review layers")
        obj = cls(path)
        obj.db.parent.mkdir(parents=True, exist_ok=True)
        # Exclusive creation avoids replacing an existing production ledger.
        with obj.db.open("xb"):
            pass
        with contextlib.closing(obj.connect()) as c:
            c.executescript("CREATE TABLE state (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL); CREATE TABLE events (id INTEGER PRIMARY KEY, at TEXT, action TEXT, body TEXT);")
            state = {"schema": "video-production/1", "id": obj.path.name, "title": nonempty(title, "title"), "created": now(), "revision": 0,
                     "brief": brief or {}, "roots": {"project": "."}, "assets": {}, "selections": {}, "comments": [], "reviews": [], "jobs": {}, "budgets": {}, "timeline": [], "notes": [], "latest_render": None, "approved_release": None}
            c.execute("INSERT INTO state VALUES (1, ?)", (json.dumps(state, ensure_ascii=False),))
            c.commit()
        return obj

    def connect(self):
        if not self.db.is_file():
            raise ValueError("Not a video project: " + str(self.path))
        c = sqlite3.connect(str(self.db), timeout=30)
        c.execute("PRAGMA journal_mode=WAL")
        return c

    def read(self):
        with contextlib.closing(self.connect()) as c:
            return json.loads(c.execute("SELECT body FROM state WHERE id=1").fetchone()[0])

    @contextlib.contextmanager
    def edit(self, action, expected=None):
        c = self.connect()
        try:
            c.execute("BEGIN IMMEDIATE")
            s = json.loads(c.execute("SELECT body FROM state WHERE id=1").fetchone()[0])
            if expected is not None and s["revision"] != expected:
                raise Conflict("Project changed; refresh before saving")
            yield s
            s["revision"] += 1
            c.execute("UPDATE state SET body=? WHERE id=1", (json.dumps(s, ensure_ascii=False),))
            c.execute("INSERT INTO events(at, action, body) VALUES (?, ?, ?)", (now(), action, json.dumps({"revision": s["revision"]})))
            c.commit()
        except BaseException:
            c.rollback()
            raise
        finally:
            c.close()

    def root(self, s, key):
        p = Path(s["roots"][key])
        return (self.path / p).resolve() if not p.is_absolute() else p.resolve()

    def asset_path(self, s, aid):
        a = s["assets"][aid]
        root = self.root(s, a["root"])
        p = inside(root / a["path"], root)
        if not p.is_file():
            raise ValueError("Missing asset: " + aid)
        return p

    def verify(self, s, aid, seen=None):
        seen = set() if seen is None else seen
        if aid in seen:
            return
        seen.add(aid)
        a = s["assets"][aid]
        if sha(self.asset_path(s, aid)) != a["sha256"]:
            raise ValueError("Asset changed: " + aid)
        for dep in a["dependencies"]:
            if s["assets"][dep["id"]]["sha256"] != dep["sha256"]:
                raise ValueError("Dependency version changed")
            self.verify(s, dep["id"], seen)

    def add_root(self, name, path):
        if not re.fullmatch(r"[a-zA-Z0-9_-]+", name) or name == "project":
            raise ValueError("Invalid root name")
        p = Path(path).resolve(strict=True)
        if not p.is_dir():
            raise ValueError("Root must be a directory")
        with self.edit("register-root") as s:
            if name in s["roots"] and Path(s["roots"][name]) != p:
                raise ValueError("Registered roots cannot be rebound")
            s["roots"][name] = str(p)

    def ingest(self, path, label, role, unit="film", root="project", deps=None, expected_sha=None):
        if role not in (*LAYERS, "mix", "render", "source"):
            raise ValueError("Invalid asset role")
        s = self.read()
        p = inside(path, self.root(s, root))
        before = p.stat()
        digest, metadata = sha(p), probe(p)
        after = p.stat()
        if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
            raise ValueError("Asset changed while ingesting")
        if expected_sha and digest != expected_sha:
            raise ValueError("Source pointer SHA does not match")
        aid = uid("asset")
        with self.edit("ingest") as s:
            dependencies = []
            for dep in deps or []:
                self.verify(s, dep)
                dependencies.append({"id": dep, "sha256": s["assets"][dep]["sha256"]})
            s["assets"][aid] = {"id": aid, "label": nonempty(label, "label"), "role": role, "unit": nonempty(unit, "unit"), "root": root,
                                 "path": str(p.relative_to(self.root(s, root))), "sha256": digest, "bytes": after.st_size, "media": metadata,
                                 "dependencies": dependencies, "created": now(), "checks": []}
            if role == "render":
                s["latest_render"] = aid
                s["approved_release"] = None
        return aid

    def check(self, aid):
        s = self.read()
        self.verify(s, aid)
        p = self.asset_path(s, aid)
        # Decode every audio/video stream, rather than trusting container headers.
        run(["ffmpeg", "-v", "error", "-xerror", "-i", str(p), "-map", "0:v?", "-map", "0:a?", "-f", "null", "-"], timeout=1800)
        self.verify(s, aid)
        with self.edit("technical-check") as current:
            current["assets"][aid]["checks"].append({"kind": "full-decode", "sha256": s["assets"][aid]["sha256"], "at": now(), "passed": True})
        return {"asset": aid, "passed": True, "kind": "full-decode", "limits": "Does not judge emotion, continuity, loudness or licensing"}

    def mutate(self, action, data, expected):
        with self.edit(action, expected) as s:
            if action == "comment":
                aid = data["asset"]
                a = s["assets"][aid]
                start, end = float(data["start"]), float(data.get("end", data["start"]))
                if not all(math.isfinite(t) for t in (start, end)) or not 0 <= start <= end <= a["media"]["duration"]:
                    raise ValueError("Invalid comment time range")
                s["comments"].append({"id": uid("comment"), "asset": aid, "sha256": a["sha256"], "start": start, "end": end, "text": nonempty(data["text"], "text"), "author": nonempty(data["author"], "author"), "resolved": False, "at": now()})
                if s["approved_release"] and s["approved_release"]["asset"] == aid:
                    s["approved_release"] = None
            elif action == "resolve":
                comment = next(c for c in s["comments"] if c["id"] == data["id"])
                comment["resolved"] = True
                comment["resolution"] = {"text": nonempty(data["text"], "resolution"), "author": nonempty(data["author"], "author"), "at": now()}
            elif action == "select":
                aid, layer = data["asset"], data["layer"]
                if layer not in LAYERS:
                    raise ValueError("Invalid layer")
                self.verify(s, aid)
                s["selections"][s["assets"][aid]["unit"] + ":" + layer] = aid
                s["approved_release"] = None
            elif action == "review":
                aid, layer = data["asset"], data["layer"]
                if layer not in LAYERS or data["decision"] not in ("approved", "rejected"):
                    raise ValueError("Invalid review")
                self.verify(s, aid)
                scope = data.get("scope", "full")
                if scope != "full":
                    if not isinstance(scope, list) or len(scope) != 2 or not all(isinstance(t, (int, float)) and math.isfinite(t) for t in scope) or not 0 <= scope[0] < scope[1] <= s["assets"][aid]["media"]["duration"]:
                        raise ValueError("Invalid review range")
                s["reviews"].append({"id": uid("review"), "asset": aid, "sha256": s["assets"][aid]["sha256"], "layer": layer, "scope": scope, "decision": data["decision"], "author": nonempty(data["author"], "author"), "text": nonempty(data["text"], "review notes"), "at": now()})
                s["approved_release"] = None
            elif action == "release":
                aid = data["asset"]
                issues = self.release_issues(s, aid)
                if issues:
                    raise ValueError("Release blocked: " + "; ".join(issues))
                confirmations = {key: nonempty(data[key], key) for key in ("author", "device_review", "rights_review")}
                s["approved_release"] = {"asset": aid, "sha256": s["assets"][aid]["sha256"], "at": now(), **confirmations}
            else:
                raise ValueError("Unsupported mutation")
        return self.read()

    def release_issues(self, s, aid):
        a = s["assets"][aid]
        issues = []
        try:
            self.verify(s, aid)
        except (ValueError, OSError, KeyError) as e:
            issues.append(str(e))
        if aid != s["latest_render"] or a["role"] != "render":
            issues.append("Only latest render can be released")
        if not any(c["kind"] == "full-decode" and c["sha256"] == a["sha256"] and c["passed"] for c in a["checks"]):
            issues.append("Full decode required")
        required = s["brief"].get("required_layers", list(LAYERS))
        for layer in required:
            reviews = [r for r in s["reviews"] if r["asset"] == aid and r["sha256"] == a["sha256"] and r["layer"] == layer]
            full = [r for r in reviews if r["scope"] == "full"]
            if not full or full[-1]["decision"] != "approved" or any(r["decision"] == "rejected" and r["at"] >= full[-1]["at"] for r in reviews):
                issues.append("Full-film " + layer + " approval required")
        lineage = set()
        def collect(key):
            if key in lineage:
                return
            lineage.add(key)
            for dep in s["assets"][key]["dependencies"]:
                collect(dep["id"])
        collect(aid)
        if any(c["asset"] in lineage and not c["resolved"] for c in s["comments"]):
            issues.append("Unresolved feedback on render or dependencies")
        return issues

    def export(self, destination):
        # Serialize approval changes against delivery creation.
        with self.edit("export"):
            return self._export(destination)

    def _export(self, destination):
        s = self.read()
        release = s["approved_release"]
        if not release:
            raise ValueError("No approved release")
        issues = self.release_issues(s, release["asset"])
        if issues:
            raise ValueError("Release no longer valid: " + "; ".join(issues))
        out = Path(destination).resolve()
        out.mkdir(parents=True, exist_ok=False)
        source = self.asset_path(s, release["asset"])
        target = out / ("master" + source.suffix.lower())
        shutil.copyfile(source, target)
        if sha(target) != release["sha256"]:
            raise ValueError("Export integrity failed; incomplete directory retained")
        # Ship the ledger, not the database or filesystem root locations.
        portable = json.loads(json.dumps(s))
        portable["roots"] = {key: "<source-root>" for key in s["roots"]}
        for name, value in (("manifest.json", portable), ("checksums.json", {target.name: sha(target)})):
            with (out / name).open("x", encoding="utf-8") as f:
                json.dump(value, f, ensure_ascii=False, indent=2)
        return str(out)

    def prepare_job(self, spec):
        nonempty(spec.get("provider"), "provider")
        nonempty(spec.get("action"), "action")
        nonempty(spec.get("unit"), "unit")
        estimate = amount(spec["estimated_cost"])
        currency = nonempty(spec["cost_unit"], "cost_unit")
        with self.edit("prepare-job") as s:
            inputs = []
            for aid in spec.get("inputs", []):
                self.verify(s, aid)
                inputs.append({"id": aid, "sha256": s["assets"][aid]["sha256"]})
            request = {"provider": spec["provider"], "action": spec["action"], "unit": spec["unit"], "parameters": spec.get("parameters", {}), "inputs": inputs}
            fingerprint = hashlib.sha256(json.dumps(request, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
            if any(j["fingerprint"] == fingerprint and j["state"] not in ("failed", "cancelled") for j in s["jobs"].values()):
                raise Conflict("Identical request exists; recover it instead of resubmitting")
            jid = uid("job")
            s["jobs"][jid] = {"id": jid, **request, "fingerprint": fingerprint, "state": "planned", "estimated_cost": estimate, "cost_unit": currency, "actual_cost": None, "submit_id": None, "history": [{"at": now(), "state": "planned"}]}
        return jid

    def job_transition(self, jid, state, evidence, submit_id=None, actual=None):
        transitions = {"planned": ("submitting", "cancelled"), "submitting": ("accepted", "unknown", "failed"), "accepted": ("running", "succeeded", "failed", "unknown"), "running": ("succeeded", "failed", "unknown"), "unknown": ("accepted", "running", "succeeded", "failed", "cancelled"), "succeeded": (), "failed": (), "cancelled": ()}
        evidence = nonempty(evidence, "evidence")
        with self.edit("job-transition") as s:
            j = s["jobs"][jid]
            if state not in transitions[j["state"]]:
                raise Conflict("Invalid transition; never resubmit an unknown job")
            if submit_id and j["submit_id"] and submit_id != j["submit_id"]:
                raise Conflict("Submit ID cannot be replaced")
            if state in ("accepted", "running", "succeeded") and not (submit_id or j["submit_id"]):
                raise ValueError("Submit ID required")
            if state == "submitting":
                for item in j["inputs"]:
                    self.verify(s, item["id"])
                unit = j["cost_unit"]
                if unit not in s["budgets"]:
                    raise ValueError("Set an explicit budget before authorizing submission")
                if cost_summary(s).get(unit, 0) + j["estimated_cost"] > s["budgets"][unit]:
                    raise ValueError("Budget exceeded")
            if actual is not None:
                j["actual_cost"] = amount(actual)
            j["state"] = state
            j["submit_id"] = submit_id or j["submit_id"]
            j["history"].append({"at": now(), "state": state, "evidence": evidence})
        return self.read()["jobs"][jid]

    def job_cost(self, jid, actual, evidence):
        actual = amount(actual)
        evidence = nonempty(evidence, "cost evidence")
        with self.edit("job-cost") as s:
            j = s["jobs"][jid]
            if j["state"] == "planned":
                raise ValueError("Unsubmitted task cannot have a settled cost")
            j["actual_cost"] = actual
            j["history"].append({"at": now(), "state": j["state"], "actual_cost": actual, "evidence": evidence})
        return self.read()["jobs"][jid]


def cost_summary(s):
    totals = {}
    for j in s["jobs"].values():
        if j["actual_cost"] is None and (j["state"] == "planned" or (j["state"] == "cancelled" and not any(h["state"] == "submitting" for h in j["history"]))):
            continue
        # Unknown charges remain reserved, including failed external tasks.
        cost = j["actual_cost"] if j["actual_cost"] is not None else j["estimated_cost"]
        totals[j["cost_unit"]] = totals.get(j["cost_unit"], 0) + cost
    return totals
