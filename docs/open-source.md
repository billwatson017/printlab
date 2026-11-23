# Open-source projects we can build on

## In use

| Project | What for |
|---|---|
| [Manifold](https://github.com/elalish/manifold) (`manifold-3d`, Apache-2.0) | Geometry kernel. Fast, guaranteed-watertight booleans in WASM, runs in the browser and Node. |
| [three.js](https://threejs.org) (MIT) | Browser viewer. |
| [fflate](https://github.com/101arrowz/fflate) (MIT) | Zipping 3MF files. |
| [Vite](https://vite.dev) (MIT) | Dev server; reloads the viewer when a model file is saved. |

## Worth adding next

| Project | Why |
|---|---|
| [OrcaSlicer CLI](https://www.orcaslicer.com/wiki/cli/cli_mode) (AGPL-3.0) | Headless slicing (`orca-slicer --slice 0 --load-settings ... model.3mf`). Would let `npm run slice` produce G-code with real print time and filament use, using the Kobra X profile. Flags differ between versions — check `--help`. |
| [opentype.js](https://github.com/opentypejs/opentype.js) (MIT) or [`@manifold-studio/typeface`](https://www.npmjs.com/package/@manifold-studio/typeface) | Text → outlines → `CrossSection` → extrude. Needed for name tags, labels, embossed text. |
| [ManifoldCAD](https://manifoldcad.org/docs/jsuser/) | Manifold's own browser editor and helper library — good reference for idioms (smooth/refine, warp, hulls). |
| [BOSL2](https://github.com/BelfrySCAD/BOSL2) (BSD-2) | The best OpenSCAD library for threads, gears, hinges, rounding. We can't call it directly, but its algorithms are a good reference to port. |
| [grunna/ha-anycubic-kobra-x-lan](https://github.com/grunna/ha-anycubic-kobra-x-lan) | Reverse-engineered LAN MQTT protocol for the Kobra X — a path to "send to printer" from this app. |

## Alternatives we considered

| Project | Notes |
|---|---|
| [OpenSCAD](https://openscad.org) | The classic code-CAD tool, huge model library. Slower CSG (Manifold is now its backend option) and a weaker language than TypeScript. |
| [build123d](https://github.com/gumyr/build123d) / [CadQuery](https://github.com/CadQuery/cadquery) (Python, OpenCascade) | True B-rep CAD: real fillets/chamfers on edges, STEP export. Most LLM text-to-CAD research uses CadQuery ([Text-to-CadQuery](https://arxiv.org/abs/2505.06507), [CAD-Coder](https://arxiv.org/pdf/2505.19713)). Heavier install; consider if we need STEP files or lots of edge fillets. |
| [replicad](https://replicad.xyz) | OpenCascade in the browser (JS). B-rep fillets in our current stack, at the cost of a ~10 MB WASM and slower booleans. |
| [JSCAD](https://openjscad.xyz) | Pure JS CSG. Simple, but slower and less robust than Manifold. |
