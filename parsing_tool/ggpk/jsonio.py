# [parsing_tool group A: LIVE TOOL] Safe to run. See parsing_tool/README.md.
"""Read and write the curation JSON without reformatting it.

Any tool that edits `base_mapping` competes with a human reviewer: if a two-line
change arrives as a 550-line diff because the writer normalised indentation or
line endings, the review is worthless and the real change is invisible.

The tree is not uniformly formatted (96 files at indent 2, 7 at indent 4), so
"just pick a house style" would rewrite the odd ones on every touch. These
helpers sniff each file's own conventions and put them back.
"""

from __future__ import annotations

import json
import re

BOM = "﻿"


def read_json(path: str) -> tuple[dict, dict]:
    """Return (document, style). Pass `style` straight back to write_json."""
    with open(path, "rb") as fh:
        raw = fh.read()
    text = raw.decode("utf-8-sig")
    style = {
        "bom": raw.startswith(BOM.encode("utf-8")),
        "newline": "\r\n" if b"\r\n" in raw else "\n",
        # indentation of the first indented line, defaulting to the common case
        "indent": next((len(m) for m in re.findall(r"(?m)^( +)(?=\S)", text)), 2),
        "trailing_newline": text.endswith(("\n", "\r\n")),
    }
    return json.loads(text), style


def write_json(path: str, doc: dict, style: dict) -> None:
    body = json.dumps(doc, ensure_ascii=False, indent=style.get("indent", 2))
    if style.get("trailing_newline", True):
        body += "\n"
    if style.get("bom"):
        body = BOM + body
    # newline="" stops Python translating \n on Windows; we control it ourselves.
    with open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(body.replace("\n", style.get("newline", "\n")))
