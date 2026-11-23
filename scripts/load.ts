import { readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getKernel } from '../src/lib/kernel';
import { defaults, type ModelDef, type Part } from '../src/lib/model';

const MODELS_DIR = resolve(import.meta.dirname, '../models');

export function modelIds(): string[] {
  return readdirSync(MODELS_DIR).filter((f) => f.endsWith('.ts')).map((f) => basename(f, '.ts')).sort();
}

export async function buildModel(id: string): Promise<{ def: ModelDef; parts: Part[] }> {
  const mod = await import(pathToFileURL(join(MODELS_DIR, `${id}.ts`)).href);
  const def: ModelDef = mod.default;
  if (!def?.build) throw new Error(`models/${id}.ts must default-export defineModel({...})`);
  const m = await getKernel();
  return { def, parts: def.build(m, defaults(def.params)) };
}

/** Model ids from argv, or all of them. */
export function selected(): string[] {
  const args = process.argv.slice(2);
  const all = modelIds();
  for (const a of args) if (!all.includes(a)) throw new Error(`No model "${a}". Available: ${all.join(', ')}`);
  return args.length ? args : all;
}
