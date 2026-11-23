#!/usr/bin/env bash
set -euo pipefail
user=thyoon7043
home=/home/thyoon7043
key_source="$home/hamonica-player/deploy/this-computer-ed25519.pub"
expected='SHA256:lS/85xROY4z/moPq61CONLQjG+2xw8XMf2JxrYCPLfI'
test "$(ssh-keygen -lf "$key_source" | awk '{print $2}')" = "$expected"
backup=$(mktemp -d /var/backups/ssh-key-only.XXXXXXXX)
chmod 700 "$backup"
cp -a /etc/ssh/sshd_config "$backup/main"
policy=/etc/ssh/this-computer-only.conf
key=/etc/ssh/authorized_keys/thyoon7043
if [ -e "$policy" ]; then cp -a "$policy" "$backup/policy"; fi
if [ -e "$key" ]; then cp -a "$key" "$backup/key"; fi
marker="$home/.ssh/key-only-confirmed"
rm -f "$marker"
cat > "$backup/rollback.sh" <<EOF
#!/bin/bash
set -eu
if [ -f '$marker' ]; then exit 0; fi
cp -a '$backup/main' /etc/ssh/sshd_config
if [ -f '$backup/policy' ]; then cp -a '$backup/policy' '$policy'; else rm -f '$policy'; fi
if [ -f '$backup/key' ]; then cp -a '$backup/key' '$key'; else rm -f '$key'; fi
/usr/sbin/sshd -t
systemctl reload ssh
echo 'SSH configuration restored'
EOF
chmod 700 "$backup/rollback.sh"
trap 'bash "$backup/rollback.sh"' ERR
systemctl stop ssh-key-only-rollback.timer 2>/dev/null || true
systemctl reset-failed ssh-key-only-rollback.service 2>/dev/null || true
systemd-run --unit=ssh-key-only-rollback --on-active=5m /bin/bash "$backup/rollback.sh"
install -d -m 755 /etc/ssh/authorized_keys
install -o root -g root -m 644 "$key_source" "$key"
cat > "$policy" <<'CONF'
# Only the selected workstation key and account may authenticate over SSH.
PubkeyAuthentication yes
AuthenticationMethods publickey
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitEmptyPasswords no
PermitRootLogin no
HostbasedAuthentication no
GSSAPIAuthentication no
KerberosAuthentication no
AllowUsers thyoon7043
AuthorizedKeysFile /etc/ssh/authorized_keys/%u
AuthorizedKeysCommand none
TrustedUserCAKeys none
CONF
chmod 644 "$policy"
python3 - <<'PY'
from pathlib import Path
p=Path('/etc/ssh/sshd_config')
s=p.read_text()
line='Include /etc/ssh/this-computer-only.conf\n'
p.write_text(line+s.replace(line,''))
PY
/usr/sbin/sshd -t
/usr/sbin/sshd -T -C user=thyoon7043,addr=192.168.76.165,host=yoonbuntu > "$backup/effective"
python3 - "$backup/effective" <<'PY'
import sys
config=dict(line.rstrip().split(' ',1) for line in open(sys.argv[1]) if ' ' in line)
expected={'pubkeyauthentication':'yes','authenticationmethods':'publickey',
'passwordauthentication':'no','kbdinteractiveauthentication':'no',
'permitrootlogin':'no','allowusers':'thyoon7043',
'authorizedkeysfile':'/etc/ssh/authorized_keys/%u','authorizedkeyscommand':'none',
'trustedusercakeys':'none'}
for key,value in expected.items():
    assert config.get(key)==value, (key,config.get(key))
    print(key,value)
PY
systemctl reload ssh
trap - ERR
echo 'Applied. A new key login must be confirmed within five minutes; otherwise automatic rollback will run.'
