# Actual harmonica recordings

Instrument: Hohner Special 20 C (diatonic; not a 24-hole tremolo).
Publisher: Versilian Studios LLC / Versilian Community Sample Library (VCSL).
Source: https://github.com/sgossner/VCSL
Revision: c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e
Directory: Aerophones/Free Aerophones/Harmonica-Hohner-Special20-C/Sustains/Normal
License: CC0 1.0 Universal; full upstream text in LICENSE.txt.

Original Hohner-Special20_Normal_*.wav files are unchanged upstream recordings.
*_play.wav files are derived using scripts/prepare_harmonica_samples.py:
leading silence trimmed, peak normalized to 0.7, sustain loop crossfaded,
and converted to 16-bit PCM. samples.json records mappings, trim offsets,
loop boundaries, and original SHA-256 hashes. VCSL C3 is MIDI 60 (C4 in
scientific notation); pitches were checked against waveform periodicity.
No synthetic oscillators or artificial tremolo are added.
