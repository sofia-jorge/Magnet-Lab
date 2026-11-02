"""Validação INDEPENDENTE do motor JS: reimplementa tudo em Python puro, com método diferente para B
(soma de espiras individuais, fórmula de anel no eixo — o motor usa a fórmula do solenoide finito)."""
import math, json, subprocess
MU0 = 4e-7*math.pi; RHO = 1.68e-8; d, enamel = 0.25e-3, 15e-6; dout = d+2*enamel
r0, Lmax, V, rint = 2.0e-3, 30e-3, 1.5, 0.25; A = math.pi*(d/2)**2; per = math.floor(Lmax/dout)
out = []
for N in (50, 100, 150):
    layers, left, k = [], N, 1
    while left > 0:
        n = min(per, left); layers.append((n, r0+(k-0.5)*dout)); left -= n; k += 1
    L = sum(n*2*math.pi*r for n, r in layers); R = RHO*L/A; I = V/(R+rint)
    B = sum(MU0*I*r*r/(2*(r*r+((j-(n-1)/2)*dout)**2)**1.5) for n, r in layers for j in range(n))
    out.append(dict(N=N, camadas=len(layers), L=L, R=R, I=I, P=R*I*I, B_ar=B))
js = subprocess.run(['node','-e',"import('./js/physics.js').then(({simulate})=>console.log(JSON.stringify([50,100,150].map(N=>{const s=simulate({turns:N});return {N,L:s.geo.wireLength,R:s.circuit.Rcoil,I:s.circuit.I,P:s.circuit.Pcoil,B_ar:s.core.Bair,Bc:s.core.Bcore,Be:s.core.Bend}}))))"],capture_output=True,text=True).stdout
js = json.loads(js); md = ["# Validação manual independente (50, 100 e 150 espiras)\n",
 "Parâmetros: fio 0,25 mm (+15 µm de esmalte por lado), ρ = 1,68e-8 Ω·m (20 °C), raio interno 2,0 mm, bobina máx. 30 mm, pilha 1,5 V com r = 0,25 Ω.\n",
 "Script: `docs/validacao_independente.py` (Python puro; B por soma de anéis individuais — método diferente do motor JS).\n",
 "| N | camadas | L fio (m) Py / JS | R (Ω) Py / JS | I (A) Py / JS | P (W) Py / JS | B centro (mT) Py / JS | dif. B |","|---|---|---|---|---|---|---|---|"]
ok = True
for p, j in zip(out, js):
    dif = abs(p['B_ar']/j['B_ar']-1)*100; ok &= dif < 1 and abs(p['R']/j['R']-1) < 1e-9 and abs(p['I']/j['I']-1) < 1e-9
    md.append(f"| {p['N']} | {p['camadas']} | {p['L']:.4f} / {j['L']:.4f} | {p['R']:.4f} / {j['R']:.4f} | {p['I']:.4f} / {j['I']:.4f} | {p['P']:.4f} / {j['P']:.4f} | {p['B_ar']*1e3:.3f} / {j['B_ar']*1e3:.3f} | {dif:.3f} % |")

# ---- núcleo: modelo 1D reimplementado com OUTRO solver (ponto fixo amortecido) e anéis por espira ----
Lr, rs, mur, Ms, K = 85e-3, 2.0e-3, 200, 1.6e6, 32; h = Lr/K; zs = [-Lr/2+(i+.5)*h for i in range(K)]; chi = mur-1
t = lambda u: u/math.sqrt(u*u+rs*rs); sheet = lambda M, dz: MU0*M/2*(t(dz+h/2)-t(dz-h/2))
def coil(I, N, z):
    layers, left, k = [], N, 1
    while left > 0:
        n = min(per, left); layers.append((n, r0+(k-0.5)*dout)); left -= n; k += 1
    return sum(MU0*I*r*r/(2*(r*r+(z-(j-(n-1)/2)*dout)**2)**1.5) for n, r in layers for j in range(n))
core_rows = []; ok2 = True
for p, j in zip(out, js):
    I = p['I']; Hc = [coil(I, p['N'], z)/MU0 for z in zs]; M = [0.0]*K; rel = 1.5/(1+chi)
    for it in range(20000):
        H = [Hc[a]-M[a]+sum(sheet(M[b], zs[a]-zs[b]) for b in range(K))/MU0 for a in range(K)]
        Mn = [Ms*math.tanh(chi*x/Ms) for x in H]; d = max(abs(Mn[a]-M[a]) for a in range(K)); M = [M[a]+rel*(Mn[a]-M[a]) for a in range(K)]
        if d < 1e-7*Ms: break
    fld = lambda z: coil(I, p['N'], z)+sum(sheet(M[b], z-zs[b]) for b in range(K))
    Bc, Be = fld(0), fld(Lr/2); difc = abs(Bc/j['Bc']-1)*100; dife = abs(Be/j['Be']-1)*100; ok2 &= difc < 1 and dife < 1
    core_rows.append(f"| {p['N']} | {Bc*1e3:.2f} / {j['Bc']*1e3:.2f} | {Be*1e3:.2f} / {j['Be']*1e3:.2f} | {difc:.3f} % / {dife:.3f} % | {it} |")
md += ["\n## Núcleo (modelo 1D) — reimplementação independente (ponto fixo × Newton)\n", "Ferro: μr = 200 (adotado), Ms = 1,6e6 A/m, parafuso 85 × 4 mm, bobina centrada. B por soma de espiras individuais + folhas.\n",
 "| N | B centro da bobina (mT) Py / JS | B extremidade (mT) Py / JS | dif. | iterações Py |","|---|---|---|---|---|"] + core_rows + [f"\n**Núcleo: {'APROVADO' if ok2 else 'REPROVADO'}** — confirma implementação e solver, **não** a física do modelo (ver limitações no README)."]
ok &= ok2
p = out[0]; md += ["\n## Conta à mão — 50 espiras (1 camada)\n", f"1. d_ext = 0,25 + 2·0,015 = 0,28 mm; espiras/camada máx. = ⌊30/0,28⌋ = {per} ≥ 50 ⇒ 1 camada.",
 "2. Raio médio da espira = 2,0 + 0,14 = 2,14 mm ⇒ comprimento por espira = 2π·2,14 mm = 13,45 mm.", f"3. L = 50 · 13,45 mm = {p['L']:.4f} m.",
 f"4. A = π(0,125 mm)² = {A*1e6:.5f} mm² ⇒ R = ρL/A = 1,68e-8 · {p['L']:.4f} / {A:.4e} = {p['R']:.4f} Ω.", f"5. I = V/(R + r) = 1,5/({p['R']:.4f} + 0,25) = {p['I']:.4f} A.", f"6. P = R·I² = {p['P']:.4f} W.",
 f"7. B no centro (soma de 50 anéis, cada um a²μ₀I/2(a²+z²)^1,5) = {p['B_ar']*1e3:.3f} mT.", "\n**Critério:** R e I devem coincidir (< 1e-9 relativo) e B (< 1 %).", f"\n**Resultado desta execução: {'APROVADO' if ok else 'REPROVADO'}**"]
open('docs/validacao-manual.md','w').write("\n".join(md)); print("APROVADO" if ok else "REPROVADO"); print("\n".join(md[4:8]))
