import type { CrossSection } from 'manifold-3d';
import { defineModel } from '../src/lib/model';

/** Signed area of a polygon: positive = outer boundary, negative = hole (manifold convention). */
const area = (poly: { length: number; [i: number]: readonly [number, number] | number[] }) => {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i] as [number, number];
    const [x2, y2] = poly[(i + 1) % poly.length] as [number, number];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
};

export default defineModel({
  title: 'Name tag keychain',
  description:
    'A name in raised letters on a base that hugs the letter shapes, with a loop for a key ring. Type any name in the box below.',
  printNotes:
    'PLA, 2 colours, no supports, print flat. Base → slot 1, Letters → slot 2. The colour change happens once, at the top of the base, so it is quick and wastes little filament. A 25 mm split key ring fits the loop.',
  params: {
    name: { type: 'text', value: 'NAME', maxLength: 16, label: 'Name' },
    letterHeight: { value: 12, min: 8, max: 25, step: 0.5, label: 'Letter height (capitals)' },
    border: { value: 3, min: 2, max: 6, step: 0.5, label: 'Border around letters' },
    base: { value: 3, min: 2, max: 5, step: 0.2, label: 'Base thickness' },
    raise: { value: 1.2, min: 0.6, max: 3, step: 0.2, label: 'Letter height above base' },
    hole: { value: 4.5, min: 3, max: 8, step: 0.5, label: 'Key ring hole' },
  },
  build: ({ Manifold, CrossSection }, p, kit) => {
    const name = p.name.trim();
    if (!name) throw new Error('Type a name in the Name box.');
    const letters = kit.text(name, { size: p.letterHeight, spacing: 0.3 });

    // Base outline: grow the letters, then keep only outer boundaries so the
    // insides of letters like O, A, B are filled.
    const grown = letters.offset(p.border, 'Round');
    const outer = grown.toPolygons().filter((poly) => area(poly) > 0);
    const outline = new CrossSection(outer, 'NonZero');

    // Key ring loop on the left, overlapping the outline so they fuse.
    const b = outline.bounds();
    const ringR = p.hole / 2 + 2.5;
    const ringX = b.min[0] - ringR + 2;
    const ring = CrossSection.circle(ringR).translate([ringX, 0]);
    // A short neck so the loop joins solidly even if the first letter is narrow at mid-height.
    const neck = CrossSection.square([ringR + 2, ringR * 1.4], true).translate([ringX + ringR / 2 + 1, 0]);
    let shape: CrossSection = CrossSection.union([outline, ring, neck]);
    shape = shape.offset(-1.5, 'Round').offset(1.5, 'Round'); // round off sharp corners
    shape = shape.offset(1.5, 'Round').offset(-1.5, 'Round'); // fillet inside corners
    shape = shape.subtract(CrossSection.circle(p.hole / 2).translate([ringX, 0]));

    // Base, with a 0.4 mm step at the bottom to hide elephant's foot.
    const foot = Manifold.extrude(shape.offset(-0.4, 'Round'), 0.4);
    const body = Manifold.extrude(shape, p.base - 0.4).translate(0, 0, 0.4);
    const base = foot.add(body);
    const raised = Manifold.extrude(letters, p.raise).translate(0, 0, p.base);

    // Centre the whole thing on the bed.
    const bb = base.boundingBox();
    const cx = -(bb.min[0] + bb.max[0]) / 2;
    const cy = -(bb.min[1] + bb.max[1]) / 2;
    return [
      { name: 'Base', color: '#2563eb', shape: base.translate(cx, cy, 0) },
      { name: 'Letters', color: '#f8fafc', shape: raised.translate(cx, cy, 0) },
    ];
  },
});
