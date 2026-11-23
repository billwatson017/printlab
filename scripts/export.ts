// Usage: npm run export [model-id ...]   — writes out/<id>.3mf plus one STL per part.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { to3MF, toSTL } from '../src/lib/export';
import { buildModel, selected } from './load';

const OUT = resolve(import.meta.dirname, '../out');
mkdirSync(OUT, { recursive: true });
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

for (const id of selected()) {
  const { def, parts } = await buildModel(id);
  const files = [`${id}.3mf`];
  writeFileSync(resolve(OUT, `${id}.3mf`), to3MF(def.title, parts));
  if (parts.length === 1) {
    writeFileSync(resolve(OUT, `${id}.stl`), toSTL([parts[0].shape]));
    files.push(`${id}.stl`);
  } else {
    for (const part of parts) {
      const f = `${id}--${slug(part.name)}.stl`;
      writeFileSync(resolve(OUT, f), toSTL([part.shape]));
      files.push(f);
    }
  }
  console.log(`${id}: ${files.map((f) => `out/${f}`).join(', ')}`);
}
