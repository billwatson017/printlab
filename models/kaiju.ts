import type { Manifold } from 'manifold-3d';
import { clean, defineModel } from '../src/lib/model';

type V3 = [number, number, number];

/**
 * Chunky standing kaiju. Built at ~100 mm tall from hulls of spheres ("blobs"),
 * then scaled. Faces -Y (towards you in the default view). Stands on both feet
 * plus the tail tip, so it is stable without a base.
 */
export default defineModel({
  title: 'Kaiju figure',
  description:
    'A chunky, toy-style kaiju standing on two feet and its tail, with crystal plates down its back, glowing eyes and toe claws.',
  printNotes:
    'PLA, up to 4 colours: Body → 1, Plates → 2, Eyes → 3, Claws → 4 (or print single colour). Print standing up. Enable TREE supports (auto, threshold 45°): the arms and chin need a little support; the back plates and tail do not. 0.12–0.16 mm layers look best on the curves.',
  params: {
    height: { value: 120, min: 60, max: 240, step: 5, label: 'Height (mm)' },
    plates: { value: 1.2, min: 0.6, max: 1.5, step: 0.05, label: 'Back plate size' },
    tail: { value: 1, min: 0.8, max: 1.3, step: 0.05, label: 'Tail length' },
  },
  build: (m, p) => {
    const { Manifold } = m;
    const s = p.height / 100;

    const ball = (c: V3, r: number) => Manifold.sphere(r).translate(c);
    const blob = (...balls: [V3, number][]) => Manifold.hull(balls.map(([c, r]) => ball(c, r)));
    const mirrorX = (shape: Manifold) => shape.add(shape.mirror([1, 0, 0]));

    // ---- body (unit space, ~100 tall) ----
    const torso = blob([[0, 4, 38], 15], [[0, 0, 52], 16], [[0, -2, 66], 13]);
    const neck = blob([[0, -1, 68], 11], [[0, -6, 82], 8.5]);
    const head = blob([[0, -6, 87], 8.5], [[0, -14, 86], 6.5], [[0, -21, 84], 5], [[0, -18, 79], 5.5], [[0, -8, 80], 7]);
    const brow = mirrorX(blob([[5, -11, 89.5], 2.8], [[3, -16, 88], 2.2]));

    const leg = mirrorX(
      Manifold.union([
        blob([[11, 6, 36], 11], [[13, -2, 22], 8.5]), // thigh
        blob([[13, -2, 22], 8], [[12, -1, 8], 6]), // shin
        blob([[12, 2, 5], 5.5], [[12, -12, 4], 5], [[8, -14, 4], 4.5], [[16, -13, 4], 4.5]), // foot
      ]),
    );
    const arm = mirrorX(
      Manifold.union([
        blob([[13, -4, 64], 5], [[17, -7, 54], 4]), // upper arm
        blob([[17, -7, 54], 3.8], [[13, -15, 51], 3.4]), // forearm, hands held close to the body
      ]),
    );

    // Tail sweeps back and down to rest on the bed, with a slight curl.
    const t = p.tail;
    const tailPts: [V3, number][] = [
      [[0, 12, 36], 12.5],
      [[0, 24 * t, 26], 10],
      [[0, 35 * t, 17], 8],
      [[0, 46 * t, 10], 6.3],
      [[3, 56 * t, 5.2], 5],
      [[9, 63 * t, 3.4], 3.8],
    ];
    const tail = Manifold.union(tailPts.slice(1).map((pt, i) => blob(tailPts[i], pt)));

    let body = Manifold.union([torso, neck, head, brow, leg, arm, tail]);

    // Mouth: a 1.2 mm groove ~2.5 mm deep wrapping round the sides and front of the snout.
    const mouth = Manifold.union([
      Manifold.cube([10, 16, 1.2], true).translate(3.4 + 5, 0, 0),
      Manifold.cube([10, 16, 1.2], true).translate(-3.4 - 5, 0, 0),
      Manifold.cube([12, 6, 1.2], true).translate(0, -7.6, 0),
    ])
      .rotate(-8, 0, 0) // rises slightly towards the back of the jaw
      .translate(0, -19, 81.2);
    body = body.subtract(mouth);

    // ---- back plates: pointed crystals in the YZ plane, leaning back ----
    const plate = (y: number, z: number, leanDeg: number, h: number, w: number) => {
      h *= p.plates;
      w *= Math.min(p.plates, 1.2);
      const sink = 4; // root buried in the body so it fuses solidly
      const pts: [number, number][] = [
        [-w / 2, -sink], [w / 2, -sink], [w * 0.42, h * 0.35], [w * 0.12, h * 0.62],
        [w * 0.02, h], [-w * 0.2, h * 0.55], [-w * 0.42, h * 0.4],
      ];
      const thick = 2.6;
      return Manifold.extrude([pts], thick)
        .translate(0, 0, -thick / 2)
        .rotate(90, 0, 90) // (u, v, w) → (x = w, y = u, z = v)
        .rotate(-leanDeg, 0, 0)
        .translate(0, y, z);
    };
    let plates = Manifold.union([
      plate(4, 79, 50, 8, 7),
      plate(10, 70, 40, 13, 10),
      plate(15.5, 59, 32, 16, 12),
      plate(18.5, 48, 26, 15, 12),
      plate(21, 41, 18, 13, 11),
      plate(28, 34, 12, 11, 10),
      plate(36, 25.5, 6, 9, 9),
      plate(44 * t, 18, 2, 7, 7.5),
      plate(51 * t, 13.4, 0, 5, 6),
    ]);

    // ---- eyes & toe claws ----
    const eyes = mirrorX(ball([5.6, -13.2, 87.6], 1.9));
    const claw = (x: number, y: number) =>
      Manifold.cylinder(4, 1.7, 0.3).rotate(90, 0, 0).translate(x, y - 1, 1.7);
    const claws = mirrorX(Manifold.union([claw(8, -17), claw(12, -16), claw(16, -16)]));

    // Flat bottom on the bed, then make the colour parts non-overlapping.
    const floor = Manifold.cube([400, 400, 400], true).translate(0, 0, 200);
    body = body.intersect(floor);
    plates = plates.subtract(body);
    const eyePart = eyes.intersect(body.add(eyes)); // whole eye ball
    body = body.subtract(eyes);
    const clawPart = claws.intersect(floor).subtract(body);

    const place = (x: Manifold) => clean(m, x).scale(s);
    return [
      { name: 'Body', color: '#3f5a45', shape: place(body) },
      { name: 'Plates', color: '#9ad3f0', shape: place(plates) },
      { name: 'Eyes', color: '#fde047', shape: place(eyePart) },
      { name: 'Claws', color: '#f1f5f9', shape: place(clawPart) },
    ];
  },
});
