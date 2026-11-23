import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { check, fmt } from './lib/check';
import { to3MF, toSTL, triangles } from './lib/export';
import { prepare } from './lib/kernel';
import roundedFont from '@fontsource/fredoka/files/fredoka-latin-700-normal.woff?url';
import { defaults, type ModelDef, type Part } from './lib/model';
import { KOBRA_X } from './lib/printer';

const fontUrls: Record<string, string> = { rounded: roundedFont };
const ready = () => prepare(async (name) => (await fetch(fontUrls[name])).arrayBuffer());

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- models ----------
// models/local/ is git-ignored: personal models that shouldn't be published.
const modules = import.meta.glob<{ default: ModelDef }>(['../models/*.ts', '../models/local/*.ts']);
const ids = Object.keys(modules).map((p) => p.match(/([^/]+)\.ts$/)![1]).sort();
const loaders = Object.fromEntries(Object.entries(modules).map(([p, l]) => [p.match(/([^/]+)\.ts$/)![1], l]));

// Session state survives the full reload Vite does when a model file is edited.
type Params = Record<string, number | string>;

const store = {
  get<T>(k: string): T | undefined {
    try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : undefined; } catch { return undefined; }
  },
  set(k: string, v: unknown) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

// ---------- scene ----------
const canvas = $<HTMLCanvasElement>('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0f1115');
THREE.Object3D.DEFAULT_UP.set(0, 0, 1);
const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 5000);
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

renderer.toneMapping = THREE.ACESFilmicToneMapping;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;
const key = new THREE.DirectionalLight('#fff4e6', 2.4); // warm key, upper front-left: shows relief
key.position.set(-160, -220, 320);
scene.add(key);
const rim = new THREE.DirectionalLight('#cfe3ff', 1.6); // cool rim from behind: separates silhouette
rim.position.set(180, 260, 200);
scene.add(rim);
scene.add(new THREE.HemisphereLight('#ffffff', '#30343c', 0.35));

const { x: BX, y: BY, z: BZ } = KOBRA_X.bed;
const bed = new THREE.Mesh(new THREE.PlaneGeometry(BX, BY), new THREE.MeshStandardMaterial({ color: '#2a2f38', roughness: 0.9 }));
bed.position.z = -0.05;
scene.add(bed);
const grid = new THREE.GridHelper(BX, BX / 10, '#3d4450', '#323844');
grid.rotation.x = Math.PI / 2;
scene.add(grid);
const volume = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(BX, BY, BZ)),
  new THREE.LineBasicMaterial({ color: '#4b5563', transparent: true, opacity: 0.5 }),
);
volume.position.z = BZ / 2;
scene.add(volume);
const axes = new THREE.AxesHelper(20);
axes.position.set(-BX / 2, -BY / 2, 0.1);
scene.add(axes);

const modelGroup = new THREE.Group();
scene.add(modelGroup);

function resize() {
  const { clientWidth: w, clientHeight: h } = canvas.parentElement!;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement!);
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
controls.addEventListener('end', () => store.set('camera', { p: camera.position.toArray(), t: controls.target.toArray() }));

// ---------- state ----------
let current: { id: string; def: ModelDef; params: Params; parts: Part[] } | undefined;
let bounds = new THREE.Box3(new THREE.Vector3(-50, -50, 0), new THREE.Vector3(50, 50, 50));

function frame(view: 'iso' | 'top' | 'front' | 'side' = 'iso') {
  const center = bounds.getCenter(new THREE.Vector3());
  const radius = Math.max(bounds.getSize(new THREE.Vector3()).length() / 2, 20);
  // ?zoom=3&tz=0.85 → close-up at 85% of the model's height (handy for screenshots).
  const q = new URLSearchParams(location.search);
  const zoom = Number(q.get('zoom') ?? 1) || 1;
  if (q.has('tz')) center.z = bounds.min.z + (bounds.max.z - bounds.min.z) * Number(q.get('tz'));
  // ?target=x,y,z (mm) → look at that point, e.g. a head close-up.
  const tgt = q.get('target')?.split(',').map(Number);
  if (tgt?.length === 3 && tgt.every(Number.isFinite)) center.set(tgt[0], tgt[1], tgt[2]);
  const dist = (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.1 / zoom;
  const dir = {
    iso: new THREE.Vector3(1, -1.4, 1),
    top: new THREE.Vector3(0, -0.0001, 1),
    front: new THREE.Vector3(0, -1, 0.0001),
    side: new THREE.Vector3(1, 0, 0.0001),
  }[view].normalize();
  camera.position.copy(center).addScaledVector(dir, dist);
  controls.target.copy(center);
  controls.update();
}

function showError(err: unknown) {
  const el = $('error');
  el.hidden = !err;
  el.textContent = err ? (err instanceof Error ? `${err.message}\n\n${err.stack ?? ''}` : String(err)) : '';
}

function download(name: string, data: Uint8Array, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- rendering a model ----------
function rebuild() {
  if (!current) return;
  const { def, params } = current;
  ready().then(({ m, kit }) => {
    let parts: Part[];
    try {
      parts = def.build(m, params as never, kit);
      showError(null);
    } catch (e) {
      showError(e);
      return;
    }
    // Manifold objects live in WASM memory and are not garbage collected.
    for (const old of current!.parts) old.shape.delete();
    current!.parts = parts;
    drawParts(parts);
    renderInfo(parts);
  });
}

function drawParts(parts: Part[]) {
  for (const child of [...modelGroup.children]) {
    modelGroup.remove(child);
    child.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
  const xray = $<HTMLInputElement>('xray').checked;
  bounds = new THREE.Box3();
  for (const part of parts) {
    const { positions, indices } = triangles(part.shape);
    let geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
    geom = toCreasedNormals(geom, THREE.MathUtils.degToRad(30));
    const mesh = new THREE.Mesh(
      geom,
      new THREE.MeshStandardMaterial({
        color: part.color, roughness: 0.62, metalness: 0.05,
        transparent: xray, opacity: xray ? 0.35 : 1, depthWrite: !xray, side: THREE.DoubleSide,
      }),
    );
    const g = new THREE.Group();
    g.name = part.name;
    g.add(mesh);
    // Crease lines help read simple CAD shapes but look like dirt on dense sculpted meshes.
    if (indices.length / 3 < 100_000) {
      g.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(geom, 30),
        new THREE.LineBasicMaterial({ color: new THREE.Color(part.color).multiplyScalar(0.45) }),
      ));
    }
    modelGroup.add(g);
    geom.computeBoundingBox();
    bounds.union(geom.boundingBox!);
  }
  if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-50, -50, 0), new THREE.Vector3(50, 50, 50));
}

function renderInfo(parts: Part[]) {
  const r = check(parts);
  $('stats').innerHTML = `
    <dt>W × D × H</dt><dd>${r.size.map(fmt).join(' × ')} mm</dd>
    <dt>Volume</dt><dd>${fmt(r.volumeCm3)} cm³</dd>
    <dt>PLA (solid)</dt><dd>≤ ${fmt(r.solidGrams)} g · ~${fmt(r.solidGrams * 0.5)} g at 15% infill</dd>
    <dt>Triangles</dt><dd>${r.triangles.toLocaleString()}</dd>`;
  const items = [
    ...r.issues.map((t) => `<li class="bad">${t}</li>`),
    ...r.warnings.map((t) => `<li class="warn">${t}</li>`),
  ];
  if (!r.issues.length) items.unshift(`<li class="ok">Fits the Kobra X bed</li>`);
  $('checks').innerHTML = items.join('');

  const slots = new Map<string, number>();
  for (const p of parts) if (!slots.has(p.color.toLowerCase())) slots.set(p.color.toLowerCase(), slots.size + 1);
  $('parts').innerHTML = '';
  parts.forEach((p, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<input type="checkbox" checked /><span class="swatch" style="background:${p.color}"></span><span>${p.name}</span><span class="slot">slot ${slots.get(p.color.toLowerCase())}</span>`;
    li.querySelector('input')!.addEventListener('change', (e) => {
      modelGroup.children[i].visible = (e.target as HTMLInputElement).checked;
    });
    $('parts').append(li);
  });

  const id = current!.id;
  const dl = $('downloads');
  dl.innerHTML = '';
  const btn = (label: string, primary: boolean, fn: () => void) => {
    const b = document.createElement('button');
    b.className = primary ? 'btn primary' : 'btn';
    b.textContent = label;
    b.onclick = fn;
    dl.append(b);
  };
  btn('Download 3MF', true, () => download(`${id}.3mf`, to3MF(current!.def.title, current!.parts), 'model/3mf'));
  if (parts.length === 1) btn('STL', false, () => download(`${id}.stl`, toSTL([parts[0].shape]), 'model/stl'));
  else for (const p of parts) btn(`${p.name}.stl`, false, () => download(`${id}--${p.name.toLowerCase().replace(/\W+/g, '-')}.stl`, toSTL([p.shape]), 'model/stl'));
}

function renderParams(def: ModelDef, params: Params) {
  const box = $('params');
  box.innerHTML = '';
  $('params-section').hidden = Object.keys(def.params).length === 0;
  let pending = 0;
  const changed = (key: string, v: number | string) => {
    params[key] = v;
    store.set(`params:${current!.id}`, params);
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(rebuild);
  };
  for (const [key, spec] of Object.entries(def.params)) {
    const wrap = document.createElement('div');
    wrap.className = 'param';
    if (spec.type === 'text') {
      wrap.innerHTML = `<label for="p-${key}">${spec.label ?? key}</label><input id="p-${key}" type="text" class="text" />`;
      const input = wrap.querySelector('input')!;
      input.value = String(params[key]);
      if (spec.maxLength) input.maxLength = spec.maxLength;
      input.addEventListener('input', () => changed(key, input.value));
      box.append(wrap);
      continue;
    }
    const step = spec.step ?? 1;
    wrap.innerHTML = `<label for="p-${key}">${spec.label ?? key}</label>
      <input id="p-${key}" type="range" min="${spec.min}" max="${spec.max}" step="${step}" value="${params[key]}" />
      <input type="number" min="${spec.min}" max="${spec.max}" step="${step}" value="${params[key]}" />`;
    const [range, num] = wrap.querySelectorAll('input');
    const set = (v: number) => {
      if (!Number.isFinite(v)) return;
      range.value = num.value = String(v);
      changed(key, v);
    };
    range.addEventListener('input', () => set(Number(range.value)));
    num.addEventListener('change', () => set(Number(num.value)));
    box.append(wrap);
  }
}

async function select(id: string, { keepCamera = false } = {}) {
  if (!loaders[id]) id = ids[0];
  if (!id) {
    showError('No models yet — add one in models/.');
    return;
  }
  location.hash = id;
  for (const a of document.querySelectorAll('#model-list a')) a.classList.toggle('active', a.getAttribute('href') === `#${id}`);
  let def: ModelDef;
  try {
    def = (await loaders[id]()).default;
  } catch (e) {
    showError(e);
    return;
  }
  const params = { ...defaults(def.params), ...store.get<Params>(`params:${id}`) };
  for (const k of Object.keys(params)) if (!(k in def.params)) delete params[k];
  current = { id, def, params, parts: [] };
  $('title').textContent = def.title;
  $('description').textContent = def.description;
  $('notes').textContent = def.printNotes ?? '';
  renderParams(def, params);
  rebuild();
  await ready();
  const saved = store.get<{ p: number[]; t: number[] }>('camera');
  if (keepCamera && saved) {
    camera.position.fromArray(saved.p);
    controls.target.fromArray(saved.t);
  } else frame((new URLSearchParams(location.search).get('view') as 'iso' | null) ?? 'iso');
  store.set('model', id);
}

// ---------- wiring ----------
$('model-list').innerHTML = ids.map((id) => `<a href="#${id}">${id}</a>`).join('');
window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (id !== current?.id) select(id);
});
for (const b of document.querySelectorAll<HTMLButtonElement>('#toolbar [data-view]')) {
  b.onclick = () => frame(b.dataset.view as 'iso');
}
$<HTMLInputElement>('xray').onchange = () => current && drawParts(current.parts);
$<HTMLInputElement>('volume').onchange = (e) => (volume.visible = (e.target as HTMLInputElement).checked);
$('reset').onclick = () => {
  if (!current) return;
  store.set(`params:${current.id}`, null);
  current.params = defaults(current.def.params);
  renderParams(current.def, current.params);
  rebuild();
};

const initial = location.hash.slice(1) || store.get<string>('model') || ids[0];
// Keep the camera when this load is Vite reloading after an edit to the same model.
select(initial, { keepCamera: initial === store.get<string>('model') });
