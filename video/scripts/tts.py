#!/usr/bin/env python3
"""Voice-over for the walkthrough video, from script/narration.json.

Each sentence goes to the local Pocket TTS server on its own (it reads one
sentence better than a whole paragraph), the same way pocket-speak sends
them. Clips are cached by their spoken text, so editing one sentence only
re-synthesizes that sentence.

Output:
  assets/voice/<scene>.mp3   one file per scene: its sentences with pauses
  assets/voice/timing.json   per scene: duration and each sentence's start/end

Usage: python3 scripts/tts.py [--force]
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "script", "narration.json")
OUT = os.path.join(ROOT, "assets", "voice")
CACHE = os.path.join(ROOT, ".cache", "tts")
TTS_URL = os.environ.get("POCKET_TTS_URL", "http://127.0.0.1:8123/tts")
RATE = 24000  # Pocket TTS output: 24 kHz mono 16-bit


def spoken(sentence):
    """What the voice reads: 'say' if given, with pocket-speak's TTS cleanups."""
    text = sentence.get("say", sentence["text"])
    # Pocket TTS reads "DocAI" as "DocA"; as two words it says "Doc AI"
    text = re.sub(r"\bDocAI\b", "Doc AI", text)
    text = text.replace("#", "")  # Pocket TTS mangles "#"
    text = re.sub(r"(?<=\w)\.(?=\w)", " dot ", text)  # "main.py" -> "main dot py"
    return re.sub(r"[ \t]{2,}", " ", text).strip()


def synthesize(text, path):
    body = urllib.parse.urlencode({"text": text}).encode("utf-8")
    request = urllib.request.Request(
        TTS_URL, data=body, method="POST",
        headers={"content-type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(request, timeout=300) as response:
        data = response.read()
    raw = path + ".raw.wav"
    with open(raw, "wb") as f:
        f.write(data)
    # The streamed WAV header has no real length; re-encode, and trim the
    # silence at both ends so pauses between sentences are ours to set.
    trim = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", raw,
         "-af", f"{trim},areverse,{trim},areverse",
         "-ar", str(RATE), "-ac", "1", "-c:a", "pcm_s16le", path],
        check=True)
    os.remove(raw)


def duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", path], capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


def silence(seconds, path):
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i",
         f"anullsrc=r={RATE}:cl=mono", "-t", f"{seconds:.3f}",
         "-c:a", "pcm_s16le", path], check=True)


def main():
    force = "--force" in sys.argv
    script = json.load(open(SCRIPT))
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(CACHE, exist_ok=True)
    pause = script["pauseAfterSentence"]
    gap = os.path.join(CACHE, f"silence-{pause}.wav")
    silence(pause, gap)

    timing = {"pauseAfterScene": script["pauseAfterScene"], "scenes": []}
    for scene in script["scenes"]:
        parts, sentences, t = [], [], 0.0
        for sentence in scene["sentences"]:
            text = spoken(sentence)
            key = hashlib.sha1(text.encode("utf-8")).hexdigest()[:16]
            clip = os.path.join(CACHE, f"{key}.wav")
            if force or not os.path.exists(clip):
                print(f"[tts] {scene['id']}: {text}", flush=True)
                synthesize(text, clip)
            # Optional silence before the sentence, e.g. for a title card
            before = sentence.get("pauseBefore", 0)
            if before:
                hold = os.path.join(CACHE, f"silence-{before}.wav")
                silence(before, hold)
                parts.append(hold)
                t += before
            d = duration(clip)
            sentences.append({"text": sentence["text"], "start": round(t, 3), "end": round(t + d, 3)})
            parts += [clip, gap]
            t += d + pause
        listing = os.path.join(CACHE, f"{scene['id']}.txt")
        with open(listing, "w") as f:
            f.writelines(f"file '{p}'\n" for p in parts)
        # Joined in the cache as WAV (exact length), saved to the repo as MP3
        wav = os.path.join(CACHE, f"{scene['id']}.wav")
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0",
             "-i", listing, "-c:a", "pcm_s16le", wav], check=True)
        mp3 = os.path.join(OUT, f"{scene['id']}.mp3")
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", wav,
             "-c:a", "libmp3lame", "-q:a", "3", mp3], check=True)
        timing["scenes"].append({
            "id": scene["id"], "title": scene["title"],
            "audio": f"assets/voice/{scene['id']}.mp3",
            "duration": round(duration(wav), 3), "sentences": sentences})
        print(f"[tts] {scene['id']}: {timing['scenes'][-1]['duration']:.1f}s", flush=True)

    with open(os.path.join(OUT, "timing.json"), "w") as f:
        json.dump(timing, f, indent=2)
    total = sum(s["duration"] for s in timing["scenes"])
    print(f"[tts] total voice {total:.1f}s across {len(timing['scenes'])} scenes")


if __name__ == "__main__":
    main()
