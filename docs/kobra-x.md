# Anycubic Kobra X — printer notes

Researched November 2026. Specs are from Anycubic and independent reviews.

| | |
|---|---|
| Build volume | **260 × 260 × 260 mm** |
| Colours | **4** natively (ACE Gen 2 built into the toolhead, no external box); up to 19 with ACE 2 Pro units |
| Speed | 300 mm/s recommended, 600 mm/s max, 20,000 mm/s² accel |
| Nozzle / bed | 300 °C / 100 °C, PEI spring-steel plate |
| Materials | PLA, PETG, TPU, PVA, PLA-CF, PETG-CF, and soft+hard combos (e.g. TPU + PLA) |
| Connectivity | Wi-Fi (no Ethernet). Cloud via Anycubic app, or LAN mode (turns off app, cloud and AI failure detection) |

## Getting a model onto the printer

1. **Design** in this repo → `npm run dev`, tweak, then *Download 3MF* (or `npm run export`).
2. **Slice** in [Anycubic Slicer Next](https://wiki.anycubic.com/en/software-and-app/new-page-anycubic-slicer-beta%28orca-version%29) (an OrcaSlicer fork). Choose the *Kobra X* printer preset.
   - Open the `.3mf`. Multi-part models load as **one object with one part per colour**.
   - In the object list, set each part's filament slot (the viewer shows the suggested slot).
   - [OrcaSlicer](https://github.com/SoftFever/OrcaSlicer) itself also ships a Kobra X profile.
3. **Print** — send over Wi-Fi from the slicer, or save to USB.

## File formats

- **3MF** (preferred): one file, keeps parts separate for multi-colour, units are explicit.
- **STL**: one per part. Fine for single-colour; for multi-colour you'd import all STLs together and say *yes* to "load as a single object with multiple parts".
- Slicer output is G-code (or `.gcode.3mf`).

## Design rules for this printer (0.4 mm nozzle)

These live in `src/lib/printer.ts` as `DESIGN_RULES`.

- Walls ≥ 1.2 mm (3 perimeters). Smallest reliable feature ≈ 0.8 mm.
- Overhangs up to 45° from vertical print without supports; bridges up to ~30 mm.
- Clearance per side: 0.3 mm for sliding fits, 0.15 mm for press fits.
- Small vertical holes print undersize; add ~0.2 mm to the radius.
- Add a 0.4 mm chamfer on bottom edges to hide "elephant's foot".
- Multi-colour: inlays work best as flat regions 0.6–1.2 mm deep on the top face. Every colour change costs purge material; the Kobra X's toolhead-mounted ACE keeps purge low, but fewer colour layers still means faster prints.

## Local control (future)

There is no official local API. Options we found:
- [grunna/ha-anycubic-kobra-x-lan](https://github.com/grunna/ha-anycubic-kobra-x-lan) — Home Assistant integration with reverse-engineered LAN MQTT notes for the Kobra X.
- [Rinkhals](https://rinkhals-community.github.io/Rinkhals/) community firmware (adds Moonraker/Fluidd) — **does not support the Kobra X** (signed firmware).
- [kobra-connect](https://github.com/rvanderp3/kobra-connect) — Moonraker bridge for Kobra 3 / S1; Kobra X untested.

## Sources

- [Anycubic Kobra X product page](https://store.anycubic.com/products/kobra-x)
- [Tom's Hardware review](https://www.tomshardware.com/3d-printing/anycubic-kobra-x-review)
- [TechRadar review](https://www.techradar.com/pro/anycubic-kobra-x-3d-printer-review)
- [All3DP review](https://all3dp.com/1/anycubic-kobra-x-review-purge-saving-multicolor-printing-on-a-budget/)
- [Anycubic Slicer Next quick start](https://wiki.anycubic.com/en/software-and-app/new-page-anycubic-slicer-beta%28orca-version%29/anycubic-slicer-next-slicing-software-quick-start-guide)
- [SimplyPrint Kobra X compatibility](https://simplyprint.io/compatibility/anycubic-kobra-x)
- [Rinkhals Kobra X page](https://jbatonnet.github.io/Rinkhals/printers/kobra-x/)
