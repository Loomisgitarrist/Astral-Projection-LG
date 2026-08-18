# Astral Projection LG

A complete, research-backed guide to astral projection — what it is, what modern neuroscience makes of it, ancient and modern history, and a step-by-step practical guide to doing it yourself.

A bilingual (English / German) Progressive Web App with offline support and a guided audio session that talks you through the practice.

## Live pages

- **English:** `./index.html`
- **German (Deutsch):** `./de.html`

Both pages link to each other via the language pill in the top-right of the nav.

## What's inside

- **9 sections** of content — what it is, the brain science (temporal-parietal junction / dissociative states), ancient + modern history, what the experience is actually like, a 13-step practical guide, alternative entry methods (sleep paralysis, lucid-dream bridge, Yoga Nidra, Hemi-Sync, WBTB, float tanks), skeptical rebuttals, risks and side effects, FAQs.
- **Custom audio player** built into the Guide section — three layers running simultaneously:
  - **Binaural beat** (4 Hz theta, 200 Hz L / 204 Hz R, requires stereo headphones)
  - **Voice guide** (Jessa Lynn ASMR voice via OmniVoice TTS) — **English** and **German** versions
  - **Optional ambient drone** (40 Hz root + harmonics, off by default)
  - Independent volume mixers, progress bar with seek, language switch with time preservation
- **PWA-ready** — `manifest.webmanifest`, `sw.js`, 192/512/maskable icons, Apple touch icon, dark-purple theme, installable on iOS/Android/desktop, full offline support for all assets including audio (~46 MB install footprint).

## Stack

Pure static site. No build step, no framework, no dependencies.

```
.
├── index.html              English page
├── de.html                 German page (full translation, same structure)
├── styles.css              Dark-purple gradient theme, mobile responsive
├── app.js                  Nav, scroll-spy, mobile menu
├── app-audio.js            Custom audio player with i18n
├── sw.js                   Service worker (network-first HTML, cache-first assets)
├── manifest.webmanifest    PWA manifest
├── images/                 PWA icons + OG/WhatsApp previews
└── audio/
    ├── README.md
    ├── scripts/
    │   ├── induction.en.txt     English script source
    │   ├── induction.de.txt     German script source
    │   ├── render_induction.py  Regenerates induction-en.mp3 / induction-de.mp3
    │   └── render_freq_tracks.py Regenerates binaural + drone (numpy, no API)
    ├── segments/                intermediate per-segment WAVs (gitignored)
    ├── tracks/                  final mp3/opus consumed by the site
    ├── sample-60s.wav           pre-production samples (gitignored)
    └── sample-de-60s.wav
```

## Regenerating the audio

The two voice tracks are produced via the public OmniVoice TTS API
(voice `d9283bb95622` = "Jessa_Lynn_Female_ASMR"). The binaural and drone
tracks are pure-numpy and need no network call.

```bash
# Voice (English + German) — needs OmniVoice reachable:
python3 audio/scripts/render_induction.py --lang en
python3 audio/scripts/render_induction.py --lang de

# Binaural + drone — math only:
python3 audio/scripts/render_freq_tracks.py
```

See `audio/README.md` for the full asset layout and notes on regeneration.

## Browser support

Modern browsers (Chrome, Edge, Firefox, Safari 16+). iOS Safari has audio
autoplay restrictions that require a tap on the play button — handled
gracefully by the player's `loadedmetadata` / `canplay` listeners.

## License

TBD by the project owner.

## Source / inspiration

Part of the content structure was inspired by a class-project reference
(`other ideas/astral-projection--main/`, kept locally for historical reference
but not shipped in the app).

---

Looking to learn astral projection? Start at the top of the page and work
your way down — Section 04 (the How-To) is where the actual practice lives.
Use the audio player at the top of that section with stereo headphones.
