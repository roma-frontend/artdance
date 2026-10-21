# Onset envelope (spectral flux) -> tempo and beat grid, plus strong-hit list.
import numpy as np, wave, sys, json
w = wave.open(sys.argv[1]); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(float)
x = x.reshape(-1, w.getnchannels()).mean(1) / 32768
hop, win = 512, 2048
fr = np.lib.stride_tricks.sliding_window_view(x, win)[::hop] * np.hanning(win)
S = np.abs(np.fft.rfft(fr, axis=1)); S = np.log1p(S * 10)
low = S[:, :int(150 * win / sr)].sum(1)
flux = np.maximum(0, np.diff(S, axis=0)).sum(1); flux = np.r_[0, flux]; flux = (flux - flux.mean()) / (flux.std() + 1e-9)
t = np.arange(len(flux)) * hop / sr
ac = np.correlate(flux, flux, 'full')[len(flux) - 1:]
lags = np.arange(len(ac)) * hop / sr; ok = (lags > 60 / 180) & (lags < 60 / 70)
period = lags[ok][np.argmax(ac[ok])]; bpm = 60 / period
best = max(np.arange(0, period, 0.01), key=lambda o: sum(np.interp(np.arange(o, t[-1], period), t, flux)))
beats = np.arange(best, t[-1], period)
lowd = np.r_[0, np.maximum(0, np.diff(low))]; lowd = lowd / (lowd.max() + 1e-9)
peaks = [round(float(t[i]), 3) for i in range(2, len(lowd) - 2) if lowd[i] > 0.35 and lowd[i] == lowd[i - 2:i + 3].max()]
rms = np.sqrt((fr ** 2).mean(1)); energy = [round(float(v), 3) for v in np.interp(np.arange(0, t[-1], 0.5), t, rms / rms.max())]
json.dump({'bpm': round(bpm, 2), 'beats': [round(float(b), 3) for b in beats], 'kicks': peaks, 'energy_halfsec': energy}, open(sys.argv[2], 'w'))
print('bpm', round(bpm, 1), 'first beat', round(best, 2), 'beats', len(beats), 'kicks', len(peaks)); print('energy', energy)
