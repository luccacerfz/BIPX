# Audio delivery and evidence

Thirteen ElevenLabs cues are integrated through `src/audio/sample-bank.js`. Original provider MP3s and request provenance remain in `assets/audio/manifest.json`; derivatives and source/output SHA-256 hashes are in `assets/audio/processed/manifest.json`. No API credential is required by, embedded in, or sent to the browser.

The audio technical checks below pass. **Perceptual listening is pending. There is no justified audio quality score above 9.5 yet.** Neither a running AudioContext nor a generated waveform proves pleasing timbre, event recognition, balance on speakers, or fatigue during a long session.

## Processing and mix

- All thirteen originals are preserved. `node tools/audio-process.mjs` verifies each provider hash before producing derivatives.
- A 35 Hz high-pass removes DC/very low rumble. Level matching uses active 10 ms RMS windows with a sample-peak ceiling, retaining transient dynamics. These are dBFS signal measurements, **not** LUFS or a perceptual loudness score.
- Leading/trailing silence is trimmed with attack/release margins. Actions target -16 dBFS active RMS, limited to -3 dBFS sample peak; quieter high-crest transients remain quieter rather than being destructively limited.
- The regenerated katana is used (provider SHA-256 `983f97e441b8fe6aaabc1951a3501d5bc4c47c1ba64b3727169d6ca4d4bd57b1`). Ambience receives +22.60 dB before runtime mixing, uses a 600 ms overlap blend and short boundary fades, and decodes to an 11.4-second loop.
- Derivatives total 523,424 encoded bytes and approximately 7.66 MiB of decoded stereo float audio at 48 kHz. No fetch/decode occurs in a combat event.
- Playback has a 16-voice cap, per-cue limits/cooldowns, preserved high-priority boss/reward cues, short release ramps when stealing voices, and pitch variation only on noncritical effects. Boss/reward cues briefly lower the combat bus; ambience also lowers under these cues. Pause/mute fade the relevant buses.
- Optional `play(type, { pan, distance })` uses bounded stereo positioning and gain `1 / (1 + distance * 0.06)`. `distance` is in game-world units. The main game now supplies camera-relative positioning for enemy hits/kills and boss spawn; player weapon sounds remain centered.

Some decoded provider originals have samples at or beyond full scale. Derivatives have headroom and no rail samples, but normalization cannot establish that preexisting provider distortion was repaired. Listening remains necessary.

## Verified technical evidence

| Check | Evidence | Result |
|---|---|---|
| All thirteen derivatives: source hashes, decoded level/peak, trimming | `assets/audio/processed/manifest.json` | PASS; action peaks at or below -3.12 dBFS; ambience -8.20 dBFS |
| Chrome 153 decode and playback after a genuine pointer gesture | `output/playwright/2026-09-18T17-12-08-015Z-audio-verify/audio-runtime.json` | PASS; 13 processed cues, no decode fallback, source/audio unchanged during this run |
| Natural login, pointer firing, pause fade, actual mute and persistence | Same Chrome report | PASS; natural combat is recorded separately from debug cue auditions |
| Full output PCM capture and repeated integration checks | `output/playwright/2026-09-18T17-16-24-405Z-audio-verify/audio-runtime.json` | PASS for audio; audio hashes unchanged; broader game source changed during this run, so this is not final frozen-candidate certification |
| Actual stereo/distance signal rendering | `output/playwright/2026-09-18T17-13-27-928Z-audio-signal-check/audio-signal.json` | PASS; left/right dominance and distance-20 RMS ratio 0.4499, expected approximately 0.4545 |
| Overlapping burst, cooldown, stealing, boss priority, no output clipping | Same OfflineAudioContext report | PASS; peak voices 16, output peak 0.7435 linear (-2.57 dBFS); explicitly a 2-second synthetic stress fixture |
| Chrome decoded ambience join, at 48 kHz | PCM runtime report | Boundary sample jump -65.79 dBFS; signal threshold passed, perceptual seam approval pending |

The PCM capture has 15.79 seconds of actual final-compressor output, with a full-sample measured peak of -7.43 dBFS. FFmpeg reads it without a decode error. The first part is explicitly labelled debug cue audition; genuine pointer/keyboard combat starts at approximately 10 seconds. The recording tap exists only inside the verifier; its ScriptProcessor deprecation warning does not originate in production code. The earlier WebM recorder emitted a final Opus packet warning, so the WAV capture below is the listening artifact to use.

## Listening artifacts

- [Actual Chrome output, WAV](../output/playwright/2026-09-18T17-16-24-405Z-audio-verify/audio-runtime-output.wav).
- [Isolated 13-cue listening page](../output/playwright/audio-listening-review/index.html) and [38.17-second WAV reel](../output/playwright/audio-listening-review/processed-cue-audition.wav). This reel is normalized source audition, not gameplay; its final section contains two consecutive ambience loops.
- [Cue timing and hashes](../output/playwright/audio-listening-review/timeline.json).

Pending listening observations must cover: immediate attack and impact distinction; separate weapon identities; boss/reward audibility during combat; player-damage salience; left/right enemy direction; ambience seam; overall fatigue over sustained combat; headphones and laptop/mobile speakers. A text-only judge may assess this written evidence but cannot supply a listening observation it did not perform. No agent has claimed to have heard these files.

## Reproduce after freezing the candidate

```sh
node tools/audio-process.mjs
BIPX_BROWSER_CHANNEL=chrome BIPX_HEADLESS=0 node tools/audio-verify.mjs
BIPX_BROWSER_CHANNEL=chrome node tools/audio-signal-check.mjs
node tools/audio-review-reel.mjs
```

Run browser verification sequentially with graphics/performance tests. `audio-verify.mjs` exercises real UI input and output capture; `audio-signal-check.mjs` uses a document without the game's GPU scene and explicitly labels its rendered signal as a fixture. These checks do not prove physical mobile playback, long-session comfort, or human perceptual approval.
