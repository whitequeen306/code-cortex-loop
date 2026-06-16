"""Capture report.html dashboard screenshot for README. One-off utility."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / "examples" / "demo-app" / "docs" / "cortexloop" / "report.html"
OUT = HTML.parent / "report-dashboard.png"

if not HTML.exists():
    raise SystemExit(f"Missing: {HTML}")

url = HTML.as_uri()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900}, device_scale_factor=2)
    page.goto(url, wait_until="networkidle")
    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT), full_page=True)
    browser.close()

print(f"Saved: {OUT}")
