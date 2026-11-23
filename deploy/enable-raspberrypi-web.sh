#!/usr/bin/env bash
set -euo pipefail
# Preserve English learning at / and add harmonica under /hamonica/.
existing=/etc/nginx/sites-available/wordstudy-ip.conf
test -f "$existing"
cp -a "$existing" "$existing.backup-$(date +%Y%m%d-%H%M%S)"
cat > /etc/nginx/snippets/hamonica-pi.conf <<'NGINX'
location = /hamonica { return 302 /hamonica/; }
location ^~ /hamonica/ {
    client_max_body_size 12m;
    proxy_pass http://127.0.0.1:8030/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header X-Content-Type-Options nosniff always;
}
NGINX
python3 - <<'PY'
from pathlib import Path
p=Path('/etc/nginx/sites-available/wordstudy-ip.conf')
s=p.read_text()
s=s.replace('server_name 121.186.117.114;', 'server_name 121.186.117.114 192.168.76.1 yoon-pi5.local;')
include='    include /etc/nginx/snippets/hamonica-pi.conf;'
if include not in s:
    assert s.count('    listen 443 ssl;') == 1
    s=s.replace('    listen 443 ssl;', '    listen 443 ssl;\n'+include)
s=s.replace('return 301 https://121.186.117.114$request_uri;', 'return 301 https://$host$request_uri;')
p.write_text(s)
PY
rm -f /etc/nginx/sites-enabled/hamonica-player.conf
nginx -t
systemctl reload nginx
echo 'English learning: /; harmonica: https://192.168.76.1/hamonica/'
