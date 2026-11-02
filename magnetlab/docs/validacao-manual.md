# Validação manual independente (50, 100 e 150 espiras)

Parâmetros: fio 0,25 mm (+15 µm de esmalte por lado), ρ = 1,68e-8 Ω·m (20 °C), raio interno 2,0 mm, bobina máx. 30 mm, pilha 1,5 V com r = 0,25 Ω.

Script: `docs/validacao_independente.py` (Python puro; B por soma de anéis individuais — método diferente do motor JS).

| N | camadas | L fio (m) Py / JS | R (Ω) Py / JS | I (A) Py / JS | P (W) Py / JS | B centro (mT) Py / JS | dif. B |
|---|---|---|---|---|---|---|---|
| 50 | 1 | 0.6723 / 0.6723 | 0.2301 / 0.2301 | 3.1244 / 3.1244 | 2.2461 / 2.2461 | 13.410 / 13.410 | 0.002 % |
| 100 | 1 | 1.3446 / 1.3446 | 0.4602 / 0.4602 | 2.1121 / 2.1121 | 2.0529 / 2.0529 | 9.370 / 9.370 | 0.000 % |
| 150 | 2 | 2.0926 / 2.0926 | 0.7162 / 0.7162 | 1.5525 / 1.5525 | 1.7262 / 1.7262 | 13.363 / 13.363 | 0.002 % |

## Núcleo (modelo 1D) — reimplementação independente (ponto fixo × Newton)

Ferro: μr = 200 (adotado), Ms = 1,6e6 A/m, parafuso 85 × 4 mm, bobina centrada. B por soma de espiras individuais + folhas.

| N | B centro da bobina (mT) Py / JS | B extremidade (mT) Py / JS | dif. | iterações Py |
|---|---|---|---|---|
| 50 | 448.01 / 447.99 | 20.24 / 20.24 | 0.004 % / 0.003 % | 834 |
| 100 | 517.51 / 517.51 | 27.85 / 27.86 | 0.001 % / 0.003 % | 857 |
| 150 | 592.58 / 592.57 | 30.60 / 30.60 | 0.001 % / 0.000 % | 868 |

**Núcleo: APROVADO** — confirma implementação e solver, **não** a física do modelo (ver limitações no README).

## Conta à mão — 50 espiras (1 camada)

1. d_ext = 0,25 + 2·0,015 = 0,28 mm; espiras/camada máx. = ⌊30/0,28⌋ = 107 ≥ 50 ⇒ 1 camada.
2. Raio médio da espira = 2,0 + 0,14 = 2,14 mm ⇒ comprimento por espira = 2π·2,14 mm = 13,45 mm.
3. L = 50 · 13,45 mm = 0.6723 m.
4. A = π(0,125 mm)² = 0.04909 mm² ⇒ R = ρL/A = 1,68e-8 · 0.6723 / 4.9087e-08 = 0.2301 Ω.
5. I = V/(R + r) = 1,5/(0.2301 + 0,25) = 3.1244 A.
6. P = R·I² = 2.2461 W.
7. B no centro (soma de 50 anéis, cada um a²μ₀I/2(a²+z²)^1,5) = 13.410 mT.

**Critério:** R e I devem coincidir (< 1e-9 relativo) e B (< 1 %).

**Resultado desta execução: APROVADO**