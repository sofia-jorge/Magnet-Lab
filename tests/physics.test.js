import test from 'node:test'; import assert from 'node:assert/strict';
import { simulate, sweepTurns, resistance, crossSection, solenoidAxisField, demagFactor, MU0, windingGeometry, sanitize } from '../js/physics.js';
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

test('1. circuito aberto: I=0 e B=0', () => { const r = simulate({ closed: false }); assert.equal(r.circuit.I, 0); assert.equal(r.core.Bcore, 0); assert.equal(r.pole, null); });
test('2. circuito fechado: I>0', () => assert.ok(simulate({}).circuit.I > 0));
test('3. mais resistência externa => menos corrente', () => assert.ok(simulate({ externalResistance: 1 }).circuit.I < simulate({}).circuit.I));
test('4. R=ρL/A (valor independente) e escala com A', () => {
  const r = simulate({ turns: 50 }); const g = r.geo;
  const L = 50 * 2 * Math.PI * (r.params.coilInnerRadius + g.dOut / 2); // 1 camada
  near(r.geo.wireLength, L); near(r.circuit.Rcoil, 1.68e-8 * L / crossSection(0.25e-3), 1e-9);
  near(resistance(1.68e-8, 1, crossSection(0.2e-3)) / resistance(1.68e-8, 1, crossSection(0.4e-3)), 4);
});
test('5. geometria: soma de espiras por camada = N, para todo N', () => {
  for (let N = 1; N <= 200; N++) assert.equal(windingGeometry(sanitize({ turns: N }).params).layers.reduce((s, l) => s + l.turns, 0), N);
});
test('5b. comprimento do fio cresce com N', () => { const s = sweepTurns({}); for (let i = 1; i < s.length; i++) assert.ok(s[i].L > s[i - 1].L); });
test('6. solenoide finito -> μ0 n I no limite longo', () => near(solenoidAxisField(1000, 1, 10, 0.001, 0), MU0 * 1000 / 10, 1e-4));
test('6b. campo no eixo: máximo no centro e simétrico', () => {
  assert.ok(solenoidAxisField(100, 1, .03, .003, 0) > solenoidAxisField(100, 1, .03, .003, .03)); near(solenoidAxisField(100, 1, .03, .003, .01), solenoidAxisField(100, 1, .03, .003, -.01));
});
test('7. inversão da corrente inverte B e polos', () => {
  const a = simulate({}), b = simulate({ reversed: true });
  near(b.core.Bcore, -a.core.Bcore); assert.notEqual(a.pole, b.pole); near(b.circuit.I, a.circuit.I);
});
test('8. núcleo: aço > ar; inox/latão ≈ ar; sem núcleo = ar', () => {
  const steel = simulate({}), none = simulate({ coreMaterial: 'none' }), ss = simulate({ coreMaterial: 'stainless' });
  assert.ok(Math.abs(steel.core.Bcore) > 1.5 * Math.abs(none.core.Bcore)); near(none.core.Bcore, none.core.Bair); near(ss.core.Bcore, ss.core.Bair);
});
test('8b. saturação: |M| ≤ Ms e B sublinear em campo enorme', () => {
  const r = simulate({ coreMaterial: 'softIron', voltage: 12, internalResistance: 0.01, turns: 200 });
  assert.ok(r.core.saturation <= 1); assert.ok(r.core.Bcore < r.core.Bair * r.core.mur);
});
test('8c. fator desmagnetizante: esfera 1/3, rod longo → 0', () => { near(demagFactor(1), 1 / 3); assert.ok(demagFactor(100) < 0.002); });
test('10. gráficos = motor: sweep(N) == simulate(N)', () => { for (const N of [50, 100, 150]) { const s = sweepTurns({}).find(x => x.N === N), r = simulate({ turns: N }); near(s.R, r.circuit.Rcoil); near(s.B, Math.abs(r.core.Bcore)); } });
test('11. sem NaN/Infinity em N=1..200 e entradas inválidas', () => {
  for (const row of sweepTurns({})) for (const v of Object.values(row)) assert.ok(Number.isFinite(v));
  const r = simulate({ turns: NaN, voltage: 'abc', wireDiameter: -1, internalResistance: 0, coilInnerRadius: 0 });
  assert.ok(Number.isFinite(r.circuit.I) && Number.isFinite(r.core.Bcore) && r.fixes.length > 0);
});
test('12. resistência sobe com temperatura (cobre)', () => assert.ok(simulate({ temperature: 80 }).circuit.Rcoil > simulate({ temperature: 20 }).circuit.Rcoil));

import { coilLoops, fieldAt, loopField, ellipticKE, traceFieldLine } from '../js/physics.js';
test('13. K,E: m=0 → π/2; m=0.5 → valores tabelados', () => { const a = ellipticKE(0); near(a.K, Math.PI / 2); near(a.E, Math.PI / 2); const b = ellipticKE(0.5); near(b.K, 1.8540746773, 1e-9); near(b.E, 1.3506438810, 1e-9); });
test('14. anel: contínuo entre eixo e quase-eixo', () => { const a = loopField(.01, 1, 0, .005), b = loopField(.01, 1, 1e-7, .005); near(a.Bz, b.Bz, 1e-6); });
test('15. Biot–Savart (anéis) ≈ solenoide finito no centro: 50, 100, 150 espiras', () => {
  for (const N of [50, 100, 150]) { const r = simulate({ turns: N }), I = r.circuit.Isigned;
    const exact = fieldAt(coilLoops(r.params, r.geo, I), 0, 0).Bz, grp = fieldAt(coilLoops(r.params, r.geo, I, 48), 0, 0).Bz;
    assert.ok(Math.abs(exact / r.core.Bair - 1) < 0.01, `N=${N} exato ${exact} vs ${r.core.Bair}`); assert.ok(Math.abs(grp / r.core.Bair - 1) < 0.02, `N=${N} agrupado`); }
});
test('16. ∇·B ≈ 0 fora do eixo (validação do campo off-axis)', () => {
  const r = simulate({ turns: 50 }), L = coilLoops(r.params, r.geo, r.circuit.Isigned), ρ = 1e-3, z = 3e-3, h = 1e-6;
  const Br = (a, b) => fieldAt(L, a, b).Br, Bz = (a, b) => fieldAt(L, a, b).Bz;
  const div = ((ρ + h) * Br(ρ + h, z) - (ρ - h) * Br(ρ - h, z)) / (2 * h * ρ) + (Bz(ρ, z + h) - Bz(ρ, z - h)) / (2 * h);
  assert.ok(Math.abs(div) < 1e-3 * Math.abs(Bz(ρ, z)) / ρ * 1e-0, `div=${div}`);
});
test('17. inverter corrente inverte Bz fora do eixo; linha segue B e sai pelo polo norte (+z)', () => {
  const r = simulate({}), L = coilLoops(r.params, r.geo, r.circuit.Isigned), M = coilLoops(r.params, r.geo, -r.circuit.Isigned);
  near(fieldAt(M, 1e-3, 2e-3).Bz, -fieldAt(L, 1e-3, 2e-3).Bz);
  const line = traceFieldLine(L, 1e-3, 0, +1); assert.ok(line.at(-1)[1] > 0.02 || line.length > 5); assert.ok(line[10][1] > 0);
  assert.ok(line.every(([a, b]) => Number.isFinite(a) && Number.isFinite(b)));
});

import { fieldXY, nearWire } from '../js/physics.js';
test('18. fieldXY: simetria do plano de corte e coincidência com o eixo', () => {
  const r = simulate({}), L = coilLoops(r.params, r.geo, r.circuit.Isigned), a = fieldXY(L, 4e-3, 1e-3), b = fieldXY(L, 4e-3, -1e-3);
  near(a.Bx, b.Bx); near(a.By, -b.By); near(a.B, b.B); near(fieldXY(L, 0, 0).Bx, fieldXY(L, 0, 1e-9).Bx, 1e-6);
  assert.ok(Math.abs(fieldXY(L, 0, 0).Bx / r.core.Bair - 1) < 0.01);
});
test('19. nearWire detecta fio e não o centro da bobina', () => {
  const r = simulate({}), L = coilLoops(r.params, r.geo, 1), l0 = L[0]; assert.ok(nearWire(L, l0.a, l0.z, r.geo.dOut / 2)); assert.ok(!nearWire(L, 0, 0, r.geo.dOut / 2));
});
