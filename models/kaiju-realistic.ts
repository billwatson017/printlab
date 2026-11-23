import { defineModel } from '../src/lib/model';
import {
  accelerate, add, boundsOf, cellular, chain, cone, cross, ellipsoid, lerp3, mul, noise, norm, sdfToManifold, slab, smax, smin,
  sphere, sub, union, type Prim, type V3,
} from '../src/lib/sdf';

/**
 * Realistic single-colour kaiju, sculpted as a signed-distance field:
 * smoothly blended body masses + jagged dorsal plates + teeth and claws,
 * with a cellular "gnarled hide" texture carved into the surface.
 *
 * Unit space: ~100 tall, facing -Y, Z up. Scaled to the requested height.
 */
export default defineModel({
  title: 'Kaiju (realistic)',
  description:
    'A roaring kaiju with an open, toothed mouth, clawed hands, jagged dorsal plates and a gnarled, scaly hide. Single colour. The tail curls on the ground so it stands on its own.',
  printNotes:
    'Single colour PLA (dark grey or charcoal looks best; a dry-brush of silver afterwards makes the texture pop). Print standing up with TREE supports (auto, 45°) — needed under the arms, jaw and hands. 0.12 mm layers to keep the skin texture. Lower "Mesh detail" for a sharper texture before downloading (slower to build).',
  params: {
    height: { value: 150, min: 80, max: 250, step: 5, label: 'Height (mm)' },
    texture: { value: 0.7, min: 0, max: 1.4, step: 0.1, label: 'Skin texture depth (mm)' },
    scale: { value: 2.6, min: 1.6, max: 5, step: 0.2, label: 'Skin scale size (mm)' },
    plates: { value: 1, min: 0.6, max: 1.4, step: 0.05, label: 'Dorsal plate size' },
    detail: { value: 0.7, min: 0.35, max: 1.5, step: 0.05, label: 'Mesh detail (mm, lower = finer, slower)' },
  },
  build: (m, p) => {
    const s = p.height / 100;
    const P = (v: V3): V3 => mul(v, s); // unit → mm

    // ---------- helpers in unit space ----------
    const sph = (c: V3, r: number) => sphere(P(c), r * s);
    const ell = (c: V3, r: V3) => ellipsoid(P(c), mul(r, s));
    const cap = (a: V3, b: V3, ra: number, rb: number) => cone(P(a), P(b), ra * s, rb * s);
    const ch = (pts: [V3, number][]) => chain(pts.map(([c, r]) => [P(c), r * s] as [V3, number]));
    const mirror = (v: V3, side: number): V3 => [v[0] * side, v[1], v[2]];

    const body: Prim[] = [];
    const carve: Prim[] = []; // subtracted after the body is blended
    const hard: Prim[] = []; // teeth & claws: added untextured, sharp
    const fine: Prim[] = []; // fingers & toes: blended with a small radius so they stay separate

    // ---------- torso ----------
    body.push(
      ell([0, 6, 40], [17, 16, 14]), // hips
      cap([0, 4, 40], [0, -2, 63], 16, 14), // belly
      ell([0, -4, 61], [15, 12, 12]), // chest
      ell([0, 4, 66], [15, 11, 12]), // shoulder hump
      cap([0, -2, 66], [0, -8, 79], 12, 9), // thick neck
      cap([0, -4, 74], [0, -11, 79.5], 9, 6), // throat into jaw
    );

    // ---------- head: tilted up, mouth open ----------
    const snoutA: V3 = [0, -12, 86.5], snoutB: V3 = [0, -23, 91.5];
    const jawA: V3 = [0, -10, 80.5], jawB: V3 = [0, -21, 80.5];
    body.push(
      ell([0, -10.5, 85], [7.5, 8, 6]), // skull
      cap(snoutA, snoutB, 5.8, 3.6), // upper snout
      cap(jawA, jawB, 5.5, 3.0), // lower jaw
    );
    for (const side of [1, -1]) {
      body.push(ell(mirror([4.8, -15.5, 89.8], side), [2.2, 3.6, 1.6])); // brow ridge
      body.push(ell(mirror([6.2, -9, 81.5], side), [2.4, 4, 3])); // cheek / jaw muscle
      carve.push(sph(mirror([5.3, -16.3, 88.2], side), 1.15)); // eye socket
      carve.push(sph(mirror([1.6, -24.4, 92.2], side), 0.7)); // nostril
    }
    carve.push(cap([0, -9, 83], [0, -26, 85.6], 2.6, 1.8)); // mouth cavity

    // Teeth along the upper snout (pointing down) and lower jaw (pointing up).
    for (const side of [1, -1]) {
      for (let i = 0; i < 6; i++) {
        const t = 0.12 + i * 0.15;
        const a = lerp3(snoutA, snoutB, t), r = 5.8 + (3.6 - 5.8) * t;
        const base: V3 = add(a, [side * r * 0.55, 0, -r * 0.62]);
        const len = 1.9 - t * 0.6;
        hard.push(cap(base, add(base, [side * -0.15, -0.25, -len]), 0.7, 0.12));
      }
      for (let i = 0; i < 5; i++) {
        const t = 0.15 + i * 0.17;
        const a = lerp3(jawA, jawB, t), r = 5.5 + (3.0 - 5.5) * t;
        const base: V3 = add(a, [side * r * 0.5, 0, r * 0.6]);
        hard.push(cap(base, add(base, [side * -0.15, -0.2, 1.5 - t * 0.5]), 0.6, 0.12));
      }
    }

    // ---------- arms & hands ----------
    const arms: { side: number; elbow: V3; wrist: V3; fwd: V3 }[] = [
      { side: 1, elbow: [22, -6, 53], wrist: [21, -17, 57], fwd: norm([0.15, -1, 0.25]) }, // raised
      { side: -1, elbow: [-21, -8, 51], wrist: [-18, -18, 50], fwd: norm([-0.1, -1, -0.1]) }, // lower
    ];
    for (const { side, elbow, wrist, fwd } of arms) {
      const shoulder: V3 = [side * 14, -3, 63];
      body.push(cap(shoulder, elbow, 6.2, 4.6), cap(elbow, wrist, 4.6, 3.5));
      const palm = add(wrist, mul(fwd, 1.8));
      body.push(sph(palm, 3.4));
      const right = norm(cross(fwd, [0, 0, 1]));
      const down = norm(cross(right, fwd));
      for (const spread of [-0.75, -0.25, 0.25, 0.75]) {
        const dir = norm(add(fwd, mul(right, spread)));
        const k1 = add(palm, mul(dir, 2.6));
        const k2 = add(add(k1, mul(dir, 2.0)), mul(down, -1.3));
        const tip = add(add(k2, mul(dir, 1.0)), mul(down, -2.4));
        fine.push(cap(palm, k1, 1.4, 1.25), cap(k1, k2, 1.25, 1.05));
        hard.push(cap(k2, tip, 0.95, 0.15)); // claw
      }
    }

    // ---------- legs & feet ----------
    for (const side of [1, -1]) {
      const hip: V3 = [side * 13, 6, 38], knee: V3 = [side * 15, -2, 22], ankle: V3 = [side * 14, 1, 7];
      body.push(cap(hip, knee, 12, 9), cap(knee, ankle, 9, 6.5));
      body.push(ell([side * 14, -3, 3.2], [7.5, 10, 4.4])); // foot, bottom below z=0 → flat on bed
      for (const dx of [-3.8, 0, 3.8]) {
        const toeA: V3 = [side * 14 + dx, -8, 3], toeB: V3 = [side * 14 + dx * 1.25, -13.5, 2.2];
        fine.push(cap(toeA, toeB, 2.3, 1.9));
        hard.push(cap(add(toeB, [0, -0.8, -0.4]), add(toeB, [dx * 0.1, -3.6, -1.9]), 1.4, 0.25));
      }
    }

    // ---------- tail: sweeps back and curls round on the ground ----------
    const tailPts: [V3, number][] = [
      [[0, 14, 36], 14], [[0, 28, 26], 11], [[4, 40, 16], 8.5], [[12, 50, 9], 6.5],
      [[22, 56, 4.6], 5], [[32, 56, 3.0], 3.6], [[40, 52, 1.8], 2.4],
    ];
    body.push(...ch(tailPts));

    // ---------- dorsal plates along the spine ----------
    const spine: [V3, number][] = [
      [[0, -8, 80], 9], [[0, -4, 72], 11], [[0, 2, 64], 13], [[0, 4, 52], 15], [[0, 8, 42], 15],
      ...tailPts.slice(0, 6),
    ];
    const segLen = spine.slice(1).map(([c], i) => Math.hypot(...sub(c, spine[i][0])));
    const total = segLen.reduce((a, b) => a + b, 0);
    const at = (f: number) => {
      let d = f * total;
      for (let i = 0; i < segLen.length; i++) {
        if (d <= segLen[i] || i === segLen.length - 1) {
          const t = Math.min(1, d / segLen[i]);
          const [a, ra] = spine[i], [b, rb] = spine[i + 1];
          return { c: lerp3(a, b, t), r: ra + (rb - ra) * t, T: norm(sub(b, a)), f };
        }
        d -= segLen[i];
      }
      throw new Error('unreachable');
    };
    const leaf = (h: number, w: number, sink: number): [number, number][] => [
      [-w / 2, -sink], [w / 2, -sink], [w * 0.46, h * 0.16], [w * 0.3, h * 0.27], [w * 0.4, h * 0.45],
      [w * 0.2, h * 0.52], [w * 0.24, h * 0.72], [w * 0.07, h * 0.78], [w * 0.02, h], [-w * 0.1, h * 0.8],
      [-w * 0.3, h * 0.7], [-w * 0.2, h * 0.56], [-w * 0.42, h * 0.44], [-w * 0.3, h * 0.31], [-w * 0.47, h * 0.17],
    ];
    const plateAt = (f: number, size: number, sideways: number) => {
      const { c, r, T } = at(f);
      // Outward reference: backwards on the torso, straight up along the tail.
      const ref = norm(lerp3([0, 0.8, 0.6], [0, 0, 1], Math.min(1, Math.max(0, (f - 0.35) / 0.25))));
      let N = norm(sub(ref, mul(T, ref[0] * T[0] + ref[1] * T[1] + ref[2] * T[2])));
      const X = norm(cross(T, N));
      if (sideways) N = norm(add(mul(N, Math.cos(0.45)), mul(X, sideways * Math.sin(0.45))));
      const V = norm(add(mul(N, Math.cos(0.2)), mul(T, Math.sin(0.2)))); // sweep back toward the tail
      const sink = 3.5;
      const base = add(add(c, mul(N, r - sink * 0.6)), mul(X, sideways * r * 0.32));
      // Height profile: biggest over the shoulders, shrinking down the tail.
      const bell = Math.exp(-(((f - 0.3) / 0.36) ** 2));
      const h = (5 + 25 * bell) * size * p.plates;
      const w = 0.62 * h + 2;
      return slab(P(base), T, V, leaf(h * s, w * s, sink * s), 1.35 * s, 0.55 * s);
    };
    const plates: Prim[] = [];
    for (let i = 0; i < 15; i++) plates.push(plateAt(0.02 + i * 0.065, 1, 0));
    for (let i = 0; i < 10; i++) {
      const f = 0.06 + i * 0.065;
      plates.push(plateAt(f, 0.62, 1), plateAt(f, 0.62, -1));
    }

    // ---------- combine ----------
    const k = 2.5 * s; // blend radius between body masses
    const massSdf = union(body, k);
    const fineSdf = union(fine, 0.6 * s);
    const bodySdf = (x: number, y: number, z: number) => smin(massSdf(x, y, z), fineSdf(x, y, z), 1.2 * s);
    const plateSdf = union(plates, 0);
    const carveSdf = union(carve, 0);
    const hardSdf = union(hard, 0);

    const cell = p.scale, depth = p.texture;
    const big = cell * 3.1;
    const sdf = (x: number, y: number, z: number, textured = true) => {
      let d = Math.min(bodySdf(x, y, z), plateSdf(x, y, z) - 0.4 * s);
      d = smax(d, -carveSdf(x, y, z), 0.8 * s);
      // Skin texture, only evaluated near the surface.
      if (textured && depth > 0 && Math.abs(d) < depth * 1.5 + 0.5) {
        const scales = Math.min(1, cellular(x, y, z, cell) * 2.2); // 0 in cracks → 1 on scale tops
        const lumps = cellular(x, y, z, big, 11); // larger gnarled plates
        const grain = noise(x / (cell * 0.6), y / (cell * 0.6), z / (cell * 0.6));
        const relief = 0.62 * scales + 0.28 * Math.min(1, lumps * 1.6) + 0.1 * grain;
        d += depth * (1 - relief) - depth * 0.35;
      }
      d = Math.min(d, hardSdf(x, y, z));
      return Math.max(d, -z); // flat bottom on the bed
    };

    const all = [...body, ...fine, ...plates, ...hard];
    const bounds = boundsOf(all, depth + 1);
    bounds.min[2] = -1;
    // Texture moves the surface by at most ~0.75 × depth; skip the expensive maths elsewhere.
    const fast = accelerate((x, y, z) => sdf(x, y, z, false), sdf, bounds, 2, depth * 0.8 + 0.3);
    const shape = sdfToManifold(m, fast, bounds, p.detail);
    return [{ name: 'Kaiju', color: '#4b5156', shape }];
  },
});
