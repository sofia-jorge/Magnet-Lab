/**
 * MAGNET LAB — motor de física (Etapa 1). Sem DOM, sem aleatoriedade: tudo é função pura.
 * Unidades SI em todo o código (m, A, V, Ω, T). A interface converte para mm/mT.
 *
 * MODELOS E LIMITES (também exibidos na interface):
 *  - R = ρL/A, com L obtido da geometria real do enrolamento em camadas (não é N × valor arbitrário).
 *  - Corrente: I = V/(R_bobina + r_interna + R_externa), circuito em série. Fonte = Thévenin (V, r).
 *  - Campo no ar: solenoide FINITO (soma de camadas), válido SOBRE O EIXO. Fora do eixo: Etapa 2 (Biot–Savart).
 *  - Núcleo: modelo DIDÁTICO 1D (magnetização autoconsistente no eixo, saturação tanh, Newton). Sem histerese. μr ADOTADO.
 *  - Força: apenas ordem de grandeza idealizada (B²A/2μ0). Não converte em número de clipes.
 */
export const MU0 = 4 * Math.PI * 1e-7;

export const WIRE_MATERIALS = {
  copper:    { label: 'Cobre',    rho20: 1.68e-8, alpha: 0.0039 },
  aluminium: { label: 'Alumínio', rho20: 2.82e-8, alpha: 0.0039 },
  nichrome:  { label: 'Nicromo',  rho20: 1.10e-6, alpha: 0.0004 },
};

// mur e Ms são valores ADOTADOS (típicos de literatura); parafusos reais variam muito.
export const CORE_MATERIALS = {
  none:       { label: 'Sem núcleo (ar)',        mur: 1,    Ms: 0 },
  lowCarbon:  { label: 'Ferro comum / aço baixo carbono (parafuso)',      mur: 200,  Ms: 1.6e6 },
  softIron:   { label: 'Ferro doce',             mur: 5000, Ms: 1.7e6 },
  stainless:  { label: 'Inox 304 (não magnético)', mur: 1.01, Ms: 0 },
  brass:      { label: 'Latão (não magnético)',  mur: 1,    Ms: 0 },
};

export const DEFAULTS = Object.freeze({
  turns: 50, voltage: 1.5, internalResistance: 0.25, externalResistance: 0,
  wireDiameter: 0.25e-3, enamelThickness: 15e-6, wireMaterial: 'copper', temperature: 20,
  coilMaxLength: 30e-3, coilInnerRadius: 2.0e-3, coilOffset: 0,
  coreMaterial: 'lowCarbon', coreLength: 85e-3, coreDiameter: 4e-3, coreMurOverride: null,
  closed: true, reversed: false,
});

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const finite = (x, fb) => (Number.isFinite(x) ? x : fb);

/** Valida e normaliza parâmetros; devolve também a lista de correções feitas. */
export function sanitize(input = {}) {
  const p = { ...DEFAULTS, ...input }; const fixes = [];
  const fix = (k, lo, hi) => { const v = clamp(finite(+p[k], DEFAULTS[k]), lo, hi); if (v !== p[k]) fixes.push(`${k}: ajustado para ${v}`); p[k] = v; };
  p.turns = Math.round(finite(+p.turns, DEFAULTS.turns)); fix('turns', 1, 200);
  fix('voltage', 0, 12); fix('internalResistance', 0, 100); fix('externalResistance', 0, 1000);
  fix('wireDiameter', 0.05e-3, 2e-3); fix('enamelThickness', 0, 0.1e-3); fix('temperature', -20, 200);
  fix('coilMaxLength', 2e-3, 0.2); fix('coilOffset', -0.1, 0.1); fix('coilInnerRadius', 0.5e-3, 0.05);
  fix('coreLength', 5e-3, 0.3); fix('coreDiameter', 1e-3, 0.03);
  if (!WIRE_MATERIALS[p.wireMaterial]) p.wireMaterial = 'copper';
  if (!CORE_MATERIALS[p.coreMaterial]) p.coreMaterial = 'none';
  if (p.coreMaterial !== 'none' && p.coilInnerRadius < p.coreDiameter / 2) {
    p.coilInnerRadius = p.coreDiameter / 2; fixes.push('coilInnerRadius: não pode ser menor que o raio do núcleo');
  }
  p.closed = !!p.closed; p.reversed = !!p.reversed;
  return { params: p, fixes };
}

/** Geometria do enrolamento: bobinado justo, em camadas. Retorna comprimento real do fio. */
export function windingGeometry(p) {
  const dOut = p.wireDiameter + 2 * p.enamelThickness;
  const perLayer = Math.max(1, Math.floor(p.coilMaxLength / dOut));
  const layers = []; let left = p.turns, k = 1;
  while (left > 0) {
    const n = Math.min(perLayer, left);
    layers.push({ index: k, turns: n, radius: p.coilInnerRadius + (k - 0.5) * dOut, length: n * dOut });
    left -= n; k++;
  }
  const wireLength = layers.reduce((s, l) => s + l.turns * 2 * Math.PI * l.radius, 0);
  const meanRadius = layers.reduce((s, l) => s + l.turns * l.radius, 0) / p.turns;
  const axialLength = Math.max(...layers.map(l => l.length));
  return { dOut, perLayer, layers, wireLength, meanRadius, axialLength, outerRadius: p.coilInnerRadius + layers.length * dOut };
}

export const crossSection = d => Math.PI * (d / 2) ** 2;
/** R = ρ L / A */
export const resistance = (rho, L, A) => rho * L / A;
export const rhoAtT = (m, T) => m.rho20 * (1 + m.alpha * (T - 20));

/** Circuito série. Fonte real: V com resistência interna r. Circuito aberto => I = 0. */
export function circuit(p, Rcoil) {
  const Rtotal = Rcoil + p.internalResistance + p.externalResistance;
  const I = p.closed && Rtotal > 0 ? p.voltage / Rtotal : 0;
  const signed = p.reversed ? -I : I;
  return { Rcoil, Rtotal, I, Isigned: signed,
    Vterminal: p.closed ? p.voltage - I * p.internalResistance : p.voltage,
    Pcoil: Rcoil * I * I, Psource: p.voltage * I, Pinternal: p.internalResistance * I * I };
}

/** Campo no eixo de um solenoide fino de comprimento L, raio a, N espiras, corrente I, a z do centro. */
export function solenoidAxisField(N, I, L, a, z) {
  const t = (u) => u / Math.sqrt(u * u + a * a);
  return (MU0 * N * I / (2 * L)) * (t(z + L / 2) - t(z - L / 2));
}
/** Campo no eixo no ar: soma das camadas (aprox.: camadas concêntricas e centradas no mesmo ponto). */
export function airAxisField(geo, I, z) {
  return geo.layers.reduce((s, l) => s + solenoidAxisField(l.turns, I, l.length, l.radius, z), 0);
}
/** Fator desmagnetizante de um elipsoide prolato (m = comprimento/diâmetro). Aproximação para um cilindro. */
export function demagFactor(m) {
  if (m <= 1.0001) return 1 / 3;
  const s = Math.sqrt(m * m - 1);
  return (1 / (m * m - 1)) * ((m / s) * Math.log(m + s) - 1);
}

/* ===== Núcleo (Etapa 7): magnetização AUTOCONSISTENTE ao longo do eixo (modelo didático 1D) =====
 * O parafuso é dividido em K trechos; cada um com magnetização axial M_i. Um trecho magnetizado equivale a uma folha de
 * corrente superficial (K_s = M) — solenoide fino de raio r_s. Em cada trecho: H = B/μ0 − M, com B = B_bobina + Σ B_folhas(M).
 * Resolve-se M_i = Ms·tanh(χ·H_i/Ms) (anisterética: SEM histerese) por Newton. Isto inclui a auto-desmagnetização do
 * parafuso e o fato de a bobina cobrir só parte dele. Hipóteses: parafuso fino (H ≈ uniforme na seção), bobina centrada. */
const K_SEG = 32, GCACHE = new Map();
const tfun = (u, a) => u / Math.sqrt(u * u + a * a);
export const sheetAxisField = (M, h, rs, dz) => MU0 * M / 2 * (tfun(dz + h / 2, rs) - tfun(dz - h / 2, rs)); // folha de corrente: comprimento h, raio rs
function rodGreen(L, rs) {
  const key = `${L}|${rs}`; if (GCACHE.has(key)) return GCACHE.get(key);
  const h = L / K_SEG, z = Array.from({ length: K_SEG }, (_, i) => -L / 2 + (i + 0.5) * h);
  const G = z.map(zj => z.map(zi => sheetAxisField(1, h, rs, zj - zi))); const o = { h, z, G }; if (GCACHE.size > 20) GCACHE.clear(); GCACHE.set(key, o); return o;
}
function solveLinear(A, b) { // eliminação de Gauss com pivotamento parcial
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-300; for (let r = c + 1; r < n; r++) { const f = M[r][c] / d; if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; } }
  const x = new Array(n).fill(0); for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / (M[r][r] || 1e-300); } return x;
}
export function coreAxisModel(p, geo, I) {
  const mat = CORE_MATERIALS[p.coreMaterial], mur = p.coreMurOverride ?? mat.mur, Bair = airAxisField(geo, I, 0), H0 = Bair / MU0;
  const air = { Bair, Bcore: Bair, Bend: [airAxisField(geo, I, p.coreLength / 2 - (p.coilOffset || 0)), airAxisField(geo, I, -p.coreLength / 2 - (p.coilOffset || 0))].reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a)), H0, M: 0, saturation: 0, mur, rings: [], profile: null, residual: 0, model: 'ar' };
  if (p.coreMaterial === 'none' || mur <= 1 || mat.Ms <= 0 || I === 0) return air;
  const rs = p.coreDiameter / 2, { h, z, G } = rodGreen(p.coreLength, rs), Ms = mat.Ms, chi = mur - 1, n = K_SEG;
  const off = p.coilOffset || 0, Hc = z.map(zj => airAxisField(geo, I, zj - off) / MU0), f = H => Ms * Math.tanh(chi * H / Ms), df = H => { const c = Math.cosh(Math.min(40, Math.abs(chi * H / Ms))); return chi / (c * c); };
  const Hof = M => z.map((_, j) => { let s = 0; for (let i = 0; i < n; i++) s += G[j][i] * M[i]; return Hc[j] - M[j] + s / MU0; });
  const resid = M => { const H = Hof(M); return { H, F: M.map((m, j) => m - f(H[j])) }; }, nrm = F => Math.max(...F.map(Math.abs)) / Ms;
  let M = new Array(n).fill(0), { H, F } = resid(M), it = 0;
  for (; it < 80 && nrm(F) > 1e-10; it++) {
    const J = z.map((_, j) => z.map((__, i) => (i === j ? 1 : 0) + df(H[j]) * ((i === j ? 1 : 0) - G[j][i] / MU0))), d = solveLinear(J, F.map(x => -x)); let t = 1, ok = false;
    while (t > 1e-4) { const Mn = M.map((m, i) => m + t * d[i]), r = resid(Mn); if (nrm(r.F) < nrm(F) * (1 - 1e-4 * t) || nrm(r.F) < 1e-12) { M = Mn; H = r.H; F = r.F; ok = true; break; } t /= 2; }
    if (!ok) break;
  }
  const field = zz => airAxisField(geo, I, zz - off) + M.reduce((s, m, i) => s + sheetAxisField(m, h, rs, zz - z[i]), 0);
  const Bc = field(off), Be = [field(p.coreLength / 2), field(-p.coreLength / 2)].reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a));
  if (![Bc, Be, ...M].every(Number.isFinite)) return air;
  return { Bair, Bcore: Bc, Bend: Be, H0, M: (M[n / 2 - 1] + M[n / 2]) / 2, saturation: Math.max(...M.map(Math.abs)) / Ms, mur, residual: nrm(F), iterations: it, model: 'eixo-1D',
    profile: { z, M, B: z.map(zz => field(zz)) }, rings: z.flatMap((zz, i) => [-1, 0, 1].map(k => ({ a: rs, z: zz + k * h / 3, I: M[i] * h / 3, eps: h / 6, mag: true }))) }; // 3 sub-anéis/trecho ≈ folha contínua
}
export const coreCenterField = coreAxisModel; // nome antigo, mantido por compatibilidade

/** Ordem de grandeza IDEALIZADA da força numa face plana com B uniforme: B²A/(2μ0). NÃO é limite rigoroso nem a força real do parafuso. */
export const forceUpperBound = (B, A) => B * B * A / (2 * MU0);

/** Avisos de segurança (limiares heurísticos, identificados como tais). */
export function warnings(p, geo, c) {
  const w = []; const J = c.I / crossSection(p.wireDiameter) / 1e6;
  if (c.I > 0.5) w.push({ level: c.I > 2 ? 'danger' : 'warn', text: `Corrente de ${c.I.toFixed(2)} A: acima do uso típico contínuo de uma pilha AA alcalina (heurística: ~0,5 A). A tensão real cai e a pilha aquece.` });
  if (J > 6) w.push({ level: J > 20 ? 'danger' : 'warn', text: `Densidade de corrente ${J.toFixed(1)} A/mm²: acima da faixa usual de fio esmaltado (heurística: 3–6 A/mm²). Risco de aquecimento do fio.` });
  if (p.internalResistance === 0 && p.closed) w.push({ level: 'warn', text: 'Resistência interna nula é idealização: uma pilha real não fornece qualquer corrente.' });
  w.push({ level: 'info', text: 'R foi calculada na temperatura informada; o aquecimento durante a operação não é simulado (R sobe ~0,39 %/°C no cobre).' });
  return w;
}

/** Ponto de entrada: tudo que a interface, os gráficos e o PDF devem consumir. */
export function simulate(input) {
  const { params: p, fixes } = sanitize(input);
  const geo = windingGeometry(p);
  const A = crossSection(p.wireDiameter);
  const rho = rhoAtT(WIRE_MATERIALS[p.wireMaterial], p.temperature);
  const Rcoil = resistance(rho, geo.wireLength, A);
  const c = circuit(p, Rcoil);
  const core = coreAxisModel(p, geo, c.Isigned);
  const longSolenoidAir = MU0 * p.turns * c.Isigned / geo.axialLength; // ideal "B=μNI/L", só p/ comparação
  const pole = c.I === 0 ? null : (c.Isigned > 0 ? 'N em +z (cabeça)' : 'N em −z (ponta)');
  return { params: p, fixes, geo, rho, A, circuit: c, core, longSolenoidAir, pole,
    forceBound: forceUpperBound(core.Bend, Math.PI * (p.coreDiameter / 2) ** 2),
    warnings: warnings(p, geo, c) };
}

/** Varre N de 1 a 200 usando os MESMOS cálculos (gráficos e tabela usam isto). */
export const sweepTurns = (input, from = 1, to = 200) =>
  Array.from({ length: to - from + 1 }, (_, i) => { const r = simulate({ ...input, turns: from + i });
    return { N: r.params.turns, L: r.geo.wireLength, R: r.circuit.Rcoil, I: r.circuit.I, P: r.circuit.Pcoil, B: Math.abs(r.core.Bcore), Bend: Math.abs(r.core.Bend), Bair: Math.abs(r.core.Bair) }; });

/* ================= Etapa 3: campo fora do eixo (Biot–Savart exato para anéis circulares) ================= */
/** Integrais elíticas completas K(m), E(m), m = k², via média aritmético-geométrica. */
export function ellipticKE(m) {
  m = Math.min(Math.max(m, 0), 1 - 1e-14);
  let a = 1, b = Math.sqrt(1 - m), sum = 0.5 * m, p = 0.5;
  for (let n = 1; n < 40; n++) { const c = (a - b) / 2, an = (a + b) / 2; b = Math.sqrt(a * b); a = an; p *= 2; sum += p * c * c; if (Math.abs(c) < 1e-16) break; }
  const K = Math.PI / (2 * a); return { K, E: K * (1 - sum) };
}
/** Campo (Bρ, Bz) de um anel de raio a, corrente I, no ponto (ρ, dz = z − z_anel). Simetria axial. */
export function loopField(a, I, rho, dz, eps = 0) { // eps>0: suavização (só p/ anéis de magnetização, que representam folhas contínuas)
  const q = dz * dz + eps * eps;
  if (rho < 1e-9 * a) return { Br: 0, Bz: MU0 * I * a * a / (2 * Math.pow(a * a + q, 1.5)) };
  const s = (a + rho) ** 2 + q, d = Math.max((a - rho) ** 2 + q, 1e-30), { K, E } = ellipticKE(4 * a * rho / s), f = MU0 * I / (2 * Math.PI);
  return { Bz: f / Math.sqrt(s) * (K + (a * a - rho * rho - q) / d * E), Br: f * dz / (rho * Math.sqrt(s)) * (-K + (a * a + rho * rho + q) / d * E) };
}
/** Anéis equivalentes da bobina (1 por espira; se maxLoops for excedido, agrupa espiras vizinhas — só p/ desempenho visual). */
export function coilLoops(p, geo, I, maxLoops = Infinity) {
  const group = Math.max(1, Math.ceil(p.turns / maxLoops)), loops = [];
  for (const l of geo.layers) for (let j = 0; j < l.turns; j += group) {
    const cnt = Math.min(group, l.turns - j); loops.push({ a: l.radius, z: ((j + (cnt - 1) / 2) - (l.turns - 1) / 2) * geo.dOut + (p.coilOffset || 0), I: I * cnt });
  }
  return loops;
}
export function fieldAt(loops, rho, z) {
  let Br = 0, Bz = 0; for (const l of loops) { const f = loopField(l.a, l.I, rho, z - l.z, l.eps || 0); Br += f.Br; Bz += f.Bz; } return { Br, Bz };
}
/** Traça linha de campo no plano meridiano (ρ,z) com RK4. dir=+1 segue B; −1 segue contra B. Unidades SI. */
export function traceFieldLine(loops, rho0, z0, dir = 1, { ds = 1e-3, max = 700, bound = { z: 0.15, rho: 0.12 } } = {}) {
  const pts = [[rho0, z0]]; let r = rho0, z = z0;
  const f = (r, z) => { const B = fieldAt(loops, Math.max(r, 1e-9), z), n = Math.hypot(B.Br, B.Bz) || 1; return [dir * B.Br / n, dir * B.Bz / n]; };
  for (let i = 0; i < max; i++) {
    const h = ds * (1 + Math.max(Math.abs(z), r) / 0.05), k1 = f(r, z), k2 = f(r + h / 2 * k1[0], z + h / 2 * k1[1]), k3 = f(r + h / 2 * k2[0], z + h / 2 * k2[1]), k4 = f(r + h * k3[0], z + h * k3[1]);
    r = Math.max(r + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), 1e-7); z += h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]); pts.push([r, z]);
    if (Math.abs(z) > bound.z || r > bound.rho) break; if (i > 30 && Math.hypot(r - rho0, z - z0) < h * 1.5) break;
  }
  return pts;
}

/* ================= Etapa 4: campo no plano de corte 2D (x = eixo, y = distância ao eixo com sinal) ================= */
/** B no plano meridional: Bx ao longo do eixo (+x = +z), By = componente radial com sinal de y. Unidades SI. */
export function fieldXY(loops, x, y) { const f = fieldAt(loops, Math.abs(y), x), By = y < 0 ? -f.Br : f.Br; return { Bx: f.Bz, By, B: Math.hypot(f.Bz, By) }; }
/** true se o ponto está a menos de `radius` (ex.: raio do fio) de algum fio: o modelo de anéis filamentares perde validade ali. */
export const nearWire = (loops, rho, z, radius) => loops.some(l => !l.mag && Math.hypot(rho - l.a, z - l.z) < radius);

/** Todos os anéis do campo TOTAL: espiras da bobina (corrente real) + anéis equivalentes à magnetização do núcleo. */
export const simLoops = (sim, maxLoops = Infinity) => [...coilLoops(sim.params, sim.geo, sim.circuit.Isigned, maxLoops), ...(sim.core.rings || [])];
