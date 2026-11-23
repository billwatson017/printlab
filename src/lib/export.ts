import { strToU8, zipSync } from 'fflate';
import type { Manifold } from 'manifold-3d';
import type { Part } from './model';

interface Tri {
  positions: Float32Array; // xyz per vertex
  indices: Uint32Array; // 3 per triangle
}

export function triangles(shape: Manifold): Tri {
  const mesh = shape.getMesh();
  const n = mesh.vertProperties.length / mesh.numProp;
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    positions[i * 3] = mesh.vertProperties[i * mesh.numProp];
    positions[i * 3 + 1] = mesh.vertProperties[i * mesh.numProp + 1];
    positions[i * 3 + 2] = mesh.vertProperties[i * mesh.numProp + 2];
  }
  return { positions, indices: mesh.triVerts };
}

/** Binary STL of one or more shapes merged into a single file. */
export function toSTL(shapes: Manifold[]): Uint8Array {
  const tris = shapes.map(triangles);
  const count = tris.reduce((s, t) => s + t.indices.length / 3, 0);
  const buf = new ArrayBuffer(84 + count * 50);
  const view = new DataView(buf);
  new Uint8Array(buf).set(strToU8('printlab binary STL'.padEnd(80, ' ')), 0);
  view.setUint32(80, count, true);
  let o = 84;
  for (const { positions: p, indices: ix } of tris) {
    for (let t = 0; t < ix.length; t += 3) {
      const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      for (const v of [nx, ny, nz]) { view.setFloat32(o, v, true); o += 4; }
      for (const i of [a, b, c]) {
        view.setFloat32(o, p[i], true);
        view.setFloat32(o + 4, p[i + 1], true);
        view.setFloat32(o + 8, p[i + 2], true);
        o += 12;
      }
      o += 2; // attribute byte count
    }
  }
  return new Uint8Array(buf);
}

const esc = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
const hex = (c: string) => c.replace('#', '').slice(0, 6).toUpperCase().padEnd(6, '0');

/**
 * 3MF with every part as a component of one object. Anycubic Slicer Next / OrcaSlicer
 * load this as a single object with one part per colour, so you just pick a filament
 * slot per part and slice.
 */
export function to3MF(title: string, parts: Part[]): Uint8Array {
  const objects: string[] = [];
  const materials = parts.map((p) => `<base name="${esc(p.name)}" displaycolor="#${hex(p.color)}FF"/>`).join('');
  parts.forEach((part, idx) => {
    const { positions: p, indices: ix } = triangles(part.shape);
    const verts: string[] = [];
    for (let i = 0; i < p.length; i += 3) verts.push(`<vertex x="${p[i]}" y="${p[i + 1]}" z="${p[i + 2]}"/>`);
    const tris: string[] = [];
    for (let t = 0; t < ix.length; t += 3) tris.push(`<triangle v1="${ix[t]}" v2="${ix[t + 1]}" v3="${ix[t + 2]}"/>`);
    objects.push(
      `<object id="${idx + 2}" name="${esc(part.name)}" type="model" pid="1" pindex="${idx}"><mesh><vertices>${verts.join('')}</vertices><triangles>${tris.join('')}</triangles></mesh></object>`,
    );
  });
  const assemblyId = parts.length + 2;
  const components = parts.map((_, i) => `<component objectid="${i + 2}"/>`).join('');
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Title">${esc(title)}</metadata>
<metadata name="Application">printlab</metadata>
<resources>
<basematerials id="1">${materials}</basematerials>
${objects.join('\n')}
<object id="${assemblyId}" name="${esc(title)}" type="model"><components>${components}</components></object>
</resources>
<build><item objectid="${assemblyId}"/></build>
</model>`;
  return zipSync({
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>',
    ),
    '3D/3dmodel.model': strToU8(model),
  });
}
