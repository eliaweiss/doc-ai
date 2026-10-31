// The YouTube thumbnail, saved as a 1280 x 720 PNG at video/thumbnail.png.
// From assets/images/thumbnail-chatgpt.png (made with ChatGPT Image) when it
// exists; otherwise from the video's first frame (compositions/cover.html).
//
// Usage: node scripts/thumbnail.mjs
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, "thumbnail.png");
const IMAGE = path.join(ROOT, "assets/images/thumbnail-chatgpt.png");

function firstFrame() {
  const log = execFileSync("npx", ["--yes", "hyperframes@0.8.220", "snapshot", "--at", "0"], { cwd: ROOT, encoding: "utf8" });
  const frame = log.match(/\S+frame-00-at-0s\.png/)?.[0];
  if (!frame || !fs.existsSync(frame)) throw new Error("No snapshot of frame 0 found in:\n" + log);
  return frame;
}

const source = fs.existsSync(IMAGE) ? IMAGE : firstFrame();
// Fill 16:9 (cropping any small difference in shape), then scale down
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", source,
  "-vf", "scale=1280:720:force_original_aspect_ratio=increase:flags=lanczos,crop=1280:720", OUT]);
const kb = Math.round(fs.statSync(OUT).size / 1024);
console.log(`[thumbnail] ${path.relative(ROOT, OUT)} from ${path.relative(ROOT, source)} (1280x720, ${kb} KB)`);
