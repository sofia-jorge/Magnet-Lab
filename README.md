# MAGNET LAB — Laboratório Virtual de Eletromagnetismo

Simulador 2D/3D de um **eletroímã** (pilha AA + fio de cobre + parafuso de ferro) para investigar:
**como o número de espiras (1–200) influencia a resistência, a corrente, o campo magnético e a atração?**

> Projeto: Eletroímã · Engenharia de Software e Física
> Relatório: *Análise do campo magnético e da capacidade de atração de um eletroímã aplicado a um guindaste didático em função do número de espiras.*
> Experimentos principais: **50, 100 e 150 espiras**.

## Funcionalidades
- Painel de controle (espiras, pilha, posição da bobina no parafuso, resistência interna, fio, bobina, parafuso, materiais, temperatura, ligar/desligar, inverter corrente) com validação de limites.
- **3D** (Three.js): pilha AA, fio enrolado em camadas (N espiras reais, escala 1 unidade = 1 mm), parafuso, corrente animada, linhas de campo coloridas por |B|, polos N/S.
- **2D** (canvas): corte meridional com zoom/pan, mapa de intensidade, linhas, vetores, símbolos ⊙/⊗ e **gaussímetro virtual** (sonda clicável; sempre rotulada como *estimativa teórica*).
- **Memória de cálculo** passo a passo (L, R, I, B, P) com os mesmos valores do motor; tabela A/B/C e 4 gráficos (N × R, I, B, P).
- **Laboratório experimental**: 3 testes iniciais **vazios**; comparação teoria × simulação × experimento com desvio; calibração da pilha (E, r).
- Salvar no navegador (localStorage), **JSON**, **CSV** (Excel pt-BR), **PDF** (com gráficos e legenda de origem) e imagens 2D/3D.
- Guindaste didático, glossário, fórmulas com exemplos numéricos e a seção *"Por que mais espiras não significa mais força?"*.

## Como executar
Aplicação estática (sem servidor próprio, sem banco, sem serviços pagos). Módulos ES exigem HTTP (não abre via `file://`):
```bash
python -m http.server 8000     # ou: npx serve
# abra http://localhost:8000
```
Three.js, Chart.js e jsPDF são carregados por CDN (versões fixas) — é preciso internet na primeira abertura.

**Testes automatizados** (Node ≥ 18, sem dependências): `npm test`
**Validação independente** (Python): `python3 docs/validacao_independente.py` → gera `docs/validacao-manual.md`.

## Fundamentação física (resumo)
| Grandeza | Modelo |
|---|---|
| Comprimento do fio | geometria do enrolamento justo em camadas: L = Σ nₖ·2π·rₖ |
| Resistência | R = ρ(T)·L/A, A = π(d/2)², ρ(T) = ρ₂₀[1+α(T−20)] |
| Corrente | I = V/(R + r_int + R_ext) — pilha real = fonte com resistência interna |
| Campo no ar (eixo) | solenoide finito (soma de camadas); fora do eixo: **Biot–Savart exato para anéis circulares** (integrais elípticas) |
| Núcleo | modelo **didático 1D**: magnetização autoconsistente ao longo do eixo (32 trechos, auto-desmagnetização incluída), saturação tanh, solução por Newton; μr **adotado**; folhas de corrente equivalentes viram anéis para as linhas 2D/3D |
| Potência | P = R·I² = V·I (fonte) |
| Referência | B = μ₀NI/ℓ (solenoide longo) é mostrada só para comparação — não é usada nos resultados |

## Limitações científicas (importante)
- **Núcleo (Etapa 7):** o modelo 1D supõe parafuso fino (H ≈ uniforme na seção), bobina bem centrada ou deslocada ao longo do eixo, e curva M(H) anisterética. Foi verificado contra limites analíticos (χ pequeno: exato; χ grande: elipsoide, ±30 %) e contra reimplementação independente, **mas não contra medição nem elementos finitos**. Espere erros de dezenas de % em valores absolutos com ferro real; use as tendências e compare com o protótipo. Linhas de campo e sonda mostram o campo total (bobina + núcleo).
- μr e Ms do ferro são valores adotados; **sem histerese nem magnetismo residual** (o guindaste ilustra o conceito qualitativamente).
- A resistência interna da pilha é suposição até ser medida; use "Calibrar pilha". Sem aquecimento (R varia com T, mas T é entrada, não resultado).
- A pilha AA não sustenta correntes de ampères por muito tempo; o site emite avisos (limiares heurísticos).
- **Clipes levantados não são previstos**: só entram como dado experimental.
- Cabos de ligação e posição da pilha no 3D são esquemáticos; o enrolamento é suposto centrado no parafuso.

## Estrutura
```
index.html  css/style.css
js/physics.js        motor físico (puro)          js/report.js      memória de cálculo e tabelas
js/experiments.js    teoria × sim × experimento   js/storage.js     localStorage / JSON
js/export.js         CSV e PDF                    js/education.js   glossário e fórmulas
js/simulation2d.js   js/simulation3d.js   js/crane.js   js/main.js
tests/  docs/validacao_independente.py  docs/validacao-manual.md
```

## Validação

Os 51 testes abrangem:

- **Núcleo e campo magnético:** comparação entre núcleo e limites analíticos, saturação, vazamento de fluxo e deslocamento da bobina.
- **Convergência e circuitos:** convergência de Newton e circuito aberto (I = 0).
- **Resistência e geometria:** relação R = ρL/A, escala e geometria = N.
- **Propriedades magnéticas:** ∇·B ≈ 0, inversão de polos e comparação entre núcleo e ar.
- **Cálculos e estabilidade:** comparação entre Biot–Savart e solenoide finito (diferença inferior a 1%), ausência de NaN/Infinity para N = 1…200.
- **Visualização e dados:** gráficos vinculados ao motor de simulação, dados experimentais nunca inventados e exportação em CSV, JSON e PDF.

O caso de validação manual com 50, 100 e 150 espiras está disponível em `docs/validacao-manual.md`.

## Licença
Este projeto está licenciado sob a Licença MIT (MIT License), permitindo o uso, a cópia, a modificação e a distribuição do código, desde que o aviso de direitos autorais e a licença original sejam mantidos.

Consulte o arquivo LICENSE para acessar o texto completo da licença.
