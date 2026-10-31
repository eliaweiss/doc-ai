# Scene patterns

How the scenes in `video/compositions/` are built. Copy from the scene named next to each pattern; it is the working example.

## Look

From Anthropic's "Introducing Claude Duet" video:
- **Ground and colours:** a flat lavender-gray ground (`--ground: #ccc9db`), near-black ink (`--ink`), and one clay accent (`--clay: #c96442`). Text accents use `--clay-text: #9b3d20`, which has enough contrast on the ground.
- **Type:** serif lines in EB Garamond (`.serif`, `.h1`–`.h3`, `.huge`), and Inter for UI (`.sans`, `.chip`).
- **Motion:** words darken from light gray as they're spoken, and there are no hard cuts.

The variables and classes are defined in the `<head>` that `scripts/build.mjs` writes. Use those classes instead of new colours.

## Scene skeleton

`templates/scene.html` in this skill, also what `new-video.sh` writes:

```html
<template>
  <div id="ex-root" class="scene" data-composition-id="ex" data-width="1920" data-height="1080">
    <style>
      #ex-root { position: absolute; inset: 0; }
      #ex-root .slide { position: absolute; inset: 0; }
      /* every placed element: position absolute */
    </style>
    <div id="ex-1" class="slide">…picture for sentence 1…</div>
    <div id="ex-caps" class="caps"></div>
  </div>
  <script>
    (function () {
      const D = window.DOC, id = "ex", end = window.VO.scenes[id].duration;
      const $ = (s) => document.querySelector(s);
      const tl = gsap.timeline({ paused: true });
      const at = (i) => D.at(id, i), to = (i) => D.end(id, i), when = (i, w) => D.when(id, i, w);
      const fadeIn = (el, t, o) => D.blurIn(tl, typeof el === "string" ? $(el) : el, t, o);
      const fadeOut = (el, t, o) => D.blurOut(tl, typeof el === "string" ? $(el) : el, t, o);

      D.captions(tl, $("#ex-caps"), id, 0);          // the narration under the pictures
      fadeIn("#ex-1", at(1) - 0.15, { y: 60, duration: 0.7, blur: 6 });
      fadeOut("#ex-1", at(2) - 0.3, { y: -30 });     // leave before the next sentence

      window.__timelines = window.__timelines || {};
      window.__timelines[id] = tl;
    })();
  </script>
</template>
```

Times are in **scene time**: seconds from the scene's start, the lead included.

## `window.DOC` helpers

These are defined in the `scripts/build.mjs` head:

| Helper | What it does |
|---|---|
| `D.at(id, i)` / `D.end(id, i)` | When sentence `i` starts and ends |
| `D.when(id, i, "word")` | When the first word starting with "word" is spoken (estimated by word length) |
| `D.captions(tl, el, id, first, last?)` | The narration as captions in `el`: each shows during its sentence, its words darkening as spoken |
| `D.speak(tl, el, id, i)` | Darken `el`'s words as sentence `i` speaks them (for a title that is the sentence) |
| `D.words(tl, el, t0, t1)` | Darken `el`'s words evenly from `t0` to `t1` (a line that condenses the sentence) |
| `D.blurIn(tl, el, t, {y, x, scale, blur, duration, ease})` | Arrive: fade in with the blur clearing |
| `D.blurOut(tl, el, t, {...})` | Leave: one quick blur-out |

Inner `.accent` spans keep their colour when words darken.

## Timing habits

- Enter about 0.15 s before a sentence and leave about 0.3 s before the next one. Put details on their words with `when`.
- A line must hold for at least 0.5 s + 0.3 s per word; `check` reports `line_unread`.
- The last thing in a scene leaves at `end - 0.45`, and the next scene enters through the 3D camera flight.

## Patterns

**Illustrated slide with caption** (`why.html`, `intro.html`, `miniapps.html`)
- One `.slide` per sentence, drawn in HTML and SVG: paper documents (`.ill-doc`), cards, chips and icons.
- Its parts arrive on their words.
- The caption sits underneath, at `top: 850px`, so keep pictures above y ≈ 800.

**One diagram that grows** (`why.html` slides 1–2, `intro.html` slides 1–3)
- The next sentence adds to the same picture instead of replacing it: badges, labels, a window shrinking into a laptop.
- This reads better than cutting to a new slide.

**Real screen in a frame** (`examples.html`, `how.html`)
- A 1120×700 `.ex-frame` holding a 1440×900 capture shown at 0.778×.
- Inside it, a zoom wrapper is tweened for punch-ins. App pages have wide margins, so start at about 1.25×.
- Highlight boxes (`.ex-hl`) are positioned in that wrapper.
  - To find their coordinates, read the capture at 720 px wide; ×2 gives CSS pixels, then multiply by the frame scale.
  - Snapshot to check they land on the right rows.
- Change state by cross-fading stacked captures (`swap`), and use a short dark flash on a button for a press.

**Title card** (`examples.html`)
- "MINI APP 1 OF 3", an icon tile and the name in large serif type.
- It shows in a `pauseBefore` gap and holds while the name is spoken, then the screens rise in.

**Chat or terminal** (`mcp.html`, `examples.html`, `use.html`)
- Peach `.bubble`s stack from the bottom, and the stack moves up one row per message.
- Terminal lines type out with a `clip-path`/`maxWidth` tween and `ease: "steps(n)"`.

**Worked example** (`how.html`, `intro.html`, `firstdoc.html`)
- One real input carried through every step: the sample invoice (`assets/images/sample-invoice.png`, from `docs/samples/`), then its fields, its table row, and the payment it's linked to.

**The 3D world** (`world.html`, DocAI video only)
- Paper documents in depth, with a camera flight at every scene change.
- Its moments are keyed to phrases in the `T` object: scatter (Why), gather, the money-flow graph on "connects" and in the outro, and dimming behind busy scenes.
- When you add a scene with its own pictures, add a dim window for it there. When you rename a scene, update the `S.<id>` references.
- Draw only from time `t`: no clock and no `Math.random`.

**Cover and outro** (`cover.html`, `outro.html`)
- The cover is the first frame and the picture for the first sentence (`COVER` in `build.mjs`). Keep it visible at frame 0, with no fade-in.
- The outro is always the last scene in the narration.
- `npm run thumbnail` makes the 1280×720 YouTube thumbnail from `assets/images/thumbnail-chatgpt.png`, or from frame 0 if that image is missing.

## Captures

- `scripts/capture.mjs` has one entry per screen in `SHOTS`:
  - `url`, plus `then(page)` for clicks;
  - helpers `clickInApp`, `clickText`, `scrollTo` and `inApp` for mini app iframes;
  - `element` to capture a single dialog.
- Add an entry, then run `npm run capture <name>`.
- The headless Chrome has no built-in PDF viewer, so PDF panes come out blank. Show the document as its own image instead.
