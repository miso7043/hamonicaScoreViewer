#!/usr/bin/env python3
"""Update rp-yoon.duckdns.org without exposing its token in process arguments."""
import argparse
import getpass
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

CONFIG = Path.home() / '.config/duckdns/config.json'
DOMAIN = 'rp-yoon'


def update(token):
    query = urllib.parse.urlencode({'domains': DOMAIN, 'token': token, 'ip': ''})
    try:
        with urllib.request.urlopen('https://www.duckdns.org/update?' + query, timeout=30) as response:
            result = response.read(128).decode().strip()
    except (urllib.error.URLError, TimeoutError, OSError):
        raise RuntimeError('DuckDNS connection failed; check network access.') from None
    if result != 'OK':
        raise RuntimeError('DuckDNS rejected the update; check the token and domain ownership.')
    print(f'DuckDNS update OK: {DOMAIN}.duckdns.org')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--setup', action='store_true')
    args = parser.parse_args()
    if args.setup:
        token = getpass.getpass('DuckDNS token (hidden): ').strip()
        if not re.fullmatch(r'[A-Za-z0-9-]{16,128}', token):
            raise RuntimeError('Invalid token format; configuration was not changed.')
        update(token)
        CONFIG.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        CONFIG.parent.chmod(0o700)
        temporary = CONFIG.with_suffix('.tmp')
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, 'w') as f:
            json.dump({'token': token}, f)
        temporary.chmod(0o600)
        temporary.replace(CONFIG)
        print('Token saved privately. Automatic updates are ready.')
    else:
        if not CONFIG.exists():
            raise RuntimeError('Token is not configured; run this program with --setup.')
        update(json.loads(CONFIG.read_text())['token'])


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, ValueError, KeyError, OSError) as error:
        # Never print URLs, request objects or configuration contents (they contain the token).
        print(str(error) if isinstance(error, RuntimeError) else 'Unable to read or save DuckDNS configuration.', file=sys.stderr)
        sys.exit(1)
