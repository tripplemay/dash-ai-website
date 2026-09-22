"""Small deterministic post-production operations; never overwrite sources."""
import json
from fractions import Fraction
from pathlib import Path

from core import probe, run, uid


def video_stream(metadata):
    return next(s for s in metadata["streams"] if s["codec_type"] == "video")


def packets(path):
    data = json.loads(run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_packets", "-show_data_hash", "sha256", "-show_entries", "packet=pts_time,duration_time,data_hash", "-of", "json", str(path)], timeout=600))
    return data["packets"]


def mux(project, video_id, audio_id, label):
    s = project.read()
    for aid in (video_id, audio_id):
        project.verify(s, aid)
    v, a = [project.asset_path(s, key) for key in (video_id, audio_id)]
    vm, am = s["assets"][video_id]["media"], s["assets"][audio_id]["media"]
    fps = float(Fraction(video_stream(vm)["avg_frame_rate"]))
    if not any(x["codec_type"] == "audio" for x in am["streams"]):
        raise ValueError("Audio input has no audio stream")
    if abs(vm["duration"] - am["duration"]) > max(0.05, 1 / fps):
        raise ValueError("Audio/video duration mismatch; align explicitly before muxing")
    folder = project.path / "renders" / uid("mux")
    folder.mkdir(parents=True, exist_ok=False)
    out = folder / "film.mp4"
    run(["ffmpeg", "-v", "error", "-n", "-i", str(v), "-i", str(a), "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out)], timeout=1800)
    if packets(v) != packets(out):
        raise ValueError("Video packet payload/timing changed; render retained but not registered")
    aid = project.ingest(out, label, "render", deps=[video_id, audio_id])
    project.check(aid)
    with project.edit("mux-provenance") as state:
        state["assets"][aid]["operation"] = {"type": "mux", "video_packets_preserved": True, "audio_codec": "aac", "audio_bitrate": "192k"}
    return aid


def conform(project, spec):
    """CFR cut-only EDL; ranges are half-open and never include implicit handles."""
    parts = spec["parts"]
    if not isinstance(parts, list) or not 1 <= len(parts) <= 32:
        raise ValueError("Conform supports 1..32 explicitly bounded pieces")
    s = project.read()
    inputs, filters, deps, signature, total = [], [], [], None, 0
    verified = {}
    for i, part in enumerate(parts):
        aid = part["asset"]
        project.verify(s, aid)
        path = project.asset_path(s, aid)
        stream = video_stream(s["assets"][aid]["media"])
        sig = (stream["width"], stream["height"], Fraction(stream["avg_frame_rate"]))
        if sig[2] <= 0 or signature is not None and sig != signature:
            raise ValueError("All sources must have matching dimensions and CFR frame rate")
        signature = sig
        if aid not in verified:
            timing = json.loads(run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_frames", "-show_entries", "frame=best_effort_timestamp_time", "-of", "json", str(path)], timeout=1800))["frames"]
            times = [float(f["best_effort_timestamp_time"]) for f in timing]
            if any(abs(b - a - float(1 / sig[2])) > 0.0001 for a, b in zip(times, times[1:])):
                raise ValueError("VFR/discontinuous source: normalize explicitly first")
            verified[aid] = len(times)
        start, end = part["in_frame"], part["out_frame"]
        if type(start) is not int or type(end) is not int or not 0 <= start < end <= verified[aid]:
            raise ValueError("Invalid half-open source frame range")
        total += end - start
        deps.append(aid)
        inputs += ["-i", str(path)]
        filters.append("[%d:v:0]trim=start_frame=%d:end_frame=%d,setpts=PTS-STARTPTS[v%d]" % (i, start, end, i))
    filters.append("".join("[v%d]" % i for i in range(len(parts))) + "concat=n=%d:v=1:a=0[out]" % len(parts))
    folder = project.path / "renders" / uid("conform")
    folder.mkdir(parents=True, exist_ok=False)
    out = folder / "silent.mp4"
    run(["ffmpeg", "-v", "error", "-n", *inputs, "-filter_complex", ";".join(filters), "-map", "[out]", "-an", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(signature[2]), "-movflags", "+faststart", str(out)], timeout=1800)
    stream = video_stream(probe(out))
    if int(stream.get("nb_frames", -1)) != total:
        raise ValueError("Conform frame count mismatch; output not registered")
    aid = project.ingest(out, spec.get("label", "CFR conform"), "visual", deps=list(dict.fromkeys(deps)))
    project.check(aid)
    with project.edit("conform-provenance") as state:
        state["assets"][aid]["operation"] = {"type": "conform", "spec": spec, "expected_frames": total, "range_convention": "[in_frame, out_frame)"}
    return aid
