import { simulate, sweepTurns, DEFAULTS, WIRE_MATERIALS, CORE_MATERIALS } from './physics.js';
import { createScene2D } from './simulation2d.js';
import { TEST_FIELDS, defaultTests, newTest, parseNum, compareRows, calibrateSource } from './experiments.js';
import { loadTests, saveTests, listSims, saveSim, deleteSim, buildExportJSON, parseImport } from './storage.js';
import { toCSV, csvSweep, csvCompare, buildPDF } from './export.js';
import { GLOSSARY, formulaCards, whyMoreTurns } from './education.js';
import { createCrane } from './crane.js';
import { calcMemory, comparisonRows, fmtB, num } from './report.js';

// scale: valor_SI = valor_exibido × scale
const FIELDS = [
  { key: 'turns', label: 'Número de espiras', unit: '', scale: 1, min: 1, max: 200, step: 1 },
  { key: 'voltage', label: 'Tensão da pilha', unit: 'V', scale: 1, min: 0, max: 3, step: 0.01 },
  { key: 'internalResistance', label: 'Resistência interna da pilha', unit: 'Ω', scale: 1, min: 0, max: 5, step: 0.01 },
  { key: 'externalResistance', label: 'Resistência externa em série', unit: 'Ω', scale: 1, min: 0, max: 20, step: 0.1 },
  { key: 'wireDiameter', label: 'Diâmetro do fio (cobre)', unit: 'mm', scale: 1e-3, min: 0.1, max: 1, step: 0.01 },
  { key: 'coilMaxLength', label: 'Comprimento máx. da bobina', unit: 'mm', scale: 1e-3, min: 5, max: 85, step: 1 },
  { key: 'coilInnerRadius', label: 'Raio interno da bobina', unit: 'mm', scale: 1e-3, min: 1, max: 15, step: 0.1 },
  { key: 'coilOffset', label: 'Deslocamento da bobina no parafuso (+ = lado da cabeça)', unit: 'mm', scale: 1e-3, min: -60, max: 60, step: 0.5 },
  { key: 'coreLength', label: 'Comprimento do parafuso', unit: 'mm', scale: 1e-3, min: 10, max: 200, step: 1 },
  { key: 'coreDiameter', label: 'Diâmetro do parafuso', unit: 'mm', scale: 1e-3, min: 2, max: 20, step: 0.1 },
  { key: 'temperature', label: 'Temperatura do fio', unit: '°C', scale: 1, min: -20, max: 150, step: 1 },
];
let scene3d = null; let state = { ...DEFAULTS }; const $ = id => document.getElementById(id);

// ---- construção dos controles
const host = $('fields');
const mkSelect = (key, label, table) => { const d = document.createElement('div'); d.className = 'f';
  d.innerHTML = `<label>${label}</label><select id="${key}">${Object.entries(table).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select>`; host.append(d);
  d.querySelector('select').onchange = e => { state[key] = e.target.value; render(); }; };
mkSelect('wireMaterial', 'Material do fio', WIRE_MATERIALS); mkSelect('coreMaterial', 'Material do núcleo', CORE_MATERIALS);
for (const f of FIELDS) { const d = document.createElement('div'); d.className = 'f';
  d.innerHTML = `<label>${f.label}<span>${f.unit}</span></label><div class="row"><input type="range" id="r_${f.key}" min="${f.min}" max="${f.max}" step="${f.step}"><input type="number" id="n_${f.key}" min="${f.min}" max="${f.max}" step="${f.step}"></div>`;
  host.append(d); const set = e => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) { state[f.key] = v * f.scale; render(); } };
  d.querySelector('[type=range]').oninput = set; d.querySelector('[type=number]').oninput = set; }
{ const d = document.createElement('div'); d.className = 'f';
  d.innerHTML = `<label>μr do núcleo (vazio = padrão do material; valor ADOTADO)<span></span></label><div class="row"><input type="number" id="mur" min="1" step="1" placeholder="auto"></div>`; host.append(d);
  d.querySelector('input').oninput = e => { const v = parseFloat(e.target.value); state.coreMurOverride = Number.isFinite(v) && v >= 1 ? v : null; render(); }; }
$('closed').onchange = e => { state.closed = e.target.checked; render(); };
$('reversed').onchange = e => { state.reversed = e.target.checked; render(); };
document.querySelectorAll('.presets button').forEach(b => b.onclick = () => { state.turns = +b.dataset.n; render(); });
$('reset').onclick = () => { state = { ...DEFAULTS }; $('mur').value = ''; render(); };

// ---- gráficos (Chart.js) — dados vêm de sweepTurns(), o MESMO motor
const CH = [
  { id: 'R', title: 'Espiras × Resistência da bobina (Ω)', ds: [{ k: 'R', n: 'R (Ω)', c: '#d98a4e' }] },
  { id: 'I', title: 'Espiras × Corrente (A)', ds: [{ k: 'I', n: 'I (A)', c: '#27d3ff' }] },
  { id: 'B', title: 'Espiras × Campo no centro (mT)', ds: [{ k: 'B', n: 'B núcleo, centro (mT)', c: '#2f7bff', s: 1e3 }, { k: 'Bend', n: 'B extremidade (mT)', c: '#ff5468', s: 1e3 }, { k: 'Bair', n: 'B ar (mT)', c: '#8fa6cc', s: 1e3 }] },
  { id: 'P', title: 'Espiras × Potência na bobina (W)', ds: [{ k: 'P', n: 'P (W)', c: '#ffb020' }] },
];
const charts = {};
if (window.Chart) for (const c of CH) { const box = document.createElement('div'); box.innerHTML = `<canvas id="c_${c.id}"></canvas>`; $('charts').append(box);
  charts[c.id] = new Chart(box.firstChild, { type: 'line', data: { datasets: [] }, options: { responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
    plugins: { title: { display: true, text: c.title, color: '#e9f1ff' }, legend: { labels: { color: '#8fa6cc' } } },
    scales: { x: { type: 'linear', min: 1, max: 200, title: { display: true, text: 'Número de espiras', color: '#8fa6cc' }, ticks: { color: '#8fa6cc' }, grid: { color: '#1d3a73' } }, y: { beginAtZero: true, ticks: { color: '#8fa6cc' }, grid: { color: '#1d3a73' } } } } }); }
else $('charts').textContent = 'Chart.js não carregou (sem internet?). Os cálculos acima continuam válidos.';

function render() {
  const s = simulate(state); state = { ...s.params, coreMurOverride: state.coreMurOverride }; // mostra valores já validados
  for (const f of FIELDS) { const v = +(s.params[f.key] / f.scale).toFixed(4); $('r_' + f.key).value = v; const n = $('n_' + f.key); if (document.activeElement !== n) n.value = v; }
  $('wireMaterial').value = s.params.wireMaterial; $('coreMaterial').value = s.params.coreMaterial; $('closed').checked = s.params.closed; $('reversed').checked = s.params.reversed;
  const c = s.circuit, cards = [['Fio total', `${num(s.geo.wireLength, 3)} m`, 'cu'], ['Camadas', s.geo.layers.length, ''], ['Resistência da bobina', `${num(c.Rcoil, 3)} Ω`, 'cu'], ['Corrente', `${num(c.Isigned, 3)} A`, ''],
    ['Tensão nos terminais', `${num(c.Vterminal, 3)} V`, ''], ['Potência na bobina', `${num(c.Pcoil, 3)} W`, ''], ['B no ar (centro)', fmtB(s.core.Bair), ''], ['B no núcleo, centro da bobina (est.)', fmtB(s.core.Bcore), ''], ['B na extremidade do parafuso (est.)', fmtB(s.core.Bend), ''],
    ['Saturação do núcleo', `${num(s.core.saturation * 100, 3)} %`, ''], ['Polo norte', s.pole ?? 'sem corrente', '']];
  $('cards').innerHTML = cards.map(([l, v, k]) => `<div class="card ${k}"><span>${l}</span><b>${v}</b></div>`).join('');
  $('warns').innerHTML = [...s.fixes.map(t => ({ level: 'info', text: 'Valor corrigido — ' + t })), ...s.warnings].map(w => `<div class="warn ${w.level}">${w.text}</div>`).join('');
  $('memory').innerHTML = calcMemory(s).map(m => `<div class="mem"><h3>${m.title}</h3><pre>Fórmula: ${m.formula}</pre><pre>Substituição: ${m.subst}</pre><pre class="r">${m.result}</pre></div>`).join('');
  const rows = comparisonRows(state);
  $('cmp').innerHTML = `<tr><th>Grandeza (TEÓRICO/SIMULADO)</th><th>A — 50</th><th>B — 100</th><th>C — 150</th></tr>` + rows.map(r => `<tr><td>${r.label}</td>${r.values.map(v => `<td>${v}</td>`).join('')}</tr>`).join('');
  if ($('note3d')) $('note3d').textContent = `Escala real (1 unidade = 1 mm): ${s.params.turns} espiras em ${s.geo.layers.length} camada(s), fio com d_ext = ${num(s.geo.dOut * 1e3)} mm (sem ampliação) — use o zoom. Cabos de ligação e posição da pilha são esquemáticos. Pontos amarelos = sentido convencional; velocidade visual ∝ |I|, não é a dos portadores. Linhas de campo: campo TOTAL = Biot–Savart (anéis) da bobina (até 48 anéis equivalentes) + 32 anéis equivalentes à magnetização do núcleo (modelo didático 1D, μr adotado, sem histerese). Linhas cortadas a 150 mm.`;
  lastSim = s; crane.setCircuit(s.params.closed && s.circuit.I > 0); renderChain(); renderEdu(s); renderCompare(); scene2d.update(s); scene3d?.update(s);
  if (window.Chart) { const sw = sweepTurns(state);
    for (const c of CH) { const ch = charts[c.id], sets = [];
      for (const d of c.ds) { const sc = d.s ?? 1; sets.push({ label: d.n, data: sw.map(r => ({ x: r.N, y: r[d.k] * sc })), borderColor: d.c, pointRadius: 0, borderWidth: 2 });
        sets.push({ label: '50/100/150', data: [50, 100, 150].map(N => ({ x: N, y: sw[N - 1][d.k] * sc })), borderColor: d.c, backgroundColor: d.c, showLine: false, pointRadius: 5 });
        sets.push({ label: 'atual', data: [{ x: s.params.turns, y: sw[s.params.turns - 1][d.k] * sc }], borderColor: '#fff', backgroundColor: d.c, showLine: false, pointStyle: 'rectRot', pointRadius: 8 }); }
      ch.data.datasets = sets; ch.update('none'); } }
}
let tests = loadTests() || defaultTests();
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const persist = () => { if (!saveTests(tests)) msg('Aviso: não foi possível salvar no navegador (armazenamento bloqueado).'); };
const msg = t => { $('stMsg').textContent = t; };
function renderTests() {
  $('tests').innerHTML = tests.map(t => `<div class="tcard" data-id="${t.id}"><div class="row"><input data-k="name" value="${esc(t.name)}" style="max-width:240px;font-weight:700"></div><div class="grid">` +
    TEST_FIELDS.map(([k, l, u]) => `<div><label>${l}${u ? ' (' + u + ')' : ''}</label><input data-k="${k}" inputmode="decimal" value="${t[k] ?? ''}" placeholder="${k === 'turns' ? '' : 'vazio'}"></div>`).join('') +
    `<div style="grid-column:1/-1"><label>Observações do experimento</label><textarea data-k="notes" rows="2">${esc(t.notes)}</textarea></div></div>
    <div class="acts"><button data-a="sim">Simular este teste</button><button data-a="cal">Calibrar pilha (E e r)</button><button data-a="del" style="background:#7a2638">Excluir</button></div></div>`).join('');
}
$('tests').addEventListener('input', e => { const card = e.target.closest('.tcard'), k = e.target.dataset.k; if (!card || !k) return; const t = tests.find(x => x.id === card.dataset.id);
  if (k === 'name' || k === 'notes' || k === 'fieldPos') t[k] = e.target.value; else if (k === 'turns') { const v = Math.round(parseNum(e.target.value)); e.target.classList.toggle('bad', !(v >= 1 && v <= 200)); if (v >= 1 && v <= 200) t.turns = v; }
  else { const v = parseNum(e.target.value); e.target.classList.toggle('bad', e.target.value.trim() !== '' && v === null); t[k] = v; }
  persist(); renderCompare(); });
$('tests').addEventListener('click', e => { const a = e.target.dataset.a, card = e.target.closest('.tcard'); if (!a || !card) return; const t = tests.find(x => x.id === card.dataset.id);
  if (a === 'del') { if (confirm(`Excluir "${t.name}"?`)) { tests = tests.filter(x => x !== t); persist(); renderTests(); renderCompare(); } }
  if (a === 'sim') { state.turns = t.turns; render(); msg(`Simulando ${t.turns} espiras com a configuração do painel.`); }
  if (a === 'cal') { const c = calibrateSource(t); if (!c) return msg('Calibração requer: tensão em aberto, tensão nos terminais e corrente > 0 (com Vt ≤ E).'); state.voltage = c.voltage; state.internalResistance = c.internalResistance; state.turns = t.turns; render(); msg(`Pilha calibrada: E = ${num(c.voltage)} V, r = ${num(c.internalResistance)} Ω (inclui contatos/cabos). Atenção: corrente e tensão deste teste deixam de ser verificação independente.`); } });
$('addTest').onclick = () => { tests.push(newTest(tests.length + 1, 50)); persist(); renderTests(); renderCompare(); };
function renderCompare() {
  const f = v => (typeof v === 'number' ? num(v, 4) : `<span class="na">${esc(v)}</span>`);
  $('cmpExp').innerHTML = '<tr><th>Grandeza</th><th>TEORIA (calculada)</th><th>SIMULAÇÃO (modelo)</th><th>EXPERIMENTO (inserido)</th><th>Desvio exp/sim</th></tr>' +
    (tests.length ? tests.map(t => `<tr><th colspan="5" style="text-align:left">${esc(t.name)} — ${t.turns} espiras</th></tr>` + compareRows(t, state).map(r => `<tr><td>${r.label} (${r.unit})</td><td>${f(r.theory)}</td><td>${f(r.sim)}</td>` +
      (r.exp == null ? '<td class="na">(não medido)</td>' : `<td class="exp">${num(r.exp, 4)}</td>`) + `<td>${r.dev == null ? '—' : num(r.dev, 3) + ' %'}</td></tr>`).join('')).join('') : '<tr><td colspan="5">Nenhum teste.</td></tr>');
}
function renderSaved() { const l = listSims(); $('savedList').innerHTML = l.length ? '<b>Simulações salvas:</b>' + l.map(s => `<div class="saved" data-id="${s.id}"><span>${esc(s.name)} — ${new Date(s.savedAt).toLocaleString('pt-BR')} — ${s.params.turns} espiras · R=${num(s.summary.R, 3)} Ω · I=${num(s.summary.I, 3)} A</span><button data-s="load">Carregar</button><button data-s="del">Excluir</button></div>`).join('') : ''; }
$('savedList').onclick = e => { const id = e.target.closest('.saved')?.dataset.id, a = e.target.dataset.s; if (!id) return; const s = listSims().find(x => x.id === id);
  if (a === 'load' && s) { state = { ...DEFAULTS, ...s.params }; render(); msg('Simulação carregada.'); } if (a === 'del') { deleteSim(id); renderSaved(); } };
$('saveSim').onclick = () => { const s = simulate(state); const ok = saveSim($('simName').value, s.params, { R: s.circuit.Rcoil, I: s.circuit.I, B: s.core.Bair }); msg(ok ? 'Simulação salva neste navegador (captura da configuração e dos resultados).' : 'Falha ao salvar (armazenamento bloqueado ou cheio).'); renderSaved(); };
const dlBlob = (data, name, type) => { const u = URL.createObjectURL(new Blob([data], { type })); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 2000); };
$('expJSON').onclick = () => dlBlob(JSON.stringify(buildExportJSON(simulate(state).params, tests, { titulo: $('expTitle').value, observacoes: $('expNotes').value }), null, 2), 'magnetlab.json', 'application/json');
$('impJSON').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const r = parseImport(await f.text()); state = { ...DEFAULTS, ...r.params }; tests = r.tests.length ? r.tests : defaultTests(); persist(); renderTests(); render(); msg(`Importado: ${tests.length} teste(s) e configuração (valores validados).`); } catch (err) { msg('Importação falhou: ' + err.message); } e.target.value = ''; };
$('expCSV1').onclick = () => dlBlob(toCSV(csvSweep(state)), 'magnetlab-simulacao.csv', 'text/csv;charset=utf-8');
$('expCSV2').onclick = () => dlBlob(toCSV(csvCompare(tests, state)), 'magnetlab-comparacao.csv', 'text/csv;charset=utf-8');
$('expPDF').onclick = () => { if (!window.jspdf) return msg('jsPDF não carregou (requer internet).');
  const imgs = Object.entries(charts).map(([id, ch]) => { const c = document.createElement('canvas'); c.width = ch.canvas.width; c.height = ch.canvas.height; const g = c.getContext('2d'); g.fillStyle = '#061126'; g.fillRect(0, 0, c.width, c.height); g.drawImage(ch.canvas, 0, 0); return { id, url: c.toDataURL('image/png') }; });
  try { buildPDF(window.jspdf.jsPDF, { base: state, tests, title: $('expTitle').value, notes: $('expNotes').value, chartImages: imgs }).save('magnetlab-relatorio.pdf'); msg('PDF gerado.'); } catch (err) { msg('Falha ao gerar PDF: ' + err.message); } };
renderTests(); renderSaved();
const chainBox = (l, v, on) => `<div class="${on ? 'on' : ''}"><span>${l}</span><b>${v}</b></div>`;
let lastSim = null;
const renderChain = () => { if (!lastSim) return; const s = lastSim, on = crane.isOn();
  $('chain').innerHTML = chainBox('1 · Energia elétrica', `pilha ${num(s.params.voltage)} V`, s.params.closed) + chainBox('2 · Corrente elétrica', `${num(s.circuit.I, 3)} A`, s.circuit.I > 0) +
    chainBox('3 · Campo magnético (bobina no ar)', fmtB(s.core.Bair), s.circuit.I > 0) + chainBox('4 · Atração do ferro', on ? 'ATIVA (guindaste ligado)' : 'sem atração sustentada', on); };
const crane = createCrane($('crane'), () => { renderChain(); $('cPower').textContent = crane.isOn() ? 'Desligar alimentação' : 'Ligar alimentação'; });
$('cPower').onclick = () => { crane.togglePower(); $('cPower').textContent = crane.isOn() ? 'Desligar alimentação' : 'Ligar alimentação'; };
$('cX').oninput = e => crane.setX(e.target.value); $('cY').oninput = e => crane.setY(e.target.value); $('cRes').onchange = e => crane.setResidual(e.target.checked);
$('cAuto').onclick = () => crane.runSequence((x, y) => { $('cX').value = x; $('cY').value = y; });
$('cReset').onclick = () => { const v = crane.reset(); $('cX').value = v.x; $('cY').value = v.y; $('cPower').textContent = 'Ligar alimentação'; };
const go = id => $(id).scrollIntoView({ behavior: 'smooth' });
$('goSim').onclick = () => go('sim'); $('goFisica').onclick = () => go('fisica'); $('goExp').onclick = () => go('exps');
$('glossary').innerHTML = GLOSSARY.map(([t, d]) => `<details class="card2"><summary>${t}</summary><p>${d}</p></details>`).join('');
function renderEdu(s) {
  const open = [...$('formulas').querySelectorAll('details')].map(d => d.open);
  $('formulas').innerHTML = formulaCards(state).map(f => `<details class="card2"><summary>${f.name}</summary><div class="expr">${f.expr}</div><p><b>O que calcula:</b> ${f.what}</p>
    <table>${f.vars.map(v => `<tr><td><b>${v[0]}</b></td><td>${v[1]}</td><td>[${v[2]}]</td></tr>`).join('')}</table><p class="ex"><b>Exemplo (sua configuração atual):</b> ${f.example}</p><p><b>No nosso eletroímã:</b> ${f.usage}</p></details>`).join('');
  $('formulas').querySelectorAll('details').forEach((d, i) => { d.open = !!open[i]; });
  const w = whyMoreTurns(state);
  $('why').innerHTML = `<div class="why">${w.paragraphs.map(p => `<p>${p}</p>`).join('')}<div class="scroll"><table><tr><th>Espiras</th><th>Camadas</th><th>Fio (m)</th><th>R bobina (Ω)</th><th>R bobina / r pilha</th><th>I (A)</th><th>N·I (A·espira)</th><th>B ar, centro</th><th>B núcleo, centro</th><th>B extremidade</th></tr>` +
    w.rows.map(r => `<tr><td>${r.N}</td><td>${r.layers}</td><td>${num(r.L, 3)}</td><td>${num(r.R, 3)}</td><td>${num(r.ratio, 3)}</td><td>${num(r.I, 3)}</td><td>${num(r.NI, 3)}</td><td>${fmtB(r.B)}</td><td>${fmtB(r.Bc)}</td><td>${fmtB(r.Be)}</td></tr>`).join('') + '</table></div></div>';
}
const probeOut = d => {
  const unit = B => { const a = Math.abs(B); return a >= 1e-3 ? `${num(B * 1e3, 4)} mT` : `${num(B * 1e6, 4)} µT`; };
  if (document.activeElement !== $('px')) $('px').value = +d.x.toFixed(2); if (document.activeElement !== $('py')) $('py').value = +d.y.toFixed(2);
  $('probeOut').textContent = (d.closed ? '' : 'Circuito aberto: I = 0 ⇒ B = 0 (campo da corrente; sem magnetismo residual no modelo).\n') +
    `ESTIMATIVA TEÓRICA (não é medição)\n|B| = ${unit(d.B)}  =  ${num(d.B, 4)} T\nB_eixo (Bx) = ${unit(d.Bx)}   B_radial (By) = ${unit(d.By)}\nPosição: x = ${num(d.x, 4)} mm (eixo, + = cabeça), y = ${num(d.y, 4)} mm\n` +
    (d.withCore ? 'Modelo: Biot–Savart exato (anéis) da bobina + anéis equivalentes à magnetização do núcleo (modelo didático 1D, μr adotado, sem histerese).' : 'Modelo: Biot–Savart exato para anéis circulares, bobina no ar (sem núcleo ferromagnético).') + (d.near ? '\n⚠ Sonda dentro/encostada no fio: o modelo filamentar não é válido aqui.' : '');
};
const scene2d = createScene2D($('view2d'), probeOut);
const ro2 = () => ({ heat: $('o2_heat').checked, field: $('o2_field').checked, vectors: $('o2_vec').checked, current: $('o2_cur').checked });
['o2_heat', 'o2_field', 'o2_vec', 'o2_cur'].forEach(id => $(id).onchange = () => scene2d.setOptions(ro2()));
$('o2_reset').onclick = () => scene2d.resetView(); $('pcenter').onclick = () => scene2d.setProbe(0, 0);
$('px').oninput = $('py').oninput = () => scene2d.setProbe(parseFloat($('px').value), parseFloat($('py').value));
const dl = (url, name) => { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); };
$('snap2').onclick = () => dl(scene2d.snapshot(), `magnetlab-2d-${state.turns}espiras.png`);
$('tab2d').onclick = () => { $('v2').hidden = false; $('v3').hidden = true; $('tab2d').classList.add('on'); $('tab3d').classList.remove('on'); };
$('tab3d').onclick = () => { $('v2').hidden = true; $('v3').hidden = false; $('tab3d').classList.add('on'); $('tab2d').classList.remove('on'); };
const readOpts = () => ({ field: $('o_field').checked, current: $('o_current').checked, animate: $('o_anim').checked });
['o_field', 'o_current', 'o_anim'].forEach(id => $(id).onchange = () => scene3d?.setOptions(readOpts()));
$('snap').onclick = () => { if (!scene3d) return; const a = document.createElement('a'); a.href = scene3d.snapshot(); a.download = `magnetlab-3d-${state.turns}espiras.png`; a.click(); };
import('./simulation3d.js').then(mod => { scene3d = mod.createScene3D($('view3d')); scene3d?.setOptions(readOpts()); render(); })
  .catch(e => { $('view3d').textContent = '3D não carregou (Three.js via CDN requer internet): ' + e.message; });
render();
