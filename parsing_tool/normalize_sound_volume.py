# -*- coding: utf-8 -*-
"""Every alert sound plays at volume 300. Enforce it, or report where it is not.

    python parsing_tool/normalize_sound_volume.py            # report only
    python parsing_tool/normalize_sound_volume.py --apply    # rewrite
    python parsing_tool/normalize_sound_volume.py --check    # exit 1 if any value is not 300

★ THE POLICY, from the author (2026-08-10): *"the sound should be 300 by default, loudness is
determined by the mp3 file, not the loudness, below 300 will make some of them hard to hear."*

So the filter's volume argument is NOT the loudness control — the mp3 is. A sound that should be
quiet is authored quiet; turning it down again in the filter only pushes it under the threshold
where it stops being audible over combat. The values below 300 were a second, redundant loudness
ladder layered on the first, and it is the one that made curated sounds inaudible.

FOUR STORES, because `resolveSoundPair` reads four and any one of them can carry a volume:

    rule / item-card `overrides.PlayAlertSound`   [file, volume]   wins over everything
    tier `theme.PlayAlertSound`                   [file, volume]
    `Sharket_sound_map.json` class_sounds[].volume                 the shared library
    `default_sound_id` fallback                                    already hardcoded 300

plus `footer.filter`, which is raw hand-maintained text no generator touches — the `[99999]`
catch-all lives there and carried the only two 150s in the build.

⚠️ EDITS ARE TEXTUAL, NOT A JSON RE-DUMP. Re-serialising would reformat whole files (indent and
key order vary across this tree) and bury a 260-value change in a thousand-line diff nobody can
read. The patterns below rewrite only the number, so every diff line is a volume.

⚠️ A `disabled:` sound is a string, not a [file, volume] pair, so it never matches these patterns
and stays muted. That is deliberate: silence is not a volume.
"""
import io, os, re, sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "filter_generation", "data")
TARGET = 300

APPLY = "--apply" in sys.argv
CHECK = "--check" in sys.argv

# (glob root, pattern) — group 1 is kept verbatim, group 2 is the volume.
# `\s` spans newlines, so a pair split across lines is matched too.
PAIR = re.compile(r'("PlayAlertSound"\s*:\s*\[\s*"(?:[^"\\]|\\.)*"\s*,\s*)(\d+)')
VOLUME = re.compile(r'("volume"\s*:\s*)(\d+)')
FILTER_LINE = re.compile(r'((?:CustomAlertSound|PlayAlertSound)\s+"[^"]*"\s+)(\d+)')

SOURCES = [
    (os.path.join(DATA, "tier_definition"), ".json", PAIR, "tier theme / item-card overrides"),
    (os.path.join(DATA, "base_mapping"), ".json", PAIR, "rule + card overrides"),
    (os.path.join(DATA, "theme", "sharket", "Sharket_sound_map.json"), None, VOLUME, "sound library"),
    (os.path.join(DATA, "footer.filter"), None, FILTER_LINE, "footer catch-all (raw text)"),
]


def files_under(root, ext):
    if ext is None:
        return [root] if os.path.exists(root) else []
    out = []
    for dp, _, fn in os.walk(root):
        out += [os.path.join(dp, f) for f in sorted(fn) if f.endswith(ext)]
    return out


def main():
    total, changed_files, offenders = 0, 0, []
    for root, ext, pat, label in SOURCES:
        n_src = 0
        for path in files_under(root, ext):
            txt = io.open(path, encoding="utf-8").read()
            hits = [m for m in pat.finditer(txt) if int(m.group(2)) != TARGET]
            if not hits:
                continue
            n_src += len(hits)
            rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
            offenders.append((rel, [int(m.group(2)) for m in hits]))
            if APPLY:
                new = pat.sub(lambda m: m.group(1) + str(TARGET), txt)
                io.open(path, "w", encoding="utf-8", newline="").write(new)
                changed_files += 1
        print("  %-34s %4d value(s) not at %d" % (label, n_src, TARGET))
        total += n_src

    print()
    if total == 0:
        print("[OK] every alert sound is at volume %d." % TARGET)
        return 0
    for rel, vols in offenders[:12]:
        print("   %-58s %s" % (rel[-58:], sorted(set(vols))))
    if len(offenders) > 12:
        print("   … +%d more files" % (len(offenders) - 12))
    print()
    if APPLY:
        print("[OK] rewrote %d value(s) across %d file(s) -> %d" % (total, changed_files, TARGET))
        return 0
    if CHECK:
        print("[FAIL] %d value(s) are not %d. Run with --apply." % (total, TARGET))
        return 1
    print("(report only -- pass --apply to rewrite, --check to fail a build)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
