import test from 'node:test'; import assert from 'node:assert/strict';
import { defaultTests, parseNum, theory, compareRows, calibrateSource } from '../js/experiments.js';
import { simulate } from '../js/physics.js'; import { toCSV, pdfSafe, csvCompare } from '../js/export.js';
import { buildExportJSON, parseImport } from '../js/storage.js';
test('3 testes iniciais 50/100/150 com TODOS os campos experimentais vazios', () => {
  const t = defaultTests(); assert.deepEqual(t.map(x => x.turns), [50, 100, 150]);
  for (const x of t) for (const k of ['voltageOpen', 'voltage', 'resistance', 'current', 'field_mT', 'fieldEnd_mT', 'clips']) assert.equal(x[k], null); });
test('parseNum: vírgula, vazio, inválido, negativo', () => { assert.equal(parseNum('1,5'), 1.5); assert.equal(parseNum(''), null); assert.equal(parseNum('abc'), null); assert.equal(parseNum('-2'), null); assert.equal(parseNum('0'), 0); });
test('teoria == simulação quando há 1 camada (R, I) e difere com 2 camadas', () => {
  const a = theory({}, 50), s = simulate({ turns: 50 }); assert.ok(Math.abs(a.R / s.circuit.Rcoil - 1) < 1e-9); assert.ok(Math.abs(a.I / s.circuit.I - 1) < 1e-9);
  assert.ok(Math.abs(theory({}, 150).R / simulate({ turns: 150 }).circuit.Rcoil - 1) > 0.005); });
test('sem dado experimental: exp=null e desvio=null (nada é inventado)', () => { for (const t of defaultTests()) for (const r of compareRows(t, {})) { assert.equal(r.exp, null); assert.equal(r.dev, null); } });
test('com dado experimental: desvio calculado contra a simulação', () => {
  const t = { ...defaultTests()[0], resistance: 0.30 }, r = compareRows(t, {}).find(x => x.label.startsWith('Resist')); assert.ok(Math.abs(r.dev - (0.30 - r.sim) / r.sim * 100) < 1e-9); });
test('calibrateSource: r = (E−Vt)/I; rejeita dados incoerentes', () => {
  const c = calibrateSource({ voltageOpen: 1.55, voltage: 1.2, current: 1.4 }); assert.ok(Math.abs(c.internalResistance - 0.25) < 1e-12); assert.equal(c.voltage, 1.55);
  assert.equal(calibrateSource({ voltageOpen: 1.2, voltage: 1.4, current: 1 }), null); assert.equal(calibrateSource({ voltageOpen: 1.5, voltage: 1.2, current: 0 }), null); assert.equal(calibrateSource({}), null); });
test('CSV: ; e vírgula decimal, aspas e BOM', () => { const c = toCSV([['a;b', 1.5, 'x"y']]); assert.ok(c.startsWith('\ufeff')); assert.ok(c.includes('"a;b";1,5;"x""y"')); });
test('CSV de comparação: coluna experimento vazia sem dados', () => { const rows = csvCompare(defaultTests(), {}); assert.ok(rows.slice(1).every(r => r[6] === '')); });
test('pdfSafe: nada fora de Latin-1', () => { const s = pdfSafe('R = ρL/A [Ω] μ₀ ≈ 4π × 10⁻⁷ ⊙ → ⚠ ∝'); assert.ok(/^[\x00-\xff]*$/.test(s)); assert.ok(!s.includes('?')); });
test('JSON: ida e volta; experimental separado da simulação; import valida e sanitiza', () => {
  const tests = defaultTests(); tests[0].current = 2.1; const j = JSON.stringify(buildExportJSON({ turns: 999, voltage: 1.5 }, tests));
  const back = parseImport(j); assert.equal(back.params.turns, 200); assert.equal(back.tests[0].current, 2.1); assert.equal(back.tests[1].current, null);
  assert.ok(!('current' in JSON.parse(j).simulation.params)); assert.throws(() => parseImport('{"a":1}')); assert.throws(() => parseImport('xx')); });
