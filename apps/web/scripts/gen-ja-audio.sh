#!/bin/bash
# Pre-generate neural Japanese audio for all Japanese shadowing sentences.
# Requires: pip install edge-tts (set EDGE_TTS=/path/to/edge-tts), ffmpeg optional.
# Output: public/audio/ja/<materialId>/<sentenceId>.mp3 + manifest.json (whitespace-stripped text → file).
set -euo pipefail
cd "$(dirname "$0")/.."
EDGE_TTS="${EDGE_TTS:-edge-tts}"
VOICE="${VOICE:-ja-JP-NanamiNeural}"
OUT=public/audio/ja
mkdir -p "$OUT"
node -e '
const m=require("@toeicpass/shadowing-content");const man={};
for(const x of m.getShadowingMaterialsByLanguage("ja"))for(const s of x.sentences){man[s.text.replace(/\s+/g,"")]=x.id+"/"+s.id+".mp3";console.log(x.id+"\t"+s.id+"\t"+s.text.replace(/\n/g," "))}
require("fs").writeFileSync(process.argv[1],JSON.stringify(man));' "$OUT/manifest.json" |
while IFS=$'\t' read -r id sid text; do
  mkdir -p "$OUT/$id"; f="$OUT/$id/$sid.mp3"
  [ -s "$f" ] && continue
  for try in 1 2 3; do "$EDGE_TTS" --voice "$VOICE" --text "$text" --write-media "$f" >/dev/null 2>&1 && [ -s "$f" ] && break; sleep 2; done
done
echo "done: $(find "$OUT" -name '*.mp3' | wc -l) files"
