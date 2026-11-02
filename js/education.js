/** Conteúdo educativo. Exemplos e a seção "mais espiras" são GERADOS pelo motor (mesmos números do restante do site). */
import { simulate, MU0 } from './physics.js';
import { num, fmtB } from './report.js';

export const GLOSSARY = [
  ['Corrente elétrica', 'Movimento ordenado de cargas. Mede-se em ampère (A) = coulomb por segundo. Por convenção, o sentido da corrente vai do polo + para o polo − da pilha.'],
  ['Tensão elétrica', 'Diferença de potencial (V): energia fornecida por unidade de carga. Uma pilha AA tem 1,5 V nominais, mas a tensão nos terminais cai quando ela fornece corrente, por causa da resistência interna.'],
  ['Resistência elétrica', 'Oposição à passagem de corrente (Ω). Um fio mais comprido ou mais fino tem resistência maior.'],
  ['Lei de Ohm', 'V = R·I. Vale para condutores ôhmicos (como o cobre em temperatura constante). No circuito série: I = V/(R_bobina + r_pilha).'],
  ['Resistividade', 'Propriedade do material (Ω·m). Cobre a 20 °C: cerca de 1,68×10⁻⁸ Ω·m. Aumenta com a temperatura (≈ 0,39 % por °C no cobre).'],
  ['Bobina e espiras', 'Bobina é o fio enrolado; cada volta é uma espira. Os campos das espiras se somam no interior da bobina.'],
  ['Solenoide', 'Bobina em forma de hélice. Dentro dela o campo é aproximadamente uniforme; fora, parece o de um ímã de barra. A fórmula simples de campo vale para solenoides longos.'],
  ['Campo magnético (B)', 'Grandeza vetorial medida em tesla (T). É criada por correntes elétricas e por materiais magnetizados. O campo da Terra é cerca de 50 µT.'],
  ['Linhas de campo', 'Representação: em cada ponto são tangentes a B e formam curvas fechadas. Linhas mais próximas indicam campo mais intenso.'],
  ['Regra da mão direita', 'Curve os dedos no sentido da corrente nas espiras: o polegar aponta para o polo norte da bobina. Inverter a corrente troca os polos.'],
  ['Núcleo ferromagnético', 'Ferro ou aço dentro da bobina concentra o fluxo magnético e pode multiplicar o campo. Parafusos de inox ou latão quase não têm esse efeito.'],
  ['Permeabilidade magnética', 'μ = μ₀·μr, com μ₀ = 4π×10⁻⁷ T·m/A. O μr do ferro NÃO é constante: depende do material, do campo, da geometria e da história magnética. Neste site ele é um valor ADOTADO.'],
  ['Lei de Biot–Savart', 'O campo é a soma das contribuições de cada pedaço de fio: dB = (μ₀/4π)·I·dl × r̂ / r². Usamos essa lei (exata para anéis circulares) nas linhas de campo 2D e 3D.'],
  ['Potência elétrica', 'P = V·I = R·I² (watts). Na bobina, vira calor (efeito Joule). Potência alta em fio fino significa aquecimento.'],
  ['Saturação magnética', 'Quando todos os domínios do ferro já estão alinhados, aumentar a corrente quase não aumenta mais o campo do núcleo.'],
  ['Magnetismo residual', 'Depois de desligar a corrente, o ferro pode reter parte da magnetização (histerese). Ferro doce retém pouco; aço duro retém mais. O modelo do site não simula histerese.'],
  ['Aplicações', 'Guindastes de sucata, separadores de metais, relés, campainhas, freios, fechaduras, motores e geradores, equipamentos de ressonância magnética.'],
];

/** Fórmulas com exemplo numérico da configuração atual (vem de simulate()). */
export function formulaCards(base) {
  const s = simulate(base), p = s.params, c = s.circuit, g = s.geo, N = p.turns;
  return [
    { name: 'Resistência do fio', expr: 'R = ρ · L / A,    A = π (d/2)²', what: 'Resistência elétrica do fio enrolado.',
      vars: [['ρ', 'resistividade do material', 'Ω·m'], ['L', 'comprimento total do fio (da geometria da bobina)', 'm'], ['A', 'área da seção do fio', 'm²'], ['d', 'diâmetro do fio', 'm']],
      example: `ρ = ${num(s.rho)} Ω·m; L = ${num(g.wireLength)} m; A = ${num(s.A * 1e6)} mm²  ⇒  R = ${num(c.Rcoil)} Ω`, usage: `Com ${N} espiras, o fio tem ${num(g.wireLength)} m: mais espiras ⇒ mais fio ⇒ mais resistência.` },
    { name: 'Lei de Ohm no circuito série', expr: 'I = V / (R + r_int + R_ext)', what: 'Corrente que a pilha consegue fornecer.',
      vars: [['V', 'tensão da pilha (em aberto)', 'V'], ['R', 'resistência da bobina', 'Ω'], ['r_int', 'resistência interna da pilha', 'Ω'], ['I', 'corrente', 'A']],
      example: `I = ${num(p.voltage)} / (${num(c.Rcoil)} + ${num(p.internalResistance)} + ${num(p.externalResistance)}) = ${num(c.I)} A`, usage: 'A pilha NÃO fornece qualquer corrente: r_int limita e, com muita corrente, a tensão nos terminais cai.' },
    { name: 'Campo do solenoide longo (ideal)', expr: 'B = μ · N · I / ℓ', what: 'Campo no interior de um solenoide muito mais longo que largo.',
      vars: [['μ', 'permeabilidade do meio (ar: μ₀)', 'T·m/A'], ['N', 'número de espiras', '—'], ['I', 'corrente', 'A'], ['ℓ', 'comprimento do solenoide', 'm']],
      example: `μ₀·N·I/ℓ = ${num(MU0)} · ${N} · ${num(c.I)} / ${num(g.axialLength)} = ${fmtB(s.longSolenoidAir)}`, usage: 'É só uma aproximação: o nosso eletroímã é curto. O site usa o modelo finito (abaixo) e mostra essa fórmula apenas para comparação.' },
    { name: 'Solenoide finito (no eixo)', expr: 'B(z) = (μ₀ n I / 2) · [cos θ₁ + cos θ₂]', what: 'Campo no eixo de uma bobina de comprimento finito (somamos as camadas).',
      vars: [['n', 'espiras por metro (N/ℓ)', '1/m'], ['θ₁, θ₂', 'ângulos até as extremidades vistos do ponto', 'rad']], example: `Centro da bobina, no ar: B = ${fmtB(s.core.Bair)}`, usage: 'É o valor "B no ar" dos cartões. Com núcleo, o modelo didático estima outro valor (veja os avisos de limitação).' },
    { name: 'Potência elétrica', expr: 'P = R · I²    (fonte: P = V · I)', what: 'Energia por segundo dissipada na bobina (calor).',
      vars: [['R', 'resistência', 'Ω'], ['I', 'corrente', 'A'], ['P', 'potência', 'W']], example: `P = ${num(c.Rcoil)} · ${num(c.I)}² = ${num(c.Pcoil)} W (na bobina);  ${num(c.Pinternal)} W na pilha`, usage: 'Potência alta num fio fino e numa pilha pequena significa aquecimento: o protótipo não deve ficar ligado por muito tempo.' },
    { name: 'Lei de Biot–Savart', expr: 'dB = (μ₀ / 4π) · I · dl × r̂ / r²', what: 'Campo gerado por cada elemento de corrente.',
      vars: [['dl', 'elemento de fio', 'm'], ['r̂, r', 'direção e distância até o ponto', '—,m']], example: `Para um anel de raio a: B(eixo) = μ₀ I a² / [2 (a² + z²)^(3/2)]`, usage: 'Somamos todos os anéis da bobina para desenhar as linhas de campo e alimentar o gaussímetro virtual.' },
  ];
}

export const trend = (a, b) => (b > a * 1.005 ? 'aumentou' : b < a * 0.995 ? 'diminuiu' : 'praticamente não mudou');

/** "Por que mais espiras não significa necessariamente mais força?" — texto montado a partir dos números do motor. */
export function whyMoreTurns(base) {
  const S = [50, 100, 150].map(N => simulate({ ...base, turns: N })), r = i => S[i].circuit, rows = S.map(s => ({ N: s.params.turns, L: s.geo.wireLength, R: s.circuit.Rcoil, ratio: s.circuit.Rcoil / (s.params.internalResistance + s.params.externalResistance || NaN), I: s.circuit.I, NI: s.params.turns * s.circuit.I, B: Math.abs(s.core.Bair), Bc: Math.abs(s.core.Bcore), Be: Math.abs(s.core.Bend), layers: s.geo.layers.length }));
  const step = (i, j) => `De ${rows[i].N} para ${rows[j].N} espiras: o fio ${trend(rows[i].L, rows[j].L)} (${num(rows[i].L, 3)} → ${num(rows[j].L, 3)} m), a corrente ${trend(rows[i].I, rows[j].I)} (${num(rows[i].I, 3)} → ${num(rows[j].I, 3)} A), N·I ${trend(rows[i].NI, rows[j].NI)} (${num(rows[i].NI, 3)} → ${num(rows[j].NI, 3)} A·espira) e o campo no ar, no centro, ${trend(rows[i].B, rows[j].B)} (${fmtB(rows[i].B)} → ${fmtB(rows[j].B)}).`;
  return { rows, paragraphs: [
    'O campo magnético depende do produto N·I (ampère-espiras) e da geometria, não só de N. Mais espiras exigem mais fio; mais fio tem mais resistência; mais resistência reduz a corrente fornecida pela pilha.',
    'Em termos simples: I = V/(R_bobina + r_pilha) e R_bobina cresce com N. Se R_bobina é muito menor que r_pilha, a corrente quase não cai e mais espiras ajudam. Se R_bobina passa a dominar, N·I tende a ficar constante (N cresce, I cai na mesma proporção) e o campo para de crescer — enquanto o calor e o consumo continuam.',
    step(0, 1), step(1, 2),
    rows[0].Bc !== rows[0].B ? `Com o núcleo (modelo didático): de ${rows[0].N} para ${rows[1].N} espiras o campo no centro da bobina ${trend(rows[0].Bc, rows[1].Bc)} (${fmtB(rows[0].Bc)} → ${fmtB(rows[1].Bc)}) e na extremidade do parafuso ${trend(rows[0].Be, rows[1].Be)} (${fmtB(rows[0].Be)} → ${fmtB(rows[1].Be)}); de ${rows[1].N} para ${rows[2].N}: centro ${trend(rows[1].Bc, rows[2].Bc)} (→ ${fmtB(rows[2].Bc)}), extremidade ${trend(rows[1].Be, rows[2].Be)} (→ ${fmtB(rows[2].Be)}). Como a bobina cobre só parte do parafuso e o fluxo se espalha, o tamanho e a POSIÇÃO da bobina no parafuso importam tanto quanto N — e os clipes são atraídos na extremidade, onde o campo é bem menor que no centro.` : '',
    rows[2].layers > rows[0].layers ? `Há também um efeito geométrico: com ${rows[2].N} espiras o fio passa a ter ${rows[2].layers} camadas; as camadas externas têm raio maior (mais fio por espira) e ficam mais longe do eixo.` : '',
    'Isto vem do modelo; a confirmação é a medição no protótipo (resistência, corrente, campo e clipes). Número de clipes depende também do núcleo, do contato e do peso dos clipes, e não é previsto aqui.',
  ].filter(Boolean) };
}
