/** Corte 2D meridional (canvas, sem dependências). x = eixo (+x = lado da cabeça do parafuso), y = distância ao eixo (simétrico).
 *  Campo = Biot–Savart (anéis) do motor — bobina NO AR; núcleo não entra no campo. Unidades de tela: mm. */
import { simLoops, fieldXY, traceFieldLine, nearWire } from './physics.js';
const S = 1e3, STOPS = ['#1b4fd8', '#27d3ff', '#ffe36b'];
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const tOf = B => Math.min(1, Math.max(0, (Math.log10(Math.max(B, 1e-12)) + 5) / 4)); // 10 µT → 100 mT (log)
function rgb(t) { const u = t * 2, i = Math.min(1, Math.floor(u)), a = hex(STOPS[i]), b = hex(STOPS[i + 1]); return a.map((v, k) => Math.round(v + (b[k] - v) * (u - i))); }

export function createScene2D(host, onProbe) {
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d'), heat = document.createElement('canvas'); host.appendChild(cv);
  const opts = { field: true, vectors: false, heat: true, current: true };
  let sim = null, exact = null, lines = [], heatRect = null, W = 0, H = 0, view = { x: 0, y: -2, s: 11 }, probe = { x: 0, y: 7 }, tHeat = null, tLines = null, raf = 0;
  const toPx = (x, y) => [W / 2 + (x - view.x) * view.s, H / 2 - (y - view.y) * view.s], toW = (px, py) => [view.x + (px - W / 2) / view.s, view.y - (py - H / 2) / view.s];
  const redraw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };

  function buildLines() {
    lines = []; if (!sim || sim.circuit.I === 0) return redraw();
    const p = sim.params, loops = simLoops(sim, 48), rIn = p.coilInnerRadius, rOut = sim.geo.outerRadius;
    const seeds = [0.1, 0.3, 0.5, 0.7, 0.88].map(f => f * rIn).concat([2, 4, 7, 12, 20, 35, 55].map(d => rOut + d * 1e-3));
    for (const r0 of seeds) { const fw = traceFieldLine(loops, r0, 0, 1), bw = traceFieldLine(loops, r0, 0, -1), pts = [...bw.slice(1).reverse(), ...fw];
      lines.push({ pts: pts.map(([r, z]) => [z * S, r * S, tOf(Math.hypot(...Object.values(fieldXY(loops, z, r)).slice(0, 2)))]), mid: bw.length - 1 + Math.floor(fw.length * 0.5) }); }
    redraw();
  }
  function buildHeat() {
    if (!sim || !opts.heat || sim.circuit.I === 0 || !W) { heatRect = null; return redraw(); }
    const loops = simLoops(sim, 48), gw = Math.min(150, Math.ceil(W / 7)), gh = Math.ceil(H / 7); heat.width = gw; heat.height = gh;
    const img = new ImageData(gw, gh), [x0, y1] = toW(0, 0), [x1, y0] = toW(W, H);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const x = x0 + (i + .5) / gw * (x1 - x0), y = y1 - (j + .5) / gh * (y1 - y0), f = fieldXY(loops, x / S, y / S), t = tOf(f.B), c = rgb(t), o = (j * gw + i) * 4;
      img.data.set([c[0], c[1], c[2], Math.round(255 * (0.1 + 0.55 * t))], o); }
    heat.getContext('2d').putImageData(img, 0, 0); heatRect = { x0, x1, y0, y1 }; redraw();
  }
  const later = () => { clearTimeout(tHeat); tHeat = setTimeout(buildHeat, 140); };

  function arrow(x, y, dx, dy, len, color) { const a = Math.atan2(dy, dx), h = 4; ctx.strokeStyle = ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x - dx * len / 2, y - dy * len / 2); ctx.lineTo(x + dx * len / 2, y + dy * len / 2); ctx.stroke();
    const ex = x + dx * len / 2, ey = y + dy * len / 2; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - h * 1.6 * Math.cos(a - .4), ey - h * 1.6 * Math.sin(a - .4)); ctx.lineTo(ex - h * 1.6 * Math.cos(a + .4), ey - h * 1.6 * Math.sin(a + .4)); ctx.fill(); }
  const css = t => `rgb(${rgb(t).join(',')})`;

  function draw() {
    if (!W || !H) return; const dpr = devicePixelRatio || 1; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#061126'; ctx.fillRect(0, 0, W, H);
    if (!sim) return; const p = sim.params, g = sim.geo, I = sim.circuit.Isigned, s = view.s;
    if (heatRect && opts.heat) { const [a, b] = toPx(heatRect.x0, heatRect.y1), [c, d] = toPx(heatRect.x1, heatRect.y0); ctx.imageSmoothingEnabled = true; ctx.drawImage(heat, a, b, c - a, d - b); }
    ctx.strokeStyle = '#1d3a73'; ctx.lineWidth = 1; ctx.setLineDash([6, 6]); const [, ay] = toPx(0, 0); ctx.beginPath(); ctx.moveTo(0, ay); ctx.lineTo(W, ay); ctx.stroke(); ctx.setLineDash([]);
    if (p.coreMaterial !== 'none') { const L = p.coreLength * S, rs = p.coreDiameter * S / 2, hh = rs * .9, [x0, y0] = toPx(-L / 2, rs), [x1, y1] = toPx(L / 2, -rs), gr = ctx.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, '#c9d1da'); gr.addColorStop(.5, '#7e8791'); gr.addColorStop(1, '#c9d1da'); ctx.fillStyle = gr; ctx.beginPath(); const [tx, ty] = toPx(-L / 2 - rs * 2.4, 0);
      ctx.moveTo(x0, y0); ctx.lineTo(x1 - hh * s, y0); ctx.lineTo(x1 - hh * s, toPx(0, rs * 1.8)[1]); ctx.lineTo(x1, toPx(0, rs * 1.8)[1]); ctx.lineTo(x1, toPx(0, -rs * 1.8)[1]); ctx.lineTo(x1 - hh * s, toPx(0, -rs * 1.8)[1]); ctx.lineTo(x1 - hh * s, y1); ctx.lineTo(x0, y1); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(tx + rs * 1.2 * s, ay); ctx.lineTo(x0, y1); ctx.fillStyle = '#9aa3ad'; ctx.fill(); }
    const rp = Math.max(1, g.dOut * S / 2 * s); ctx.fillStyle = '#b87333';
    for (const l of g.layers) for (let j = 0; j < l.turns; j++) { const x = (j - (l.turns - 1) / 2) * g.dOut * S + (p.coilOffset || 0) * S, y = l.radius * S;
      for (const sg of [1, -1]) { const [px, py] = toPx(x, sg * y); if (px < -9 || px > W + 9) continue; ctx.beginPath(); ctx.arc(px, py, rp, 0, 6.2832); ctx.fill();
        if (opts.current && I !== 0 && rp >= 4) { ctx.fillStyle = '#061126'; const up = (sg > 0) === (I > 0); if (up) { ctx.beginPath(); ctx.arc(px, py, rp * .25, 0, 6.2832); ctx.fill(); } else { ctx.fillRect(px - rp * .5, py - 1, rp, 2); ctx.fillRect(px - 1, py - rp * .5, 2, rp); } ctx.fillStyle = '#b87333'; } } }
    if (opts.field) for (const ln of lines) { for (const sg of [1, -1]) { ctx.lineWidth = 1.6; let prev = null;
      for (let i = 0; i < ln.pts.length; i++) { const [x, y, t] = ln.pts[i], q = toPx(x, sg * y); if (prev) { ctx.strokeStyle = css(t); ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); } prev = q; }
      const m = ln.mid, a = ln.pts[m], b = ln.pts[Math.min(m + 2, ln.pts.length - 1)]; if (a && b) { const A = toPx(a[0], sg * a[1]), B = toPx(b[0], sg * b[1]), dx = B[0] - A[0], dy = B[1] - A[1], n = Math.hypot(dx, dy) || 1; arrow(A[0], A[1], dx / n, dy / n, 8, css(a[2])); } } }
    if (opts.vectors && exact && I !== 0) { ctx.lineWidth = 1.4; for (let px = 24; px < W; px += 38) for (let py = 24; py < H; py += 38) { const [x, y] = toW(px, py); if (nearWire(exact, Math.abs(y) / S, x / S, g.dOut)) continue;
      const f = fieldXY(exact, x / S, y / S), n = f.B || 1; if (f.B < 1e-6) continue; arrow(px, py, f.Bx / n, -f.By / n, 16, css(tOf(f.B))); } }
    if (I !== 0) { const half = (p.coreMaterial !== 'none' ? p.coreLength / 2 : g.axialLength / 2) * S, pn = I > 0 ? half : -half; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
      let q = toPx(pn + Math.sign(pn) * 5, 7); ctx.fillStyle = '#ff5468'; ctx.fillText('N', q[0], q[1]); q = toPx(-pn - Math.sign(pn) * 5, 7); ctx.fillStyle = '#27d3ff'; ctx.fillText('S', q[0], q[1]); }
    // sonda
    const [qx, qy] = toPx(probe.x, probe.y); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(qx, qy, 7, 0, 6.2832); ctx.moveTo(qx - 12, qy); ctx.lineTo(qx + 12, qy); ctx.moveTo(qx, qy - 12); ctx.lineTo(qx, qy + 12); ctx.stroke();
    // legenda: circuito (esquemático) e escala
    ctx.fillStyle = '#e9f1ff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(p.closed ? `Circuito FECHADO · I = ${Number(I.toPrecision(3))} A (convencional) · pilha ${p.voltage.toFixed(2)} V` : 'Circuito ABERTO · I = 0 · sem campo', 12, 18);
    ctx.fillText('Corte meridional (plano que contém o eixo) — ⊙ corrente saindo · ⊗ entrando', 12, 36); const bar = 10 * s; ctx.strokeStyle = '#e9f1ff'; ctx.beginPath(); ctx.moveTo(12, H - 16); ctx.lineTo(12 + bar, H - 16); ctx.stroke(); ctx.fillText('10 mm', 12, H - 22);
    const near = nearWire(exact, Math.abs(probe.y) / S, probe.x / S, g.dOut / 2), f = I === 0 ? { Bx: 0, By: 0, B: 0 } : fieldXY(exact, probe.x / S, probe.y / S);
    onProbe?.({ x: probe.x, y: probe.y, ...f, near, closed: p.closed, withCore: (sim.core.rings || []).length > 0 });
  }
  function resize() { W = host.clientWidth; H = host.clientHeight; if (!W || !H) return; const dpr = devicePixelRatio || 1; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; later(); redraw(); }
  new ResizeObserver(resize).observe(host);
  let drag = null; cv.style.touchAction = 'none';
  cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }; };
  cv.onpointermove = e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 4) drag.moved = true; if (drag.moved) { view.x = drag.vx - dx / view.s; view.y = drag.vy + dy / view.s; redraw(); later(); } };
  cv.onpointerup = e => { if (drag && !drag.moved) { const r = cv.getBoundingClientRect(), [x, y] = toW(e.clientX - r.left, e.clientY - r.top); probe = { x, y }; redraw(); } drag = null; };
  cv.onwheel = e => { e.preventDefault(); const r = cv.getBoundingClientRect(), [wx, wy] = toW(e.clientX - r.left, e.clientY - r.top), k = Math.exp(-e.deltaY * 0.0015); view.s = Math.min(400, Math.max(3, view.s * k));
    const [nx, ny] = toW(e.clientX - r.left, e.clientY - r.top); view.x += wx - nx; view.y += wy - ny; redraw(); later(); };
  return {
    update(s) { sim = s; exact = simLoops(s); clearTimeout(tLines); tLines = setTimeout(buildLines, 60); later(); redraw(); },
    setOptions(o) { Object.assign(opts, o); if (opts.heat) later(); redraw(); },
    setProbe(x, y) { if (Number.isFinite(x) && Number.isFinite(y)) { probe = { x, y }; redraw(); } },
    resetView() { view = { x: 0, y: -2, s: 11 }; later(); redraw(); },
    snapshot() { draw(); return cv.toDataURL('image/png'); },
  };
}
