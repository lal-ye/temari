#!/usr/bin/env python3
"""Static OG card for Temari (audit phase 9 — static first, no build browser).

Renders public/og.png (1200x630): the landing's band composition in miniature
— the ተማሪ wordmark on paper, a hairline-bordered ASCII band, and the caption
row. The band glyphs come from the same wave/ramp idea as the canvas field
(asciiFieldMath.ts) evaluated once at t=0; this is a static echo of the motif,
not the shipped maths.

Dependencies (dev-only, not in package.json): pillow, fonttools, brotli.
Run:  python3 scripts/generate-og.py
"""
import math
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent

# --landing-* tokens (src/index.css is the source of truth; these mirror it)
PAGE = (0xF8, 0xF7, 0xF4)
INK = (0x11, 0x11, 0x13)
PALETTE = [(0xE3, 0x3E, 0x33), (0xC2, 0x2B, 0x22), (0xD9, 0x77, 0x06), (0x36, 0x36, 0x3B)]
REST_ALPHA = 0.256  # contrastFor('#F8F7F4', accent, deep).restAlpha
RAMP = " .,:;i1tfLCG08@"

W, H = 1200, 630
PAD = 60


def abyssinica_ttf() -> Path:
    """Convert the self-hosted woff2 once so PIL can rasterise the wordmark."""
    out = Path("/tmp/AbyssinicaSIL-Ethiopic.ttf")
    if not out.exists():
        f = TTFont(ROOT / "public/fonts/AbyssinicaSIL-Ethiopic.woff2")
        f.flavor = None
        f.save(out)
    return out


def at(alpha: float, color: tuple) -> tuple:
    """Pre-composited colour: `color` at `alpha` over the paper."""
    return tuple(round(a * alpha + p * (1 - alpha)) for a, p in zip(color, PAGE))


def main() -> None:
    img = Image.new("RGB", (W, H), PAGE)
    d = ImageDraw.Draw(img)

    mono = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
    mono_bold = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"

    # Wordmark
    word = ImageFont.truetype(str(abyssinica_ttf()), 190)
    d.text((PAD, 46), "ተማሪ", font=word, fill=PALETTE[0])

    # ASCII band (the field's region, static at t = 0)
    band_top, band_bottom = 300, 470
    d.rectangle([PAD, band_top, W - PAD, band_bottom], outline=INK, width=2)
    cell = 17
    glyph = ImageFont.truetype(mono, 14)
    cols = (W - 2 * PAD - 16) // 9
    rows = (band_bottom - band_top - 12) // cell
    for r in range(rows):
        for c in range(cols):
            v = 0.5 + 0.5 * math.sin(c * 0.28 + r * 0.55) * math.cos(r * 0.4 - c * 0.11)
            ch = RAMP[min(len(RAMP) - 1, int(v * len(RAMP)))]
            if ch == " ":
                continue
            color = PALETTE[(c + r) % 3] if (c + r) % 4 else PALETTE[3]
            d.text((PAD + 8 + c * 9, band_top + 6 + r * cell), ch, font=glyph,
                   fill=at(REST_ALPHA + 0.22 * v, color))

    # Caption row
    cap = ImageFont.truetype(mono_bold, 26)
    d.text((PAD, 512), "COGNITIVE STUDY ENGINE", font=cap, fill=INK)
    small = ImageFont.truetype(mono, 18)
    sub = "PRIVATE  ·  BROWSER-BASED  ·  LOCAL-FIRST"
    wpx = d.textlength(sub, font=small)
    d.text((W - PAD - wpx, 518), sub, font=small, fill=at(0.55, INK))

    out = ROOT / "public/og.png"
    img.save(out, optimize=True)
    print(f"wrote {out} ({out.stat().st_size // 1024} kB)")


if __name__ == "__main__":
    main()
