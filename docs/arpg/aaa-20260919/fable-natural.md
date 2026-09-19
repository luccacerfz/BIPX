# Fable 3 — candidato v2, status das cartas e jogo natural das duas classes (2026-09-19)

Tarefa `task_cfe33d70242b`. **Nenhum arquivo vivo alterado** (`output/qa/aaa-20260919/fable-fixes-v2/live-hashes-{before,after}.txt`, 105 arquivos, idênticos; sem drift desde a v1). **v1 preservada** (hashes idênticos aos da entrega anterior). v2 = cópia da v1 em `output/qa/aaa-20260919/fable-fixes-v2/candidate/` + 3 hunks.

## Candidato v2

| Arquivo | Vivo | v2 |
| --- | --- | --- |
| `src/main.js` | `d9e6fed48d8609acbd495f9a1c747bbe8e6b9d3cc00447aa75e4896b156b6d3b` | `c4ec44f0520772fce4327360804ffa4af5c289e3735edae635b027bb5bdbfc71` |
| `src/ui/arpg-hud.js` | `9f0f35dd4f80d71e6df073dc52707373a1068e212b45aed83c308d897d3b8927` | `36e157e77be8d3dc271e88a2891bd61aca7fad30657316e3ea29ff8cb78ab622` |
| `src/progression/authority.mjs`, `index.html`, `styles.css` | — | iguais à v1 (ver `candidate-hashes-after.txt`) |

Mudanças v1→v2 (`patches/v1-to-v2-incremental.patch`, 3 hunks): (1) `buildArpgState()` publica `paused` real; cartas abertas entram em `enabled=false` — habilidades continuam indisponíveis e `requestClassSkill` continua recusando; (2) glifo do slot em estado `upgrade` é ◆, Ⅱ fica só para pausa; (3) `formatHudNumber` usa `pt-BR` (HUD e resumo de morte compartilham a função; `arpg-hud.js` já usava pt-BR). Patch completo contra a árvore viva: `patches/all-fable-fixes-v2.patch` (5 arquivos, +62/−21, `git apply --check` ok). Autoridade/balanceamento intactos.

### Verificação pontual (`cards-status-probe.mjs`, XP por fixture **só aqui**, headless 1440×900)

| Situação | v1 | v2 |
| --- | --- | --- |
| Cartas abertas: status / slot / snapshot.paused / engine paused | "Em pausa" / `paused` Ⅱ / true / **false** | "Evolução" / `upgrade` ◆ / false / false |
| Rótulo acessível do slot 1 com cartas | "…Em pausa." | "…Escolha uma evolução." (`aria-disabled=true`) |
| Relógio avança com cartas; Dígito 1 escolhe carta e **não** lança skill; após fechar, Dígito 1 lança | sim/sim/sim | sim/sim/sim |
| Pausa verdadeira (Esc): status, foco | "Em pausa" Ⅱ, foco no × | idem |
| Cartas + Esc → volta | "Em pausa" → "Em pausa" (falso) | "Em pausa" → "Evolução", foco no canvas |

Formatação ≥1.000 não foi observada em runtime (nenhuma run natural passou de 854 pontos); é mudança de uma linha no locale.

## Jogo natural

Método: `natural-play.mjs`, Chromium headless com ANGLE/Metal (**60 fps médios, mín. 56,6**), 1280×720, vídeo contínuo. **Entrada 100 % real** (teclas W/A/S/D, mouse para mirar/segurar ataque, Dígitos 1/2/3 para skills e para cartas, Enter para reiniciar). Nenhum XP, dano, inimigo, recurso ou invulnerabilidade por fixture. Os getters de debug foram usados apenas como *percepção* (posições, HUD). **Limite central: quem joga é uma política automática simples, não uma pessoa** — aproxima e bate (Aldric) / recua em arco e atira (Lyra), lê a carta por 1,3 s e escolhe por lista de preferência. Ela não desvia de ataques individualmente nem usa o cenário; números de sobrevivência são piso de um jogador ingênuo, não veredito de dificuldade. Zero erros de página/console nas duas sessões.

| | Aldric (espada) | Lyra (rifle) |
| --- | --- | --- |
| Tempo ativo | 180 s | 180 s |
| Mortes | 4 (aos 0:24, 0:33, 0:44, 0:43) | 3 (0:23, 1:09, 0:23) |
| Melhor run | 0:44 · 40 abates · 412 pts · Nv. 4 · onda 2 | 1:09 · 77 abates · 854 pts · Nv. 5 · onda 2 |
| Skills lançadas (eventos observados) | Grito 8 · Corte 18 · Escudo 11 | Canhão 20 · Glacial 7 · Núcleo 8 |
| Cartas escolhidas | 14 (10 delas com vida < 30 %) | 6 (1 com vida < 30 %) |
| Máx. inimigos vivos | 26 | 34 |
| Vídeo | `evidence/natural-warrior/natural-warrior.webm` (24 MB) | `evidence/natural-dwarf/natural-dwarf.webm` (24 MB) |

Dados por segundo, escolhas (ofertas/escolha/vida/inimigos) e capturas a cada 30 s, das 3 primeiras cartas e de cada morte: `evidence/natural-*/natural-play.json` e PNGs.

### Defeitos/observações reproduzidos (ritmo e progressão)

- **N-01 · P1 · Abertura sem rampa: a onda 1 cerca o jogador antes do primeiro poder.** Medido nas 7 runs: 7 inimigos aos 0:04, 16–20 aos 0:12, 24–30 aos 0:20 (`getZombieSpawnInterval` começa em 0,657 s e a onda 1 já agenda 35+ inimigos, `main.js:7978-7990`). Primeiro nível só chega entre 0:12 e 0:30. Cercado, o herói perde ~14 HP por golpe várias vezes por segundo: Aldric 200→4 HP entre 0:05 e 0:24; Lyra 200→17 entre 0:15 e 0:22 **ainda no nível 1, sem nenhuma carta**. 3 das 7 runs acabaram ≤0:24. Mesmo descontando a política ingênua, os primeiros 20 s não ensinam nem dão ferramenta; sugiro rampa (menos spawns até ~0:25 ou primeiro nível garantido cedo) — decisão de Combat/design, não implementada.
- **N-02 · P1 · Lyra fica presa no cerco sem saída.** Aos 0:15–0:22 da run 1 o bot segurou W/D continuamente com o inimigo mais próximo a 2,0 m e a vida caindo a cada segundo: a horda bloqueia o corpo e Lyra não tem mobilidade; Glacial (recarga 9 s) e Núcleo (12 s) estavam em recarga. Aldric escapa com Corte/Escudo. Identidade ok ("mantenha espaço"), mas falta uma válvula (p.ex. recuo curto no Glacial ou empurrão ao ser cercada). Reproduzível no vídeo da Lyra, 0:15–0:23 e 1:55–2:20.
- **N-03 · P2 · Cartas em tempo real punem o corpo a corpo.** 10 das 14 escolhas de Aldric ocorreram com vida < 30 % e 5–23 inimigos ao redor (o nível sobe justamente no meio da pilha de abates); durante ~1,3 s de leitura 1/2/3 não lançam skill. Em 1280×720 o painel centralizado também **cobre o próprio herói** (`evidence/natural-dwarf/cards-1.png`). Mantive tempo real conforme instrução; mitigação sugerida sem sistema novo: painel mais baixo/estreito em alturas < 700 px e breve janela de redução de dano ou empurrão ao abrir cartas.
- **N-04 · P1 · As cartas quase não conversam com as habilidades (confirma S-01 com rastreio de código).** `+Dano` chega a básicos e skills (`main.js:6808`). `+Cadência` só reduz o intervalo do golpe/tiro básico (`7014-7021`); `+Área` aumenta o cone da espada (`7007`) — útil a Aldric — mas para Lyra só engrossa o raio da bala (`7183`) e **não altera** Canhão/Glacial/Núcleo (`class-skills.mjs` não lê multiplicadores). O texto "+Área: explosões e áreas de efeito" promete o que não entrega à Lyra, que ofereceu/escolheu +Área 2 vezes. Nenhuma carta toca custo, recarga, duração ou recurso. Na prática o bot só tinha uma escolha boa (+Dano), escolhida em 9 de 20 ofertas.
- **N-05 · P2 · Economia de recurso não é a restrição no início.** Fervor/Foco voltaram a 100 repetidamente durante o cerco (amostras 0:21–0:24) porque as três skills estavam em recarga: no early game o limite é recarga, não recurso, e a esfera direita vira enfeite. Pendente observar ondas tardias.
- **Positivo:** as 6 skills dispararam por tecla real dezenas de vezes sem erro; Canhão foi o que mais sustentou a Lyra (77 abates em 1:09); reinício por Enter após a guarda funcionou 7/7; resumo de morte correto em todas as mortes; status "Evolução" em 100 % das cartas.

## Limitações

Política automática ≠ jogador humano (sem leitura de telegraph, sem uso de cenário, sem coleta deliberada de XP além de voltar aos locais de abate); nenhuma run passou da onda 2, então chefes, elites, cartas raras+/épicas, fim de pilhas (S-02) e economia tardia **não foram exercitados**. Headless com GPU real, sem áudio, sem toque, sem multiplayer, sem dispositivo físico. Vídeo prova o que ocorreu na tela, não sensação de controle. Nenhuma suíte global rodada. Nenhuma nota atribuída.
