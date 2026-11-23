import { defineModel } from '../src/lib/model';

/** Single-colour example: a screw-on desk cable clip with a snap-in opening. */
export default defineModel({
  title: 'Desk cable clip',
  description: 'Screws to the underside of a desk and holds one cable. The C-shaped clip flexes so the cable snaps in.',
  printNotes: 'PLA or PETG, 0.2 mm layers, 3 walls, no supports. Print flat as shown.',
  params: {
    cable: { value: 6, min: 3, max: 14, step: 0.5, label: 'Cable diameter' },
    wall: { value: 2, min: 1.2, max: 4, step: 0.2, label: 'Clip wall' },
    width: { value: 10, min: 6, max: 25, step: 1, label: 'Clip width' },
    screw: { value: 4, min: 2.5, max: 6, step: 0.5, label: 'Screw diameter' },
  },
  build: ({ Manifold }, p) => {
    const r = p.cable / 2 + 0.3; // 0.3 mm clearance around the cable
    const ringR = r + p.wall;
    const holeX = ringR + p.screw + 2; // countersink clears the ring
    const baseL = 2 * (holeX + p.screw + 2);
    const baseT = 3;
    const base = Manifold.cube([baseL, p.width, baseT], true).translate(0, 0, baseT / 2);

    // Ring standing on the base, axis along Y so it prints without supports.
    const ringOuter = Manifold.cylinder(p.width, ringR, ringR, 0, true).rotate(90, 0, 0);
    const ringInner = Manifold.cylinder(p.width + 2, r, r, 0, true).rotate(90, 0, 0);
    const cz = baseT + r;
    // Opening at the top, a little narrower than the cable so it snaps in.
    const gap = Manifold.cube([p.cable * 0.75, p.width + 2, r + p.wall + 2], true).translate(0, 0, cz + r);
    const ring = ringOuter.subtract(ringInner).translate(0, 0, cz).subtract(gap);

    // Countersunk screw holes either side.
    const hole = (x: number) =>
      Manifold.cylinder(baseT + 2, p.screw / 2 + 0.2, p.screw / 2 + 0.2, 0, true)
        .add(Manifold.cylinder(p.screw / 2 + 0.2, p.screw / 2 + 0.2, p.screw, 0).translate(0, 0, baseT - p.screw / 2 - 0.2 + 0.01))
        .translate(x, 0, baseT / 2);

    const clip = base.add(ring).subtract(ringInner.translate(0, 0, cz)).subtract(hole(holeX)).subtract(hole(-holeX));
    return [{ name: 'Clip', color: '#3b82f6', shape: clip }];
  },
});
