#!/usr/bin/env python3
"""Local helper: build bounded contact sheets for D124 evidence (run manually)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1] / "evidence" / "d124-brand-review"
PNG = ROOT / "png"
OUT = ROOT
THUMB_W = 300


def thumb(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGB")
    h = int(im.height * (THUMB_W / im.width))
    return im.resize((THUMB_W, h), Image.Resampling.LANCZOS)


def grid_sheet(cells: list[tuple[str, Path]], out: Path, cols: int) -> None:
    thumbs = [thumb(p) for _, p in cells]
    row_h = max(t.height for t in thumbs) + 36
    w = cols * (THUMB_W + 16) + 16
    rows = (len(cells) + cols - 1) // cols
    h = rows * row_h + 16
    sheet = Image.new("RGB", (w, h), "#0d0d0d")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for i, (label, _) in enumerate(cells):
        r, c = divmod(i, cols)
        x = 16 + c * (THUMB_W + 16)
        y = 16 + r * row_h
        sheet.paste(thumbs[i], (x, y))
        draw.text((x, y + thumbs[i].height + 4), label, fill="#c9efcf", font=font)
    sheet.save(out, optimize=True)


def blocked_sheet() -> None:
    p375 = PNG / "dashboard_375.png"
    p1440 = PNG / "dashboard_1440.png"
    t375, t1440 = thumb(p375), thumb(p1440)
    w = THUMB_W * 2 + 48
    h = max(t375.height, t1440.height) + 72
    sheet = Image.new("RGB", (w, h), "#0d0d0d")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.text(
        (16, 8),
        "SYNTHETIC_RUNTIME_BLOCKED (workflow) — not brand coverage; R1 inspect png/*",
        fill="#c9efcf",
        font=font,
    )
    sheet.paste(t375, (16, 48))
    sheet.paste(t1440, (THUMB_W + 32, 48))
    draw.text((16, 48 + t375.height + 4), "dashboard_375 (all workflow ids match)", fill="#9ca3af", font=font)
    draw.text((THUMB_W + 32, 48 + t1440.height + 4), "dashboard_1440", fill="#9ca3af", font=font)
    sheet.save(OUT / "contactsheet-synthetic-blocked-workflow.png", optimize=True)


def main() -> None:
    for tag in ("375", "1440"):
        cells = [
            ("landing", PNG / f"landing_{tag}.png"),
            ("product", PNG / f"product_{tag}.png"),
            ("pricing", PNG / f"pricing_{tag}.png"),
            ("login", PNG / f"login_{tag}.png"),
        ]
        grid_sheet(cells, OUT / f"contactsheet-real-routes-{tag}.png", cols=2)
    blocked_sheet()


if __name__ == "__main__":
    main()