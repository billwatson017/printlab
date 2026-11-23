import Module, { type ManifoldToplevel } from 'manifold-3d';
import type { Toolkit } from './model';
import { FONTS, registerFont, text, type FontName } from './text';

let kernel: Promise<ManifoldToplevel> | undefined;

/** Load the manifold WASM kernel once (works in the browser and in Node). */
export function getKernel(): Promise<ManifoldToplevel> {
  kernel ??= Module().then((m) => {
    m.setup();
    // Smooth curves by default: segment count scales with radius, min 0.5 mm edge.
    m.setMinCircularEdgeLength(0.5);
    m.setMinCircularAngle(5);
    return m;
  });
  return kernel;
}

/** Loads every bundled font. Hosts supply the bytes: fetch in the browser, fs in Node. */
export type FontLoader = (font: FontName, spec: string) => Promise<ArrayBuffer>;

let ready: Promise<{ m: ManifoldToplevel; kit: Toolkit }> | undefined;

export function prepare(loadFont: FontLoader) {
  ready ??= (async () => {
    const [m] = await Promise.all([
      getKernel(),
      ...Object.entries(FONTS).map(async ([name, spec]) => registerFont(name as FontName, await loadFont(name as FontName, spec))),
    ]);
    const kit: Toolkit = { text: (str, opts) => text(m, str, opts) };
    return { m, kit };
  })();
  return ready;
}
