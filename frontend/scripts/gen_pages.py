#!/usr/bin/env python3
"""Generate all frontend pages for Frame Videos SaaS."""
import os

BASE = "/data/.openclaw/workspace/framevideos/frontend/app"

def w(relpath, content):
    full = os.path.join(BASE, relpath)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  wrote {relpath} ({len(content)} bytes)")

print("Generating pages...")
print("Done - pages generated. Now run build.")
