/** Cena 3D (Three.js). 1 unidade = 1 mm. Eixo da bobina = X do mundo (= z da física; +X = lado da cabeça do parafuso).
 *  Geometria da bobina = a MESMA do motor (geo.layers); linhas de campo = Biot–Savart do motor. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { simLoops, fieldAt, traceFieldLine } from './physics.js';
const V3 = (x, y, z) => new THREE.Vector3(x, y, z), S = 1e3, BAT_Y = -22;

export function createScene3D(host) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); }
  catch (e) { host.textContent = 'WebGL indisponível neste navegador/dispositivo.'; return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x061126);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 3000); camera.position.set(55, 40, 120);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.target.set(0, -8, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35)); const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(60, 90, 50); scene.add(dl);
  const grid = new THREE.GridHelper(300, 30, 0x1d3a73, 0x10264d); grid.position.y = -40; scene.add(grid);
  const statics = new THREE.Group(), fieldG = new THREE.Group(), dotsG = new THREE.Group(); scene.add(statics, fieldG, dotsG);
  const mat = { copper: new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 1, roughness: 0.28 }), steel: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.92, roughness: 0.38 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x15171c, metalness: 0.5, roughness: 0.45 }), gold: new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.9, roughness: 0.3 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xdfe5ec, metalness: 1, roughness: 0.2 }), lead: new THREE.MeshStandardMaterial({ color: 0xc0623a, metalness: 0.8, roughness: 0.4 }), off: new THREE.MeshStandardMaterial({ color: 0x66707d, metalness: 0.3, roughness: 0.7 }) };
  const shared = new Set(Object.values(mat)); const opts = { field: true, current: true, animate: true };
  let sim = null, path = null, dots = null, fieldStale = true, timer = null;

  const clear = g => { g.traverse(o => { o.geometry?.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.map?.dispose(); if (!shared.has(m)) m.dispose(); }); }); g.clear(); };
  function label(text, color = '#fff', size = 6) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.font = 'bold 40px sans-serif'; g.fillStyle = color; g.textAlign = 'center'; g.fillText(text, 128, 46);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); s.scale.set(size * 4, size, 1); return s;
  }
  const rotX = m => { m.rotation.z = -Math.PI / 2; return m; }; // cilindro (eixo Y) → eixo X

  function screwMesh(p) {
    const L = p.coreLength * S, rs = p.coreDiameter * S / 2, pitch = Math.max(0.6, rs * 0.35), hh = rs * 0.9, pts = [];
    const y0 = -L / 2; pts.push(new THREE.Vector2(0, y0), new THREE.Vector2(rs * 0.35, y0 + rs * 1.2), new THREE.Vector2(rs, y0 + rs * 2.4));
    for (let y = y0 + rs * 2.4; y + pitch < L / 2 - hh; y += pitch) { pts.push(new THREE.Vector2(rs * 0.84, y + pitch * 0.5), new THREE.Vector2(rs, y + pitch)); }
    pts.push(new THREE.Vector2(rs, L / 2 - hh), new THREE.Vector2(rs * 1.8, L / 2 - hh), new THREE.Vector2(rs * 1.8, L / 2), new THREE.Vector2(0, L / 2));
    return rotX(new THREE.Mesh(new THREE.LatheGeometry(pts, 48), p.coreMaterial === 'brass' ? new THREE.MeshStandardMaterial({ color: 0xb5a642, metalness: 1, roughness: 0.3 }) : mat.steel));
  }
  function batteryGroup(p) {
    const b = new THREE.Group(); b.position.set(0, BAT_Y, 0);
    b.add(rotX(new THREE.Mesh(new THREE.CylinderGeometry(7.25, 7.25, 48.5, 40), mat.dark)), rotX(new THREE.Mesh(new THREE.CylinderGeometry(7.3, 7.3, 10, 40), mat.gold)));
    const nub = rotX(new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.8, 24), mat.silver)); nub.position.x = 25.15; const neg = rotX(new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.6, 0.4, 32), mat.silver)); neg.position.x = -24.45; b.add(nub, neg);
    b.scale.x = p.reversed ? 1 : -1; // + (nub) fica no lado de ENTRADA da corrente na bobina (−X) quando não invertido
    return b;
  }
  function buildStatic() {
    clear(statics); clear(dotsG); const p = sim.params, g = sim.geo, I = sim.circuit.Isigned, closed = p.closed;
    const curves = g.layers.map(l => { const n = l.turns, len = n * g.dOut * S, r = l.radius * S, per = 20, pts = [], off = (p.coilOffset || 0) * S;
      for (let i = 0; i <= n * per; i++) { const t = i / per, x = l.index % 2 ? -len / 2 + t * g.dOut * S : len / 2 - t * g.dOut * S, th = Math.PI + 2 * Math.PI * t; pts.push(V3(x + off, r * Math.cos(th), r * Math.sin(th))); }
      return new THREE.CatmullRomCurve3(pts); });
    curves.forEach((c, i) => statics.add(new THREE.Mesh(new THREE.TubeGeometry(c, g.layers[i].turns * 20, g.dOut * S / 2, 6, false), mat.copper)));
    if (p.coreMaterial !== 'none') statics.add(screwMesh(p));
    const outer = g.outerRadius * S, lead = (pt, sx) => new THREE.CatmullRomCurve3([pt.clone(), V3(pt.x, -outer - 3, 0), V3(sx * 30, BAT_Y, 0), V3(sx * 25, BAT_Y, 0)]);
    const A = lead(curves[0].getPoint(0), -1), B = lead(curves.at(-1).getPoint(1), 1);
    for (const c of [A, B]) statics.add(new THREE.Mesh(new THREE.TubeGeometry(c, 24, 0.4, 6, false), closed ? mat.lead : mat.off));
    statics.add(batteryGroup(p)); const plusX = (p.reversed ? 1 : -1) * 32;
    const lp = label('+', '#ff5468', 8), lm = label('−', '#27d3ff', 8); lp.position.set(plusX, BAT_Y + 10, 0); lm.position.set(-plusX, BAT_Y + 10, 0);
    const lv = label(`AA · ${p.voltage.toFixed(2).replace('.', ',')} V`, '#e9f1ff', 6); lv.position.set(0, BAT_Y - 13, 0); statics.add(lp, lm, lv);
    if (!closed) { const la = label('CIRCUITO ABERTO', '#ffb020', 7); la.position.set(0, BAT_Y + 14, 0); statics.add(la); }
    // caminho do sentido convencional (da saída + para a bobina e de volta ao −)
    let items = [{ c: A, rev: true }, ...curves.map(c => ({ c, rev: false })), { c: B, rev: false }];
    if (I < 0) items = items.reverse().map(i => ({ c: i.c, rev: !i.rev }));
    items.forEach(i => i.len = i.c.getLength()); path = { items, total: items.reduce((s, i) => s + i.len, 0) };
    const N = 70, geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    dots = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffd34d, size: 1.3, depthTest: false, transparent: true })); dots.frustumCulled = false; dots.visible = I !== 0 && opts.current; dotsG.add(dots);
  }
  function pathPoint(s) { s = ((s % 1) + 1) % 1; let d = s * path.total; for (const it of path.items) { if (d <= it.len) { const u = it.len ? d / it.len : 0; return it.c.getPointAt(it.rev ? 1 - u : u); } d -= it.len; } return path.items.at(-1).c.getPointAt(1); }

  const ramp = [new THREE.Color(0x1b4fd8), new THREE.Color(0x27d3ff), new THREE.Color(0xffe36b)];
  const colorFor = B => { const t = Math.min(1, Math.max(0, (Math.log10(Math.max(B, 1e-12)) + 5) / 4)) * 2, i = Math.min(1, Math.floor(t)); return ramp[i].clone().lerp(ramp[i + 1], t - i); }; // 10 µT → 100 mT (log)
  function buildField() {
    clear(fieldG); fieldStale = false; if (!sim || sim.circuit.I === 0) return;
    const p = sim.params, loops = simLoops(sim, 48), rIn = p.coilInnerRadius, rOut = sim.geo.outerRadius, AZ = 8;
    const seeds = [0.12, 0.4, 0.65, 0.85].map(f => f * rIn).concat([rOut + 0.003, rOut + 0.008, rOut + 0.018, rOut + 0.035]);
    for (const r0 of seeds) {
      const fw = traceFieldLine(loops, r0, 0, +1), bw = traceFieldLine(loops, r0, 0, -1), line = [...bw.slice(1).reverse(), ...fw];
      const cols = line.map(([r, z]) => { const B = fieldAt(loops, r, z); return colorFor(Math.hypot(B.Br, B.Bz)); });
      for (let k = 0; k < AZ; k++) { const ph = 2 * Math.PI * k / AZ, cp = Math.cos(ph), sp = Math.sin(ph), pos = [], col = [];
        line.forEach(([r, z], i) => { pos.push(z * S, r * S * cp, r * S * sp); col.push(cols[i].r, cols[i].g, cols[i].b); });
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        fieldG.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false })));
        if (k % 4 === 0 && line.length > 6) { const i = Math.floor(bw.length - 1 + fw.length * 0.5), a = V3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]), b = V3(pos[i * 3 + 3], pos[i * 3 + 4], pos[i * 3 + 5]);
          const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.8, 10), new THREE.MeshBasicMaterial({ color: cols[i] })); cone.position.copy(a); cone.quaternion.setFromUnitVectors(V3(0, 1, 0), b.sub(a).normalize()); fieldG.add(cone); } }
    }
    const half = (p.coreMaterial !== 'none' ? p.coreLength / 2 : sim.geo.axialLength / 2) * S + 9, sgn = Math.sign(sim.circuit.Isigned);
    const N = label('N', '#ff5468', 9), Sx = label('S', '#27d3ff', 9); N.position.set(sgn * half, 6, 0); Sx.position.set(-sgn * half, 6, 0); fieldG.add(N, Sx);
  }
  const scheduleField = () => { fieldStale = true; clearTimeout(timer); if (opts.field) timer = setTimeout(buildField, 140); };
  function resize() { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(host); resize();
  renderer.setAnimationLoop(t => { if (dots && opts.animate && path && sim.circuit.I !== 0) { const a = dots.geometry.attributes.position, N = a.count, sp = 0.04 * Math.min(Math.abs(sim.circuit.I), 4);
      for (let i = 0; i < N; i++) { const q = pathPoint(i / N + t / 1000 * sp); a.setXYZ(i, q.x, q.y, q.z); } a.needsUpdate = true; } controls.update(); renderer.render(scene, camera); });
  return {
    update(s) { sim = s; buildStatic(); scheduleField(); },
    setOptions(o) { Object.assign(opts, o); fieldG.visible = opts.field; if (dots) dots.visible = sim?.circuit.I !== 0 && opts.current; if (opts.field && fieldStale) scheduleField(); },
    snapshot() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
  };
}
