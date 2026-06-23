#!/usr/bin/env python3
"""Capture CodeCortexLoop HTML dashboard screenshots for README / launch posts."""
from __future__ import annotations

import argparse
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent

CASE_STUDIES = {
    "chokidar": ROOT / "examples/case-studies/chokidar/docs/cortexloop/report.html",
    "fastify-hello": ROOT / "examples/case-studies/fastify-hello/docs/cortexloop/report.html",
    "flask-todo": ROOT / "examples/case-studies/flask-todo/docs/cortexloop/report.html",
    "demo-app": ROOT / "examples/demo-app/docs/cortexloop/report.html",
}


def capture(html: Path, out: Path, *, full_page: bool = True, clip_selector: str | None = None) -> None:
    if not html.exists():
        raise SystemExit(f"Missing: {html}")
    out.parent.mkdir(parents=True, exist_ok=True)
    url = html.as_uri()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900}, device_scale_factor=2)
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(600)

        if clip_selector:
            el = page.locator(clip_selector).first
            el.wait_for(state="visible")
            el.screenshot(path=str(out))
        elif full_page:
            page.screenshot(path=str(out), full_page=True)
        else:
            page.screenshot(path=str(out))

        browser.close()
    print(f"Saved: {out}")


def composite_chokidar_launch(hero: Path, findings: Path, out: Path) -> None:
    """Side-by-side hero + findings for Reddit / README."""
    from PIL import Image, ImageDraw, ImageFont

    left = Image.open(hero).convert("RGB")
    right = Image.open(findings).convert("RGB")

    pad = 24
    gap = 20
    label_h = 36
    total_w = left.width + right.width + pad * 2 + gap
    total_h = max(left.height, right.height) + pad * 2 + label_h

    canvas = Image.new("RGB", (total_w, total_h), (248, 250, 252))
    draw = ImageDraw.Draw(canvas)

    try:
        font = ImageFont.truetype("segoeui.ttf", 22)
        sub = ImageFont.truetype("segoeui.ttf", 14)
    except OSError:
        font = ImageFont.load_default()
        sub = font

    draw.text((pad, 8), "CodeCortexLoop on chokidar (npm file watcher)", fill=(17, 24, 39), font=font)
    draw.text((pad, 32), "Real /cortexloop run · score 71 → 79 after Direct", fill=(107, 114, 128), font=sub)

    y = pad + label_h
    canvas.paste(left, (pad, y))
    canvas.paste(right, (pad + left.width + gap, y))

    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, optimize=True)
    print(f"Saved composite: {out}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Capture cortexloop dashboard screenshots")
    parser.add_argument("--case", choices=[*CASE_STUDIES.keys(), "all"], default="chokidar")
    parser.add_argument("--launch-assets", action="store_true", help="Generate docs/assets launch PNGs from chokidar")
    args = parser.parse_args()

    cases = CASE_STUDIES.keys() if args.case == "all" else [args.case]

    for name in cases:
        html = CASE_STUDIES[name]
        out_dir = html.parent
        capture(html, out_dir / "report-dashboard.png", full_page=True)

    if args.launch_assets or args.case == "chokidar":
        html = CASE_STUDIES["chokidar"]
        assets = ROOT / "docs/assets"
        hero = assets / "chokidar-report-hero.png"
        findings = assets / "chokidar-report-findings.png"
        full = assets / "chokidar-report-full.png"

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900}, device_scale_factor=2)
            page.goto(html.as_uri(), wait_until="networkidle")
            page.wait_for_timeout(600)

            # Findings table card
            page.locator("table").first.locator("xpath=ancestor::div[contains(@class,'card')]").screenshot(
                path=str(findings)
            )

            # Hero: reload clean page, strip findings table, capture score + categories
            page.goto(html.as_uri(), wait_until="networkidle")
            page.wait_for_timeout(400)
            page.locator(".wrap").evaluate(
                """el => {
                for (const c of el.querySelectorAll('.card')) {
                  if (c.querySelector('table')) c.remove();
                }
            }"""
            )
            page.locator(".wrap").first.screenshot(path=str(hero))

            page.goto(html.as_uri(), wait_until="networkidle")
            page.wait_for_timeout(400)
            page.screenshot(path=str(full), full_page=True)
            browser.close()

        for p in (hero, findings, full):
            print(f"Saved: {p}")

        composite = assets / "chokidar-launch-preview.png"
        composite_chokidar_launch(hero, findings, composite)


if __name__ == "__main__":
    main()
