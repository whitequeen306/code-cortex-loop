#!/usr/bin/env python3
"""Create demo GIF: health score 58 -> 82 using dashboard screenshots."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "assets" / "cortexloop-demo.gif"
HTML_BEFORE = ROOT / "examples" / "demo-app" / "docs" / "cortexloop" / "report.html"
PNG_FALLBACK = ROOT / "examples" / "demo-app" / "docs" / "cortexloop" / "report-dashboard.png"


def capture_frames():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return None

    frames = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 900, "height": 600}, device_scale_factor=2)
        page.goto(HTML_BEFORE.as_uri(), wait_until="networkidle")
        page.wait_for_timeout(400)

        # Before score (58)
        page.evaluate(
            """() => {
            const score = document.querySelector('.overall-score, [data-overall-score], .score-value');
            if (score) score.textContent = '58';
            const ring = document.querySelector('.score-ring-text');
            if (ring) ring.textContent = '58';
        }"""
        )
        frames.append(page.screenshot(type="png"))

        # After score (82) — simulate Direct mode improvement
        page.evaluate(
            """() => {
            const score = document.querySelector('.overall-score, [data-overall-score], .score-value');
            if (score) score.textContent = '82';
            const ring = document.querySelector('.score-ring-text');
            if (ring) ring.textContent = '82';
            document.body.style.transition = 'background 0.3s';
        }"""
        )
        page.wait_for_timeout(300)
        frames.append(page.screenshot(type="png"))
        frames.append(page.screenshot(type="png"))
        browser.close()
    return frames


def from_png_fallback():
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return None

    if not PNG_FALLBACK.exists():
        return None

    base = Image.open(PNG_FALLBACK).convert("RGB")
    w, h = base.size
    frames = []

    for score, label in [(58, "Before Direct"), (82, "After Direct"), (82, "After Direct")]:
        frame = base.copy()
        draw = ImageDraw.Draw(frame)
        banner_h = 48
        draw.rectangle([0, 0, w, banner_h], fill=(15, 23, 42))
        draw.text((20, 12), f"Health score: {score}/100 — {label}", fill=(248, 250, 252))
        frames.append(frame)
    return frames


def save_gif(frames):
    try:
        from PIL import Image
    except ImportError:
        return False

    OUT.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        OUT,
        save_all=True,
        append_images=frames[1:],
        duration=[1200, 1200, 800],
        loop=0,
        optimize=True,
    )
    print(f"Saved: {OUT}")
    return True


def main():
    frames = capture_frames()
    if frames is None:
        frames = from_png_fallback()
    if not frames:
        raise SystemExit("Need playwright or Pillow + report-dashboard.png to generate GIF")

    # Normalize to PIL Images
    from PIL import Image
    import io

    pil_frames = []
    for f in frames:
        if isinstance(f, Image.Image):
            pil_frames.append(f)
        else:
            pil_frames.append(Image.open(io.BytesIO(f)).convert("RGB"))

    if not save_gif(pil_frames):
        raise SystemExit("Pillow required to write GIF")


if __name__ == "__main__":
    main()
