#!/usr/bin/env bash
set -euo pipefail
conf=/etc/nginx/sites-available/rp-yoon-duckdns.conf
link=/etc/nginx/sites-enabled/z-rp-yoon-duckdns.conf
backup=$(mktemp -d)
if [ -f "$conf" ]; then cp -a "$conf" "$backup/config"; fi
if [ -L "$link" ]; then readlink "$link" > "$backup/link"; fi
rollback() {
    if [ -f "$backup/config" ]; then cp -a "$backup/config" "$conf"; else rm -f "$conf"; fi
    if [ -f "$backup/link" ]; then ln -sfn "$(cat "$backup/link")" "$link"; else rm -f "$link"; fi
    nginx -t && systemctl reload nginx
}
trap rollback ERR
# Keep the existing wordstudy IP server first for clients connecting without SNI.
if [ -L /etc/nginx/sites-enabled/rp-yoon-duckdns.conf ]; then
    rm /etc/nginx/sites-enabled/rp-yoon-duckdns.conf
fi
mkdir -p /var/www/wordstudy-acme/.well-known/acme-challenge
cat > "$conf" <<'NGINX'
server {
    listen 80;
    server_name rp-yoon.duckdns.org;
    location /.well-known/acme-challenge/ {
        root /var/www/wordstudy-acme;
        try_files $uri =404;
    }
    location / { return 301 https://rp-yoon.duckdns.org$request_uri; }
}
NGINX
ln -sfn "$conf" "$link"
nginx -t
systemctl reload nginx
/snap/bin/certbot certonly --non-interactive --agree-tos --register-unsafely-without-email \
    --webroot -w /var/www/wordstudy-acme \
    --cert-name rp-yoon.duckdns.org -d rp-yoon.duckdns.org
cat >> "$conf" <<'NGINX'
server {
    listen 443 ssl;
    server_name rp-yoon.duckdns.org;
    ssl_certificate /etc/letsencrypt/live/rp-yoon.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rp-yoon.duckdns.org/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 5m;
    include /etc/nginx/snippets/hamonica-pi.conf;
    location / {
        proxy_pass http://127.0.0.1:43871;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX
nginx -t
systemctl reload nginx
install -d /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/30-rp-yoon-nginx <<'HOOK'
#!/bin/sh
set -eu
/usr/sbin/nginx -t
/usr/bin/systemctl reload nginx
HOOK
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/30-rp-yoon-nginx
systemctl enable --now snap.certbot.renew.timer
curl --noproxy '*' --fail --silent --show-error -o /dev/null https://rp-yoon.duckdns.org/
curl --noproxy '*' --fail --silent --show-error -o /dev/null https://rp-yoon.duckdns.org/hamonica/
trap - ERR
rm -rf "$backup"
echo 'DDNS HTTPS enabled for English learning and harmonica; certificate renewal timer enabled.'
