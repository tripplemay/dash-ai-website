---
name: video-production
description: Produce and revise AI-assisted promotional, educational, and product videos using versioned assets, semantic narration, shot-level review, local conform, and gated delivery. Use for starting a video project, continuing production, fixing a shot or narration passage, comparing versions, or operating the local video review workbench.
---

# Video production

Treat this skill folder as `$SKILL_ROOT`; projects and large media belong outside it.
Use `python3 "$SKILL_ROOT/scripts/video.py" --help` for the executable interface.
Requires Python 3.9+, ffmpeg and ffprobe. The standalone workbench needs no Next.js,
Node server, API key or paid generation to operate.

## Choose the mode

- New brief, script, shot plan, or production: read [production.md](references/production.md).
- Narration, emotion, voice consistency, or a mis-segmented sentence: read [voice.md](references/voice.md).
- Local revisions, temporal continuity, CFR cuts, audio replacement: read [conform.md](references/conform.md).
- Project ledger, task recovery, workbench, approval or export: read [operations.md](references/operations.md).

Do not read every reference for a narrow task.

## Non-negotiable production distinctions

1. Inspect current artifacts, SHA and approvals before acting. Historical notes do not
   override current outputs. Different visual, UI and voice branches can have different timelines.
2. A generated result is a candidate, not an approved shot. A shot approval is not
   an end-to-end approval. Record visual, voice, music and UI decisions separately.
3. Work on one meaningful unit: a continuous action or a complete spoken thought.
   Verify a contextual pilot before producing all dependent material.
4. Keep originals and approved versions immutable. Ingest new revisions under new IDs.
   Review clips may contain handles; conform only the explicit source frame range.
5. Technical checks do not establish artistic quality, emotion, speech rhythm,
   copyright, device playback or a user's approval. Never supply human approvals yourself.
6. Unknown task status is not permission to submit again. Persist request and inputs
   before a paid action; save the original provider ID and recover that task.
7. Use the user's requested provider/preset, not an approximation with the same label.
   Dreamina CLI image/video support does not imply support for its webpage TTS voices.
8. Do not call paid generation or change a delivery merely to study a workflow.
   Confirm actual authorization, scope and cost limit before the external action.

For each iteration report: changed and preserved scope; technical evidence;
remaining human decision; review entry; actual/unknown cost and next step.

## Start / resume

New project: copy `assets/PROJECT.md` and `assets/brief.json` into a separate project
directory; fill the brief, then `init --title ... --brief ...`. Register external source
roots explicitly with `root`, or place sources inside the project before `ingest`.

Existing project: run `status`, inspect latest render, layer approvals, dependencies,
open comments and unknown jobs. Prefer the workbench for timecoded user feedback.
Keep unrelated files, global memory and website deployment untouched.

The implementation is a local single-user toolkit, not an online editor or a fully
automatic producer. Paid submit, webpage TTS, ASR/alignment, mixing and creative
generation are deliberate external/manual steps; record their outputs and provenance.
