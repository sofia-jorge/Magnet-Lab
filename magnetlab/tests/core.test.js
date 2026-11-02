import test from 'node:test'; import assert from 'node:assert/strict';
import { simulate, sweepTurns, coreAxisModel, simLoops, fieldAt, demagFactor, MU0, CORE_MATERIALS } from '../js/physics.js';
// campo uniforme de referência: bobina de 1 m (H0 = N·I/L = 1000 A/m sobre todo o parafuso)
const uniform = { layers: [{ turns: 1000, radius: 0.005, length: 1.0, index: 1 }] };
const rod = (mur, extra = {}) => ({ coreMaterial: 'lowCarbon', coreMurOverride: mur, coreLength: 0.085, coreDiameter: 0.004, coilOffset: 0, ...extra });

test('limite χ pequeno: M ≈ χ·H0 (sem desmagnetização relevante) — resultado analítico exato', () => {
  const c = coreAxisModel(rod(1.5), uniform, 1), H0 = c.H0; assert.ok(Math.abs(H0 - 1000) < 5);
  assert.ok(Math.abs(c.M / (0.5 * H0) - 1) < 0.02, `M=${c.M} esperado ${0.5 * H0}`); });
test('χ grande, campo uniforme: M(centro) próximo ao elipsoide χ/(1+Nd·χ)·H0 (tolerância 30%: cilindro ≠ elipsoide)', () => {
  const c = coreAxisModel(rod(200), uniform, 1), Nd = demagFactor(85 / 4), ref = 199 / (1 + Nd * 199) * c.H0;
  assert.ok(Math.abs(c.M / ref - 1) < 0.30, `M=${c.M} ref=${ref}`); assert.ok(c.M < 199 * c.H0); });
test('Newton convergiu (resíduo pequeno) em N=1..200 e materiais', () => {
  for (const mat of ['lowCarbon', 'softIron']) for (const N of [1, 25, 50, 100, 150, 200]) { const r = simulate({ turns: N, coreMaterial: mat }); assert.ok(r.core.residual < 1e-8, `${mat} N=${N} res=${r.core.residual}`); assert.ok(Number.isFinite(r.core.Bcore)); } });
test('saturação: |M| ≤ Ms e B do centro ≤ B_ar + μ0·Ms·(fração)', () => {
  const r = simulate({ voltage: 12, internalResistance: 0.05, turns: 200, coreMaterial: 'softIron' }); assert.ok(r.core.saturation <= 1 + 1e-9);
  assert.ok(Math.abs(r.core.Bcore) <= Math.abs(r.core.Bair) + MU0 * CORE_MATERIALS.softIron.Ms * 1.0001); });
test('simetria: inverter corrente inverte B do núcleo e das extremidades', () => {
  const a = simulate({}), b = simulate({ reversed: true }); assert.ok(Math.abs(b.core.Bcore + a.core.Bcore) < 1e-12 * 1e3); assert.ok(Math.abs(b.core.Bend + a.core.Bend) < 1e-9); });
test('fluxo vaza: B na extremidade < B no centro (bobina centrada)', () => { const r = simulate({}); assert.ok(Math.abs(r.core.Bend) < Math.abs(r.core.Bcore)); });
test('posição da bobina: deslocar para a extremidade AUMENTA o campo na extremidade', () => {
  const c = simulate({}), e = simulate({ coilOffset: 0.035 }); assert.ok(Math.abs(e.core.Bend) > 3 * Math.abs(c.core.Bend), `${e.core.Bend} vs ${c.core.Bend}`);
  const s = simulate({ coilOffset: -0.035 }); assert.ok(Math.abs(Math.abs(s.core.Bend) / Math.abs(e.core.Bend) - 1) < 1e-6); /* simetria espelhada */ });
test('anéis de magnetização reproduzem B(centro) do modelo axial (consistência 2D/3D × números)', () => {
  for (const N of [50, 100, 150]) { const s = simulate({ turns: N }), off = s.params.coilOffset, b = fieldAt(simLoops(s), 0, off).Bz; assert.ok(Math.abs(b / s.core.Bcore - 1) < 0.05, `N=${N}: anéis ${b} vs modelo ${s.core.Bcore}`); } });
test('anéis reproduzem o PERFIL axial B(z) inteiro do modelo (não só o centro)', () => {
  for (const N of [50, 150]) { const s = simulate({ turns: N }), L = simLoops(s), P = s.core.profile, mx = Math.max(...P.B.map(Math.abs));
    P.z.forEach((z, j) => assert.ok(Math.abs(fieldAt(L, 0, z).Bz - P.B[j]) < 0.06 * mx, `N=${N} z=${z}: ${fieldAt(L, 0, z).Bz} vs ${P.B[j]}`)); } });
test('sem núcleo / não magnético: sem anéis de magnetização e B=B_ar', () => {
  for (const m of ['none', 'stainless', 'brass']) { const s = simulate({ coreMaterial: m }); assert.equal(s.core.rings.length, 0); assert.equal(s.core.Bcore, s.core.Bair); } });
test('núcleo ferromagnético multiplica o campo e é limitado por μr', () => { const s = simulate({}); const k = s.core.Bcore / s.core.Bair; assert.ok(k > 3 && k < s.core.mur); });
test('desempenho: varredura de 200 pontos com núcleo em < 3 s', () => { const t = Date.now(); const sw = sweepTurns({}); assert.ok(Date.now() - t < 3000); sw.forEach(r => Object.values(r).forEach(v => assert.ok(Number.isFinite(v)))); });
