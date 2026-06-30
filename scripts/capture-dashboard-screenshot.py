#!/usr/bin/env python3
"""Capture CodeCortexLoop HTML dashboard screenshots for README / launch posts."""
from __future__ import annotations

import argparse
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent

CASE_STUDIES = {
    "lianyu-pc": ROOT / "examples/lianyu-pc/docs/cortexloop/report.html",
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


def composite_launch(hero: Path, findings: Path, out: Path, *, title: str, subtitle: str) -> None:
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

    draw.text((pad, 8), title, fill=(17, 24, 39), font=font)
    draw.text((pad, 32), subtitle, fill=(107, 114, 128), font=sub)

    y = pad + label_h
    canvas.paste(left, (pad, y))
    canvas.paste(right, (pad + left.width + gap, y))

    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, optimize=True)
    print(f"Saved composite: {out}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Capture cortexloop dashboard screenshots")
    parser.add_argument("--case", choices=[*CASE_STUDIES.keys(), "all"], default="lianyu-pc")
    parser.add_argument(
        "--launch-assets",
        action="store_true",
        help="Generate docs/assets launch PNGs from lianyu-pc report",
    )
    args = parser.parse_args()

    cases = CASE_STUDIES.keys() if args.case == "all" else [args.case]

    for name in cases:
        html = CASE_STUDIES[name]
        out_dir = html.parent
        capture(html, out_dir / "report-dashboard.png", full_page=True)

    if args.launch_assets or args.case == "lianyu-pc":
        html = CASE_STUDIES["lianyu-pc"]
        assets = ROOT / "docs/assets"
        hero = assets / "lianyu-pc-report-hero.png"
        findings = assets / "lianyu-pc-report-findings.png"
        full = assets / "lianyu-pc-report-full.png"

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900}, device_scale_factor=2)
            page.goto(html.as_uri(), wait_until="networkidle")
            page.wait_for_timeout(600)

            page.locator("table").first.locator("xpath=ancestor::div[contains(@class,'card')]").screenshot(
                path=str(findings)
            )

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

        composite = assets / "lianyu-pc-launch-preview.png"
        composite_launch(
            hero,
            findings,
            composite,
            title="CodeCortexLoop on LianYu-PC (Vue 3 + Spring Boot)",
            subtitle="Real /cortexloop-deep Report · health score 32 · 81 findings",
        )


if __name__ == "__main__":
    main()
