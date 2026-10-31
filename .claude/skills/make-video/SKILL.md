---
name: make-video
description: Make or change a narrated HyperFrames video in this repo (the DocAI walkthrough in video/, or a new one) - write narration, voice it with the local Pocket TTS server, build illustrated scenes with captions, capture real DocAI screens, check frames, render. Use when the user asks to update a section of the video, add a new section, re-voice or retime it, retake screenshots, change the cover, thumbnail or outro, render it, or create a new video from scratch.
---

# Make or change a video

The DocAI walkthrough lives in `video/` (read `video/README.md`). It is a HyperFrames project: HTML scenes animated with GSAP, a three.js layer behind them, a voice from Pocket TTS, rendered to MP4. The narration drives everything: the voice is generated per sentence, and every scene times its pictures to those sentences.

```
script/narration.json --npm run tts--> assets/voice/*.mp3 + timing.json --npm run build--> index.html (window.VO)
compositions/<scene>.html  <- one per narration scene, animated on window.VO / window.DOC
```

Pick the job, then follow its steps and the rules below:

- **Update a section**: change its narration, pictures or timing.
- **New section**: add a scene. In the DocAI video it goes before `outro`, which always stays last.
- **New video from scratch**: `bash .claude/skills/make-video/scripts/new-video.sh <folder> "<Title>"`, then fill it in.

## Before you start

- Run everything from the video folder (`cd video`). The CLI is pinned: `npx --yes hyperframes@0.8.220 …` (the npm scripts already do this).
- Pocket TTS must be up: `curl -s http://127.0.0.1:8123/health` → `{"status":"healthy"}`. If not, tell the user; don't fake audio.
- Studio (the user's preview) may be running: `npx hyperframes@0.8.220 preview --status`. Start it with `preview --background` only if the user wants to watch.
- `git status` first. **Studio writes into the scene files**: it stamps `data-hf-id` attributes, and its inspector inserts GSAP lines (one landed before `const tl` and froze a whole scene). To see real changes: `git diff <file> | sed -E 's/ data-hf-id="[^"]*"//g'`.

## The loop (every job)

1. **Narration** in `script/narration.json`: one sentence per entry (Pocket TTS reads single sentences best).
   - `text` is what shows in the caption; `say` is how to read it when that differs ("M C P", numbers spelled out). `DocAI` is sent as "Doc AI" automatically; never "Doc A.I.".
   - `pauseBefore: 1.6` adds silence before a sentence, for a title card.
   - Keep sentences short and spoken; the picture carries detail, not the voice.
2. `npm run tts`: only new or changed sentences are synthesized (cache in `.cache/tts/`). Check what was said: `~/.claude/skills/transcribe-bark/scripts/transcribe-bark.sh --no-speakers assets/voice/<scene>.mp3` (it can't tell similar-sounding words apart, so a match is necessary but not proof; ask the user to listen when it matters).
3. `npm run build`, then `npm run timing <scene>` for each sentence's time in the video.
4. Write or edit `compositions/<scene>.html`, following [references/scene-patterns.md](references/scene-patterns.md).
5. `npm run check`: fix every error. Warnings worth fixing: `line_unread` (hold longer), `text_below_floor` on real text (≥ 28 px), `content_overlap` (move things; use `data-layout-allow-overlap` only when the overlap is the point, like a stamp). Gray not-yet-spoken words fail contrast by design.
6. `npx hyperframes@0.8.220 snapshot --at <times>` at every beat you changed (from step 3), then **Read the contact sheet**. A passing check doesn't show a card stacked in a corner or a blank stretch.
7. Report what changed and ask before committing. **Render only when asked** (see Render).

## Rules that came from mistakes

**Pictures**
- One picture per sentence, the narration as a caption underneath (`DOC.captions`). No reading slides: the big text belongs to titles only.
- Show only what is said; put each thing on screen on the word that names it (`DOC.when`).
- When the topic changes (a new app, a new step), give it a title card in a pause (`pauseBefore`), or viewers miss the change.
- No empty stretches: when the illustrations step back (for the 3D graph, between sentences), something must still say what the voice says.
- Real UI is shown flat, never tilted into 3D; only generated pictures may tilt.
- Every placed element needs `position: absolute` (or the `abs` class). A forgotten one put a whole window in the top-left corner.

**Screens and data**
- Capture with `npm run capture <name>` (`scripts/capture.mjs`, 1440×900 at 2×). The browser tool's screenshots are 800 px wide: too soft for video.
- Screens show the user's **real data** and the repo is public: say so before committing new captures.
- **API keys**: a dialog that shows "Key ending in …" leaks it. Capture providers with no key set, and check every capture for keys, emails and tokens.
- Some states need temporary data changes (documents in the top folder, an unlinked match). Record the original state first, restore it through the app's own action, and verify the restore (counts, links) before you report.

**Code**
- Scene files: everything inside `<template>`; root `id="<scene>-root"` with `data-composition-id="<scene>"`; register `window.__timelines["<scene>"]`. Prefix every id with the scene's short name.
- `fromTo`, not `from`. A second tween on the same property: `immediateRender: false`. Start hidden elements hidden in CSS (`opacity: 0`), not with `tl.set(..., 0)`.
- `scripts/build.mjs` writes the shared helpers inside a JavaScript template string: a regex there needs `\\s`, not `\s` (a lost backslash split sentences on the letter "s").

## Render

Only when the user asks, in the background (it takes minutes per minute of video):

```bash
npx --yes hyperframes@0.8.220 render --output renders/<name>.mp4 --quality standard
```

Then check the file (`ffprobe` for duration and an audio stream), snapshot two or three frames from it if in doubt, and send it to the user with SendUserFile. `renders/` is git-ignored.

## Committing

Ask first. Commit `script/narration.json`, `assets/voice/` (MP3s and `timing.json`), new `assets/screens/`, `compositions/`, `index.html` and `scripts/`. Caches, renders and `.hyperframes/` are ignored by `video/.gitignore`.
