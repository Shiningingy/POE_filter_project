from __future__ import annotations
from urllib.parse import urlparse, unquote
import re


def _prettify_slug(slug: str) -> str:
    name = re.sub(r"[_-]+", " ", slug).strip()
    # Title-case words but keep all-caps (simple heuristic)
    name = " ".join(w if w.isupper() else w.capitalize() for w in name.split())
    return name

def infer_item_class_from_source(source: str) -> str | None:
    """
    Try to infer item_class from URL or local filename.
    """
    candidate = None
    if source.lower().startswith(("http://", "https://")):
        p = urlparse(source)
        segs = [s for s in p.path.split("/") if s]
        if segs:
            last = unquote(segs[-1])
            candidate = _prettify_slug(last)

    else:
        # Local file name (strip extension)
        fname = source.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
        stem = re.sub(r"\.html?$", "", fname, flags=re.I)
        candidate = _prettify_slug(stem)


    return candidate or None

def infer_item_class_from_html(soup) -> str | None:
    """
    Fallback: search nearby headings/tabs like 'Two Hand Swords Unique /16'
    """
    import re as _re
    hdr = soup.select_one("h1, h2, h3, h4, h5.card-header, .breadcrumb li:last-child, ul.nav .nav-link[role='tab']")
    if hdr:
        text = hdr.get_text(" ", strip=True)
        # remove counts like '/16' and trailing 'Unique ...'
        text = _re.sub(r"\s+Unique.*$", "", text, flags=_re.I)
        text = _re.sub(r"\s*/\s*\d+.*$", "", text)
        text = text.strip()
        if text:
            return text
    return None
