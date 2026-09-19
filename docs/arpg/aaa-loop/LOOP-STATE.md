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
