/** Formatação, memória de cálculo e tabela comparativa. Usa SOMENTE saídas de simulate(). Sem DOM. */
import { simulate, MU0, WIRE_MATERIALS, CORE_MATERIALS } from './physics.js';
export const num = (x, d = 4) => (Number.isFinite(x) ? (x === 0 ? '0' : Number(x.toPrecision(d)).toLocaleString('pt-BR', { maximumSignificantDigits: d })) : '—');
export const fmtB = (T) => { const a = Math.abs(T); return a >= 1e-3 ? `${num(T * 1e3, 3)} mT` : `${num(T * 1e6, 3)} µT`; };

export function calcMemory(s) {
  const p = s.params, c = s.circuit, g = s.geo, m = WIRE_MATERIALS[p.wireMaterial];
  return [
    { title: 'Comprimento do fio (geometria)', formula: 'L = Σ nₖ · 2π · rₖ  (camadas k, bobinado justo)',
      subst: `${g.layers.length} camada(s); d_ext = ${num(g.dOut * 1e3)} mm; ${g.perLayer} espiras/camada máx.`, result: `L = ${num(g.wireLength)} m` },
    { title: 'Resistência elétrica', formula: 'R = ρ(T) · L / A,   A = π(d/2)²,   ρ(T) = ρ₂₀[1 + α(T−20)]',
      subst: `ρ = ${num(s.rho, 4)} Ω·m (${m.label}, ${p.temperature} °C); L = ${num(g.wireLength)} m; A = ${num(s.A * 1e6)} mm²`, result: `R = ${num(c.Rcoil)} Ω` },
    { title: 'Corrente (Lei de Ohm, circuito série)', formula: 'I = V / (R + r_int + R_ext)',
      subst: p.closed ? `I = ${num(p.voltage)} / (${num(c.Rcoil)} + ${num(p.internalResistance)} + ${num(p.externalResistance)}) = ${num(p.voltage)} / ${num(c.Rtotal)}` : 'Circuito ABERTO ⇒ I = 0',
      result: `I = ${num(c.Isigned)} A` },
    { title: 'Campo magnético (modelo)', formula: 'Bobina no ar, eixo: B = Σ μ₀nₖI/(2Lₖ)·[(z+Lₖ/2)/√((z+Lₖ/2)²+aₖ²) − (z−Lₖ/2)/√((z−Lₖ/2)²+aₖ²)]\nNúcleo (modelo didático 1D): M_i = Ms·tanh(χ·H_i/Ms),  H_i = B_i/μ₀ − M_i,  B(z) = B_bobina(z) + Σ B_folha(M_i)  (Newton)',
      subst: `H₀ (centro da bobina, no ar) = ${num(s.core.H0)} A/m;  μr (adotado) = ${num(s.core.mur)};  Ms = ${num(CORE_MATERIALS[p.coreMaterial].Ms)} A/m\n` + (s.core.profile ? `Núcleo: 32 trechos; Newton ${s.core.iterations} iterações, resíduo ${num(s.core.residual, 2)}; saturação máx. = ${num(s.core.saturation * 100, 3)} %; M no centro = ${num(s.core.M)} A/m\n` : 'Sem núcleo ferromagnético (ou material não magnético): B = B_ar.\n') + `Referência (solenoide longo ideal, NÃO usada): μ₀NI/L = ${fmtB(s.longSolenoidAir)}`,
      result: `B_ar = ${fmtB(s.core.Bair)}  |  B_núcleo no centro da bobina = ${fmtB(s.core.Bcore)}  |  B na extremidade do parafuso = ${fmtB(s.core.Bend)}  (estimativas)` },
    { title: 'Potência elétrica', formula: 'P = R·I²   (fonte: P = V·I)',
      subst: `P_bobina = ${num(c.Rcoil)} · ${num(c.I)}²; P_fonte = ${num(p.voltage)} · ${num(c.I)}; P_interna = ${num(c.Pinternal)} W`, result: `P_bobina = ${num(c.Pcoil)} W` },
  ];
}

/** Linhas da tabela dos experimentos A/B/C — origem: motor (TEÓRICO/SIMULADO), nunca medição. */
export function comparisonRows(base, Ns = [50, 100, 150]) {
  const S = Ns.map(N => simulate({ ...base, turns: N }));
  const row = (label, f) => ({ label, values: S.map(f) });
  return [
    row('Número de espiras', s => `${s.params.turns}`), row('Comprimento do fio (m)', s => num(s.geo.wireLength)),
    row('Resistência da bobina (Ω)', s => num(s.circuit.Rcoil)), row('Tensão da fonte (V)', s => num(s.params.voltage)),
    row('Corrente (A)', s => num(s.circuit.I)), row('Potência na bobina (W)', s => num(s.circuit.Pcoil)),
    row('B no ar, centro (estimado)', s => fmtB(s.core.Bair)), row('B no núcleo, centro da bobina (modelo didático)', s => fmtB(s.core.Bcore)), row('B na extremidade do parafuso (modelo didático)', s => fmtB(s.core.Bend)),
  ];
}
