# Loop Fable — BIPX rumo a AAA (estado persistente do orquestrador)

> Este arquivo é a memória do loop. Todo tick começa lendo-o e termina atualizando-o.

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
