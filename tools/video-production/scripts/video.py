#!/usr/bin/env python3
"""CLI entrypoint. All media changes create new artifacts."""
import argparse
import json
import shutil
import sys
from pathlib import Path

from core import Project, amount, cost_summary


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def import_legacy(project, source):
    source = Path(source).resolve()
    project.add_root("legacy", source)
    if project.read()["assets"]:
        raise ValueError("Legacy import requires an empty project")
    visual, ui, voice = [load(source / name) for name in ("CURRENT-FULL.json", "CURRENT-UI.json", "CURRENT-VOICE.json")]
    def add(relative, label, role, deps=None, digest=None):
        return project.ingest(source / relative, label, role, root="legacy", deps=deps, expected_sha=digest)
    v = add(visual["file"], "画面分支 v6（154.708 秒，非当前声音时间线）", "visual", digest=visual.get("sha256"))
    u = add(ui["file"], "UI 基线 v1（152.875 秒）", "ui", digest=ui.get("sha256"))
    n = add(voice["narration"], "沉稳解说 Pro · 连续排比修订 · 干声", "voice")
    mix = add(voice["mix"], "旁白与配乐 · 混音 v2", "mix", deps=[n])
    music_path = Path(voice["mix"]).parent / "music_bed.wav"
    if (source / music_path).is_file():
        music = add(music_path, "配乐底轨", "music")
        with project.edit("import-music-dependency") as s:
            s["assets"][mix]["dependencies"].append({"id": music, "sha256": s["assets"][music]["sha256"]})
    latest = add(voice["file"], "当前审阅 · 沉稳男声 v2", "render", deps=[u, mix], digest=voice.get("sha256"))
    previous = Path(voice["file"]).parent.parent / "full-v1" / "full_film_ui_jimeng_calm_pro.mp4"
    if (source / previous).is_file():
        add(previous, "声音 v1 · 断句修订前（仅供对照）", "source")
    alignment = load(source / Path(voice["file"]).parent / "alignment.json")
    with project.edit("legacy-import-evidence") as s:
        s["timeline"] = alignment.get("cues", [])
        s["notes"] = ["旧 CURRENT 指针是来源证据，不自动转为人工批准。", "画面 v6 与 UI/声音分支片长不同，不得直接拼接或继承帧号。", "待整片声音情感、UI 对位、目标设备、音乐使用范围确认。", "连续排比修订区间约 125.312–131.000 秒；需听完整前后文。"]
        s["selections"] = {"film:visual": v, "film:ui": u, "film:voice": n}
        s["legacy_evidence"] = {"CURRENT-FULL": visual, "CURRENT-UI": ui, "CURRENT-VOICE": voice}
    return {"latest_render": latest, "assets": len(project.read()["assets"]), "approvals_imported": 0}


def parser():
    p = argparse.ArgumentParser(description="Local video production ledger and review workbench")
    p.add_argument("--project", help="Project directory (not the skill directory)")
    sub = p.add_subparsers(dest="cmd", required=True)
    q = sub.add_parser("init"); q.add_argument("--title", required=True); q.add_argument("--brief", help="JSON file")
    q = sub.add_parser("root"); q.add_argument("name"); q.add_argument("path")
    q = sub.add_parser("ingest"); q.add_argument("path"); q.add_argument("--label", required=True); q.add_argument("--role", required=True); q.add_argument("--unit", default="film"); q.add_argument("--root", default="project"); q.add_argument("--dep", action="append", default=[])
    sub.add_parser("status")
    q = sub.add_parser("check"); q.add_argument("asset")
    q = sub.add_parser("review"); q.add_argument("--data", required=True, help="JSON file: asset, layer, decision, author, text, optional scope")
    q = sub.add_parser("release"); q.add_argument("--data", required=True, help="JSON file: asset, author, device_review, rights_review")
    q = sub.add_parser("export"); q.add_argument("destination")
    q = sub.add_parser("import-legacy"); q.add_argument("source")
    q = sub.add_parser("budget"); q.add_argument("unit"); q.add_argument("limit", type=float)
    q = sub.add_parser("prepare-job"); q.add_argument("spec")
    q = sub.add_parser("job-state"); q.add_argument("job"); q.add_argument("state"); q.add_argument("--evidence", required=True); q.add_argument("--submit-id"); q.add_argument("--actual-cost", type=float)
    q = sub.add_parser("query-job"); q.add_argument("job")
    q = sub.add_parser("job-cost"); q.add_argument("job"); q.add_argument("amount", type=float); q.add_argument("--evidence", required=True)
    q = sub.add_parser("download-job"); q.add_argument("job"); q.add_argument("--role", required=True)
    sub.add_parser("doctor")
    q = sub.add_parser("mux"); q.add_argument("--video", required=True); q.add_argument("--audio", required=True); q.add_argument("--label", required=True)
    q = sub.add_parser("conform"); q.add_argument("spec")
    q = sub.add_parser("serve"); q.add_argument("--workspace", required=True); q.add_argument("--port", type=int, default=8877)
    return p


def main():
    p = parser(); args = p.parse_args()
    if args.cmd == "doctor":
        print(json.dumps({"python": sys.version.split()[0], "ffmpeg": shutil.which("ffmpeg"), "ffprobe": shutil.which("ffprobe"), "dreamina": shutil.which("dreamina"), "paid_submission": "not implemented; use authorized CLI/web then reconcile original ID"}, ensure_ascii=False, indent=2))
        return
    if args.cmd == "serve":
        from server import serve
        serve(args.workspace, args.port)
        return
    if not args.project:
        p.error("--project required for this command")
    project = Project(args.project)
    if args.cmd == "init":
        result = Project.create(args.project, args.title, load(args.brief) if args.brief else None).read()
    elif args.cmd == "root":
        project.add_root(args.name, args.path); result = project.read()["roots"]
    elif args.cmd == "ingest":
        result = {"asset": project.ingest(args.path, args.label, args.role, args.unit, args.root, args.dep)}
    elif args.cmd == "status":
        result = project.read(); result["cost_reserved_or_spent"] = cost_summary(result)
    elif args.cmd == "check":
        result = project.check(args.asset)
    elif args.cmd in ("review", "release"):
        result = project.mutate(args.cmd, load(args.data), project.read()["revision"])
    elif args.cmd == "export":
        result = {"directory": project.export(args.destination)}
    elif args.cmd == "import-legacy":
        result = import_legacy(project, args.source)
    elif args.cmd == "budget":
        with project.edit("budget") as s:
            s["budgets"][args.unit] = amount(args.limit)
        result = project.read()["budgets"]
    elif args.cmd == "prepare-job":
        result = {"job": project.prepare_job(load(args.spec)), "submitted": False}
    elif args.cmd == "job-state":
        result = project.job_transition(args.job, args.state, args.evidence, args.submit_id, args.actual_cost)
    elif args.cmd == "query-job":
        from providers import query_job
        result = query_job(project, args.job)
    elif args.cmd == "job-cost":
        result = project.job_cost(args.job, args.amount, args.evidence)
    elif args.cmd == "download-job":
        from providers import download_job
        result = download_job(project, args.job, args.role)
    elif args.cmd == "mux":
        from media import mux
        result = {"asset": mux(project, args.video, args.audio, args.label)}
    elif args.cmd == "conform":
        from media import conform
        result = {"asset": conform(project, load(args.spec))}
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, StopIteration) as exc:
        print("ERROR: " + str(exc), file=sys.stderr)
        sys.exit(1)
