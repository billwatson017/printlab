/** Anycubic Kobra X — see docs/kobra-x.md for sources. All units mm. */
export const KOBRA_X = {
  name: 'Anycubic Kobra X',
  bed: { x: 260, y: 260, z: 260 },
  nozzle: 0.4,
  /** Colours loaded in the built-in ACE Gen 2 toolhead unit (expandable to 19 with ACE 2 Pro units). */
  colorSlots: 4,
  maxNozzleTemp: 300,
  maxBedTemp: 100,
  materials: ['PLA', 'PETG', 'TPU', 'PVA', 'PLA-CF', 'PETG-CF'],
} as const;

/** Rules of thumb for FDM on a 0.4 mm nozzle. Models should respect these. */
export const DESIGN_RULES = {
  minWall: 1.2, // 3 perimeters
  minFeature: 0.8, // smallest positive feature that reliably prints
  layerHeight: 0.2,
  clearanceSliding: 0.3, // gap per side for parts that must slide/fit together
  clearancePress: 0.15, // gap per side for a snug press fit
  maxOverhangDeg: 45, // from vertical, before supports are needed
  maxBridge: 30, // unsupported horizontal span
  holeOversize: 0.2, // add to radius of small vertical holes (they print undersize)
} as const;

/** PLA density, g/cm³. */
export const PLA_DENSITY = 1.24;
