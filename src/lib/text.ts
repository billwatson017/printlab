import opentype from 'opentype.js';
import type { CrossSection, ManifoldToplevel } from 'manifold-3d';

/** Fonts bundled with printlab. Bytes are loaded by the host (browser fetch or Node fs). */
export const FONTS = {
  /** Fredoka Bold — rounded, chunky, prints cleanly at small sizes. SIL OFL 1.1. */
  rounded: '@fontsource/fredoka/files/fredoka-latin-700-normal.woff',
} as const;
export type FontName = keyof typeof FONTS;

const loaded = new Map<FontName, opentype.Font>();

export function registerFont(name: FontName, bytes: ArrayBuffer) {
  loaded.set(name, opentype.parse(bytes));
}

export interface TextOptions {
  /** Capital-letter height in mm. */
  size: number;
  font?: FontName;
  /** Extra space between letters, mm. */
  spacing?: number;
  /** Where (0,0) sits relative to the text block. Default: centred. */
  align?: 'center' | 'left';
}

/**
 * Text → 2D CrossSection (mm, y up). Extrude it with `Manifold.extrude`.
 * Letters that touch are merged, so it is always one clean region set.
 */
export function text(m: ManifoldToplevel, str: string, opts: TextOptions): CrossSection {
  const font = loaded.get(opts.font ?? 'rounded');
  if (!font) throw new Error(`Font "${opts.font ?? 'rounded'}" not loaded`);
  const capHeight = (font.tables.os2?.sCapHeight as number | undefined) || font.unitsPerEm * 0.7;
  const fontSize = (opts.size * font.unitsPerEm) / capHeight;
  const spacingUnits = ((opts.spacing ?? 0) / fontSize) * font.unitsPerEm;
  const path = font.getPath(str, 0, 0, fontSize, { kerning: true, letterSpacing: spacingUnits / font.unitsPerEm });

  // Flatten curves into polylines. getPath is y-down, so flip y.
  const contours: [number, number][][] = [];
  let cur: [number, number][] = [];
  let x = 0, y = 0;
  const STEPS = 10;
  for (const c of path.commands) {
    if (c.type === 'M') {
      if (cur.length > 2) contours.push(cur);
      cur = [[c.x, -c.y]];
      x = c.x; y = c.y;
    } else if (c.type === 'L') {
      cur.push([c.x, -c.y]);
      x = c.x; y = c.y;
    } else if (c.type === 'Q') {
      for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS, u = 1 - t;
        cur.push([u * u * x + 2 * u * t * c.x1 + t * t * c.x, -(u * u * y + 2 * u * t * c.y1 + t * t * c.y)]);
      }
      x = c.x; y = c.y;
    } else if (c.type === 'C') {
      for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS, u = 1 - t;
        const a = u * u * u, b = 3 * u * u * t, d = 3 * u * t * t, e = t * t * t;
        cur.push([a * x + b * c.x1 + d * c.x2 + e * c.x, -(a * y + b * c.y1 + d * c.y2 + e * c.y)]);
      }
      x = c.x; y = c.y;
    } else if (c.type === 'Z') {
      if (cur.length > 2) contours.push(cur);
      cur = [];
    }
  }
  if (cur.length > 2) contours.push(cur);

  let cs = new m.CrossSection(contours, 'NonZero');
  if (cs.isEmpty()) return cs;
  const b = cs.bounds();
  const dx = opts.align === 'left' ? -b.min[0] : -(b.min[0] + b.max[0]) / 2;
  // Centre vertically on the cap height so descenders (g, y) hang below like real text.
  cs = cs.translate([dx, opts.align === 'left' ? 0 : -opts.size / 2]);
  return cs;
}
