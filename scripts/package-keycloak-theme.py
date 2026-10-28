#!/usr/bin/env python3
"""Package only the trusted M3aya theme as a portable stdin installer (sh + base64).
No user data, realm exports, passwords or identity database are included.
"""
import argparse
import base64
from pathlib import Path
import shlex
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--output',required=True,type=Path)
a=p.parse_args()
source=Path(__file__).resolve().parents[1]/'infrastructure/keycloak/themes/m3aya'
lines=['#!/bin/sh','set -eu','umask 022']
for f in sorted(source.rglob('*')):
    if not f.is_file():continue
    dest=Path('/opt/keycloak/themes/m3aya')/f.relative_to(source)
    lines.extend(['mkdir -p '+shlex.quote(str(dest.parent)),"base64 -d > "+shlex.quote(str(dest))+" <<'M3AYA_THEME_ASSET'",base64.encodebytes(f.read_bytes()).decode().rstrip(),'M3AYA_THEME_ASSET','chmod 644 '+shlex.quote(str(dest))])
lines.append("echo 'M3aya theme files installed; no identity data modified.'")
a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text('\n'.join(lines)+'\n')
print(f'Theme installer packaged ({sum(1 for f in source.rglob("*") if f.is_file())} files).')
