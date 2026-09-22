"""Create an isolated synthetic browser QA project; never import real media."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from core import Project, run


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("workspace")
    args = parser.parse_args()
    project = Project.create(Path(args.workspace) / "browser-fixture", "隔离验收 · 合成测试素材")
    for color, role in (("blue", "render"), ("green", "source")):
        path = project.path / (color + ".mp4")
        run(["ffmpeg", "-v", "error", "-n", "-f", "lavfi", "-i", "color=c=%s:s=320x180:r=24:d=2" % color, "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(path)])
        project.ingest(path, color + " synthetic candidate", role)
    with project.edit("qa-fixture") as s:
        s["notes"] = ["仅测试 UI 写入、审阅门禁和导出，不是实际影片的人工作品验收。"]
    print(json.dumps({"project": str(project.path), "latest_render": project.read()["latest_render"]}))


if __name__ == "__main__":
    main()
