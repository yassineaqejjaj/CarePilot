#!/usr/bin/env python3
"""Package the checked Vite dist explicitly using Vercel Build Output API v3.
Run a production-configured npm build first. No secrets are read or copied.
"""

import json
import re
from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[1]
web = root / "apps/web"
source = web / "dist"
if not (source / "index.html").is_file():
    raise SystemExit("Build the frontend before packaging")
settings = json.loads((web / "vercel.json").read_text())
api_rule = next(r for r in settings["rewrites"] if r["source"] == "/api/:path*")
api_destination = api_rule["destination"].replace(":path*", "$1")
refs = re.findall(
    r'(?:src|href)="(/assets/[^"]+)"', (source / "index.html").read_text()
)
if not refs or any(not (source / path.lstrip("/")).is_file() for path in refs):
    raise SystemExit("Incomplete static output: index asset references must exist")
output = web / ".vercel/output"
output.mkdir(parents=True, exist_ok=True)
static = output / "static"
if static.exists():
    shutil.rmtree(static)
shutil.copytree(source, static)
config = {
    "version": 3,
    "routes": [
        {
            "src": "/(.*)",
            "headers": {
                "X-Content-Type-Options": "nosniff",
                "X-Frame-Options": "DENY",
                "Referrer-Policy": "no-referrer",
            },
            "continue": True,
        },
        {"src": "/api/(.*)", "dest": api_destination},
        {"handle": "filesystem"},
        {"src": "/(assets|brand|marketing|licenses)/(.*)", "status": 404},
        {"src": "/(.*)", "dest": "/index.html"},
    ],
}
(output / "config.json").write_text(json.dumps(config, indent=2) + "\n")
print(
    "Explicit static package ready:",
    sum(1 for f in static.rglob("*") if f.is_file()),
    "files",
)
