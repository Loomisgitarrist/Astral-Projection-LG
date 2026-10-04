# Astral Projection LG — Audio Assets

This folder holds everything audio-related for the site: generated tracks, segment
renderings, and the source scripts in two languages.

## Folder layout

```
audio/
├── sample-60s.wav              ← initial 60-sec Jessa Lynn English sample
├── sample-de-60s.wav           ← initial 60-sec German sample in same voice
├── scripts/
│   ├── induction.en.txt        ← English induction (15-min target, Hybrid style)
│   ├── induction.de.txt        ← German induction (same pacing, meditation register)
│   ├── render_induction.py     ← calls OmniVoice TTS, segments, stitches, encodes mp3
│   └── render_freq_tracks.py   ← math-only binaural + monaural + drone generators (no API)
├── segments/                   ← per-segment WAV outputs from render_induction.py
└── tracks/                     ← final mp3 / wav tracks the website consumes
    ├── 01-binaural-4hz-15min.wav   (stereo — different tone each ear)
    ├── 02-monaural-4hz-15min.mp3   (mono — same signal both ears)
    ├── 02-induction-en.mp3
    ├── 02-induction-de.mp3
    └── 03-drone-ambient-15min.wav
```

## Voice

`d9283bb95622` — Jessa_Lynn_Female_ASMR (OmniVoice library).
Same voice used for both English and German (rural accent OK in this context;
hypnosis scripts forgive accent, the pacing matters more than the phoneme).

## Settings

- `num_step: 32` (balanced) — change to `64` in the script for higher quality at
  ~3× the generation cost.
- `speed: 1.0` (default, Jessa's natural pace).
- Sample rate 44.1 kHz, mono (voice) / stereo (binaural + drone).

## Regenerating

```bash
# English + German induction mp3s (requires OmniVoice reachable):
python3 scripts/render_induction.py --lang en
python3 scripts/render_induction.py --lang de

# Theta floor (binaural + monaural) + ambient drone (no API, math-only):
python3 scripts/render_freq_tracks.py
```

## Caching

The site service worker (`../sw.js`) includes all `tracks/*.mp3` and `tracks/*.wav`
in its precache list, so the audio is fully available offline once the page is
loaded once.

## Beats — mono vs stereo

The site's **Frequency output** switch selects between two 4 Hz theta-floor tracks:

- `tracks/01-binaural-4hz-15min.mp3` — **Stereo / binaural**: 200 Hz in the left ear,
  204 Hz in the right. The brainstem perceives the 4 Hz difference tone. Requires
  stereo headphones; if you pull one earbud out the beat disappears.
- `tracks/02-monaural-4hz-15min.mp3` — **Mono / monaural**: the same two tones
  (200 + 204 Hz) summed into one signal played identically in both ears. The 4 Hz
  beat is a *physical* amplitude beat, so it survives on a phone speaker or with a
  single earbud. Encoded as a single-channel mp3 for half the file size.

Both target the same 3–4 Hz theta-delta border · "mind awake, body asleep" state.
Note: for people with epilepsy or a seizure history, consult a doctor before using
brainwave-entrainment audio (the site shows this caution beside the player).

## i18n swap

The site audio player exposes a language pill (EN / DE). Both tracks play at the
same timecode and use the same binaural floor underneath.
