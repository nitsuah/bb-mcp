# Lays a spot's narration (spot.json "narration", committed vo/<id>.wav lines
# from narrate.sh) over its music, ducking the music ~10 dB under each line.
# Usage (inside the promo image): python3 mix.py <spot.json> <vo dir> <music.wav> <out.wav>
import json
import sys
import wave

import numpy as np
from scipy.ndimage import uniform_filter1d
from scipy.signal import resample_poly


def read(path):
    with wave.open(path) as w:
        sr, ch = w.getframerate(), w.getnchannels()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
    return sr, x.reshape(-1, ch)


def main():
    spot, vo, music_path, out = sys.argv[1:5]
    with open(spot) as f:
        narration = json.load(f)['narration']

    sr, music = read(music_path)
    voice = np.zeros(len(music))
    duck = np.zeros(len(music))
    for line in narration['lines']:
        vsr, v = read(f"{vo}/{line['id']}.wav")
        v = v.mean(axis=1)
        if vsr != sr:
            v = resample_poly(v, sr, vsr)
        i = int(line['at'] * sr)
        v = v[: max(0, len(voice) - i)]
        voice[i:i + len(v)] += v
        duck[max(0, i - int(0.15 * sr)):i + len(v) + int(0.25 * sr)] = 1
    # Smooth the duck so the music breathes in and out instead of switching.
    k = int(0.12 * sr)
    duck = uniform_filter1d(duck, k, mode="constant")
    gain = 1 - (1 - 10 ** (-10 / 20)) * duck
    mix = music * gain[:, None] + voice[:, None] * 10 ** (-1.5 / 20) / max(1e-9, np.max(np.abs(voice)))
    mix *= 10 ** (-1 / 20) / np.max(np.abs(mix))
    with wave.open(out, 'wb') as w:
        w.setnchannels(mix.shape[1])
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())
    print('vo mixed', len(narration['lines']), 'lines')


if __name__ == "__main__":
    main()
