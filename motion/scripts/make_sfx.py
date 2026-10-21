# Synthesizes the sound-design kit (whoosh, impact, riser, tick, sub-drop) with numpy only.
import numpy as np, wave, os, sys
SR = 44100
rng = np.random.default_rng(7)
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join('public', 'sfx'); os.makedirs(out, exist_ok=True)

def save(name, x, stereo_width=0.0):
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.9
    d = int(SR * 0.011)
    r = np.concatenate([np.zeros(d), x[:-d]]) if stereo_width else x
    l2, r2 = x * (1 - stereo_width * 0.3) + r * stereo_width * 0.3, r * (1 - stereo_width * 0.3) + x * stereo_width * 0.3
    s = (np.stack([l2, r2], 1) * 32767).astype(np.int16)
    with wave.open(os.path.join(out, name + '.wav'), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(s.tobytes())

def sweep_noise(dur, f0, f1, q=2.0):
    n = int(SR * dur); t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    spec = np.fft.rfft(noise); freqs = np.fft.rfftfreq(n, 1 / SR)
    # time-varying bandpass approximated by short overlapping windows
    hop, win = 512, 2048; y = np.zeros(n + win); wnd = np.hanning(win)
    for i in range(0, n, hop):
        seg = noise[i:i + win]
        if len(seg) < win: seg = np.pad(seg, (0, win - len(seg)))
        p = i / n; fc = f0 * (f1 / f0) ** p
        S = np.fft.rfft(seg * wnd); fr = np.fft.rfftfreq(win, 1 / SR)
        S *= np.exp(-((np.log2(fr + 1) - np.log2(fc)) ** 2) * q)
        y[i:i + win] += np.fft.irfft(S)
    return y[:n]

def env(n, a, r, curve=3):
    t = np.linspace(0, 1, n); A = int(n * a)
    e = np.ones(n); e[:A] = np.linspace(0, 1, A) ** 2
    e[A:] = (1 - np.linspace(0, 1, n - A)) ** curve
    return e

# whoosh: fast band sweep up then down
w = sweep_noise(0.55, 300, 5000, 1.5); w *= env(len(w), 0.55, 0.45, 2); save('whoosh', w, 1)
w2 = sweep_noise(0.35, 2000, 400, 1.5); w2 *= env(len(w2), 0.2, 0.8, 2); save('whoosh_short', w2, 1)
# impact: pitch-dropping sub + transient noise + short tail
n = int(SR * 1.6); t = np.arange(n) / SR
f = 38 + 90 * np.exp(-t * 18); sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.6)
crack = rng.standard_normal(n) * np.exp(-t * 45) * 0.6
tail = sweep_noise(1.6, 900, 200, 1.0) * np.exp(-t * 3.5) * 0.25
save('impact', np.tanh((sub * 1.4 + crack + tail) * 1.6), 0.6)
# soft hit for word slams
n = int(SR * 0.5); t = np.arange(n) / SR
f = 55 + 140 * np.exp(-t * 30)
save('hit', np.tanh(2 * (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) + rng.standard_normal(n) * np.exp(-t * 80) * 0.5)), 0.3)
# riser: noise sweep rising with tremolo, ends abruptly
r = sweep_noise(1.6, 200, 7000, 1.2); n = len(r); t = np.arange(n) / SR
tone = np.sin(2 * np.pi * (110 * t + 300 * t ** 2)) * 0.25
save('riser', (r + tone) * (t / t[-1]) ** 2.2 * (1 + 0.25 * np.sin(2 * np.pi * (6 + 14 * t) * t)), 1)
# tick: tiny UI click
n = int(SR * 0.06); t = np.arange(n) / SR
save('tick', (np.sin(2 * np.pi * 2400 * t) * 0.6 + rng.standard_normal(n) * 0.4) * np.exp(-t * 120))
# sub drop for the outro
n = int(SR * 2.4); t = np.arange(n) / SR
save('subdrop', np.sin(2 * np.pi * np.cumsum(30 + 60 * np.exp(-t * 2)) / SR) * np.exp(-t * 1.4) + sweep_noise(2.4, 3000, 150, 1) * np.exp(-t * 2) * 0.3, 0.5)
print('ok', sorted(os.listdir(out)))
# pop: short pitched blip for UI elements
n = int(SR * 0.09); t = np.arange(n) / SR
save('pop', np.sin(2 * np.pi * np.cumsum(900 * np.exp(-t * 30) + 180) / SR) * np.exp(-t * 40))
# crack: glass/ice fracture — bursts of filtered clicks
n = int(SR * 0.7); y = np.zeros(n)
for k in range(28):
    p = int(rng.random() ** 2 * n * 0.6); L = int(SR * 0.004)
    y[p:p + L] += rng.standard_normal(L) * (1 - k / 30)
y = np.diff(y, prepend=0) + 0.3 * sweep_noise(0.7, 6000, 2500, 1.0) * np.exp(-np.arange(n) / SR * 8)
save('crack', y, 0.8)
print('extra ok')
# paper sounds: tear (crackly noise sweep), snip (two metallic clicks), rustle (soft noise puff)
n = int(SR * 0.45); t = np.arange(n) / SR
cr = rng.standard_normal(n) * (rng.random(n) > 0.82) * 1.0
save('tear', (sweep_noise(0.45, 1800, 5000, 1.2) * 0.6 + np.diff(cr, prepend=0) * 0.5) * np.minimum(1, t / 0.03) * np.exp(-t * 4), 0.5)
n = int(SR * 0.16); t = np.arange(n) / SR; y = np.zeros(n)
for o in (0.0, 0.07): i = int(o * SR); m = int(SR * 0.02); y[i:i + m] += (np.sin(2 * np.pi * 3400 * t[:m]) + rng.standard_normal(m) * 0.6) * np.exp(-t[:m] * 260)
save('snip', y)
save('rustle', sweep_noise(0.3, 900, 3000, 0.8) * np.sin(np.linspace(0, np.pi, int(SR * 0.3))) ** 2, 0.7)
print('paper sfx ok')
