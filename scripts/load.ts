import { readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { prepare } from '../src/lib/kernel';
import { defaults, type ModelDef, type Part } from '../src/lib/model';

const require = createRequire(import.meta.url);
const MODELS_DIR = resolve(import.meta.dirname, '../models');

const LOCAL_DIR = join(MODELS_DIR, 'local'); // git-ignored personal models

function files(dir: string): string[] {
  try { return readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => join(dir, f)); } catch { return []; }
}

function modelPaths(): Map<string, string> {
  return new Map([...files(MODELS_DIR), ...files(LOCAL_DIR)].map((f) => [basename(f, '.ts'), f]));
}

export function modelIds(): string[] {
  return [...modelPaths().keys()].sort();
}

export async function buildModel(id: string): Promise<{ def: ModelDef; parts: Part[] }> {
  const path = modelPaths().get(id);
  if (!path) throw new Error(`No model "${id}"`);
  const mod = await import(pathToFileURL(path).href);
  const def: ModelDef = mod.default;
  if (!def?.build) throw new Error(`models/${id}.ts must default-export defineModel({...})`);
  const { m, kit } = await prepare(async (_name, spec) => {
    const buf = await readFile(require.resolve(spec));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  });
  return { def, parts: def.build(m, defaults(def.params), kit) };
}

/** Model ids from argv, or all of them. */
export function selected(): string[] {
  const args = process.argv.slice(2);
  const all = modelIds();
  for (const a of args) if (!all.includes(a)) throw new Error(`No model "${a}". Available: ${all.join(', ')}`);
  return args.length ? args : all;
}
