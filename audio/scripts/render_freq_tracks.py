#!/usr/bin/env python3
"""
Astral Projection LG — binaural beat + ambient drone generator.

Binaural beats: two slightly different frequencies (e.g. 200 Hz left, 204 Hz right)
produce a perceived 4 Hz theta pulsation when listened to on stereo headphones.
This is the "Hemi-Sync" / "Focus 10" floor used by the Monroe Institute.

Outputs:
  audio/tracks/01-binaural-4hz-15min.wav
  audio/tracks/03-drone-ambient-15min.wav

Both written at 44.1 kHz, 16-bit, stereo (binaural) / stereo (drone).
Math only — no API calls.
"""

import math
import struct
import wave
from pathlib import Path

ROOT = Path("/Users/loomisgreen/Lumina Green AI/Projects/Astral Projection LG")
TRACK_DIR = ROOT / "audio" / "tracks"
TRACK_DIR.mkdir(parents=True, exist_ok=True)

SR = 44100  # CD quality

def write_wav(path: Path, samples_l, samples_r=None, sr=SR):
    """Write a stereo 16-bit WAV. If samples_r is None, mono is duplicated to both channels."""
    n = len(samples_l)
    if samples_r is None:
        samples_r = samples_l
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)  # 16-bit
        w.setframerate(sr)
        frames = bytearray()
        for L, R in zip(samples_l, samples_r):
            L = max(-1.0, min(1.0, L))
            R = max(-1.0, min(1.0, R))
            frames.extend(struct.pack("<hh", int(L * 32760), int(R * 32760)))
        w.writeframes(bytes(frames))

# ---------- Binaural beat 4 Hz theta ----------

def render_binaural(duration_min: int = 15, beat_hz: float = 4.0,
                    base_hz: float = 200.0, amp: float = 0.45) -> Path:
    n = int(duration_min * 60 * SR)
    # Frequency-difference perception works best with base frequencies in 100-300 Hz range
    left = base_hz
    right = base_hz + beat_hz  # 204 Hz → perceives 4 Hz pulsation

    print(f"→ generating binaural beat: {duration_min} min, {beat_hz} Hz beat "
          f"({left:.0f} Hz L / {right:.0f} Hz R)")
    samples_l = []
    samples_r = []
    # fade in / fade out 5 seconds
    fade_n = 5 * SR
    for i in range(n):
        t = i / SR
        L = amp * math.sin(2 * math.pi * left * t)
        R = amp * math.sin(2 * math.pi * right * t)
        # envelope
        env = 1.0
        if i < fade_n:
            env = i / fade_n
        elif i > n - fade_n:
            env = (n - i) / fade_n
        samples_l.append(L * env)
        samples_r.append(R * env)
    out = TRACK_DIR / f"01-binaural-{beat_hz:.0f}hz-{duration_min}min.wav"
    write_wav(out, samples_l, samples_r)
    print(f"✓ wrote {out}")
    return out

# ---------- Ambient drone ~40 Hz fundamental + soft harmonics ----------

def render_drone(duration_min: int = 15) -> Path:
    n = int(duration_min * 60 * SR)
    print(f"→ generating ambient drone: {duration_min} min, root ~40 Hz")

    # Layered soft sine waves with slight detuning for warmth
    # + slow LFO on amplitude to feel "breathing"
    layers = [
        (40.0,  0.30),  # fundamental
        (60.0,  0.18),  # 5th
        (80.0,  0.12),  # octave
        (120.0, 0.07),  # 5th above octave - breathy
        (160.0, 0.04),  # top voice - shimmer
    ]
    lfo_hz = 0.08  # 1 cycle per 12.5 seconds — feels like slow breathing

    samples = []
    fade_n = 8 * SR
    for i in range(n):
        t = i / SR
        # LFO envelope (-3% to +3%) so the drone feels alive but not pulsing
        env_lfo = 1.0 + 0.03 * math.sin(2 * math.pi * lfo_hz * t)
        s = 0.0
        for freq, a in layers:
            s += a * math.sin(2 * math.pi * freq * t)
        s *= env_lfo
        # global fade in/out
        fade = 1.0
        if i < fade_n:
            fade = i / fade_n
        elif i > n - fade_n:
            fade = (n - i) / fade_n
        samples.append(s * fade * 0.55)  # overall amplitude safety

    out = TRACK_DIR / f"03-drone-ambient-{duration_min}min.wav"
    write_wav(out, samples, samples)  # stereo same both channels
    print(f"✓ wrote {out}")
    return out

def main():
    bin_path = render_binaural(15)
    drone_path = render_drone(15)
    print(f"\nready: {bin_path.name}  +  {drone_path.name}")

if __name__ == "__main__":
    main()
