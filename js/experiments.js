/** Dados EXPERIMENTAIS (medidos pelo grupo) e comparação teoria × simulação × experimento. Sem DOM.
 *  Experimentais nunca são preenchidos aqui: tudo começa como null. */
import { simulate, sanitize, MU0, WIRE_MATERIALS, crossSection, rhoAtT, resistance } from './physics.js';

export const TEST_FIELDS = [ // [chave, rótulo, unidade]
  ['turns', 'Espiras', ''], ['voltageOpen', 'Tensão da pilha EM ABERTO (sem carga)', 'V'], ['voltage', 'Tensão nos terminais com circuito FECHADO', 'V'],
  ['resistance', 'Resistência da bobina (multímetro)', 'Ω'], ['current', 'Corrente com circuito fechado', 'A'], ['field_mT', 'Campo medido no centro da bobina', 'mT'], ['fieldEnd_mT', 'Campo medido na extremidade (ponta/cabeça) do parafuso', 'mT'],
  ['fieldPos', 'Local/posição da medição do campo', ''], ['clips', 'Clipes levantados', 'un.'],
];
let seq = 0;
export const newTest = (n, turns) => ({ id: `t${Date.now().toString(36)}${seq++}`, name: `Teste ${n}`, turns, voltageOpen: null, voltage: null, resistance: null, current: null, field_mT: null, fieldEnd_mT: null, fieldPos: '', clips: null, notes: '' });
export const defaultTests = () => [newTest(1, 50), newTest(2, 100), newTest(3, 150)];

/** Texto digitado → número ≥ 0, ou null (vazio/ inválido). Aceita vírgula decimal. */
export function parseNum(s) { if (s == null) return null; const t = String(s).trim().replace(',', '.'); if (t === '') return null; const v = Number(t); return Number.isFinite(v) && v >= 0 ? v : null; }

/** TEORIA = fórmulas do relatório com geometria nominal de 1 camada: L=N·2π(r+d/2), R=ρL/A, I=V/(R+r), B=μ0·N·I/ℓ (solenoide longo, ar). */
export function theory(base, N) {
  const { params: p } = sanitize({ ...base, turns: N }), dOut = p.wireDiameter + 2 * p.enamelThickness, L = N * 2 * Math.PI * (p.coilInnerRadius + dOut / 2);
  const R = resistance(rhoAtT(WIRE_MATERIALS[p.wireMaterial], p.temperature), L, crossSection(p.wireDiameter));
  const Rt = R + p.internalResistance + p.externalResistance, I = p.closed && Rt > 0 ? p.voltage / Rt : 0, ell = Math.min(N * dOut, p.coilMaxLength);
  return { L, R, I, ell, B: MU0 * N * I / ell, V: p.closed ? p.voltage - I * p.internalResistance : p.voltage };
}
/** Estima E e r_interna: r = (E − Vt)/I. Retorna null se faltarem dados ou se forem incoerentes (Vt > E, I = 0). */
export function calibrateSource(t) {
  if (t.voltageOpen == null || t.voltage == null || !(t.current > 0) || t.voltage > t.voltageOpen) return null;
  return { voltage: t.voltageOpen, internalResistance: (t.voltageOpen - t.voltage) / t.current };
}
const dev = (exp, ref) => (exp != null && ref > 0 ? (exp - ref) / ref * 100 : null);
/** Linhas de comparação de UM teste. exp = null enquanto o grupo não inserir o dado. */
export function compareRows(test, base) {
  const th = theory(base, test.turns), s = simulate({ ...base, turns: test.turns });
  return [
    { label: 'Tensão nos terminais', unit: 'V', theory: th.V, sim: s.circuit.Vterminal, exp: test.voltage, dev: dev(test.voltage, s.circuit.Vterminal) },
    { label: 'Resistência da bobina', unit: 'Ω', theory: th.R, sim: s.circuit.Rcoil, exp: test.resistance, dev: dev(test.resistance, s.circuit.Rcoil) },
    { label: 'Corrente', unit: 'A', theory: th.I, sim: s.circuit.I, exp: test.current, dev: dev(test.current, s.circuit.I) },
    { label: 'Campo magnético (centro da bobina, SEM núcleo)', unit: 'mT', theory: th.B * 1e3, sim: Math.abs(s.core.Bair) * 1e3, exp: test.field_mT, dev: dev(test.field_mT, Math.abs(s.core.Bair) * 1e3) },
    { label: 'Campo na extremidade do parafuso (com núcleo, modelo didático)', unit: 'mT', theory: '— (sem fórmula simples)', sim: Math.abs(s.core.Bend) * 1e3, exp: test.fieldEnd_mT, dev: dev(test.fieldEnd_mT, Math.abs(s.core.Bend) * 1e3) },
    { label: 'Capacidade de atração', unit: 'clipes', theory: 'hipótese: maior B ⇒ maior atração (sem fórmula para clipes)', sim: 'não estimada (sem calibração)', exp: test.clips, dev: null },
  ];
}
