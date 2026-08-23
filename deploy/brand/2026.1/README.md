# CORECOORD brand assets 2026.1

This directory is the tracked, web-safe subset of the approved CORECOORD brand
delivery. It is generated from the adjacent `dashpr` source package and keeps
the official manual's relative paths intact.

## Contents

- `logo-final-2026/vector/`: approved Logo Final 2026.1 SVG variants.
- `logo-final-2026/icons/`: favicon, app-icon, and mark PNG variants.
- `vi-system-2026/deliverables/assets/svg/`: coordinate field and stage palette graphics.
- `vi-system-2026/deliverables/previews/`: official VI template previews used by the manual.
- `vi-system-2026/deliverables/fonts/`: Noto Sans SC variable fonts and SIL OFL license.
- `vi-system-2026/deliverables/tokens/`: CORECOORD CSS and DTCG token sources.
- `vi-system-2026/deliverables/templates/`: approved course, print, social, and video SVG masters.
- `vi-system-2026/manual/`: the official VI System 2026.1 HTML/CSS manual.
- `manifest.json`, `checksums.sha256`, and `runtime-map.json`: generated path, byte-size, SHA-256, and resource-prefix records.

The generic `corecoord-poster-a3.png` is the approved VI manual preview. No
files from `vi-system-2026/campaigns/` or the MAKER review poster are included.
The runtime map exposes the PDF as the `guides` resource; the HTML manual stays
at its static URL so its original relative logo, graphic, preview, and font
references remain intact.

## Synchronize and verify

From the repository root:

```sh
pnpm brand:sync
pnpm brand:check
# In a release packaging job, set this to the package root. The resulting
# archive contains both static assets and protected `files/corecoord` copies.
CORECOORD_RESOURCE_ROOT=brand-release pnpm brand:materialize
```

The source defaults to `../dashpr/品牌商标-芯坐标`. For another checkout, set
`CORECOORD_BRAND_SOURCE` or pass `--source` to the script. `brand:materialize`
installs both the public static package (`assets/brand/corecoord/2026.1`) and
the protected `files/corecoord` copies. When that adjacent source exists,
`brand:check` compares it to the checked-in copy; CI checkouts without the
source validate the checked-in manifest and bytes only.

The script owns this versioned directory's generated files. It validates all
source files before replacing the managed tree and rejects campaign/review
paths. The `/files/corecoord` namespace is release-owned; do not place manual
uploads there because the next deployment replaces it as one managed bundle.
Do not edit copied assets in place; update the source package, then run the sync
and review the manifest diff.
