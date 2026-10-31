// When each sentence plays in the finished video (root time), read from the
// built index.html: use these seconds for `hyperframes snapshot --at ...`.
//
// Usage: node scripts/timing.mjs [scene ...]   (no names: every scene)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const VO = JSON.parse(html.match(/window\.VO = (\{.*?\});\n/)[1]);
const only = process.argv.slice(2);

console.log(`total ${VO.total.toFixed(2)}s${VO.cover ? `, cover 0-${VO.cover.toFixed(2)}s` : ""}`);
for (const [id, scene] of Object.entries(VO.scenes)) {
  if (only.length && !only.includes(id)) continue;
  console.log(`\n${id}  ${scene.start.toFixed(2)}-${(scene.start + scene.duration).toFixed(2)}s`);
  scene.sentences.forEach((s, i) => {
    const a = (scene.start + s.start).toFixed(2), b = (scene.start + s.end).toFixed(2);
    console.log(`  ${String(i).padStart(2)}  ${a.padStart(7)}-${b.padStart(7)}  ${s.text}`);
  });
}
