"""Music bed + sound design for the "对不对" scene, locked to src/verify/timeline.json.

120 BPM like both references (their onsets sit on a 0.5 s grid). Every sound effect lands on
a frame the picture also uses, so sound and motion stay in sync after any timing change.
Usage: python3 audio/verify_audio.py public/verify.wav
"""
import json
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
T = json.loads((Path(__file__).parent.parent / "src/verify/timeline.json").read_text())
FPS, DUR = T["fps"], T["duration"] / T["fps"]
BEAT = 60 / T["bpm"]
N = int(SR * (DUR + 0.6))
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR


def at(frame):
    return frame / FPS


def note(name):
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    return 440 * 2 ** ((names[name[:-1]] + 12 * (int(name[-1]) + 1) - 69) / 12)


def lp(x, hz, order=2):
    return sosfilt(butter(order, hz, "low", fs=SR, output="sos"), x)


def hp(x, hz, order=2):
    return sosfilt(butter(order, hz, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], "band", fs=SR, output="sos"), x)


def place(buf, sig, start_s, gain=1.0, pan=0.0):
    i = int(start_s * SR)
    sig = sig[: max(0, N - i)]
    left, right = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[i : i + len(sig), 0] += sig * gain * left * 1.414
    buf[i : i + len(sig), 1] += sig * gain * right * 1.414


def env(n, a, d, curve=4.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-curve * np.maximum(0, t - a) / max(d, 1e-4))
    return e


def saw(f, n, detune=0.0):
    t = np.arange(n) / SR
    ph = (f * (1 + detune) * t + rng.random()) % 1
    return 2 * ph - 1


def reverb_ir(seconds=2.4, damp=3000):
    n = int(SR * seconds)
    ir = np.zeros((n, 2))
    for c in range(2):
        noise = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 3.2)
        ir[:, c] = lp(noise, damp)
    ir[: int(0.012 * SR)] = 0  # pre-delay
    return ir / np.abs(ir).sum(0).max() * 6


IR = reverb_ir()


def wet(dry, mix):
    out = np.zeros_like(dry)
    for c in range(2):
        out[:, c] = fftconvolve(dry[:, c], IR[:, c])[: len(dry)]
    return dry * (1 - mix) + out * mix


music = np.zeros((N, 2))
sfx = np.zeros((N, 2))

# --- pad: one chord per bar (2 s), filter opens after the push ---
chords = [["A2", "E3", "G3", "B3", "C4"], ["F2", "C3", "E3", "A3"], ["C3", "G3", "B3", "E4"], ["G2", "D3", "A3", "B3"]]
bar = 4 * BEAT
for k in range(int(DUR / bar) + 2):
    n = int(SR * (bar + 1.0))
    sig = np.zeros(n)
    for nm in chords[k % 4]:
        for d in (-0.004, 0.0, 0.005):
            sig += saw(note(nm), n, d)
    start = k * bar
    cutoff = 900 if start < at(T["push"]) else 1800
    sig = lp(sig, cutoff, 4) * env(n, 0.6, 2.2, 1.2)
    place(music, sig / 14, start, gain=0.55, pan=-0.2 if k % 2 else 0.2)

# --- drums enter with the evidence panel; sidechain-style ducking on the pad ---
kick_start = at(T["panelIn"])
beats = np.arange(kick_start, DUR, BEAT)
duck = np.ones(N)
for b in beats:
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 48 + 70 * np.exp(-t * 30)
    k = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.16, 5)
    k += hp(rng.standard_normal(n), 3000) * env(n, 0.0005, 0.006, 8) * 0.15
    place(music, k, b, gain=0.55)
    i = int(b * SR)
    m = min(N - i, int(0.3 * SR))
    duck[i : i + m] = np.minimum(duck[i : i + m], 1 - 0.45 * np.exp(-np.arange(m) / SR * 9))
# offbeat hats from the first link on
for b in np.arange(at(T["links"][0]) + BEAT / 2, DUR, BEAT):
    n = int(0.08 * SR)
    place(music, hp(rng.standard_normal(n), 7000) * env(n, 0.001, 0.03, 6), b, gain=0.07, pan=0.35)
# sub bass on the chord roots
for k in range(int(DUR / bar) + 1):
    n = int(SR * bar)
    root = note(chords[k % 4][0]) / 2
    s = np.sin(2 * np.pi * root * np.arange(n) / SR) * env(n, 0.02, bar, 0.6)
    if k * bar >= kick_start - 0.01:
        place(music, s, k * bar, gain=0.22)
music *= duck[:, None]

# --- sound design ---
# headline: airy whoosh rising
n = int(0.9 * SR)
w = rng.standard_normal(n)
sweep = np.concatenate([bp(w[i : i + 2400], 400 + 3000 * i / n, 800 + 6000 * i / n) for i in range(0, n, 2400)])[:n]
place(sfx, sweep * env(n, 0.5, 0.3, 3), at(T["headline"]), gain=0.18, pan=-0.3)
# evidence panel: low swell
n = int(1.2 * SR)
t = np.arange(n) / SR
swell = np.sin(2 * np.pi * np.cumsum(90 * np.exp(-t * 2) + 40) / SR) * env(n, 0.08, 0.5, 2)
swell += lp(rng.standard_normal(n), 500) * env(n, 0.15, 0.4, 3) * 0.6
place(sfx, swell, at(T["panelIn"]) - 0.05, gain=0.32)
# sentences: soft ticks
for i, fr in enumerate(T["sentences"]):
    n = int(0.12 * SR)
    tk = np.sin(2 * np.pi * 1900 * np.arange(n) / SR) * env(n, 0.001, 0.02, 6)
    place(sfx, tk, at(fr), gain=0.08, pan=0.4)
# links: rising plucks (A minor pentatonic), the out-of-scope link a touch brighter
for i, (fr, nm) in enumerate(zip(T["links"], ["A4", "C5", "E5", "G5"])):
    n = int(0.9 * SR)
    tt = np.arange(n) / SR
    f0 = note(nm)
    pl = (np.sin(2 * np.pi * f0 * tt) + 0.35 * np.sin(2 * np.pi * 2 * f0 * tt) + 0.12 * np.sin(2 * np.pi * 3.01 * f0 * tt)) * env(n, 0.003, 0.35, 5)
    place(sfx, pl, at(fr), gain=0.16 if i < 3 else 0.2, pan=0.25)
    place(sfx, pl * 0.4, at(fr) + 0.75 * BEAT, gain=0.16, pan=-0.35)  # dotted echo
# riser into the push, then impact + sub drop
rs, re_ = at(T["links"][-1]), at(T["push"])
n = int((re_ - rs) * SR)
r = rng.standard_normal(n)
riser = np.concatenate([bp(r[i : i + 1200], 300 + 5000 * (i / n) ** 2, 900 + 9000 * (i / n) ** 2) for i in range(0, n, 1200)])[:n]
riser *= np.linspace(0, 1, n) ** 2
place(sfx, riser, rs, gain=0.22)
n = int(2.2 * SR)
tt = np.arange(n) / SR
boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-tt * 9)) / SR) * env(n, 0.003, 1.1, 2.2)
boom += lp(rng.standard_normal(n), 220) * env(n, 0.002, 0.25, 4) * 0.8
place(sfx, boom, re_, gain=0.6)
# diff popover: soft bell (FM)
n = int(1.6 * SR)
tt = np.arange(n) / SR
bell = np.sin(2 * np.pi * note("E6") * tt + 1.8 * np.sin(2 * np.pi * note("E6") * 1.41 * tt) * np.exp(-tt * 4)) * env(n, 0.002, 0.7, 4)
place(sfx, bell, at(T["diff"]), gain=0.07, pan=0.2)

mix = wet(music, 0.18) + wet(sfx, 0.3)
# gentle tail and fade
fade = np.ones(N)
fe = int((DUR + 0.6) * SR)
fade[int((DUR - 0.25) * SR) :] = np.linspace(1, 0, N - int((DUR - 0.25) * SR))
mix *= fade[:, None]
mix = mix[: int(DUR * SR)]
# soft-clip, then level to about -18 dBFS RMS with peaks under -1 dBFS
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
rms = np.sqrt((mix**2).mean())
mix *= 10 ** (-18 / 20) / max(rms, 1e-9)
peak = np.abs(mix).max()
if peak > 0.89:
    mix *= 0.89 / peak
wavfile.write(sys.argv[1], SR, (mix * 32767).astype(np.int16))
print(f"wrote {sys.argv[1]}  {len(mix)/SR:.2f}s  rms {20*np.log10(np.sqrt((mix**2).mean())):.1f} dBFS  peak {20*np.log10(np.abs(mix).max()):.1f} dBFS")
