# printlab — agent instructions

The user describes an object; you turn it into a parametric model in `models/<kebab-name>.ts` that they view at http://localhost:5190 (`npm run dev`) and print on an **Anycubic Kobra X** (260 × 260 × 260 mm bed, 0.4 mm nozzle, 4 colours). Printer details: `docs/kobra-x.md`.

## Workflow

1. If a key dimension or the purpose is unclear, ask one short question; otherwise pick sensible real-world sizes and say what you assumed.
2. Write `models/<name>.ts` using `defineModel` (see `models/two-tone-coaster.ts` for multi-colour, `models/cable-clip.ts` for single). Files in `models/` are discovered automatically — no registry.
3. Run `npm run check <name>` and fix every ERROR. Treat warnings seriously.
4. Run `npm run typecheck`.
5. Tell the user to look at `http://localhost:5190/#<name>` (the page reloads on save). Summarise size, parts/colours, and how to print it (supports? orientation?).

## Model conventions

- Units mm, **Z up**, model sits on z = 0, centred on x = y = 0.
- Orient the model the way it should print: largest flat face down, minimal overhangs.
- Expose the dimensions a person would want to tweak as `params` (with sensible min/max/step and a `label`). Derive everything else from them.
- Each `Part` is one colour. Parts must not overlap — subtract the inlay from the base (see the coaster). Max 4 distinct colours.
- Use the `CrossSection` 2D API + `Manifold.extrude` / `revolve` for profiles; `Manifold.hull` for rounded blocks; `cylinder(h, r, r, 0, true)` for centred cylinders. Manifold types: `node_modules/manifold-3d/manifold-encapsulated-types.d.ts`.
- Text: `build(m, p, kit)` → `kit.text('Hi', { size: 12 })` returns a centred `CrossSection` (size = capital height, mm). Use a `{ type: 'text', value: '...' }` param so it's editable in the viewer. Don't commit people's real names (the repo is public) — use a placeholder and let them type it.
- Organic shapes (figures, animals): hull spheres into blobs (`Manifold.hull`), union the blobs, cut the bottom flat at z = 0. See `models/kaiju.ts`. Wrap each returned part in `clean(m, shape)` to drop zero-volume slivers.
- Realistic / textured sculpts: use the SDF toolkit in `src/lib/sdf.ts` (blended spheres/ellipsoids/tapered capsules, `slab` for fins/plates, `cellular` + `noise` for skin texture, `accelerate` + `sdfToManifold` to mesh). See `models/kaiju-realistic.ts`. Keep texture relief ≥ 0.4 mm deep and ≥ 1.6 mm across or the nozzle can't reproduce it. Keep the build ≲ 6 s at default detail (`time npm run check <name>`).
- Check the result visually: `http://localhost:5190/?view=side#<name>` (views: iso, top, front, side).
- Put `printNotes` on every model: material, supports yes/no, slicer tips.

## Design rules (0.4 mm nozzle) — `DESIGN_RULES` in `src/lib/printer.ts`

- Walls ≥ 1.2 mm; features ≥ 0.8 mm.
- Overhangs ≤ 45° from vertical, bridges ≤ 30 mm, else design them out (chamfers instead of fillets on downward faces, teardrop horizontal holes) or note supports are needed.
- Fits: 0.3 mm clearance per side for sliding, 0.15 mm for press fit. Add 0.2 mm to small hole radii.
- 0.4 mm chamfer on bottom outside edges (elephant's foot).
- Multi-colour inlays: 0.6–1.2 mm deep on the top surface.
- Snap/flex features: orient so layer lines run along the flexing direction, not across it.

## Repo layout

- `models/` — one file per model (default export `defineModel({...})`)
- `src/lib/` — kernel loader, model types, printer profile, checks, STL/3MF export (shared by browser + Node)
- `src/main.ts` — three.js viewer
- `scripts/` — `check` and `export` CLIs (Node, via tsx)
- `out/` — exports (git-ignored)
