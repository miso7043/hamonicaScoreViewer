# Raspberry Pi deployment

- English learning keeps the HTTPS root at `https://192.168.76.1/`.
- Harmonica uses `https://192.168.76.1/hamonica/` and mobile `/hamonica/m`.
- Application: `/home/thyoon7043/hamonica-player`
- Database: `/home/thyoon7043/.local/share/hamonica-player/db.sqlite3`
- Environment: `/home/thyoon7043/.config/hamonica-player.env` (mode 600)
- User service: `systemctl --user status hamonica-player`
- User lingering is enabled, so the service starts without an interactive login.
- Nginx keeps the existing English learning upstream on `127.0.0.1:43871`.
  `/etc/nginx/snippets/hamonica-pi.conf` proxies only `/hamonica/` to `127.0.0.1:8030`.
- Settings: `config.raspberrypi`. Anonymous visitors can view and play scores;
  only active Django staff can upload, edit or delete.

To create an administrator, run on the Pi:

```bash
cd ~/hamonica-player
set -a
. ~/.config/hamonica-player.env
set +a
.venv/bin/python manage.py createsuperuser
```

Then log in at `/hamonica/admin/login/` and return to `/hamonica/` to manage scores.
No administrator existed in the migrated database; public viewing needs none.

The 2026-11-23 migration copied 12 scores with exact DB SHA-256 verification.
Private local backups are stored in the git-ignored `deployment-backups/` folder.
The previous remote harmonica application, DB, environment, service and dedicated
nginx routing were removed after the initial LAN deployment was verified.
Other remote applications were preserved.

Apply the reviewed nginx integration with:

```bash
sudo bash ~/hamonica-player/deploy/enable-raspberrypi-web.sh
```

This reuses the Pi's existing HTTPS certificate; it does not issue or replace it.
