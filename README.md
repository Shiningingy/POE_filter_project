# Sharket Filter — Path of Exile Loot Filter Editor

A visual editor, simulator, and generator for Path of Exile loot filters, with full English/中文 support.

**🌐 Live: [sharketfilter.xyz](https://sharketfilter.xyz)**

No account, no install — open the site, customize, and download your `.filter`. All your edits are saved in your own browser.

## Features

- **Tier Editor** — drag-and-drop items between tiers across 50+ categories (currency, gear, uniques, maps, league content...), with per-category tier ladders mirroring the structure filter players already know.
- **Theme Editor** — per-category, per-tier styling (colors, font size, beams, minimap icons) with preset management and per-rule style overrides.
- **Sound Editor** — global per-item drop sounds plus per-occurrence sound rules (a unique feature: target one copy of a basetype in one category without affecting the rest), with custom mp3 support.
- **Drop Simulator** — WYSIWYG preview of how items will actually look in game, driven by the exact same resolution logic as the generator.
- **Unique tierlists & hover info** — curated 18-tier unique ladder with bilingual chase/exception rules, and FilterBlade-style "could drop as" tooltips.
- **Import / Export** — lossless filter round-trip via a snapshot sidecar or an embedded (game-valid) comment block; selective per-category import; standalone theme/sound file sharing.
- **Ruthless & POE2 modes** — mode-aware generation (`.ruthlessfilter`), with deeper Ruthless support in progress.

## How it works

```
filter_generation/data/   ← the filter database (git = single source of truth)
        │
        ├── local dev:  FastAPI backend (webapp/backend) reads/writes these files
        │
        └── deploy:     GitHub Action bakes them into static JSON
                        → Vite build → Cloudflare Pages (sharketfilter.xyz)
```

The deployed site is fully backend-free: a client-side data layer (`webapp/frontend/src/services/clientData.ts`) re-implements every backend endpoint over the baked data bundle plus your localStorage edits, and the filter itself is generated in the browser (`filterGenerator.ts`). A parity test suite (`webapp/frontend/test_parity.mjs`) keeps the two implementations in lockstep.

Filter tuning by invited maintainers happens through an in-app admin flow (Supabase-backed): submit your tuned snapshot → owner reviews the diff locally → approval lands as a git commit → the site redeploys itself. See [DEPLOYMENT.md](DEPLOYMENT.md) for the full architecture and setup.

## Local development

```bash
# backend (Python 3.12+)
pip install -r webapp/backend/requirements.txt
cd webapp/backend && uvicorn main:app --reload      # http://127.0.0.1:8000

# frontend
cd webapp/frontend && npm install && npm run dev     # http://localhost:5173 (proxies /api)
```

To test the deployed (backend-free) behavior locally:

```bash
python filter_generation/create_demo_bundle.py
cd webapp/frontend && npm run build:demo && npx vite preview
```

To generate a filter from the command line:

```bash
python filter_generation/generate.py --mode standard --game-version poe1
```

## Acknowledgements

This project utilizes data, filter files, and visual assets obtained from [FilterBlade](https://filterblade.xyz/, https://github.com/NeverSinkDev/FilterBlade-Public-Assets). We gratefully acknowledge their work in the Path of Exile community.

The following files are sourced from FilterBlade:

- `BaseTypes.csv`
- `bonusItemInfo.json`
- `FilterBlade_*.filter` files
- Visual assets: `item_bg` images and `MiniMapIcon_FullSpriteV2.png`

We also use [poe-dat-viewer](https://github.com/SnosMe/poe-dat-viewer) to extract and process information from the game's GGPK files. Many thanks to the authors for this valuable tool.

Path of Exile is a registered trademark of Grinding Gear Games. This is an unofficial fan-made tool.
