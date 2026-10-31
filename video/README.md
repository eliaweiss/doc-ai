# DocAI walkthrough video

A narrated walkthrough of the main README, made with [HyperFrames](https://hyperframes.heygen.com) (HTML + GSAP + three.js, rendered to MP4). It covers the README up to the Mini apps section, then setting DocAI up and adding a first document (from [docs/setup-wizard.md](../docs/setup-wizard.md)), then three mini apps in use (from [docs/mini-app-examples.md](../docs/mini-app-examples.md)), and ends on the outro, which always stays last.

## How it's made

1. **Narration** is written in [script/narration.json](script/narration.json), one sentence per entry. `text` is what the sentence says; `say` is how the voice should read it when that differs (for example "Doc A I" for DocAI, "M C P" for MCP).
2. **Voice:** `python3 scripts/tts.py` sends each sentence on its own to the local Pocket TTS server (`POCKET_TTS_URL`, default `http://127.0.0.1:8123/tts`), the same way pocket-speak does. It writes one MP3 per scene and `assets/voice/timing.json` with every sentence's start and end. Clips are cached in `.cache/tts/`, so editing one sentence re-synthesizes only that one.
3. **Screenshots:** `node scripts/capture.mjs` takes 2880×1800 screenshots of a running DocAI with headless Chrome. Pages are only read, never changed. `DOCAI_URL` is the instance with real data; `SAMPLE_URL` and `SAMPLE_DOC` point at an instance holding the sample invoice from `docs/samples/`; `WIZARD_URL` at a build with the AI setup wizard, whose dialogs are captured on their own (no keys may be set for the provider shown, or their last characters appear). The `ex-*` mini app captures need two temporary states: `ex-folders` needs documents in the top folder (`ex-folders-done` clicks Move all 100%, which files them back), and `ex-recon-suggest` needs an unlinked suggested match (`ex-recon-done` clicks Reconcile, which links it again).
4. **Build:** `node scripts/build.mjs` writes `index.html` from the timing: one scene per narration section, the voice clips, and `window.VO`, which the scenes use to show each word as it's spoken.
5. **Scenes** are in [compositions/](compositions), one file per section. The video opens on [cover.html](compositions/cover.html), a title card with no narration (its length is `COVER` in `scripts/build.mjs`); `npm run thumbnail` saves its first frame as the 1280×720 YouTube thumbnail, `thumbnail.png`. [world.html](compositions/world.html) is the three.js layer behind them: paper documents that scatter, gather into one place and become the money-flow graph, with the camera flying through them between scenes.
6. **Check and render:**

```bash
npm run check
npx hyperframes@0.8.220 snapshot --at 5,30,60
npx hyperframes@0.8.220 render --output renders/docai-readme.mp4 --quality standard
```

After changing the narration, run steps 2 and 4 again; the scenes follow the new timing on their own.

## Look

Based on Anthropic's "Introducing Claude Duet" video: a flat lavender-gray ground, black serif lines (EB Garamond) whose words darken from light gray as they're spoken, one clay accent, real UI shown flat (never tilted), and no hard cuts. three.js is used only for generated content: the documents and the graph.
