SiteCam Web v6.5.1 - Merge handover into original

Main changes:
- "Cập nhật vào bản gốc" works even when the same PDF was imported independently on different devices.
- Drawing matching order: stable source ID -> exact PDF SHA-256 -> unique normalized drawing name/page count.
- Duplicate pins are matched by source ID, then unique code/page, then close position on the same page.
- Matching pins are merged into the original; conflicts can still be reviewed and resolved.
- Pins that exist only in the incoming handover are added to the original drawing.
- Pins that exist only in the original are kept; no deletion occurs during merge.
- No duplicate drawing is created in Update Original mode.
- Photo storage IDs are respected when comparing conflict photos.

Recommended shared workflow:
1. Each engineer imports/receives the latest LATEST.zip.
2. Choose "Cập nhật vào bản gốc".
3. Review conflicts; keep original or use incoming update as appropriate.
4. Then upload the consolidated project back to the shared Drive as LATEST.zip.
