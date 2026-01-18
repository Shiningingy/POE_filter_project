# POE_filter_project

install -r requirements.txt

playwright install

# Demo

https://shiningingy.github.io/POE_filter_project/

## Acknowledgements

This project utilizes data, filter files, and visual assets obtained from [FilterBlade](https://filterblade.xyz/). We gratefully acknowledge their work in the Path of Exile community.

The following files are sourced from FilterBlade:

- `BaseTypes.csv`
- `bonusItemInfo.json`
- `FilterBlade_*.filter` files
- Visual assets: `item_bg` images and `MiniMapIcon_FullSpriteV2.png`

We also use [poe-dat-viewer](https://github.com/SnosMe/poe-dat-viewer) to extract and process information from the game's GGPK files. Many thanks to the authors for this valuable tool.

# DEV Patch Note.

Jan 13. Baic Viewer finished, DEMO went live.

Jan 17. Pre-defined tier added, Added Houver, Rule-system refined, Initilized Basic Theme, Viewer-Refineding, and a lot of bug fixing, DEMO updated.

- Refined frontend components with relative paths for better portability.
- Fixed TypeScript interface issues across Bulk Editor and Tooltips.
- Synchronized demo improvements back to main.

JAN 18. Major Bug fix on viewer, Auto-sound and sound file path fix. Generator logic implemented should work for most of the cases.

- **Demo Mode Evolution**: Implemented a complete browser-side TypeScript filter generator (`filterGenerator.ts`) enabling full offline filter building without a Python backend.
- **Virtual File System (VFS)**: Enhanced `demoAdapter` to persist user configuration changes in `localStorage`, allowing the demo to remember edits and generate customized filters.
- **Seamless Export**: Merged "Generate" and "Download" into a single action with automatic extension handling for Ruthless mode (`.filter` vs `.ruthlessfilter`).
- **UI/UX Polishing**: Resolved stacking context issues for modals and refined the Sound Popup footer for better visual clarity.
