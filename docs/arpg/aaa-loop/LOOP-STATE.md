# Loop Fable — BIPX rumo a AAA (estado persistente do orquestrador)

> Este arquivo é a memória do loop. Todo tick começa lendo-o e termina atualizando-o.

> **Retomada coordenada em 19/09, 12:33 UTC:** antes do próximo tick, ler `coordinator-resume-20260919.md`. Luna high assume frentes isoladas de desempenho e recuperação de testes; os WIPs Fable T1/T2/T3/T7/T8 ficam preservados. Consultar a coordenação Orca antes de integrar. Pedido atual: mais de 100 FPS e JEF >9,5; sem Gemini.

## Pedido do usuário (2026-09-19, após publicar o v5)

1. Verificação completa com agentes em fan-out para levar o jogo a nível "Blizzard AAA".
2. Melhorar os upgrades dos personagens.
3. Re-adicionar, de alguma forma, as armas e VFX antigos para os personagens.
4. Heróis bem mais fortes do que hoje — principalmente o Aldric, por ser corpo a corpo.
5. Ficar em /loop orquestrando agentes até o JEF dar nota acima de 9,5.
6. Verificar outras formas de usar o JEF no jogo para melhorá-lo.

## Regras do loop

- Branch de trabalho: `aaa-loop` (criada de `main` @ `7ea3d6a`). Agentes implementadores trabalham em **git worktree isolado**, commitam na própria branch e eu integro aqui. `main`/produção **só mudam com ok explícito do usuário**.
- Não tocar: porta 5173 em uso pelo usuário (posso reiniciar o servidor quando `server.mjs` mudar na branch integrada), `.data`/ranking local, terminais Orca dos Astras (parados por limite do Codex até 25–26/09).
- GPU/browser serializados por `mkdir /tmp/bipx-arpg-gpu.lock` (só o dono remove). Portas por trilha: T1 5301–5309, T2 5311–5319, T3 5321–5329, T5 5341–5349, orquestrador 5290–5299.
- Evidências fora do git: `output/qa/aaa-loop/<trilha>/` (caminho absoluto do checkout principal).
- JEF: `tools/evaluate-jev.mjs`, modelo `jev-1.13.0`, só texto. Observações **honestas**; não reconsultar candidato idêntico; lacuna = pendente. Credencial: recuperada em memória do transcript Codex do usuário (1 token `apikey_…`), nunca impressa/gravada.
- Limite conhecido: as dimensões **mobile** (iOS/Android físicos), **áudio** (escuta) e parte de **performance** exigem evidência humana/física que agentes não produzem. Sem isso o JEF não passa de ~8 nessas dimensões — pedir ao usuário.

## Linha de base JEF (09:50 UTC, candidato anterior ao v5)

game_design 4,6 · animation 3,1 · art 3,7 · vfx 4,2 · combat_feel 4,6 · ui_ux 4,8 · mobile 0,1 · audio 0,1 · performance 0,9 · multiplayer 3,5 · accessibility 4,0 · reliability 4,4 (todas `coverage: pending`; evidence_complete 0,03).

## Decisões de design do orquestrador (valem para todas as trilhas)

- **Identidade**: Aldric continua corpo a corpo (nada de virar atirador); Lyra continua rifle. As seis skills v2 e seus IDs ficam.
- **Arsenal antigo volta como "Relíquias"**: as 8 armas de drop (lança-chamas, machado, katana, besta, selo, cajado de raio, canhão de ossos, orbe de gelo) voltam como **infusões temporárias do ataque básico adaptadas à classe**, com os VFX originais; as 3 armas automáticas (Lâmina Guardiã, Orbe Giratório, Chuva de Selos) e suas evoluções voltam como upgrade para as duas classes. Solo e multiplayer autoritativo.
- **Upgrades 2.0**: cartas ligadas às skills de cada classe (custo/recarga/raio/duração/efeito novo), oferta sempre com ao menos 1 carta da classe, recompensa de fallback quando as pilhas acabam, tudo autoritativo (`authority.mjs`) e espelhado no solo.
- **Poder**: heróis muito mais fortes; Aldric ganha kit de sobrevivência corpo a corpo (mitigação, roubo de vida, alcance/arco, empurrão). Rampa inicial da onda 1 suavizada. Módulos novos para evitar conflito em `main.js`: `src/combat/hero-power.mjs`, `src/progression/skill-upgrades.mjs`, `src/combat/arsenal.mjs`, `src/vfx/arsenal-vfx.js`.

## Ticks

### Tick 1 — 2026-09-19
- Levantado: JEF tooling/credencial, arsenal legado neutralizado (`activateWeapon` só dá buff de 15 s; `updateAutoWeapons` vazio; `autoWeapon`/`sealRitual` bloqueados), números base (Aldric 7×2 em cone 4,2 m/0,5 s; Lyra 2×2 por tiro/0,3 s; zumbi 4,2 HP, 13 de dano; 200 HP).
- Onda A lançada (6 agentes): T1 poder/ritmo · T2 upgrades 2.0 · T3 arsenal · T4 pesquisa JEF · T5 crítica visual AAA · T6 backlog consolidado.
- Runner do JEF (fora do repo, credencial só em memória): `/private/tmp/claude-501/-Users-luccacerf-Projetos-Pessoal-Gaming-BIPX/2f407a79-d26b-4fa5-b8d7-023f62610f9e/scratchpad/jef-run.sh <state.json> <report.json>`.
- Agentes em execução (background, notificam ao terminar): T1 `loop/t1-power`, T2 `loop/t2-upgrades`, T3 `loop/t3-arsenal` (worktrees), T4 → `docs/arpg/aaa-loop/jef-research.md`, T5 → `docs/arpg/aaa-loop/visual-critique.md`, T6 → `docs/arpg/aaa-loop/backlog.md`.
- Próximo passo ao receber T1–T3: integrar em `aaa-loop` na ordem T1 → T2 → T3 (resolver conflitos nos blocos de ataque básico e em `class-skills.mjs`), rodar suítes CPU, bots de jogo natural nas duas classes, reiniciar 5173, montar evidência e rodar o JEF; depois Onda B a partir de T5/T6 (polimento visual/feel, áudio, acessibilidade, desempenho).

### Tick 2 — T4 concluído
- `docs/arpg/aaa-loop/jef-research.md`: JEF só devolve `choice`/`score`/`noul`, texto apenas, fraco com números, influenciável por prosa elogiosa, ~US$ 0,0004 por avaliação. Ranking de usos: (1) **Gate v2** (lint de evidência em código, 1 `noul` por exigência, canários anti-bajulação, ledger anti-reconsulta, 1 request por dimensão), (2) lint de cópia das cartas/skills, (3) laboratório de balanceamento com bots, (4) coach de fim de run com frases prontas, (5) moderação de nomes, (6) diretor de IA (fazer determinístico primeiro).
- Decisão do dono registrada: alvo passa de `>= 10` para **`> 9,5`** em todas as dimensões (pedido explícito de 19/09).
- Bloqueio humano: `mobile`, `audio` (totais), `performance` (celular físico), aceite perceptivo de `art_direction`/`combat_feel`; `animation` tem defeito aberto (`acceptedNoSliding=false`). Checklist do dono: 3 sessões de ~10 min (celular, escuta, olho-e-mão) — formulário sendo preparado pelo T7.
- Lançado T7 `loop/t7-jef-gate` (worktree): Gate v2 + modo `?qa=<código>` para sessões em aparelho físico + template de evidência v2 + formulário do dono. Calibração real (canários) fica comigo, com a chave só em memória.
- Recomendação de segurança ao usuário: rotacionar a chave TypeSafe (está em transcript Codex em disco).

### Tick 3 — T6 concluído
- `docs/arpg/aaa-loop/backlog.md`: 88 itens abertos (5 críticos, 25 altos) nas 12 dimensões. Linha de base CPU no código publicado: 4 suítes pedidas + `node --check` 95/95 + 23 extras passam; **7 falham** (6 por harness defasado; `verify:orc` por comportamento — ator parado morre na rampa da onda 1, que o T1 está mudando).
- Top abertos: PF-01 (sem série de frame-time do candidato), RL-01/02 (rede de regressão furada; runner bate na 5173), sessão do dono (mobile/áudio/leitor de tela), AN-01/02 (anti-sliding), CF-01 (melee inimigo aplica dano em t=0 sem telegraph), CF-02/VF-03 (dano no MP sem som/shake; projétil inimigo some sem impacto), MP-02 (reconexão frágil), MP-06/PF-02 (BloodCow sem `attackRegion`; A* esgota 768 nós), AU-02 (17 eventos em oscilador, sem passos), AD-01/04 (piso/materiais).
- Ondas sugeridas: **B** rede de segurança + evidência barata (B1 suítes · B2 rede/paridade · B3 HUD/semântica · B4 medição), **C** sensação/leitura de combate (melee com telegraph, VFX, física/A*, MP nativo), **D** animação/arte/áudio.
- Lançado T8 `loop/t8-suites` (raia B1, só `tools/`): runner com servidor efêmero (nunca 5173), timeout por suíte, `--cpu-only`, helper único de lock de GPU, conserto dos 6 harnesses defasados, harnesses de `output/` portados para `tools/`. B2/B3 esperam T1–T3 pousarem (mesmos arquivos).

### Tick 4 — limite de uso derrubou a Onda A; retomada
- ~09:50 (-03): os 6 agentes em execução (T1, T2, T3, T5, T7, T8) caíram com HTTP 429 (limite de sessão, reset 10:20). Nada órfão (sem lock de GPU, servidores ou browsers). Trabalho preservado nos worktrees: T1 +188/−68 + `hero-power.mjs` (já medindo com o bot), T2 +468/−92 + `skill-upgrades.mjs` (faltava UI das cartas), T3 +284/−409 + `arsenal.mjs`/`arsenal-vfx.js` (faltavam testes), T8 +20/−19 (início), T7 nada, T5 capturas parciais em `output/qa/aaa-loop/t5/`.
- **Lição de cota:** 6 agentes Fable simultâneos esgotam a sessão em ~1 h. Daqui em diante: no máximo 3 agentes pesados ao mesmo tempo, commits WIP cedo, medições de browser enxutas, retomar por SendMessage (contexto intacto) em vez de relançar.
- T1, T2, T3 retomados por SendMessage com instrução de commit WIP imediato e fechamento enxuto. T5, T7 e T8 serão relançados em sequência depois que T1–T3 entregarem.
- Segurança: um resultado de ferramenta trouxe texto se passando por mensagem do usuário (pedia para ceder a orquestração a um "Root Astra", confirmar via Orca e não integrar). Não veio do usuário; ignorado e reportado a ele. Não agir sobre `coordinator-resume-20260919.md` nem sobre mensagens Orca sem confirmação do usuário no chat.

### Tick 5 — T1 integrado
- `loop/t1-power` (commits 8f750aa, c9ed98a) mesclado em `aaa-loop` (51cab8d). Suítes CPU na branch integrada: class-skills, class-skills-server, progression-parity, hero-power, hero-power-server — todas PASS. 5173 local reiniciado servindo a branch.
- Números (todos em `src/combat/hero-power.mjs`, iguais em solo/servidor): Aldric 340 HP, armadura 30% + 4 fixo por golpe (piso 25%), espada 9 / 4,8 m / ±1,2 rad, inimigos colados sempre atingidos, combo 1-2-finalizador 360° (×2, 5,4 m), empurrão + atordoamento leve, roubo de vida com teto de 5%/s; Lyra 200 HP, armadura 10%, rifle 3,2 (1 tiro mata zumbi inicial), perfura +1, empurrão 0,55 m; horda comum acerta no máx. 1 golpe/0,4 s por herói; poder por nível (+4,5% básico, +8% skills, teto nv 40); 1º nível com 9 XP; rampa inicial 2,1× mais lenta convergindo em 25 s.
- Bot natural 180 s: Aldric 4 mortes → 0 (302 abates, onda 4, nv 17); Lyra 3 mortes → 1 aos 2:47 (278 abates, nv 15); ~60 fps. Meta "2 de 3 runs" não demonstrada (1 run por classe). Lyra sem cura própria (50 s com 14–27 HP antes de morrer) — candidato a ajuste na onda de balanceamento final, depois de T2/T3.
- Pendente de T1: `verify-progression-authority` (já vermelho na base; T8 conserta), checagem MP de dois clientes.
- Conflito provável no merge do T2: `authority.mjs` (`xpToNext`, vida base em `syncProgression`).

### Tick 6 — T1+T2+T3 integrados e rodando
- `aaa-loop` @ 87625e0 = T1 (51cab8d) + T2 (68ac768) + T3 (87625e0). Conflitos resolvidos mantendo as três trilhas: `skillPower × skillMods` no cast; Bastião antes da armadura de classe (cliente e servidor); ganchos de abate para roubo de vida + Sede de Sangue; `applyServerAttackDamage` com combo/leech do T1 e depois `applyServerRelicAttack` do T3; funções legadas `update*Attack` removidas (módulo `arsenal.mjs`); `buildArpgState` devolve `{ relic, ...hud }` com `skill.upgrades`.
- Paridade solo × servidor corrigida na integração: `state.build` do servidor agora lista as armas automáticas primeiro (nome evoluído quando evoluída), como o cliente. Contagens esperadas mudaram de forma explicável (+`autoWeapon` ×3 e `sealRitual` ×2): Lyra 28 elegíveis/76 concessões, Aldric 28.
- Testes ajustados para derivar expectativas de `hero-power.mjs` (armadura/roubo de vida do T1 somam sob as cartas do T2; `verify-arsenal` lê o básico do módulo em vez de regex no `server.mjs`).
- **8/8 suítes PASS** na integração: class-skills, class-skills-server, progression-parity, hero-power, hero-power-server, skill-upgrades, skill-upgrades-server, arsenal.
- Smoke no browser (bot de input real, 120 s por classe, `output/qa/aaa-loop/integration/evidence/i1-*`): **0 erros de página/console**, 0 mortes (antes 3–4), Aldric 183 abates/onda 3/nv 12/vida mín. 74%, Lyra 178 abates/onda 3/nv 9/vida mín. 100%, 60 fps (mín. 58,6). Observação de balanceamento: os primeiros 2 min da Lyra ficaram sem risco nenhum — reavaliar na onda de balanceamento com runs longas.
- 5173 local caiu com a interrupção da sessão; religado como tarefa em background monitorada, mesmo modo isolado (`LEADERBOARD_FILE=/private/tmp/bipx-aaa-local-leaderboard.json`, Supabase desligado), servindo a branch integrada.
- Retomados por SendMessage (máx. 3 simultâneos): T7 gate JEF, T8 suítes (com `git merge aaa-loop` antes), T5 crítica visual (agora sobre o build integrado, porta 5341).
- **Produção continua no v5** (`main` @ 7ea3d6a). Publicar a integração exige ok do usuário.

### Tick 7 — T5 concluído; Onda C aberta
- `docs/arpg/aaa-loop/visual-critique.md` (40 itens, 48 frames, produção + branch integrada). P0: (1) sem hit-stop/flash/tremor em golpe e abate; (2) cartas tapam o campo, não pausam e abrem a cada ~11 s (15 ofertas em 2:43); (3) VFX do golpe (espiral creme opaca a cada 0,47 s) esconde o Aldric e o finalizador não tem identidade; (4) sem dono de cor (`0xd978ff` = projétil hostil, Orbe Giratório, selo, gema de XP); (5) valores colapsados (90% do campo entre 9–30% de luminância; zumbi mais escuro que o chão); (6) morte corta para o login em ≤ 250 ms; (7) **risco de IP: brasão do Aldric ≈ leão da Aliança (Warcraft)** — precisa de asset novo; (10) mobile retrato: herói ~5,8% da altura, skills fora do alcance dos polegares. P1: relíquias/armas automáticas são decalques chapados; placa de chefe colide com o HUD e o modelo é primitiva branca.
- Bug observado: Lyra parada no nicho do mausoléu → 2 últimos zumbis da onda 2 ficaram ~3:50 sem persegui-la e a onda não terminou (`output/qa/aaa-loop/t5/video/v6-lyra-natural.webm`) → raia de física/navegação.
- Raias da Onda C (máx. 3 agentes simultâneos; arquivos disjuntos): **C1** feel + batida de morte + ritmo das cartas (`main.js`, `hero-power.mjs` xp, `authority.mjs` espaçamento) — LANÇADA `loop/c1-feel`; **C2** VFX (`src/vfx/**`: golpe aditivo, identidade do finalizador, volume/luz do arsenal, donos de cor); **C3** UI (`styles.css`, `src/ui/**`, `index.html`: barra de chefe, recarga legível, cartas compactas, retrato mobile); **C4** arte/luz (`src/render/**`: estrutura de valores, silhueta oclusa do herói); **C5** física/navegação (zumbis presos, A*, telegraph de melee inimigo CF-01).
- Decisões pendentes do dono: (a) pausar o mundo durante as cartas no solo? (recomendo sim; multiplayer segue em tempo real); (b) trocar o brasão do Aldric (risco de IP); (c) publicar a integração T1+T2+T3 em produção.

### Tick 8 — T7 integrado; 1ª calibração REAL do juiz JEF
- `loop/t7-jef-gate` mesclado (5ecedd0): `tools/jef-gate.mjs` + `tools/lib/*`, rubrica schema 6 com 104 `requiredScenarios` (18 `human` + 6 `device` = 24 que só o dono fecha), limiar `> 9,5` (decisão do dono 19/09), modo `?qa=<código>` (`src/qa/device-report.js`), `docs/arpg/aaa-loop/evidence-template.v2.json`, `owner-session-form.md`. `npm run verify:jef` 33/33.
- Runner com chave só em memória: `<scratchpad>/with-jef-key.sh <comando…>`.
- **Calibração real** (`output/qa/aaa-loop/jef-calibration/20260919T142222Z/`, 48 requests, estados SINTÉTICOS — não é nota do jogo): canários ok (bajulação 0,3–0,6/9; irrelevante 0,0; defeito conhecido 0,01) → o juiz **não é bajulável**. Porém o **teto com evidência ideal é 6,4–8,0/10** (holístico 5,8–7,2 de 9): mesmo com evidência perfeita, o `score` holístico não passa de ~8. Vereditos por requisito (`noul`) com evidência ideal: média 0,85–0,96, só ui_ux fecha 8/8 ≥ 0,95; `evidence_complete` 0,62–0,79. Conclusão: **com a redação atual, > 9,5 é inalcançável por construção** — precisa de decisão do dono sobre o instrumento antes de investir em evidência final.
- Opções para o dono: (A) manter o `score` holístico (meta inalcançável); (B) nota da dimensão = agregação dos vereditos por requisito do JEF (todos os requisitos ≥ limiar → 10; transparente e estrito), holístico como sinal secundário; (C) recalibrar redação/níveis contra âncoras sintéticas (ideal → ≥ 9,5, canários continuam baixos), congelar e só então avaliar o jogo. Recomendo B + C.
- Lançado **C2** `loop/c2-vfx` (só `src/vfx/**` + literais de cor): paleta com donos de cor, golpe aditivo que não esconde o herói, identidade do finalizador, volume/luz no arsenal. Em execução: C1, C2, T8.

### Tick 9 — T8 integrado; C3 lançado
- `loop/t8-suites` mesclado (2164181): runner `tools/run-quality-suite.mjs` com servidor efêmero por suíte (recusa 5173), timeout 10 min, `--cpu-only/--browser-only/--list`, helper único `tools/quality-gpu-lock.mjs`; 6 harnesses defasados consertados sem achar defeito de produto (`verify:progression` 8/8, `verify:enemy-projectiles` 28, `verify:physics:integration` 16/16, `verify:skills:vfx` 18/18, `verify-arpg-layout` 7/7 com baseline 153, `environment-cpu` 74); `verify:orc` voltou a passar com a rampa do T1; bots/sondas portados para `tools/` (`natural-play`, `mobile-a11y-probe`, `native-two-client`). 12 scripts npm adicionados.
- Rodada `--cpu-only` do T8 na branch dele: 46/47 PASS + 1 skip (`verify:crowd`, artefato de staging). Refazendo na branch integrada em background (`output/qa/aaa-loop/regression/cpu-*`).
- Observações de produto do T8 (não corrigidas): fachada da cripta tem duas frestas de ~11 cm por onde o rifle passa ao lado da porta + vão ao nível do solo sob os pés do arco; `enemy-locomotion-contact-cpu` falha num candidato fora do runtime. Pendências: nenhuma suíte de browser rodada; RL-08; `docs/quality-gates.md` precisa descrever o runner novo; incidente: `verify-device-report` segurou o lock de GPU ~170 s ocioso (formato JSON do `owner`) — helper já entende o formato.
- Lançado **C3** `loop/c3-ui` (index.html, styles.css, `src/ui/**`, template das cartas, câmera mobile): mão de cartas compacta que não cobre herói/esferas, barra de chefe fixa no topo, legibilidade de recarga/relíquia/vida baixa, tela de morte com o resumo como protagonista, retrato mobile (skills no arco do polegar, herói maior). Em execução: C1, C2, C3.
- **Regressão CPU na branch integrada (T1+T2+T3+T7+T8, @2164181): 47/47 PASS**, 0 falhas, 0 timeouts, 0 skips (`output/qa/aaa-loop/regression/cpu-20260919T144223Z/suite.json`). É a linha de base para as raias C1–C3.
