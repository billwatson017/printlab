import type { Part } from './model';
import { KOBRA_X, PLA_DENSITY } from './printer';

export interface Report {
  size: [number, number, number];
  min: [number, number, number];
  max: [number, number, number];
  volumeCm3: number;
  /** Mass if printed 100% solid — a ceiling; real prints with 15% infill are typically 40–60% of this. */
  solidGrams: number;
  triangles: number;
  issues: string[];
  warnings: string[];
}

export function check(parts: Part[]): Report {
  const issues: string[] = [];
  const warnings: string[] = [];
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  let volume = 0;
  let triangles = 0;

  for (const part of parts) {
    const status = part.shape.status();
    if (status !== 'NoError') issues.push(`${part.name}: geometry error ${status}`);
    if (part.shape.isEmpty()) {
      issues.push(`${part.name}: is empty`);
      continue;
    }
    const box = part.shape.boundingBox();
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], box.min[i]);
      max[i] = Math.max(max[i], box.max[i]);
    }
    volume += part.shape.volume();
    triangles += part.shape.numTri();
  }

  const size = [0, 1, 2].map((i) => max[i] - min[i]) as [number, number, number];
  const { bed } = KOBRA_X;
  if (size[0] > bed.x || size[1] > bed.y) issues.push(`Footprint ${fmt(size[0])}×${fmt(size[1])} mm exceeds the ${bed.x}×${bed.y} mm bed`);
  if (size[2] > bed.z) issues.push(`Height ${fmt(size[2])} mm exceeds the ${bed.z} mm build height`);
  if (Math.abs(min[2]) > 0.01) warnings.push(`Lowest point is z = ${fmt(min[2])}, expected 0 (the slicer will drop it to the bed)`);

  const colors = new Set(parts.map((p) => p.color.toLowerCase()));
  if (colors.size > KOBRA_X.colorSlots) warnings.push(`${colors.size} colours — the base Kobra X holds ${KOBRA_X.colorSlots}`);

  // Parts that overlap would fight over the same space in the slicer.
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const overlap = parts[i].shape.intersect(parts[j].shape).volume();
      if (overlap > 0.01) warnings.push(`${parts[i].name} and ${parts[j].name} overlap by ${fmt(overlap)} mm³`);
    }
  }

  const volumeCm3 = volume / 1000;
  return { size, min, max, volumeCm3, solidGrams: volumeCm3 * PLA_DENSITY, triangles, issues, warnings };
}

export const fmt = (n: number) => (Math.round(n * 10) / 10).toString();
