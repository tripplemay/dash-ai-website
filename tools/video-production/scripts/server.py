"""Loopback review server. No arbitrary path API, shell execution or remote bind."""
import json
import mimetypes
import os
import re
import secrets
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

from core import Conflict, Project, cost_summary, inside, sha, uid


WEB = Path(__file__).resolve().parent.parent / "web"


class Workbench(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, workspace, port):
        self.workspace = Path(workspace).resolve(strict=True)
        self.token = secrets.token_urlsafe(32)
        self.hash_cache = {}
        self.release = os.environ.get("VIDEO_WORKBENCH_RELEASE", "development")
        super().__init__(("127.0.0.1", port), Handler)

    def project(self, name):
        if not re.fullmatch(r"[A-Za-z0-9_-]+", name):
            raise ValueError("Invalid project ID")
        return Project(inside(self.workspace / name, self.workspace))


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # Do not print comment bodies or CSRF tokens.
        pass

    def guard(self, write=False):
        port = self.server.server_port
        host = self.headers.get("Host", "")
        if host not in ("127.0.0.1:%d" % port, "localhost:%d" % port):
            raise PermissionError("Invalid Host")
        if self.headers.get("Origin", "http://" + host) != "http://" + host:
            raise PermissionError("Cross-origin access denied")
        if self.headers.get("Sec-Fetch-Site") == "cross-site":
            raise PermissionError("Cross-site access denied")
        if write and not secrets.compare_digest(self.headers.get("X-Workbench-Token", ""), self.server.token):
            raise PermissionError("Invalid mutation token")

    def send_headers(self, status, mime, length, extras=None):
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(length))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; media-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        for k, v in (extras or {}).items():
            self.send_header(k, v)
        self.end_headers()

    def json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_headers(status, "application/json; charset=utf-8", len(body))
        if self.command != "HEAD":
            self.wfile.write(body)

    def dispatch(self, write=False):
        try:
            self.guard(write)
            self.route(write)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except PermissionError as e:
            self.json({"error": str(e)}, 403)
        except Conflict as e:
            self.json({"error": str(e)}, 409)
        except (ValueError, KeyError, OSError, StopIteration, TypeError) as e:
            self.json({"error": str(e)}, 400)
        except Exception:
            self.json({"error": "Internal operation failed; inspect local inputs and retry only safe read operations"}, 500)

    def do_GET(self):
        self.dispatch()

    def do_HEAD(self):
        self.dispatch()

    def do_POST(self):
        self.dispatch(True)

    def route(self, write):
        path = unquote(urlsplit(self.path).path)
        if not write and path == "/api/health":
            writable = os.access(self.server.workspace, os.R_OK | os.W_OK | os.X_OK)
            self.json({"status": "ok" if writable else "unready", "release": self.server.release, "workspace_writable": writable, "bind": "127.0.0.1", "port": self.server.server_port}, 200 if writable else 503)
            return
        if not write and path in ("/", "/app.js", "/style.css"):
            file = WEB / ("index.html" if path == "/" else path[1:])
            body = file.read_bytes()
            self.send_headers(200, mimetypes.guess_type(str(file))[0] + "; charset=utf-8", len(body))
            if self.command != "HEAD":
                self.wfile.write(body)
            return
        if not write and path == "/api/projects":
            projects = []
            for folder in sorted(self.server.workspace.iterdir()):
                if not re.fullmatch(r"[A-Za-z0-9_-]+", folder.name):
                    continue
                try:
                    s = self.server.project(folder.name).read()
                    projects.append({"id": folder.name, "title": s["title"], "assets": len(s["assets"]), "released": bool(s["approved_release"])})
                except (ValueError, OSError):
                    continue
            self.json({"projects": projects, "token": self.server.token})
            return
        match = re.fullmatch(r"/api/projects/([A-Za-z0-9_-]+)(?:/([a-z-]+)(?:/([A-Za-z0-9_-]+))?)?", path)
        if not match:
            self.json({"error": "Not found"}, 404)
            return
        name, action, aid = match.groups()
        project = self.server.project(name)
        if not write:
            if action == "media" and aid:
                self.media(project, aid)
            elif action is None:
                s = project.read()
                s["cost_reserved_or_spent"] = cost_summary(s)
                s["roots"] = {key: "<registered>" for key in s["roots"]}
                self.json(s)
            else:
                self.json({"error": "Not found"}, 404)
            return
        if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
            raise ValueError("JSON required")
        size = int(self.headers.get("Content-Length", "0"))
        if not 0 < size <= 65536:
            raise ValueError("Invalid request size")
        data = json.loads(self.rfile.read(size))
        expected = data.pop("revision")
        if type(expected) is not int:
            raise ValueError("Integer revision required")
        if action in ("comment", "resolve", "review", "select", "release"):
            project.mutate(action, data, expected)
            self.json({"ok": True})
        elif action in ("check", "export"):
            if project.read()["revision"] != expected:
                raise Conflict("Project changed; refresh")
            if action == "check":
                self.json(project.check(data["asset"]))
            else:
                out = project.export(project.path / "deliveries" / uid("release"))
                self.json({"directory": out})
        else:
            raise ValueError("Unsupported operation")

    def media(self, project, aid):
        state = project.read()
        file = project.asset_path(state, aid)
        stat = file.stat()
        key = (str(file), stat.st_mtime_ns, stat.st_ctime_ns, stat.st_size)
        if key not in self.server.hash_cache:
            digest = sha(file)
            if len(self.server.hash_cache) > 512:
                self.server.hash_cache.clear()
            self.server.hash_cache[key] = digest
        if self.server.hash_cache[key] != state["assets"][aid]["sha256"]:
            raise Conflict("Asset content changed; register a new version")
        size, start, end = stat.st_size, 0, stat.st_size - 1
        request_range = self.headers.get("Range")
        if request_range:
            m = re.fullmatch(r"bytes=(\d*)-(\d*)", request_range)
            if not m or not any(m.groups()):
                self.send_headers(416, "text/plain", 0, {"Content-Range": "bytes */%d" % size})
                return
            first, last = m.groups()
            if first:
                start = int(first)
                end = min(int(last), end) if last else end
            else:
                start = max(0, size - int(last))
            if not 0 <= start <= end < size:
                self.send_headers(416, "text/plain", 0, {"Content-Range": "bytes */%d" % size})
                return
        extras = {"Accept-Ranges": "bytes"}
        if request_range:
            extras["Content-Range"] = "bytes %d-%d/%d" % (start, end, size)
        self.send_headers(206 if request_range else 200, mimetypes.guess_type(str(file))[0] or "application/octet-stream", end - start + 1, extras)
        if self.command == "HEAD":
            return
        with file.open("rb") as f:
            f.seek(start)
            left = end - start + 1
            while left:
                block = f.read(min(left, 256 * 1024))
                if not block:
                    break
                self.wfile.write(block)
                left -= len(block)


def serve(workspace, port):
    with Workbench(workspace, port) as server:
        print("Video workbench: http://127.0.0.1:%d (local only)" % server.server_port, flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
