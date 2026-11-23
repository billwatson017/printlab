import Module, { type ManifoldToplevel } from 'manifold-3d';

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
