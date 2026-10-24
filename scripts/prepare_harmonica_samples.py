"""Prepare downloaded VCSL Special 20 WAVs without changing their source recordings."""
import hashlib
import json
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'snd/note_snd/vcsl'
LOOP_START = 1.04
LOOP_END = 3.0


def prepare(path):
    raw = path.read_bytes()
    chunks = {}
    pos = 12
    while pos + 8 <= len(raw):
        kind, size = struct.unpack_from('<4sI', raw, pos)
        chunks[kind] = raw[pos + 8:pos + 8 + size]
        pos += 8 + size + size % 2
    encoding, channels, rate, _, _, bits = struct.unpack_from('<HHIIHH', chunks[b'fmt '])
    if (encoding, channels, bits) != (1, 1, 24):
        raise ValueError(f'Unexpected source format: {path}')
    data = chunks[b'data']
    values = [int.from_bytes(data[i:i + 3], 'little', signed=True) / 8388608
              for i in range(0, len(data), 3)]
    peak = max(map(abs, values))
    onset = next(i for i, value in enumerate(values) if abs(value) > peak * .015)
    trim = max(0, onset - int(rate * .01))
    values = values[trim:trim + int(rate * LOOP_END)]
    if len(values) != int(rate * LOOP_END):
        raise ValueError(f'Source too short: {path}')
    # Blend the loop tail into the beginning of the sustain region. At the
    # wrap, playback continues after the section consumed by the crossfade.
    fade = int(rate * .04)
    head = int(rate * (LOOP_START - .04))
    for i in range(fade):
        mix = i / (fade - 1)
        values[len(values) - fade + i] = values[len(values) - fade + i] * (1 - mix) + values[head + i] * mix
    gain = .7 / max(map(abs, values))
    output = path.with_name(path.stem + '_play.wav')
    with wave.open(str(output), 'wb') as wav:
        wav.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
        wav.writeframes(struct.pack('<' + 'h' * len(values), *(round(value * gain * 32767) for value in values)))
    pitch = path.stem.rsplit('_', 1)[1]
    # VCSL uses C3 for middle C (MIDI 60), unlike scientific pitch notation.
    midi = 12 * (int(pitch[1:]) + 2) + {'C': 0, 'E': 4, 'G': 7}[pitch[0]]
    return {'file': output.name, 'midi': midi, 'loopStart': LOOP_START,
            'loopEnd': LOOP_END, 'trimSeconds': trim / rate,
            'source': path.name, 'sourceSha256': hashlib.sha256(raw).hexdigest()}


if __name__ == '__main__':
    samples = sorted((prepare(p) for p in ROOT.glob('Hohner-Special20_Normal_*.wav')
                      if not p.stem.endswith('_play')), key=lambda sample: sample['midi'])
    (ROOT / 'samples.json').write_text(json.dumps(samples, indent=2) + '\n')
    print(f'Prepared {len(samples)} real-recording samples.')
