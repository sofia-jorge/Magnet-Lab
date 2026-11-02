/** CSV e PDF. toCSV/pdfSafe são puros (testáveis); buildPDF recebe a classe jsPDF. */
import { sweepTurns, simulate } from './physics.js';
import { calcMemory, comparisonRows, num } from './report.js';
import { compareRows } from './experiments.js';

/** CSV para Excel pt-BR: separador ';', decimal ',', UTF-8 com BOM. */
export function toCSV(rows) {
  const cell = v => { const s = typeof v === 'number' ? (Number.isFinite(v) ? String(v).replace('.', ',') : '') : String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return '\ufeff' + rows.map(r => r.map(cell).join(';')).join('\r\n');
}
export const csvSweep = base => [['ORIGEM: SIMULADO (motor físico) — não são medições'], ['espiras', 'fio_m', 'R_ohm', 'I_A', 'P_bobina_W', 'B_nucleo_T(estimativa didática)', 'B_ar_centro_T'], ...sweepTurns(base).map(r => [r.N, r.L, r.R, r.I, r.P, r.B, r.Bair])];
export function csvCompare(tests, base) {
  const rows = [['grandeza', 'unidade', 'teste', 'espiras', 'TEORIA', 'SIMULACAO', 'EXPERIMENTO (inserido pelo grupo)', 'desvio_exp_vs_sim_%']];
  for (const t of tests) for (const r of compareRows(t, base)) rows.push([r.label, r.unit, t.name, t.turns, r.theory, r.sim, r.exp ?? '', r.dev ?? '']);
  return rows;
}
/** jsPDF usa WinAnsi: troca símbolos fora dessa faixa por equivalentes ASCII. */
export function pdfSafe(t) {
  const map = { 'Ω': 'ohm', 'ρ': 'rho', 'μ': 'µ', 'π': 'pi', 'χ': 'chi', 'α': 'alfa', 'Δ': 'delta', '→': '->', '⇒': '=>', '≈': '~', '≤': '<=', '≥': '>=', '−': '-', '√': 'raiz', 'Σ': 'soma', '∇': 'div', '⊙': '(saindo)', '⊗': '(entrando)', '⚠': '[!]', '₀': '0', '₁': '1', '₂': '2', '₃': '3', 'ₖ': 'k', 'ₙ': 'n', '₍': '(', '₎': ')', '·': '·', '∝': 'prop.', '⁻': '-', '⁰': '0', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '–': '-', '—': '-', '“': '"', '”': '"', '’': "'" };
  return String(t).replace(/[^\x00-\xff]/g, c => map[c] ?? '?').replace(/[\u0080-\u009f]/g, '?');
}
export function buildPDF(JsPDF, { base, tests, title, notes, chartImages = [] }) {
  const doc = new JsPDF({ unit: 'mm', format: 'a4' }), M = 15, PW = 210 - 2 * M; let y = M;
  const room = h => { if (y + h > 285) { doc.addPage(); y = M; } };
  const T = (txt, size = 10, bold = false, color = 0) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(color); for (const l of doc.splitTextToSize(pdfSafe(txt), PW)) { room(size * 0.45); doc.text(l, M, y); y += size * 0.45; } y += 1.2; };
  const row = (cells, xs, bold = false) => { room(5); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(8.5); cells.forEach((c, i) => doc.text(pdfSafe(c).slice(0, i ? 34 : 44), xs[i], y)); y += 4.4; };
  const s = simulate(base), c = s.circuit, g = s.geo, p = s.params;
  T('MAGNET LAB - Laboratório Virtual de Eletromagnetismo', 15, true); T(title || 'Análise do campo magnético de um eletroímã em função do número de espiras', 11, true);
  T(`Data: ${new Date().toLocaleString('pt-BR')}   |   Projeto A3 - Tema 3: Eletroímã - UNA Contagem`, 9);
  T('LEGENDA DE ORIGEM: TEORIA = fórmulas do relatório (geometria nominal). SIMULADO = motor físico do site (geometria em camadas, Biot-Savart). EXPERIMENTAL = valores MEDIDOS e inseridos pelo grupo. Nada calculado é apresentado como medido.', 8.5, false, 90);
  T('1. Configuração', 12, true);
  T(`Fonte: ${num(p.voltage)} V, resistência interna ${num(p.internalResistance)} ohm (SUPOSIÇÃO se não medida), R externa ${num(p.externalResistance)} ohm, circuito ${p.closed ? 'fechado' : 'aberto'}${p.reversed ? ', corrente invertida' : ''}.`);
  T(`Fio: ${p.wireMaterial}, d = ${num(p.wireDiameter * 1e3)} mm (ext. ${num(g.dOut * 1e3)} mm), ${p.turns} espiras em ${g.layers.length} camada(s), raio interno ${num(p.coilInnerRadius * 1e3)} mm, comprimento máx. ${num(p.coilMaxLength * 1e3)} mm, ${p.temperature} °C.`);
  T(`Núcleo: ${p.coreMaterial}, ${num(p.coreLength * 1e3)} mm x ${num(p.coreDiameter * 1e3)} mm, mu_r ADOTADO = ${num(s.core.mur)} (modelo didático, sem histerese).`);
  T('2. Memória de cálculo (SIMULADO)', 12, true); for (const m of calcMemory(s)) { T(m.title, 10, true); T(`Fórmula: ${m.formula}`, 8.5); T(`Substituição: ${m.subst}`, 8.5); T(m.result, 9, true); }
  T('3. Experimentos A/B/C (TEÓRICO/SIMULADO - não medido)', 12, true); const xs = [M, M + 62, M + 100, M + 140]; row(['Grandeza', 'A - 50', 'B - 100', 'C - 150'], xs, true);
  for (const r of comparisonRows(base)) row([r.label, ...r.values], xs);
  T('4. Dados experimentais do protótipo (MEDIDOS pelo grupo)', 12, true);
  const filled = tests.filter(t => ['voltageOpen', 'voltage', 'resistance', 'current', 'field_mT', 'fieldEnd_mT', 'clips'].some(k => t[k] != null));
  if (!filled.length) T('Nenhum dado experimental foi inserido até o momento.');
  for (const t of tests) { T(`${t.name} - ${t.turns} espiras`, 10, true); T(`E aberto: ${t.voltageOpen ?? '-'} V | V terminais: ${t.voltage ?? '-'} V | R: ${t.resistance ?? '-'} ohm | I: ${t.current ?? '-'} A | B centro: ${t.field_mT ?? '-'} mT | B extremidade: ${t.fieldEnd_mT ?? '-'} mT (${t.fieldPos || 'local não informado'}) | clipes: ${t.clips ?? '-'}`, 8.5); if (t.notes) T(`Obs.: ${t.notes}`, 8.5); }
  T('5. Comparação teoria x simulação x experimento', 12, true); const xc = [M, M + 58, M + 88, M + 118, M + 150];
  for (const t of tests) { T(`${t.name} (${t.turns} espiras)`, 9.5, true); row(['Grandeza', 'Teoria', 'Simulação', 'Experimento', 'Desvio exp/sim'], xc, true);
    for (const r of compareRows(t, base)) row([`${r.label} (${r.unit})`, typeof r.theory === 'number' ? num(r.theory, 4) : 'hipótese', typeof r.sim === 'number' ? num(r.sim, 4) : 'n/d', r.exp == null ? '(não medido)' : num(r.exp, 4), r.dev == null ? '-' : `${num(r.dev, 3)} %`], xc); }
  if (chartImages.length) { T('6. Gráficos (curvas = SIMULADO; marcadores em 50/100/150 e valor atual)', 12, true); const w = PW / 2 - 2, h = w * 0.62;
    chartImages.forEach((im, i) => { if (i % 2 === 0) room(h + 4); const x = M + (i % 2) * (w + 4); doc.addImage(im.url, 'PNG', x, y, w, h); if (i % 2 === 1 || i === chartImages.length - 1) y += h + 4; }); }
  T('7. Observações do grupo', 12, true); T(notes || '(sem observações)');
  T('8. Limitações do modelo', 12, true); T('Campo da bobina por Biot-Savart (anéis circulares); núcleo por modelo didático 1D de magnetização autoconsistente no eixo (mu_r adotado, saturação tanh, sem histerese, parafuso fino, H uniforme na seção). Resistência interna da pilha pode ser suposição. Sem aquecimento. Número de clipes não é previsto pelo modelo. Resultados virtuais não substituem medições.', 9);
  return doc;
}
