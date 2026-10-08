"""Music bed + sound design for the full film, locked to src/film/timeline.json (and the verify scene's own timeline).

Usage: python3 audio/film_audio.py public/film.wav
"""
import json
import sys
from pathlib import Path

import numpy as np

from synth import CHORDS, SR, Track, bell, boom, hat, key_click, kick, lp, master, note, pad_bar, pluck, riser, swell, tick, wet, whoosh

ROOT = Path(__file__).parent.parent
F = json.loads((ROOT / "src/film/timeline.json").read_text())
V = json.loads((ROOT / "src/verify/timeline.json").read_text())
FPS, BEAT = F["fps"], 60 / F["bpm"]
DUR = F["duration"] / FPS
S = F["scenes"]


def at(scene, frame):
    return (S[scene]["start"] + frame) / FPS


tr = Track(DUR + 1.0)
bar = 4 * BEAT
outro = at("name", 0)

# --- music bed ---
for k in range(int(DUR / bar) + 2):
    start = k * bar
    cutoff = 800 if start < at("fold", F["fold"]["sweepEnd"]) else 1500
    tr.place("music", pad_bar(CHORDS[k % 4], bar, cutoff), start, gain=0.55, pan=-0.2 if k % 2 else 0.2)
kick_from, kick_to = at("problem", 30), outro
duck = np.ones(tr.n)
for b in np.arange(kick_from, kick_to, BEAT):
    tr.place("music", kick(), b, gain=0.55)
    i, m = int(b * SR), int(0.3 * SR)
    duck[i : i + m] = np.minimum(duck[i : i + m], 1 - 0.45 * np.exp(-np.arange(min(m, tr.n - i)) / SR * 9))
for b in np.arange(at("fold", F["fold"]["sweepStart"]) + BEAT / 2, outro - BEAT, BEAT):
    tr.place("music", hat(), b, gain=0.07, pan=0.35)
for k in range(int(DUR / bar) + 1):
    if kick_from - 0.01 <= k * bar < outro:
        n = int(SR * bar)
        r = note(CHORDS[k % 4][0]) / 2  # sub bass an octave under the chord root
        tr.place("music", np.sin(2 * np.pi * r * np.arange(n) / SR) * np.exp(-np.arange(n) / SR * 0.3), k * bar, gain=0.22)
tr.music *= duck[:, None]
# outro: the bed closes down (low-pass) as the name appears
o = int(outro * SR)
closed = lp(tr.music, 500, 2)
blend = np.clip((np.arange(tr.n) - o) / (0.8 * SR), 0, 1)[:, None]
tr.music = tr.music * (1 - blend) + closed * blend

# --- 1. problem ---
P = F["problem"]
tr.place("sfx", whoosh(), at("problem", P["headline"]), gain=0.18, pan=-0.3)
# counter rattle: ticks that speed up while the numbers climb
t0, t1 = at("problem", P["counters"]), at("problem", P["pages"] - 4)
t = t0
while t < t1:
    p = (t - t0) / (t1 - t0)
    tr.place("sfx", tick(2600 + 600 * p, 0.04), t, gain=0.035 + 0.03 * p, pan=-0.4)
    t += 0.11 - 0.07 * p
tr.place("sfx", boom(1.2), at("problem", P["pages"]), gain=0.32)

# --- 2. fold ---
Fd = F["fold"]
tr.place("sfx", whoosh(0.7), at("fold", Fd["turn"]), gain=0.16, pan=0.3)
tr.place("sfx", riser((Fd["sweepEnd"] - Fd["sweepStart"]) / FPS), at("fold", Fd["sweepStart"]), gain=0.2)
tr.place("sfx", boom(), at("fold", Fd["sweepEnd"]), gain=0.55)
tr.place("sfx", bell("A5", 1.4), at("fold", Fd["sweepEnd"]), gain=0.05, pan=0.2)

# --- 3. verify (its own timeline, offset into the film) ---
tr.place("sfx", whoosh(), at("verify", V["headline"]), gain=0.16, pan=-0.3)
tr.place("sfx", swell(), at("verify", V["panelIn"]) - 0.05, gain=0.3)
for fr in V["sentences"]:
    tr.place("sfx", tick(), at("verify", fr), gain=0.08, pan=0.4)
for i, (fr, nm) in enumerate(zip(V["links"], ["A4", "C5", "E5", "G5"])):
    g = 0.16 if i < 3 else 0.2
    tr.place("sfx", pluck(nm), at("verify", fr), gain=g, pan=0.25)
    tr.place("sfx", pluck(nm) * 0.4, at("verify", fr) + 0.75 * BEAT, gain=g, pan=-0.35)
tr.place("sfx", riser((V["push"] - V["links"][-1]) / FPS), at("verify", V["links"][-1]), gain=0.2)
tr.place("sfx", boom(), at("verify", V["push"]), gain=0.55)
tr.place("sfx", bell(), at("verify", V["diff"]), gain=0.07, pan=0.2)

# --- 4. decide ---
D = F["decide"]
tr.place("sfx", whoosh(0.7), at("decide", D["headline"]), gain=0.14, pan=0.3)
tr.place("sfx", swell(1.0), at("decide", D["panel"]), gain=0.22)
tr.place("sfx", key_click(), at("decide", D["press"]), gain=1.0)
tr.place("sfx", boom(0.9), at("decide", D["press"]), gain=0.3)
for nm in ("A4", "C5", "E5"):
    tr.place("sfx", pluck(nm, 1.2), at("decide", D["press"]) + 0.02, gain=0.13)

# --- 5. name ---
N = F["name"]
tr.place("sfx", bell("A5", 2.0), at("name", N["logo"]), gain=0.08)
tr.place("sfx", boom(1.6), at("name", N["logo"]), gain=0.25)
for i in range(len("pi-activity-view")):
    tr.place("sfx", tick(3200, 0.03), at("name", N["type"] + i * 1.2), gain=0.03, pan=0.1)

mix = wet(tr.music, 0.18) + wet(tr.sfx, 0.3)
master(mix, sys.argv[1], DUR, fade_out=0.6)
