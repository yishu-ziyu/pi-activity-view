"""Small synth + sound-design kit shared by the scene and film audio scripts (48 kHz stereo)."""
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
rng = np.random.default_rng(7)
NAMES = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
CHORDS = [["A2", "E3", "G3", "B3", "C4"], ["F2", "C3", "E3", "A3"], ["C3", "G3", "B3", "E4"], ["G2", "D3", "A3", "B3"]]


def note(name):
    return 440 * 2 ** ((NAMES[name[:-1]] + 12 * (int(name[-1]) + 1) - 69) / 12)


def lp(x, hz, order=2):
    return sosfilt(butter(order, hz, "low", fs=SR, output="sos"), x, axis=0)


def hp(x, hz, order=2):
    return sosfilt(butter(order, hz, "high", fs=SR, output="sos"), x, axis=0)


def bp(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], "band", fs=SR, output="sos"), x)


def env(n, a, d, curve=4.0):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-curve * np.maximum(0, t - a) / max(d, 1e-4))


def saw(f, n, detune=0.0):
    ph = (f * (1 + detune) * np.arange(n) / SR + rng.random()) % 1
    return 2 * ph - 1


class Track:
    def __init__(self, seconds):
        self.n = int(SR * seconds)
        self.music = np.zeros((self.n, 2))
        self.sfx = np.zeros((self.n, 2))

    def place(self, bus, sig, start_s, gain=1.0, pan=0.0):
        buf = self.music if bus == "music" else self.sfx
        i = int(start_s * SR)
        if i >= self.n:
            return
        sig = sig[: self.n - i]
        left, right = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        buf[i : i + len(sig), 0] += sig * gain * left * 1.414
        buf[i : i + len(sig), 1] += sig * gain * right * 1.414


def sweep_noise(n, lo0, lo1, hi0, hi1, block=1200, power=1.0):
    r = rng.standard_normal(n)
    out = [bp(r[i : i + block], lo0 + (lo1 - lo0) * (i / n) ** power, hi0 + (hi1 - hi0) * (i / n) ** power) for i in range(0, n, block)]
    return np.concatenate(out)[:n]


# --- instruments ---
def pad_bar(chord, seconds, cutoff):
    n = int(SR * (seconds + 1.0))
    sig = np.zeros(n)
    for nm in chord:
        for d in (-0.004, 0.0, 0.005):
            sig += saw(note(nm), n, d)
    return lp(sig, cutoff, 4) * env(n, 0.6, seconds + 0.2, 1.2) / 14


def kick():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    k = np.sin(2 * np.pi * np.cumsum(48 + 70 * np.exp(-t * 30)) / SR) * env(n, 0.002, 0.16, 5)
    return k + hp(rng.standard_normal(n), 3000) * env(n, 0.0005, 0.006, 8) * 0.15


def hat():
    n = int(0.08 * SR)
    return hp(rng.standard_normal(n), 7000) * env(n, 0.001, 0.03, 6)


def tick(freq=1900, length=0.12):
    n = int(length * SR)
    return np.sin(2 * np.pi * freq * np.arange(n) / SR) * env(n, 0.001, 0.02, 6)


def pluck(name, length=0.9):
    n = int(length * SR)
    t = np.arange(n) / SR
    f0 = note(name)
    return (np.sin(2 * np.pi * f0 * t) + 0.35 * np.sin(4 * np.pi * f0 * t) + 0.12 * np.sin(2 * np.pi * 3.01 * f0 * t)) * env(n, 0.003, 0.35, 5)


def whoosh(length=0.9):
    n = int(length * SR)
    return sweep_noise(n, 400, 3400, 800, 6800, block=2400) * env(n, length * 0.55, length * 0.35, 3)


def swell(length=1.2):
    n = int(length * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * np.cumsum(90 * np.exp(-t * 2) + 40) / SR) * env(n, 0.08, 0.5, 2)
    return s + lp(rng.standard_normal(n), 500) * env(n, 0.15, 0.4, 3) * 0.6


def riser(seconds):
    n = int(seconds * SR)
    return sweep_noise(n, 300, 5300, 900, 9900, power=2) * np.linspace(0, 1, n) ** 2


def boom(length=2.2):
    n = int(length * SR)
    t = np.arange(n) / SR
    b = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t * 9)) / SR) * env(n, 0.003, 1.1, 2.2)
    return b + lp(rng.standard_normal(n), 220) * env(n, 0.002, 0.25, 4) * 0.8


def bell(name="E6", length=1.6):
    n = int(length * SR)
    t = np.arange(n) / SR
    f = note(name)
    return np.sin(2 * np.pi * f * t + 1.8 * np.sin(2 * np.pi * f * 1.41 * t) * np.exp(-t * 4)) * env(n, 0.002, 0.7, 4)


def key_click():
    n = int(0.06 * SR)
    return hp(rng.standard_normal(n), 1500) * env(n, 0.0005, 0.012, 7) + np.sin(2 * np.pi * 180 * np.arange(n) / SR) * env(n, 0.001, 0.03, 6) * 0.6


# --- mixing ---
def reverb_ir(seconds=2.4, damp=3000):
    n = int(SR * seconds)
    ir = np.zeros((n, 2))
    for c in range(2):
        ir[:, c] = lp(rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 3.2), damp)
    ir[: int(0.012 * SR)] = 0
    return ir / np.abs(ir).sum(0).max() * 6


IR = reverb_ir()


def wet(dry, mix):
    out = np.zeros_like(dry)
    for c in range(2):
        out[:, c] = fftconvolve(dry[:, c], IR[:, c])[: len(dry)]
    return dry * (1 - mix) + out * mix


def master(mix, path, seconds, fade_out=0.25):
    n = int(seconds * SR)
    mix = mix[:n].copy()
    f = int(fade_out * SR)
    mix[-f:] *= np.linspace(1, 0, f)[:, None]
    mix = np.tanh(mix * 1.2) / np.tanh(1.2)
    mix *= 10 ** (-18 / 20) / max(np.sqrt((mix**2).mean()), 1e-9)
    peak = np.abs(mix).max()
    if peak > 0.89:
        mix *= 0.89 / peak
    wavfile.write(path, SR, (mix * 32767).astype(np.int16))
    print(f"wrote {path}  {len(mix)/SR:.2f}s  rms {20*np.log10(np.sqrt((mix**2).mean())):.1f} dBFS  peak {20*np.log10(np.abs(mix).max()):.1f} dBFS")
