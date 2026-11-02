/** Persistência local (localStorage) e import/export JSON. Simulação e experimento ficam em chaves SEPARADAS. */
import { sanitize } from './physics.js';
const KEY = { sims: 'magnetlab.simulacoes.v1', exp: 'magnetlab.experimentos.v1' };
const ls = () => (typeof localStorage !== 'undefined' ? localStorage : null);
function read(k, fb) { try { const v = JSON.parse(ls()?.getItem(k)); return v ?? fb; } catch { return fb; } }
function write(k, v) { try { ls().setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
export const loadTests = () => { const t = read(KEY.exp, null); return Array.isArray(t) && t.length ? t : null; };
export const saveTests = t => write(KEY.exp, t);
export const listSims = () => read(KEY.sims, []);
export function saveSim(name, params, summary) { const l = listSims(); l.unshift({ id: Date.now().toString(36), name: name || 'Simulação', savedAt: new Date().toISOString(), params, summary }); return write(KEY.sims, l.slice(0, 50)); }
export const deleteSim = id => write(KEY.sims, listSims().filter(s => s.id !== id));

export const buildExportJSON = (params, tests, extra = {}) => ({ app: 'MAGNET LAB', schema: 1, exportedAt: new Date().toISOString(), ...extra,
  simulation: { params, nota: 'configuração usada nos valores TEÓRICOS/SIMULADOS' }, experimental: { tests, nota: 'valores MEDIDOS pelo grupo (armazenados separadamente)' } });
/** Valida um JSON importado; parâmetros passam por sanitize() (limites físicos). Lança Error se inválido. */
export function parseImport(text) {
  let o; try { o = JSON.parse(text); } catch { throw new Error('Arquivo não é um JSON válido.'); }
  if (!o || o.app !== 'MAGNET LAB' || o.schema !== 1 || !o.simulation?.params) throw new Error('Arquivo não é uma exportação do MAGNET LAB (schema 1).');
  const num = v => (v === null || v === undefined || v === '' ? null : Number.isFinite(+v) && +v >= 0 ? +v : null);
  const tests = (Array.isArray(o.experimental?.tests) ? o.experimental.tests : []).slice(0, 50).map((t, i) => ({ id: String(t.id ?? `i${i}`), name: String(t.name ?? `Teste ${i + 1}`).slice(0, 80), turns: Math.min(200, Math.max(1, Math.round(+t.turns) || 1)),
    voltageOpen: num(t.voltageOpen), voltage: num(t.voltage), resistance: num(t.resistance), current: num(t.current), field_mT: num(t.field_mT), fieldEnd_mT: num(t.fieldEnd_mT), fieldPos: String(t.fieldPos ?? '').slice(0, 200), clips: num(t.clips), notes: String(t.notes ?? '').slice(0, 2000) }));
  return { params: sanitize(o.simulation.params).params, tests };
}
