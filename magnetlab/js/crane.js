/** Guindaste didático (canvas 2D). ILUSTRAÇÃO QUALITATIVA: atração é liga/desliga; NÃO calcula força nem peso suportado. */
export function createCrane(host, onChange) {
  const cv = document.createElement('canvas'); host.appendChild(cv); const ctx = cv.getContext('2d'), W = 900, H = 330, GROUND = 285, MW = 78, MH = 30;
  const mkPieces = () => [{ n: 'Aço', x: 150, w: 56, h: 40, mat: 'steel', m: 3 }, { n: 'Chapa de ferro', x: 300, w: 72, h: 22, mat: 'steel', m: 2 }, { n: 'Alumínio (não magnético)', x: 450, w: 56, h: 40, mat: 'alu', m: 1 }, { n: 'Parafusos', x: 590, w: 34, h: 20, mat: 'steel', m: 0 }]
    .map(p => ({ ...p, y: GROUND - p.h, vy: 0, att: false, ox: 0, hold: false }));
  let pieces = mkPieces(), sw = false, circuitOk = true, residual = false, tx = 15, ty = 0, last = performance.now(), auto = null, prevPow = false;
  const pow = () => sw && circuitOk, mx = () => 60 + tx / 100 * 780, my = () => 78 + ty / 100 * (GROUND - 78 - MH - 2);
  function step(dt) {
    const x = mx(), P = pow(); let lim = GROUND; // o eletroímã não atravessa peças nem o chão
    for (const p of pieces) { if (p.att || p.hold) lim = Math.min(lim, GROUND - p.h); else if (Math.abs(p.x - x) < MW / 2 + p.w / 2) lim = Math.min(lim, p.y); }
    const maxTy = (lim - MH - 78) / (GROUND - 78 - MH - 2) * 100; if (ty > maxTy) ty = Math.max(0, maxTy); const bottom = my() + MH;
    if (prevPow && !P) pieces.forEach(p => { if (p.att) { if (residual && p.m === 0) p.hold = true; else p.att = false; } }); // ao desligar: solta (exceto residual ilustrativo)
    if (!prevPow && P) pieces.forEach(p => { if (p.hold) { p.hold = false; p.att = true; } });
    prevPow = P;
    for (const p of pieces) {
      if (p.att || p.hold) { p.ox *= Math.max(0, 1 - 8 * dt); p.vy = 0; p.y = bottom; if (p.hold) p.x = x + p.ox; else p.x = x + p.ox; continue; }
      if (P && p.mat === 'steel' && !pieces.some(q => q.att || q.hold) && Math.abs(p.x - x) < MW / 2 + p.w / 2 - 8 && p.y - bottom <= 10 && p.y >= bottom - 2) { p.att = true; p.ox = p.x - x; continue; }
      if (p.y + p.h < GROUND) { p.vy += 900 * dt; p.y = Math.min(GROUND - p.h, p.y + p.vy * dt); } else p.vy = 0;
    }
  }
  function draw() {
    const g = ctx; g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0); const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#0d2147'); sky.addColorStop(1, '#061126'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1d3a73'; g.fillRect(0, GROUND, W, H - GROUND); g.fillStyle = '#10264d'; g.fillRect(780, GROUND - 6, 110, 6); g.fillStyle = '#8fa6cc'; g.font = '12px sans-serif'; g.fillText('destino', 806, GROUND + 18);
    g.fillStyle = '#34528c'; g.fillRect(30, 30, 840, 10); g.fillRect(30, 30, 10, GROUND - 30); g.fillRect(860, 30, 10, GROUND - 30);
    const x = mx(), y = my(); g.fillStyle = '#d98a4e'; g.fillRect(x - 24, 22, 48, 26); g.strokeStyle = '#9aa3ad'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 48); g.lineTo(x, y); g.stroke();
    g.fillStyle = '#4a5560'; g.fillRect(x - MW / 2, y, MW, MH); g.fillStyle = '#b87333'; for (let i = 0; i < 9; i++) g.fillRect(x - MW / 2 + 6 + i * 8, y + 4, 4, MH - 8); g.fillStyle = pow() ? '#ffe36b' : '#66707d'; g.fillRect(x - MW / 2, y + MH - 4, MW, 4);
    if (pow()) { g.strokeStyle = 'rgba(39,211,255,.55)'; g.lineWidth = 1.4; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x + k * 14, y + MH); g.bezierCurveTo(x + k * 40, y + MH + 45, x + k * 40 + 20, y + MH + 45, x + k * 14 + 8, y + MH + 4); g.stroke(); } }
    for (const p of pieces) { g.fillStyle = p.mat === 'alu' ? '#c9d1da' : p.m === 2 ? '#7d8791' : '#5c6773'; g.fillRect(p.x - p.w / 2, p.y, p.w, p.h); g.strokeStyle = '#0a1a3a'; g.lineWidth = 1; g.strokeRect(p.x - p.w / 2, p.y, p.w, p.h);
      g.fillStyle = '#e9f1ff'; g.font = '11px sans-serif'; g.textAlign = 'center'; g.fillText(p.n.length > 12 && p.w < 60 ? p.n.split(' ')[0] : p.n, p.x, p.y - 4); g.textAlign = 'left'; }
    g.fillStyle = pow() ? '#27d3ff' : '#ffb020'; g.font = 'bold 13px sans-serif'; g.fillText(circuitOk ? (pow() ? 'ALIMENTAÇÃO LIGADA — atração magnética ativa' : 'ALIMENTAÇÃO DESLIGADA — sem atração sustentada') : 'Circuito do painel está ABERTO — sem corrente, sem campo', 50, 72);
  }
  function resize() { const w = host.clientWidth; if (!w) return; const dpr = devicePixelRatio || 1; cv.style.width = '100%'; cv.style.height = 'auto'; cv.width = w * dpr; cv.height = w * dpr * H / W; cv.style.aspectRatio = `${W}/${H}`; }
  new ResizeObserver(resize).observe(host); resize();
  const loop = t => { const dt = Math.min(0.05, (t - last) / 1000); last = t; if (auto) auto(dt); step(dt); draw(); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  const api = {
    setPower(v) { sw = !!v; onChange?.(pow()); }, togglePower() { api.setPower(!sw); return sw; }, setX(v) { tx = +v; }, setY(v) { ty = +v; }, setResidual(v) { residual = !!v; },
    setCircuit(ok) { const was = pow(); circuitOk = !!ok; if (was !== pow()) onChange?.(pow()); }, isOn: () => pow(),
    reset() { pieces = mkPieces(); sw = false; tx = 15; ty = 0; auto = null; prevPow = false; onChange?.(false); return { x: tx, y: ty }; },
    /** sequência: descer sobre o aço → ligar → subir → mover → descer → desligar → subir */
    runSequence(setUI) { api.reset(); let ph = 0, t = 0; setUI(tx, ty);
      auto = dt => { t += dt; const go = (cur, tgt, sp) => (Math.abs(tgt - cur) < sp * dt ? tgt : cur + Math.sign(tgt - cur) * sp * dt);
        if (ph === 0) { ty = go(ty, 84, 40); if (ty === 84) { api.setPower(true); ph = 1; t = 0; } }
        else if (ph === 1 && t > 0.8) { ty = go(ty, 10, 40); if (ty === 10) ph = 2; }
        else if (ph === 2) { tx = go(tx, 95, 30); if (tx === 95) ph = 3; }
        else if (ph === 3) { ty = go(ty, 70, 40); if (ty === 70) { api.setPower(false); ph = 4; t = 0; } }
        else if (ph === 4 && t > 1.2) { ty = go(ty, 0, 40); if (ty === 0) auto = null; }
        setUI(tx, ty); }; },
  };
  return api;
}
