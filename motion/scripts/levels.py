# Покадровая «громкость» трека по полосам: bass / mid / high (0..1) — чтобы свет, объекты и камера реагировали на музыку.
#   ffmpeg -i track.mp3 -ac 1 -ar 22050 work/track.wav
#   python tools/levels.py work/track.wav 30 src/levels.json
# В Remotion: import LV from './levels.json'; const bass = LV.bass[frame] ?? 0;
import sys, json
import numpy as np
import scipy.io.wavfile as wavfile
import scipy.signal as sig

wav, fps, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
sr, x = wavfile.read(wav)
x = x.astype(np.float32)
if x.ndim > 1:
    x = x.mean(1)
x /= np.abs(x).max() + 1e-9
n = int(len(x) / sr * fps)
f, t, S = sig.stft(x, sr, nperseg=2048, noverlap=2048 - int(sr / 120))
M = np.abs(S)


def band(a, b):
    v = M[(f >= a) & (f < b)].sum(0)
    fr = np.interp(np.arange(n) / fps, t, v)
    fr = np.clip(fr / (np.percentile(fr, 98) + 1e-9), 0, 1)
    o = np.zeros_like(fr)  # быстрая атака, плавный спад
    for i in range(len(fr)):
        o[i] = fr[i] if i == 0 or fr[i] > o[i - 1] else o[i - 1] * 0.86 + fr[i] * 0.14
    return [round(float(z), 3) for z in o]


res = {'fps': fps, 'bass': band(30, 150), 'mid': band(300, 3000), 'high': band(5000, 11000)}
json.dump(res, open(out, 'w'))
print(n, 'кадров ->', out)
