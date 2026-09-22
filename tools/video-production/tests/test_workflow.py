import copy
import http.client
import json
import shutil
import sys
import tempfile
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from core import Conflict, Project, cost_summary, run, sha
from media import conform, mux
from providers import query_job, download_job
from server import Workbench


class WorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixtures = tempfile.TemporaryDirectory()
        cls.video = Path(cls.fixtures.name) / "source.mp4"
        cls.audio = Path(cls.fixtures.name) / "audio.wav"
        run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=160x90:r=24:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(cls.video)])
        run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=1", str(cls.audio)])

    @classmethod
    def tearDownClass(cls):
        cls.fixtures.cleanup()

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.workspace = Path(self.tmp.name)
        self.p = Project.create(self.workspace / "test-film", "Test film")
        self.path = self.p.path / "clip.mp4"
        shutil.copyfile(self.video, self.path)
        self.aid = self.p.ingest(self.path, "Candidate", "render")

    def tearDown(self):
        self.tmp.cleanup()

    def mutate(self, action, data):
        return self.p.mutate(action, data, self.p.read()["revision"])

    def review(self, layer="visual", **kwargs):
        data = {"asset": self.aid, "layer": layer, "decision": "approved", "author": "Tester", "text": "Synthetic test approval", **kwargs}
        return self.mutate("review", data)

    def approve_all(self):
        self.p.check(self.aid)
        for layer in ("visual", "voice", "music", "ui"):
            self.review(layer)

    def release(self):
        return self.mutate("release", {"asset": self.aid, "author": "Tester", "device_review": "Synthetic device check", "rights_review": "Generated test pattern"})

    def test_ingest_and_integrity(self):
        self.assertEqual(self.p.read()["assets"][self.aid]["sha256"], sha(self.video))
        self.assertTrue(self.p.check(self.aid)["passed"])
        with self.path.open("ab") as f:
            f.write(b"changed")
        with self.assertRaisesRegex(ValueError, "changed"):
            self.review()

    def test_project_no_overwrite(self):
        with self.assertRaises(FileExistsError):
            Project.create(self.p.path, "Different")
        self.assertEqual(self.p.read()["title"], "Test film")

    def test_root_traversal_and_symlink(self):
        with self.assertRaisesRegex(ValueError, "escapes"):
            self.p.ingest(self.video, "Outside", "source")
        link = self.p.path / "escape.mp4"
        link.symlink_to(self.video)
        with self.assertRaisesRegex(ValueError, "escapes"):
            self.p.ingest(link, "Symlink", "source")

    def test_registered_root_immutable(self):
        self.p.add_root("external", self.fixtures.name)
        with self.assertRaises(ValueError):
            self.p.add_root("external", self.workspace)

    def test_transitive_dependencies(self):
        b = self.p.ingest(self.path, "B", "visual", deps=[self.aid])
        c = self.p.ingest(self.path, "C", "render", deps=[b])
        with self.path.open("ab") as f:
            f.write(b"changed")
        with self.assertRaises(ValueError):
            self.p.verify(self.p.read(), c)

    def test_revision_conflict(self):
        old = self.p.read()["revision"]
        self.review()
        with self.assertRaises(Conflict):
            self.p.mutate("select", {"asset": self.aid, "layer": "visual"}, old)

    def test_invalid_write_rollback(self):
        old = self.p.read()
        with self.assertRaises(ValueError):
            self.review(layer="unsupported")
        self.assertEqual(self.p.read(), old)

    def test_release_gates_and_export(self):
        with self.assertRaisesRegex(ValueError, "blocked"):
            self.release()
        self.approve_all()
        self.release()
        out = self.workspace / "delivery"
        self.p.export(out)
        self.assertEqual(sha(out / "master.mp4"), sha(self.video))
        self.assertEqual(json.loads((out / "manifest.json").read_text())["roots"], {"project": "<source-root>"})
        with self.assertRaises(FileExistsError):
            self.p.export(out)

    def test_local_approval_not_full(self):
        self.approve_all()
        self.review(decision="rejected")
        self.review(scope=[0.1, 0.2])
        with self.assertRaisesRegex(ValueError, "visual"):
            self.release()

    def test_later_range_rejection_invalidates(self):
        self.approve_all()
        self.review(scope=[0.1, 0.2], decision="rejected")
        with self.assertRaisesRegex(ValueError, "visual"):
            self.release()

    def test_new_version_does_not_inherit(self):
        self.approve_all(); self.release()
        new = self.p.ingest(self.path, "New candidate", "render")
        self.assertIsNone(self.p.read()["approved_release"])
        issues = self.p.release_issues(self.p.read(), new)
        self.assertIn("Full-film voice approval required", issues)

    def test_comment_release_and_resolution(self):
        self.approve_all(); self.release()
        self.mutate("comment", {"asset": self.aid, "start": 0.1, "end": 0.2, "author": "Tester", "text": "Check rhythm"})
        self.assertIsNone(self.p.read()["approved_release"])
        with self.assertRaisesRegex(ValueError, "feedback"):
            self.release()
        cid = self.p.read()["comments"][0]["id"]
        self.mutate("resolve", {"id": cid, "author": "Tester", "text": "Reviewed again"})
        self.release()

    def test_bad_comment_ranges(self):
        for start, end in ((-1, 0), (0, 2), (float("nan"), .5), (.5, .1)):
            with self.assertRaises(ValueError):
                self.mutate("comment", {"asset": self.aid, "start": start, "end": end, "author": "Tester", "text": "Bad"})

    def job(self, **kwargs):
        return self.p.prepare_job({"provider": "manual-dreamina", "action": "frames2video", "unit": "S001", "inputs": [self.aid], "parameters": {"prompt": "test"}, "estimated_cost": 2, "cost_unit": "credits", **kwargs})

    def budget(self, limit):
        with self.p.edit("test-budget") as s:
            s["budgets"]["credits"] = limit

    def test_task_no_duplicate(self):
        self.job()
        with self.assertRaises(Conflict):
            self.job()

    def test_unknown_never_resubmits(self):
        self.budget(10)
        jid = self.job()
        self.p.job_transition(jid, "submitting", "Authorized")
        self.p.job_transition(jid, "unknown", "Response timeout")
        with self.assertRaises(Conflict):
            self.p.job_transition(jid, "submitting", "Retry")
        with self.assertRaises(Conflict):
            self.job()
        self.assertEqual(cost_summary(self.p.read()), {"credits": 2})
        self.p.job_transition(jid, "succeeded", "Found original task", "provider-123", 1)
        self.assertEqual(cost_summary(self.p.read()), {"credits": 1})

    def test_budget_and_failed_cost_unknown(self):
        jid = self.job()
        with self.assertRaisesRegex(ValueError, "budget"):
            self.p.job_transition(jid, "submitting", "Authorized")
        self.budget(1)
        with self.assertRaisesRegex(ValueError, "Budget"):
            self.p.job_transition(jid, "submitting", "Authorized")
        self.budget(3)
        self.p.job_transition(jid, "submitting", "Authorized")
        self.p.job_transition(jid, "failed", "Provider terminal failure; charge unknown")
        self.assertEqual(cost_summary(self.p.read()), {"credits": 2})
        another = self.job()
        with self.assertRaisesRegex(ValueError, "Budget"):
            self.p.job_transition(another, "submitting", "Authorized")
        self.p.job_cost(jid, 0, "Provider confirmed full refund")
        self.assertEqual(cost_summary(self.p.read()), {"credits": 0})
        self.p.job_transition(another, "submitting", "Authorized after refund")

    def test_task_submit_id_immutable(self):
        self.budget(10); jid = self.job()
        self.p.job_transition(jid, "submitting", "Authorized")
        with self.assertRaisesRegex(ValueError, "ID"):
            self.p.job_transition(jid, "accepted", "Accepted")
        self.p.job_transition(jid, "accepted", "Accepted", "a")
        with self.assertRaises(Conflict):
            self.p.job_transition(jid, "running", "Running", "b")

    def test_invalid_costs(self):
        for n in (-1, float("nan"), float("inf")):
            with self.assertRaises(ValueError):
                self.job(estimated_cost=n)

    def test_provider_queries_and_downloads_never_submit(self):
        self.budget(10); jid = self.job(provider="dreamina")
        self.p.job_transition(jid, "submitting", "Authorized fixture")
        self.p.job_transition(jid, "accepted", "Fixture task ID", "test-id")
        calls = []
        def fake_runner(argv, timeout):
            calls.append(argv)
            self.assertEqual(argv[:2], ["dreamina", "query_result"])
            for arg in argv:
                if arg.startswith("--download_dir="):
                    shutil.copyfile(self.video, Path(arg.split("=", 1)[1]) / "result.mp4")
            return json.dumps({"gen_status": "success", "credit_count": 2, "signed_url": "not-retained"})
        observation = query_job(self.p, jid, fake_runner)
        self.assertNotIn("signed_url", observation)
        self.assertEqual(self.p.read()["jobs"][jid]["state"], "accepted")
        with self.assertRaises(ValueError):
            download_job(self.p, jid, "visual", fake_runner)
        self.p.job_transition(jid, "succeeded", "Fixture query checked", actual=2)
        result = download_job(self.p, jid, "visual", fake_runner)
        self.assertEqual(len(result["assets"]), 1)
        self.assertFalse(result["submitted"])
        self.assertEqual(len(calls), 2)

    def test_provider_query_failure_preserves_state(self):
        self.budget(10); jid = self.job(provider="dreamina")
        self.p.job_transition(jid, "submitting", "Authorized fixture")
        self.p.job_transition(jid, "unknown", "No response", "existing-id")
        old = self.p.read()
        def failed_runner(argv, timeout):
            raise TimeoutError("Fixture timeout")
        with self.assertRaises(TimeoutError):
            query_job(self.p, jid, failed_runner)
        self.assertEqual(self.p.read(), old)

    def test_mux_protects_video(self):
        audio = self.p.path / "voice.wav"
        shutil.copyfile(self.audio, audio)
        aid = self.p.ingest(audio, "Voice", "mix")
        rendered = mux(self.p, self.aid, aid, "Mux")
        result = self.p.read()["assets"][rendered]
        self.assertTrue(result["operation"]["video_packets_preserved"])
        self.assertEqual(len(result["dependencies"]), 2)
        self.assertEqual(sha(self.path), sha(self.video))

    def test_conform_half_open_ranges(self):
        result = conform(self.p, {"parts": [{"asset": self.aid, "in_frame": 0, "out_frame": 12}, {"asset": self.aid, "in_frame": 18, "out_frame": 24}]})
        self.assertEqual(self.p.read()["assets"][result]["operation"]["expected_frames"], 18)
        with self.assertRaises(ValueError):
            conform(self.p, {"parts": [{"asset": self.aid, "in_frame": 0, "out_frame": 25}]})


class HTTPTests(unittest.TestCase):
    setUpClass = classmethod(WorkflowTests.setUpClass.__func__)
    tearDownClass = classmethod(WorkflowTests.tearDownClass.__func__)

    def setUp(self):
        WorkflowTests.setUp(self)
        self.server = Workbench(self.workspace, 0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = "/api/projects/test-film"

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join()
        WorkflowTests.tearDown(self)

    def request(self, path, method="GET", data=None, headers=None):
        c = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=10)
        body = json.dumps(data) if data is not None else None
        c.request(method, path, body=body, headers=headers or {})
        r = c.getresponse(); result = (r.status, dict(r.getheaders()), r.read()); c.close()
        return result

    def test_http_security(self):
        self.assertEqual(self.request("/api/projects")[0], 200)
        self.assertEqual(self.request("/api/projects", headers={"Host": "evil.example"})[0], 403)
        self.assertEqual(self.request("/api/projects", headers={"Origin": "https://evil.example"})[0], 403)
        self.assertEqual(self.request(self.base + "/comment", "POST", {"revision": 1})[0], 403)
        self.assertEqual(self.request("/api/projects/..%2Ftest-film")[0], 404)

    def test_http_range_and_head(self):
        path = self.base + "/media/" + self.aid
        status, headers, body = self.request(path, headers={"Range": "bytes=0-99"})
        self.assertEqual(status, 206); self.assertEqual(len(body), 100)
        self.assertEqual(body, self.path.read_bytes()[:100])
        self.assertEqual(self.request(path, "HEAD")[2], b"")
        self.assertEqual(self.request(path, headers={"Range": "bytes=-20"})[2], self.path.read_bytes()[-20:])
        self.assertEqual(self.request(path, headers={"Range": "bytes=9999999-"})[0], 416)
        self.assertEqual(self.request(path, headers={"Range": "bytes=0-1,3-4"})[0], 416)

    def test_http_mutation_and_conflict(self):
        headers = {"Content-Type": "application/json", "X-Workbench-Token": self.server.token}
        data = {"revision": self.p.read()["revision"], "asset": self.aid, "layer": "visual", "decision": "approved", "author": "HTTP tester", "text": "Synthetic review"}
        self.assertEqual(self.request(self.base + "/review", "POST", data, headers)[0], 200)
        self.assertEqual(self.request(self.base + "/review", "POST", data, headers)[0], 409)

    def test_http_rejects_modified_media(self):
        path = self.base + "/media/" + self.aid
        self.assertEqual(self.request(path)[0], 200)
        with self.path.open("ab") as f:
            f.write(b"modified")
        self.assertEqual(self.request(path)[0], 409)


if __name__ == "__main__":
    unittest.main()
