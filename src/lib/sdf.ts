/**
 * Signed-distance sculpting: build organic shapes from smoothly blended primitives,
 * add surface texture, then mesh with Manifold.levelSet (always watertight).
 *
 * Convention here: negative = inside, positive = outside (the usual SDF sign).
 * `sdfToManifold` flips it for Manifold. Everything is plain numbers — no
 * allocations in the hot path, because the SDF is evaluated millions of times.
 */
import type { Manifold, ManifoldToplevel } from 'manifold-3d';

export type V3 = [number, number, number];
export type Sdf = (x: number, y: number, z: number) => number;

export interface Prim {
  /** Bounding sphere: the primitive is entirely inside it. Used to skip far-away work. */
  cx: number; cy: number; cz: number; r: number;
  f: Sdf;
}

// ---------- vector helpers (setup only, not hot path) ----------
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---------- blending ----------
/** Smooth minimum (union) with blend radius k. */
export function smin(a: number, b: number, k: number) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
/** Smooth maximum (intersection / subtraction with -b). */
export const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);

// ---------- primitives ----------
export function sphere(c: V3, r: number): Prim {
  const [cx, cy, cz] = c;
  return { cx, cy, cz, r, f: (x, y, z) => {
      const dx = x - cx, dy = y - cy, dz = z - cz;
      return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
    } };
}

/** Ellipsoid (approximate distance, good near the surface). */
export function ellipsoid(c: V3, radii: V3): Prim {
  const [cx, cy, cz] = c;
  const [a, b, e] = radii;
  const rmin = Math.min(a, b, e);
  return {
    cx, cy, cz, r: Math.max(a, b, e),
    f: (x, y, z) => {
      const u = (x - cx) / a, v = (y - cy) / b, w = (z - cz) / e;
      return (Math.sqrt(u * u + v * v + w * w) - 1) * rmin;
    },
  };
}

/** Capsule whose radius tapers from ra at a to rb at b. */
export function cone(a: V3, b: V3, ra: number, rb: number): Prim {
  const [ax, ay, az] = a;
  const dx = b[0] - ax, dy = b[1] - ay, dz = b[2] - az;
  const ll = dx * dx + dy * dy + dz * dz || 1;
  const mid = lerp3(a, b, 0.5);
  return {
    cx: mid[0], cy: mid[1], cz: mid[2], r: Math.sqrt(ll) / 2 + Math.max(ra, rb),
    f: (x, y, z) => {
      const px = x - ax, py = y - ay, pz = z - az;
      const t = Math.min(1, Math.max(0, (px * dx + py * dy + pz * dz) / ll));
      const qx = px - dx * t, qy = py - dy * t, qz = pz - dz * t;
      return Math.sqrt(qx * qx + qy * qy + qz * qz) - (ra + (rb - ra) * t);
    },
  };
}

/** Chain of tapered capsules through points [p, r]. */
export function chain(pts: [V3, number][]): Prim[] {
  return pts.slice(1).map((pt, i) => cone(pts[i][0], pt[0], pts[i][1], pt[1]));
}

/** Exact 2D polygon distance (negative inside). */
function polyDist(px: number, py: number, xs: Float64Array, ys: Float64Array) {
  const n = xs.length;
  let d = (px - xs[0]) ** 2 + (py - ys[0]) ** 2;
  let s = 1;
  for (let i = 0, j = n - 1; i < n; j = i, i++) {
    const ex = xs[j] - xs[i], ey = ys[j] - ys[i];
    const wx = px - xs[i], wy = py - ys[i];
    const t = Math.min(1, Math.max(0, (wx * ex + wy * ey) / (ex * ex + ey * ey)));
    const bx = wx - ex * t, by = wy - ey * t;
    d = Math.min(d, bx * bx + by * by);
    const c1 = py >= ys[i], c2 = py < ys[j], c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * Math.sqrt(d);
}

/**
 * A flat 2D outline given thickness — e.g. a fin or plate. `outline` is in (u, v)
 * where u runs along `uDir` and v along `vDir`; thickness tapers from t0 at v=0
 * to t1 at the top of the outline.
 */
export function slab(origin: V3, uDir: V3, vDir: V3, outline: [number, number][], t0: number, t1: number): Prim {
  const V = norm(vDir);
  const U = norm(sub(uDir, mul(V, dot(uDir, V))));
  const W = cross(U, V);
  const xs = Float64Array.from(outline.map((p) => p[0]));
  const ys = Float64Array.from(outline.map((p) => p[1]));
  const vMax = Math.max(...ys);
  const reach = Math.max(...outline.map(([u, v]) => Math.hypot(u, v)));
  const [ox, oy, oz] = origin;
  return {
    cx: ox, cy: oy, cz: oz, r: reach + t0,
    f: (x, y, z) => {
      const px = x - ox, py = y - oy, pz = z - oz;
      const u = px * U[0] + py * U[1] + pz * U[2];
      const v = px * V[0] + py * V[1] + pz * V[2];
      const w = px * W[0] + py * W[1] + pz * W[2];
      const half = t0 + (t1 - t0) * Math.min(1, Math.max(0, v / vMax));
      return Math.max(polyDist(u, v, xs, ys), Math.abs(w) - half);
    },
  };
}

/** Smooth union of primitives, skipping any whose bounding sphere can't affect the result. */
export function union(prims: Prim[], k: number): Sdf {
  const n = prims.length;
  const cx = Float64Array.from(prims.map((p) => p.cx));
  const cy = Float64Array.from(prims.map((p) => p.cy));
  const cz = Float64Array.from(prims.map((p) => p.cz));
  const r = Float64Array.from(prims.map((p) => p.r));
  const f = prims.map((p) => p.f);
  return (x, y, z) => {
    let d = 1e9;
    for (let i = 0; i < n; i++) {
      const dx = x - cx[i], dy = y - cy[i], dz = z - cz[i];
      const reach = d + k + r[i];
      if (reach < 0 || dx * dx + dy * dy + dz * dz > reach * reach) continue;
      d = smin(d, f[i](x, y, z), k);
    }
    return d;
  };
}

// ---------- noise ----------
function hash3(x: number, y: number, z: number, seed: number) {
  let h = Math.imul(x, 0x8da6b343) ^ Math.imul(y, 0xd8163841) ^ Math.imul(z, 0xcb1ab31f) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/**
 * Cellular (Worley) noise. Returns F2 - F1 for cells of size `cell`:
 * ~0 along cell borders, larger in cell centres. Great for scales and cracked skin.
 */
export function cellular(x: number, y: number, z: number, cell: number, seed = 1) {
  const fx = x / cell, fy = y / cell, fz = z / cell;
  const ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz);
  let f1 = 9, f2 = 9;
  for (let dz = -1; dz <= 1; dz++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const cx = ix + dx, cy = iy + dy, cz = iz + dz;
        const px = cx + hash3(cx, cy, cz, seed) - fx;
        const py = cy + hash3(cx, cy, cz, seed + 1) - fy;
        const pz = cz + hash3(cx, cy, cz, seed + 2) - fz;
        const d = px * px + py * py + pz * pz;
        if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
      }
  return Math.sqrt(f2) - Math.sqrt(f1);
}

/** Smooth value noise in [-1, 1]. */
export function noise(x: number, y: number, z: number, seed = 7) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const tx = x - ix, ty = y - iy, tz = z - iz;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), sz = tz * tz * (3 - 2 * tz);
  const v = (a: number, b: number, c: number) => hash3(ix + a, iy + b, iz + c, seed);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return (
    l(
      l(l(v(0, 0, 0), v(1, 0, 0), sx), l(v(0, 1, 0), v(1, 1, 0), sx), sy),
      l(l(v(0, 0, 1), v(1, 0, 1), sx), l(v(0, 1, 1), v(1, 1, 1), sx), sy),
      sz,
    ) * 2 - 1
  );
}

// ---------- meshing ----------
export interface Bounds { min: V3; max: V3 }

export function boundsOf(prims: Prim[], margin: number): Bounds {
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const p of prims) {
    const c = [p.cx, p.cy, p.cz];
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], c[i] - p.r - margin);
      max[i] = Math.max(max[i], c[i] + p.r + margin);
    }
  }
  return { min, max };
}

/**
 * Speed-up for expensive SDFs: sample a cheap version (`coarse`, e.g. without texture)
 * on a grid, and only call the full `fine` SDF near the surface. `band` is how far
 * the fine surface can stray from the coarse one (e.g. texture depth).
 */
export function accelerate(coarse: Sdf, fine: Sdf, b: Bounds, cell: number, band: number): Sdf {
  const nx = Math.ceil((b.max[0] - b.min[0]) / cell) + 1;
  const ny = Math.ceil((b.max[1] - b.min[1]) / cell) + 1;
  const nz = Math.ceil((b.max[2] - b.min[2]) / cell) + 1;
  const grid = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++)
        grid[i + nx * (j + ny * k)] = coarse(b.min[0] + i * cell, b.min[1] + j * cell, b.min[2] + k * cell);
  const limit = band + cell * 0.87; // half the cell diagonal + band
  const [ox, oy, oz] = b.min;
  return (x, y, z) => {
    const i = Math.min(nx - 1, Math.max(0, Math.round((x - ox) / cell)));
    const j = Math.min(ny - 1, Math.max(0, Math.round((y - oy) / cell)));
    const k = Math.min(nz - 1, Math.max(0, Math.round((z - oz) / cell)));
    const v = grid[i + nx * (j + ny * k)];
    if (v > limit) return v - cell * 0.87;
    if (v < -limit) return v + cell * 0.87;
    return fine(x, y, z);
  };
}

/** Mesh an SDF (negative inside) with Manifold's marching tetrahedra. */
export function sdfToManifold(m: ManifoldToplevel, sdf: Sdf, bounds: Bounds, edgeLength: number): Manifold {
  return m.Manifold.levelSet((p) => -sdf(p[0], p[1], p[2]), bounds, edgeLength);
}
