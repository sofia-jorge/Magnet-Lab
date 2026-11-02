import test from 'node:test'; import assert from 'node:assert/strict';
import { simulate } from '../js/physics.js'; import { calcMemory, comparisonRows, num } from '../js/report.js';
test('memória de cálculo usa os mesmos números do motor', () => {
  const s = simulate({ turns: 100 }); const m = calcMemory(s);
  assert.equal(m.length, 5); assert.ok(m[1].result.includes(num(s.circuit.Rcoil))); assert.ok(m[2].result.includes(num(s.circuit.I)));
});
test('circuito aberto é declarado na memória', () => assert.ok(calcMemory(simulate({ closed: false }))[2].subst.includes('ABERTO')));
test('tabela A/B/C tem 3 colunas e nenhum NaN', () => { for (const r of comparisonRows({})) { assert.equal(r.values.length, 3); r.values.forEach(v => assert.ok(!/NaN|Infinity/.test(v))); } });
