#!/usr/bin/env python3
"""Build a self-contained Orbital Atlas HTML file without third-party tools.

Checkout layout: src/index.template.html + dist/ editable assets.
Export layout:   src/index.template.html + src/assets/ editable assets.
The latter writes index.html at the repository root by default.
"""
from __future__ import annotations

import argparse
import base64
from html import escape
from html.parser import HTMLParser
import json
import mimetypes
from pathlib import Path
import re
import sys

CSS_URL = re.compile(r"url\(\s*(['\"]?)(.*?)\1\s*\)", re.I)
CSS_IMPORT = re.compile(r"@import\s+(?:url\(\s*)?(['\"])([^'\"]+)\1\s*\)?\s*;", re.I)


def inside(path: Path, root: Path) -> Path:
    resolved = path.resolve()
    if not resolved.is_relative_to(root.resolve()):
        raise ValueError(f"Asset escapes the source directory: {path}")
    if not resolved.is_file():
        raise FileNotFoundError(f"Missing local asset: {path}")
    return resolved


def data_url(path: Path) -> str:
    mime = {".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf"}.get(path.suffix.lower())
    mime = mime or mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def read_css(path: Path, asset_root: Path, visited: set[Path]) -> str:
    path = inside(path, asset_root)
    if path in visited:
        return ""
    visited.add(path)
    css = path.read_text(encoding="utf-8")

    def import_css(match: re.Match[str]) -> str:
        url = match.group(2)
        if re.match(r"(?:[a-z][a-z0-9+.-]*:|//)", url, re.I):
            raise ValueError(f"External CSS import is not allowed: {url}")
        return read_css(path.parent / url.split("?")[0], asset_root, visited)

    css = CSS_IMPORT.sub(import_css, css)
    if re.search(r"@import\b", css, re.I):
        raise ValueError(f"Unsupported CSS import in {path.name}; use a local quoted URL")

    def embed_url(match: re.Match[str]) -> str:
        url = match.group(2).strip()
        if url.startswith(("data:", "#")):
            return match.group(0)
        if re.match(r"(?:[a-z][a-z0-9+.-]*:|//)", url, re.I):
            raise ValueError(f"External CSS resource is not allowed: {url}")
        asset = inside(path.parent / url.split("?")[0].split("#")[0], asset_root)
        return 'url("' + data_url(asset) + '")'

    return CSS_URL.sub(embed_url, css)


class ResourceAudit(HTMLParser):
    """Check resource requests; ordinary documentation links remain allowed."""
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.errors: list[str] = []
        self.script_count = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = dict(attrs)
        if tag == "script":
            self.script_count += 1
            if "src" in a or a.get("type") == "module":
                self.errors.append("A script still needs a resource or ES-module loader")
        if tag in {"img", "audio", "video", "source", "iframe", "embed", "object", "input"}:
            for key in ("src", "srcset", "data", "poster"):
                value = a.get(key)
                if value and not value.startswith("data:"):
                    self.errors.append(f"Unembedded {tag} {key}: {value}")
        if tag == "link" and a.get("href") and not a["href"].startswith("data:"):
            self.errors.append(f"Unembedded link resource: {a['href']}")


def build(root: Path, output: Path | None = None) -> tuple[Path, int]:
    exported = (root / "src/assets").is_dir()
    assets = root / ("src/assets" if exported else "dist")
    template = root / "src/index.template.html"
    if not template.is_file():
        raise FileNotFoundError("Missing src/index.template.html; preserve it as the editable page source")
    html = template.read_text(encoding="utf-8")
    styles: list[str] = []
    visited: set[Path] = set()
    for name in ("style.css", "math-typography.css"):
        if (assets / name).is_file():
            styles.append(read_css(assets / name, assets, visited))
    css = "\n".join(styles).replace("</style", "<\\/style")
    html, count = re.subn(r'<link\b(?=[^>]*\brel=["\']stylesheet["\'])[^>]*>', "", html, flags=re.I)
    if not count:
        raise ValueError("Template needs a stylesheet link to identify its unbuilt source state")
    html = html.replace("</head>", '<style id="orbital-styles">\n' + css + "\n</style>\n</head>", 1)

    guide = (assets / "math-guide.html").read_text(encoding="utf-8")
    if html.count("<!-- MATH_GUIDE -->") != 1:
        raise ValueError("Template must contain exactly one <!-- MATH_GUIDE --> marker")
    html = html.replace("<!-- MATH_GUIDE -->", guide)

    renderer = (assets / "renderer.js").read_text(encoding="utf-8")
    renderer = re.sub(r"^export\s+(?=(?:function|class|const|let|var)\b)", "", renderer, flags=re.M)
    app = (assets / "app.js").read_text(encoding="utf-8")
    app = re.sub(r"^import\s+\{[^}]+\}\s+from\s+['\"]\./renderer\.js(?:\?[^'\"]*)?['\"];?\s*\n", "", app, flags=re.M)
    # Compatibility with the earlier source: the guide is now already in HTML.
    app = re.sub(r"^fetch\(['\"]math-guide\.html(?:\?[^'\"]*)?['\"]\).*?;\s*$", "", app, flags=re.M)
    code = renderer + "\n" + app
    if re.search(r"^\s*(?:import|export)\b", code, re.M):
        raise ValueError("Unexpected module syntax: update the bundler rather than relying on file:// module loading")
    if re.search(r"\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|importScripts)\s*\(", code):
        raise ValueError("Runtime network API found; standalone output must work without network requests")
    fragments = assets / "math-fragments.json"
    before = ""
    if fragments.is_file():
        data = json.loads(fragments.read_text(encoding="utf-8"))
        before = "window.OrbitalMathFragments=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
    extra_js = assets / "math-fragments.js"
    if extra_js.is_file():
        before += extra_js.read_text(encoding="utf-8") + "\n"
    script = before + "(() => {\n'use strict';\n" + code + "\n})();"
    script = re.sub(r"</script", r"<\/script", script, flags=re.I)
    html, script_count = re.subn(r'<script\b[^>]*\bsrc=["\'](?:\./)?app\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>', lambda _: "<script>\n" + script + "\n</script>", html, flags=re.I)
    if script_count != 1:
        raise ValueError("Template must contain exactly one app.js script")

    if not re.search(r'http-equiv=["\']Content-Security-Policy["\']', html, re.I):
        policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"
        html = html.replace("</head>", f'<meta http-equiv="Content-Security-Policy" content="{policy}">\n</head>', 1)
    licenses = sorted((assets / "licenses").glob("*.txt"))
    if licenses:
        notices = "\n\n".join(path.name + "\n\n" + path.read_text(encoding="utf-8") for path in licenses)
        html = html.replace("</body>", '<template id="third-party-notices"><pre>' + escape(notices) + "</pre></template>\n</body>", 1)
    audit = ResourceAudit()
    audit.feed(html)
    if audit.errors:
        raise ValueError("; ".join(audit.errors))
    if audit.script_count != 1:
        raise ValueError("Expected exactly one embedded script")
    output = output or root / ("index.html" if exported else "dist/index.html")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html, encoding="utf-8")
    return output, len(html.encode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--output", type=Path, help="Optional output path; default follows the source layout")
    args = parser.parse_args()
    try:
        output, size = build(args.root.resolve(), args.output.resolve() if args.output else None)
    except (ValueError, OSError) as error:
        print(f"Build failed: {error}", file=sys.stderr)
        return 1
    print(f"Built {output} ({size:,} bytes). All runtime resources are embedded.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
