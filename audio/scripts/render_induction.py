#!/usr/bin/env python3
"""
Render Astral Projection LG induction scripts via OmniVoice.

Splits scripts/induction.{en,de}.txt at SEGMENT boundaries, calls OmniVoice
TTS for each segment with ref_audio_path resolution + retry-with-backoff,
then concats WAVs into final mp3.

Inputs:
  --lang en|de    language code; selects which script and output filename
  --voice ID      OmniVoice voice ID (default: d9283bb95622 = Jessa Lynn)
  --num-step N    quality preset (default: 32)

Outputs:
  audio/tracks/induction-{lang}.mp3
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path("/Users/loomisgreen/Lumina Green AI/Projects/Astral Projection LG")
SCRIPT_DIR = ROOT / "audio" / "scripts"
SEG_DIR = ROOT / "audio" / "segments"
TRACK_DIR = ROOT / "audio" / "tracks"
BASE = "https://loomisgreen-alienware-aurora-r16.tail2eb3c3.ts.net/realtime-api"

# ---------- helpers ----------

def split_segments(text: str) -> list[str]:
    """Split a script on # ==== SEGMENT N — TITLE ==== markers, return only the prose."""
    parts = re.split(r"# =+\n# SEGMENT \d+.*?\n# =+\n", text)
    # strip comments-only blocks (header/footer)
    segs = []
    for p in parts:
        body = "\n".join(
            line for line in p.splitlines()
            if not line.lstrip().startswith("#")
        ).strip()
        if body:
            segs.append(body)
    return segs

def lookup_ref(voice_id: str, retries: int = 3) -> tuple[str, str]:
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                f"{BASE}/api/voices/lookup",
                data=json.dumps({"ids": [voice_id]}).encode(),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=30) as r:
                d = json.loads(r.read())
            info = d[voice_id]
            return info["ref_audio_path"], info.get("ref_text", "") or ""
        except Exception as e:
            last_err = e
            if attempt < retries - 1:
                time.sleep(0.4 * (2 ** attempt))
    raise RuntimeError(f"voice lookup failed: {last_err}")

def tts_segment(text: str, voice_id: str, ref_audio_path: str, ref_text: str,
                num_step: int, out_path: Path, retries: int = 3) -> int:
    """Render one segment. Returns bytes written."""
    payload = {
        "input": text,
        "response_format": "wav",
        "num_step": num_step,
        "ref_audio_path": ref_audio_path,
        "ref_text": ref_text,
    }
    body = json.dumps(payload).encode()
    delays = [0.2, 0.4, 0.8]
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                f"{BASE}/v1/audio/speech",
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=120) as r:
                audio = r.read()
            if len(audio) < 1000:
                raise RuntimeError(f"audio too small ({len(audio)} B)")
            out_path.write_bytes(audio)
            return len(audio)
        except urllib.error.HTTPError as e:
            try:
                err = e.read().decode("utf-8", "replace")[:200]
            except Exception:
                err = "<unreadable>"
            print(f"  ! HTTP {e.code}: {err}", file=sys.stderr)
            if e.code in (502, 503, 504) and attempt < retries - 1:
                time.sleep(delays[attempt]); continue
            raise
        except Exception as e:
            print(f"  ! attempt {attempt+1} ERR: {e}", file=sys.stderr)
            if attempt < retries - 1:
                time.sleep(delays[attempt]); continue
            raise
    raise RuntimeError("tts segment: gave up")

def probe_duration(path: Path) -> float:
    """Return seconds of an audio file via ffprobe (uses macOS afconvert fallback)."""
    try:
        out = subprocess.check_output([
            "ffprobe", "-v", "error", "-show_entries",
            "format=duration", "-of", "default=nw=1:nk=1", str(path)
        ], stderr=subprocess.DEVNULL, timeout=10)
        return float(out.decode().strip())
    except Exception:
        return 0.0

# ---------- main ----------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", choices=["en", "de"], required=True)
    ap.add_argument("--voice", default="d9283bb95622")
    ap.add_argument("--num-step", type=int, default=32)
    args = ap.parse_args()

    SEG_DIR.mkdir(parents=True, exist_ok=True)
    TRACK_DIR.mkdir(parents=True, exist_ok=True)

    src = SCRIPT_DIR / f"induction.{args.lang}.txt"
    print(f"→ rendering language={args.lang} voice={args.voice} num_step={args.num_step}")
    print(f"  source: {src}")

    segments = split_segments(src.read_text())
    print(f"  segments: {len(segments)}")

    word_total = sum(len(s.split()) for s in segments)
    print(f"  total words: {word_total}")
    print(f"  est minutes @115wpm: {word_total / 115:.1f}")

    ref_audio_path, ref_text = lookup_ref(args.voice)
    print(f"  ref_audio_path: {ref_audio_path}")
    print(f"  ref_text len: {len(ref_text)}")

    wavs = []
    for i, seg in enumerate(segments, 1):
        wav_path = SEG_DIR / f"induction-{args.lang}-seg{i:02d}.wav"
        print(f"\n  --- segment {i}/{len(segments)} ({len(seg.split())} words) ---")
        if wav_path.exists() and wav_path.stat().st_size > 1000:
            print(f"  exists, skipping render: {wav_path}")
        else:
            print(f"  rendering → {wav_path.name}")
            n = tts_segment(seg, args.voice, ref_audio_path, ref_text,
                            args.num_step, wav_path)
            print(f"  ✓ {n} bytes")
        wavs.append(wav_path)

    # Stitch WAVs into one WAV with ffmpeg, then encode MP3
    concat_list = SEG_DIR / f"_concat-{args.lang}.txt"
    with concat_list.open("w") as f:
        for w in wavs:
            f.write(f"file '{w.resolve()}'\n")

    merged_wav = SEG_DIR / f"induction-{args.lang}-merged.wav"
    print(f"\n  concat → {merged_wav}")
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", str(concat_list),
        "-c", "copy", str(merged_wav)
    ], check=True, stderr=subprocess.DEVNULL)

    final_mp3 = TRACK_DIR / f"induction-{args.lang}.mp3"
    print(f"  encode → {final_mp3}")
    subprocess.run([
        "ffmpeg", "-y", "-i", str(merged_wav),
        "-codec:a", "libmp3lame", "-b:a", "128k",
        "-ac", "1",  # mono - half the file size for spoken word
        str(final_mp3)
    ], check=True, stderr=subprocess.DEVNULL)

    dur = probe_duration(final_mp3)
    size_kb = final_mp3.stat().st_size // 1024
    print(f"\n✓ done: {final_mp3} ({size_kb} KB, {dur/60:.1f} min)")

if __name__ == "__main__":
    main()
