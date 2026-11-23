import { defineModel } from '../src/lib/model';

/** Multi-colour example: each Part is a separate colour — the slicer assigns one filament per part. */
export default defineModel({
  title: 'Two-tone coaster',
  description: 'Round coaster with a star inlay that is flush with the top surface, plus a raised rim.',
  printNotes: 'PLA, 2 colours. In Anycubic Slicer Next assign Base → slot 1, Star → slot 2. No supports.',
  params: {
    diameter: { value: 95, min: 60, max: 140, step: 1, label: 'Diameter' },
    thickness: { value: 5, min: 3, max: 10, step: 0.2, label: 'Thickness' },
    points: { value: 5, min: 3, max: 12, step: 1, label: 'Star points' },
    inlayDepth: { value: 1.2, min: 0.6, max: 3, step: 0.2, label: 'Inlay depth' },
  },
  build: ({ Manifold, CrossSection }, p) => {
    const R = p.diameter / 2;
    const rim = 2;

    // Star polygon.
    const outer = R * 0.62, inner = outer * 0.45;
    const pts: [number, number][] = [];
    for (let i = 0; i < p.points * 2; i++) {
      const a = (Math.PI * i) / p.points + Math.PI / 2;
      const r = i % 2 === 0 ? outer : inner;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const star2d = new CrossSection([pts]);

    const disc = Manifold.cylinder(p.thickness, R, R);
    const lip = Manifold.cylinder(1, R, R).subtract(Manifold.cylinder(1, R - rim, R - rim)).translate(0, 0, p.thickness);
    const starTop = p.thickness;
    const star = Manifold.extrude(star2d, p.inlayDepth).translate(0, 0, starTop - p.inlayDepth);

    // Chamfer the bottom edge 0.4 mm to hide elephant's foot.
    const chamfer = Manifold.cylinder(0.4, R - 0.4, R).add(Manifold.cylinder(p.thickness, R, R).translate(0, 0, 0.4));
    const base = disc.intersect(chamfer).add(lip).subtract(star);

    return [
      { name: 'Base', color: '#1f2937', shape: base },
      { name: 'Star', color: '#f59e0b', shape: star },
    ];
  },
});
