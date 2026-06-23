#!/usr/bin/env python3
"""Capture showcase.html as PNG for README."""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
html = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else (ROOT / "examples/lianyu-pc/docs/cortexloop/showcase.html").resolve()
out = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else (ROOT / "docs/assets/lianyu-pc-showcase.png").resolve()

if not html.exists():
    raise SystemExit(f"Missing: {html}")

out.parent.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1200, "height": 720}, device_scale_factor=2)
    page.goto(html.as_uri(), wait_until="networkidle")
    page.wait_for_timeout(400)
    page.locator(".frame").screenshot(path=str(out))
    browser.close()

print(f"Saved: {out}")
