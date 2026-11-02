import test from 'node:test'; import assert from 'node:assert/strict';
import { whyMoreTurns, formulaCards, trend, GLOSSARY } from '../js/education.js'; import { simulate } from '../js/physics.js'; import { num } from '../js/report.js';
test('trend: palavras coerentes com os números', () => { assert.equal(trend(1, 2), 'aumentou'); assert.equal(trend(2, 1), 'diminuiu'); assert.equal(trend(1, 1.001), 'praticamente não mudou'); });
test('"mais espiras": linhas = motor; texto cita os valores reais', () => {
  const w = whyMoreTurns({}); [50, 100, 150].forEach((N, i) => { const s = simulate({ turns: N }); assert.equal(w.rows[i].R, s.circuit.Rcoil); assert.equal(w.rows[i].NI, N * s.circuit.I); });
  assert.ok(w.paragraphs.some(p => p.includes(num(w.rows[1].I, 3)))); });
test('texto muda de verdade se a física muda (pilha ideal: r=0.01 → corrente cai mais)', () => {
  const a = whyMoreTurns({ internalResistance: 5 }).rows, b = whyMoreTurns({ internalResistance: 0.01 }).rows; assert.ok(a[2].I / a[0].I > b[2].I / b[0].I); });
test('fórmulas: exemplo usa o R do motor; glossário cobre os 17 itens exigidos', () => {
  const R = simulate({}).circuit.Rcoil; assert.ok(formulaCards({})[0].example.includes(num(R))); assert.ok(GLOSSARY.length >= 17); formulaCards({}).forEach(f => assert.ok(f.vars.length && f.example && f.usage)); });
