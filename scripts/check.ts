// Usage: npm run check [model-id ...]   — validates printability; exits 1 on problems.
import { check, fmt } from '../src/lib/check';
import { buildModel, selected } from './load';

let failed = false;
for (const id of selected()) {
  const { def, parts } = await buildModel(id);
  const r = check(parts);
  const ok = r.issues.length === 0;
  failed ||= !ok;
  console.log(`${ok ? '✓' : '✗'} ${id} — ${def.title}`);
  console.log(`  ${r.size.map(fmt).join(' × ')} mm · ${parts.length} part(s) · ${fmt(r.volumeCm3)} cm³ · ≤${fmt(r.solidGrams)} g solid · ${r.triangles} tris`);
  for (const i of r.issues) console.log(`  ERROR ${i}`);
  for (const w of r.warnings) console.log(`  warn  ${w}`);
}
process.exit(failed ? 1 : 0);
