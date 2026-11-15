#!/usr/bin/env python3
"""Read-only HTTP sweep of constructa-nu.vercel.app public routes and image URLs."""
import re
import ssl
import urllib.error
import urllib.request
from html.parser import HTMLParser

HOST = "https://constructa-nu.vercel.app"
ROUTES = [
    "/",
    "/landing",
    "/about",
    "/apply",
    "/contact",
    "/pricing",
    "/features",
    "/product",
    "/customers",
    "/privacy-policy",
    "/terms-of-service",
    "/guides/review-brief-and-price",
    "/guides/programme-and-proposal-before-sharing",
]


class ImgCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag not in ("img", "source"):
            return
        d = dict(attrs)
        for key in ("src", "srcset"):
            val = d.get(key)
            if not val:
                continue
            for part in val.split(","):
                url = part.strip().split()[0] if part.strip() else ""
                if url:
                    self.urls.append(url)


def fetch(url: str) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": "Constructa-marketing-sweep/1.0"})
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace") if e.fp else ""


def absolutize(path: str) -> str:
    if path.startswith("http"):
        return path.split("?")[0] + ("?" + path.split("?", 1)[1] if "?" in path else "")
    if path.startswith("//"):
        return "https:" + path
    if path.startswith("/"):
        return HOST + path
    return HOST + "/" + path


def probe_image(url: str) -> tuple[int, str]:
    full = absolutize(url)
    if "/_next/image" in full:
        probe = full
    elif full.startswith(HOST):
        probe = full
    else:
        probe = full
    req = urllib.request.Request(probe, headers={"User-Agent": "Constructa-marketing-sweep/1.0"})
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
            ctype = resp.headers.get("Content-Type", "")
            return resp.status, ctype
    except urllib.error.HTTPError as e:
        return e.code, ""


def main():
    broken: list[tuple[str, str, int]] = []
    all_images: set[str] = set()
    lines = ["# Marketing public image sweep — extended 15 Nov 2026", "", f"Host: `{HOST}` (read-only).", "", "## Routes", ""]

    for route in ROUTES:
        status, html = fetch(HOST + route)
        imgs: list[str] = []
        if status == 200 and html:
            p = ImgCollector()
            p.feed(html)
            imgs = list(dict.fromkeys(p.urls))
            all_images.update(imgs)
        bad_route = status >= 400
        lines.append(f"- `{route}` — HTTP {status}, {len(imgs)} image refs")
        if bad_route:
            broken.append((route, "(page)", status))

        for img in imgs:
            if not img or img.startswith("data:"):
                continue
            ist, ctype = probe_image(img)
            if ist >= 400 or (ctype and "image" not in ctype and "octet" not in ctype):
                broken.append((route, img, ist))

    lines.extend([
        "",
        f"**Total routes:** {len(ROUTES)}",
        f"**Unique image refs:** {len(all_images)}",
        f"**Broken:** {len(broken)}",
        "",
    ])
    if broken:
        lines.append("## Failures")
        for r, u, c in broken:
            lines.append(f"- {r}: `{u}` → HTTP {c}")
    else:
        lines.append("All probed image URLs returned HTTP 200.")

    out = "/agent/repos/Constructa/docs/temp-files/marketing-public-image-sweep-2026-11-15.md"
    with open(out, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()