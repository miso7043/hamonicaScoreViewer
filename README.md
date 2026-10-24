# Hamonica Player

A Django and SQLite web app for storing, viewing, editing, and playing MusicXML sheet music in your browser. Scores are rendered with Verovio WebAssembly, loaded from a CDN, and played using recorded harmonica samples.

[한국어 README](README_kr.md)

## Features

- Upload `.xml` or `.musicxml` files and store their original XML, title, and composer in SQLite.
- View scores with four measures per line on desktop or two measures per line on mobile. Layout changes apply only during rendering; the stored MusicXML remains unchanged.
- Edit score metadata and MusicXML source, preview changes, and delete scores.
- Play scores with recorded Hohner Special 20 C harmonica samples, including pitches, note durations, rests, chords, and tempo.
- Combine tied notes of the same pitch into a single sustained note, and follow repeat signs and first/second endings.
- Click a note to start playback from that position or jump there during playback.

## Getting Started

Run the following commands from the project directory:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Open <http://127.0.0.1:8000> and upload a `.xml` or `.musicxml` file. Sample scores in [`musicXML/`](musicXML/) must be uploaded manually; they are not imported automatically.

Score rendering and previews require an internet connection to load Verovio from its CDN. The XML upload limit is 10 MB.

## Editing Scores

Open **타이틀·악보 수정** (Edit Title and Score) on a score page to change its title, composer, or MusicXML source. Use **변경 내용 미리보기** (Preview Changes) to render the edited XML before saving.

When saving:

- XML syntax and the MusicXML root element are validated.
- Changing the title field also updates `<work-title>` in the XML, creating `<work>` and `<work-title>` if needed.
- Changing only `<work-title>` in the XML updates the database title. If both are changed, the title field takes precedence.

To remove a score, click **삭제** (Delete) on the score list or detail page and confirm the deletion.

## Mobile Access

Open `/m` or `/m/` for the mobile dashboard. Selecting a score opens `/m/scores/<id>/`, with two measures per line, playback controls, and page navigation. Scores uploaded from the mobile interface also open in the mobile viewer.

To access the app from a phone on the same Wi-Fi network, replace the example address below with your computer's local IP address:

```bash
DJANGO_ALLOWED_HOSTS=192.168.0.10 python manage.py runserver 0.0.0.0:8000
```

Then open `http://192.168.0.10:8000/m` on your phone. Your computer's firewall must allow connections on port 8000. This setup is for local development.

## Harmonica Samples

Playback uses nine recorded Hohner Special 20 C samples from [VCSL](https://versilian-studios.com/vcsl/). These are not recordings of a 24-hole tremolo harmonica. Attribution and CC0 license details are available in the [sample README](snd/note_snd/vcsl/README.md) and [license file](snd/note_snd/vcsl/LICENSE.txt). The older WAV files directly under `snd/note_snd/` are retained but are not used for playback.

Original recordings are preserved as 24-bit WAV files. The playback files, named `*_play.wav`, have leading silence removed, volume normalized, and sustain sections crossfaded. The samples provide reference pitches across MIDI notes 60–96. Missing pitches, including chromatic notes, are produced by adjusting the playback rate of the nearest sample; timbre can vary more noticeably outside the recorded range.

Long notes loop only the sustain section between 1.04 and 3.0 seconds, without repeating the initial attack.

To regenerate the playback files:

```bash
.venv/bin/python scripts/prepare_harmonica_samples.py
```

## Tests

```bash
python manage.py test
```

## VPS Deployment Configuration

The repository includes production settings in [`config/production.py`](config/production.py) and deployment templates in [`deploy/`](deploy/). Production authentication uses Authlib's OpenID Connect validation and allows a single Google account identified by its numeric account ID. See the [Google OpenID Connect documentation](https://developers.google.com/identity/openid-connect/openid-connect) for protocol details.

The supplied configuration targets the following layout:

| Setting | Value |
| --- | --- |
| Desktop URL | `https://scores.example.com/harmonica/` |
| Mobile URL | `https://scores.example.com/harmonica/m` |
| Application directory | `/opt/hamonica-player` |
| SQLite database | `/var/lib/hamonica-player/db.sqlite3` |
| systemd service | [`deploy/hamonica-player.service`](deploy/hamonica-player.service) |
| Internal app address | `127.0.0.1:8030` |
| Google OAuth callback path | `/auth/google/callback` |
| Session cookie name | `hamonica_session` |

Required production environment variables:

```text
DJANGO_SETTINGS_MODULE=config.production
DJANGO_SECRET_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
ALLOWED_GOOGLE_ID
```

Include [`deploy/hamonica-nginx.conf`](deploy/hamonica-nginx.conf) in the existing Nginx HTTPS server block. In the `http` block, define a `$hamonica_callback_backend` map that routes requests whose `$arg_state` matches `~^hmp_` to `127.0.0.1:8030`, and all other callback requests to `127.0.0.1:8020`. This lets the app reuse the existing registered Google callback URL.

These files describe the intended deployment configuration; their presence does not indicate that a VPS service is running.
