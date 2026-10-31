#!/usr/bin/env bash
# Scaffold a new narrated HyperFrames video next to video/, with the same
# pipeline (Pocket TTS voice, build, timing, captions, capture, thumbnail).
#
# Usage: bash .claude/skills/make-video/scripts/new-video.sh <folder> "<Title>"
#   e.g. bash .claude/skills/make-video/scripts/new-video.sh video-reconciliation "Reconciling with DocAI"
#
# It writes a two-scene starter (intro, outro) with placeholder pictures;
# no 3D world and no cover (add compositions/world.html or cover.html later
# to get them; scripts/build.mjs picks them up when they exist).
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <folder> \"<Title>\"" >&2
  exit 2
fi
REPO="$(git rev-parse --show-toplevel)"
SRC="$REPO/video"
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$REPO/$1"
TITLE="$2"
SLUG="$(basename "$DEST")"

if [ -e "$DEST" ]; then
  echo "$DEST already exists" >&2
  exit 1
fi

mkdir -p "$DEST"/{compositions,script,scripts,assets/voice,assets/screens,assets/images}

# The pipeline, unchanged
cp "$SRC"/scripts/{build.mjs,tts.py,timing.mjs,thumbnail.mjs} "$DEST/scripts/"
cp "$SRC"/{hyperframes.json,CLAUDE.md,AGENTS.md,.gitignore} "$DEST/"

# capture.mjs: keep the helpers, drop the DocAI-specific screens
python3 - "$SRC/scripts/capture.mjs" "$DEST/scripts/capture.mjs" <<'EOF'
import re, sys
src, dest = sys.argv[1], sys.argv[2]
s = open(src).read()
start = s.index("const SHOTS = {")
end = s.index("\n};\n", start) + 4
s = s[:start] + "const SHOTS = {\n  // name: { url, then?: async (page) => {...}, settle?: ms, element?: selector },\n};\n" + s[end:]
open(dest, "w").write(s)
EOF

# package.json and meta.json, renamed
python3 - "$SRC/package.json" "$DEST/package.json" "$SLUG" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1]))
d["name"] = sys.argv[3]
json.dump(d, open(sys.argv[2], "w"), indent=2)
open(sys.argv[2], "a").write("\n")
EOF
printf '{\n  "id": "%s",\n  "name": "%s",\n  "createdAt": "%s"\n}\n' "$SLUG" "$SLUG" "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" > "$DEST/meta.json"

# Starter narration and scenes
python3 - "$DEST/script/narration.json" "$TITLE" <<'EOF'
import sys
path, title = sys.argv[1], sys.argv[2]
q = lambda s: s.replace("\\", "\\\\").replace('"', '\\"')
open(path, "w").write(f'''{{
  "_comment": "Narration for {q(title)}, one sentence per entry (Pocket TTS reads single sentences best). 'say' is what the voice reads when it differs from the on-screen text; 'pauseBefore' adds that many seconds of silence before the sentence (room for a title card). The outro always stays last.",
  "pauseAfterSentence": 0.35,
  "pauseAfterScene": 0.8,
  "scenes": [
    {{
      "id": "intro",
      "title": "{q(title)}",
      "sentences": [
        {{ "text": "This is {q(title)}." }},
        {{ "text": "Replace these sentences with the story, one sentence per entry." }}
      ]
    }},
    {{
      "id": "outro",
      "title": "{q(title)}",
      "sentences": [
        {{ "text": "{q(title)}." }},
        {{ "text": "The closing line goes here." }}
      ]
    }}
  ]
}}
''')
EOF
esc() { printf '%s' "$1" | sed -e 's/[\/&|]/\\&/g'; }
sed -e "s|__ID__|intro|g" -e "s|__TITLE__|$(esc "$TITLE")|g" "$SKILL/templates/scene.html" > "$DEST/compositions/intro.html"
sed -e "s|__TITLE__|$(esc "$TITLE")|g" "$SKILL/templates/outro.html" > "$DEST/compositions/outro.html"

cat > "$DEST/README.md" <<EOF
# $TITLE

A narrated video made with [HyperFrames](https://hyperframes.heygen.com), with the same pipeline as [video/](../video/README.md): narration in \`script/narration.json\`, \`npm run tts\` (Pocket TTS), \`npm run build\`, scenes in \`compositions/\`, \`npm run check\`, then render.
EOF

echo "Created $DEST"
echo "Next:"
echo "  cd $1 && npm install"
echo "  edit script/narration.json, then: npm run tts && npm run build && npm run check"
