"""Read/recover existing Dreamina tasks only. No generation submission code."""
import json
from pathlib import Path

from core import now, run, uid


def query_job(project, jid, runner=run):
    j = project.read()["jobs"][jid]
    if j["provider"] != "dreamina" or not j["submit_id"]:
        raise ValueError("Existing Dreamina submit ID required; reconcile unknown submissions first")
    result = json.loads(runner(["dreamina", "query_result", "--submit_id=" + j["submit_id"]], timeout=90))
    if not isinstance(result, dict):
        raise ValueError("Unexpected provider response; job state not changed")
    # Exclude signed media URLs and account data from browser-visible observations.
    observation = {"at": now(), "submit_id": j["submit_id"], "gen_status": result.get("gen_status"), "credit_count": result.get("credit_count"), "source": "dreamina query_result"}
    with project.edit("query-existing-job") as state:
        state["jobs"][jid].setdefault("observations", []).append(observation)
    return observation


def download_job(project, jid, role, runner=run):
    j = project.read()["jobs"][jid]
    if j["provider"] != "dreamina" or j["state"] != "succeeded" or not j["submit_id"]:
        raise ValueError("Download requires a reconciled, succeeded Dreamina task")
    folder = project.path / "source" / jid / uid("download")
    folder.mkdir(parents=True, exist_ok=False)
    runner(["dreamina", "query_result", "--submit_id=" + j["submit_id"], "--download_dir=" + str(folder)], timeout=600)
    files = sorted(p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in (".mp4", ".mov", ".webm", ".wav", ".mp3", ".png", ".jpg", ".jpeg", ".webp"))
    if not files:
        raise ValueError("Provider returned no supported local media; do not resubmit generation")
    assets = []
    for file in files:
        aid = project.ingest(file, j["unit"] + " / " + file.name, role, unit=j["unit"], deps=[x["id"] for x in j["inputs"]])
        project.check(aid)
        assets.append(aid)
    with project.edit("download-existing-job") as state:
        state["jobs"][jid].setdefault("downloads", []).append({"at": now(), "assets": assets})
    return {"assets": assets, "submitted": False}
