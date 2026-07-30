"""Cut a few categories out of the generated filter into a paste-able partial.

For dropping new-league sections into an existing filter without shipping the whole
tree. Re-run after any theme or tier edit:

    python filter_generation/generate.py --mode ruthless
    python parsing_tool/extract_partial.py --sections 32 41 42 94 -o out/partial.filter

--sections takes the leading digits of the block ids in the #==[NNNNN]== headers
(a category owns one such prefix, e.g. 94 = Scarabs, 42 = Curse of the Allflame).
--list prints every section with its id and name so you can pick.
"""
import argparse, io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILTER = os.path.join(ROOT, 'filter_generation', 'complete_filter.filter')

HDR = re.compile(r'^#==\[(\d+)\]-(.*?)==\s*$')


def parse_blocks(text):
    """-> [(id, header_line, [body lines])]. A block runs to the next #== header."""
    blocks, cur = [], None
    for ln in text.split('\n'):
        m = HDR.match(ln)
        if m:
            if cur:
                blocks.append(cur)
            cur = [m.group(1), ln, []]
            continue
        if cur:
            cur[2].append(ln)
    if cur:
        blocks.append(cur)
    return blocks


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sections', nargs='*', default=[],
                    help='leading digits of the block ids to keep, e.g. 42 94')
    ap.add_argument('-o', '--out', default='out/partial.filter')
    ap.add_argument('--list', action='store_true', help='list sections and exit')
    args = ap.parse_args()

    if not os.path.isfile(FILTER):
        sys.exit('no generated filter at %s - run generate.py first' % FILTER)
    blocks = parse_blocks(io.open(FILTER, encoding='utf-8').read())

    if args.list or not args.sections:
        seen = set()
        for bid, hdr, _ in blocks:
            pre = bid[:-3] or bid          # ids are <section><3-digit index>
            if pre in seen:
                continue
            seen.add(pre)
            sys.stdout.buffer.write(('  %-6s %s\n' % (pre, hdr.strip())).encode('utf-8'))
        if not args.sections:
            print('\n(pass --sections <prefix> ... to cut)')
        return

    # Block ids are NOT unique across categories - 41000 is both Currency/Runegrafts and
    # Curse of the Allflame/Enshrouded Gear. Match on the header TEXT instead, so a cut
    # cannot silently drag in an unrelated category that happens to share a prefix.
    want = [s.lower() for s in args.sections]
    kept = [b for b in blocks if any(w in b[1].lower() for w in want)]
    if not kept:
        sys.exit('no blocks matched %s - run --list to see the section headers' % args.sections)

    out = os.path.join(ROOT, args.out) if not os.path.isabs(args.out) else args.out
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with io.open(out, 'w', encoding='utf-8') as f:
        f.write('#===================================================================\n')
        f.write('# PARTIAL FILTER - sections %s\n' % ' '.join(sorted(want)))
        f.write('# Cut from complete_filter.filter by parsing_tool/extract_partial.py.\n')
        f.write('# Paste ABOVE the blocks it should outrank - PoE is first-match-wins.\n')
        f.write('#===================================================================\n\n')
        for _, hdr, body in kept:
            f.write(hdr + '\n')
            f.write('\n'.join(body).rstrip() + '\n\n')

    shows = sum(1 for _, _, b in kept for l in b if l.startswith(('Show', 'Hide', 'Minimal')))
    print('blocks : %d  (%d Show/Hide)' % (len(kept), shows))
    print('written: %s' % out)


if __name__ == '__main__':
    main()
