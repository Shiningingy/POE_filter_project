# -*- coding: utf-8 -*-
"""Does every workflow the deploy docs name actually exist?

    python parsing_tool/check_doc_workflows.py          # exit 1 if a named workflow is missing

★ WHY THIS EXISTS. DEPLOYMENT.md described a deploy that ran from
`.github/workflows/deploy-pages.yml` for five months after that file was deleted
(66f027e, 2026-06-14). Nothing failed: the docs kept saying "push to main and the site
redeploys itself", pushes went green, and sharketfilter.xyz stayed on a June build.
A doc that names a workflow is a promise about what happens on a push, so the name has
to resolve.

What it checks: every `.github/workflows/<name>.yml` (or `.yaml`) path written in the
docs listed in DOCS must exist in the repo. Only the full path counts as a reference; a
bare `deploy-pages.yml` in prose is not checked, so a doc that mentions some other YAML
file by name cannot trip it.

It refuses to pass on nothing: if the docs name no workflow at all, that is a failure,
because a check that matched zero references checked nothing (DEPLOYMENT.md has always
named its deploy workflow, so zero means the pattern or the docs moved).
"""
import os, re, sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)

DOCS = ("DEPLOYMENT.md", "README.md")
WORKFLOW_PATH = re.compile(r"\.github/workflows/[A-Za-z0-9_.-]+\.ya?ml")


def main():
    refs = []      # (doc, line number, path)
    for doc in DOCS:
        with open(os.path.join(REPO, doc), encoding="utf-8") as f:
            for n, line in enumerate(f, 1):
                for m in WORKFLOW_PATH.finditer(line):
                    refs.append((doc, n, m.group(0)))

    if not refs:
        print("!! no .github/workflows/*.yml path found in %s - nothing was checked" % ", ".join(DOCS))
        return 1

    missing = [(doc, n, p) for doc, n, p in refs if not os.path.isfile(os.path.join(REPO, p))]
    for doc, n, p in refs:
        print("  [%s] %s:%d  %s" % ("MISSING" if (doc, n, p) in missing else "ok", doc, n, p))

    if missing:
        print("\n!! %d workflow path(s) named in the docs do not exist." % len(missing))
        print("   Restore the workflow, or fix the doc so it describes the deploy that really runs.")
        return 1
    print("\n[OK] every workflow the docs name exists (%d reference(s))" % len(refs))
    return 0


if __name__ == "__main__":
    sys.exit(main())
