import type { Manifold, ManifoldToplevel } from 'manifold-3d';

export interface Param {
  value: number;
  min: number;
  max: number;
  step?: number;
  label?: string;
}

export interface Part {
  /** Shown in the viewer and used as the object name in the 3MF. */
  name: string;
  /** Display colour (CSS hex). Each distinct part becomes its own filament slot in the slicer. */
  color: string;
  shape: Manifold;
}

export type ParamValues<P extends Record<string, Param>> = { [K in keyof P]: number };

export interface ModelDef<P extends Record<string, Param> = Record<string, Param>> {
  title: string;
  description: string;
  /** Suggested material + slicer notes shown in the viewer. */
  printNotes?: string;
  params: P;
  /**
   * Build the model. Conventions: Z is up, units are mm, the model sits on z = 0
   * and is centred on x = 0, y = 0 (the middle of the bed).
   */
  build: (m: ManifoldToplevel, p: ParamValues<P>) => Part[];
}

/** Identity helper that gives model files full type inference. */
export function defineModel<P extends Record<string, Param>>(def: ModelDef<P>): ModelDef<P> {
  return def;
}

export function defaults<P extends Record<string, Param>>(params: P): ParamValues<P> {
  return Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v.value])) as ParamValues<P>;
}
