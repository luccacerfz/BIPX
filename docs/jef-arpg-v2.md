# JEF real — candidato integrado ARPG v2

Avaliado em 2026-09-19T01:01:52.532Z; TypeSafe Jev, modelo solicitado `jev-1.13.0`. **HTTP200 / `requires_further_work`**. Meta inalterada:12dimensões,10/10 em cada. Todas as notas aceitas são `null`; `allDimensionsMeetTarget:false`, `fullGoalComplete:false`. O incremento funciona nos cenários comprovados; o goal AAA não está concluído.

## Candidato e procedência

[Evidência enviada](../output/qa/arpg-v2-integrated-20260919/evidence.json), [resposta redigida](../output/qa/arpg-v2-integrated-20260919/jef.json), [199hashes runtime](../output/qa/arpg-v2-integrated-20260919/source-manifest.json), [13relatórios fonte a fonte](../output/qa/arpg-v2-integrated-20260919/evidence-provenance.json). Os13relatórios de CPU/combos/timeline/rede/natural coincidem com todos199hashes; nenhum mudou durante sua execução. Corpse promovido é `e37398db…`, com queda/tampas e braços coerentes, conforme [handoff Animation](arpg/animation-cut-v3-handoff.md).

JEF recebe somente **texto**. Não abriu/viu/ouviu PNG/WebM/WAV. Credencial ficou apenas no ambiente do subprocesso; histórico privado não foi enviado. O relatório registra observações diretas e limites dos revisores, distinguindo fixture, input real, sinal e escuta.

| Dimensão | Preliminar textual0–10 | Nota aceita |
| --- | ---: | --- |
| game_design | 6.70 | pendente / null |
| animation | 4.88 | pendente / null |
| art_direction | 5.71 | pendente / null |
| vfx | 6.80 | pendente / null |
| combat_feel | 6.68 | pendente / null |
| ui_ux | 6.87 | pendente / null |
| mobile | 3.74 | pendente / null |
| audio | 4.51 | pendente / null |
| performance | 6.67 | pendente / null |
| multiplayer | 5.83 | pendente / null |
| accessibility | 4.81 | pendente / null |
| reliability | 7.22 | pendente / null |

Cobertura de todas as dimensões ainda é parcial. Notas preliminares não são notas artísticas aceitas nem aprovação global.

## Provas do candidato

- **CPU/protocolo13/13:** `00-54-45-126Z-quality-suite`, runtime/ferramentas estáveis. Core16cenários, área/boss/expiry, movimento/crowd, autoridade/forgery, progressão/paridade, ranking, reconnect e demais grupos selecionados.
- **Combos3/3:** `00-54-57-066Z-verify-arpg-combos`, high/low-reduced, sobreviventes stun/freeze, pull, dano e morte por dash, foco Environment real.
- **Timeline12casts:** `00-55-58-053Z-verify-arpg-browser`, quatro contextos novos com ambas classes paradas/em movimento.
- **Rede:** `00-56-20-856Z-verify-arpg-network`,6casts idênticos entre dois browsers, mundo compartilhado, reconnect e terceiro latejoin.
- **Natural60s/classe:** `00-57-00-491Z-verify-natural-runs`. Aldric141.38655FPS,p957.6ms,p9913.9ms,pior41.7ms; Lyra143.89852FPS,p957.6ms,pior14.3ms. Zero frames>50ms. Gate declarado>=57FPS/p95<=20ms mantido. Desktop Chrome/ANGLE Metal AppleM5Pro,1440×900; não telefone/benchmark térmico/horda extrema. XP/upgrades/3skills em ambos; morte/restart naturais em Aldric.

## Histórico preservado e correções

A suíte00:39:46 permanece **FAILED12/13**, fonte estável: clienteHP200!=160 antes da entregaWebSocket apósIPC. O harness passou a exigir160em ambos os canais, sem relaxar falsificação; execução isolada00:41passou8checks, suítes00:46e00:54passaram13/13. Os artefatos antigos não foram apagados/renomeados como sucesso.

O primeiro corpsev3 tinha mão suspensa, como [root registrou](arpg/review/v3-cut-followup.md). A correção posterior mantém braço/mão/props junto ao torso por componente conectado. Fixture final4rigs, CPU16casos, morte real/expiração e inspeção independente dos PNGs finais comprovam a melhoria limitada; não fingem ragdoll anatômico ou perfeição em todas as poses. [Inspeção Combat](../output/qa/arpg-skills-v2/corpse-v3-observations.json).

A primeira tentativa low/reduced do combo errou legitimamente o tiro após a automação trocar de alvo; repetir seguindo a mesma vítima natural passou. PrimeiroJEF do checkpoint anterior também retornou `requires_further_work`, preservado em [checkpoint0051](../output/qa/arpg-v2-checkpoint-20260919T0051/jef.json); não é avaliação do corpse promovido.

## Pendências explícitas

`acceptedNoSliding:false`: deriva de sola/transições, ré rápida, alcance e pequena penetração permanecem. Gravidade ainda precisa de vórtice mais convincente e leitura temporal densa. Corpse continua estilizado em duas peças rígidas; gesto/peso/grip/poses amplas não têm aceite10. Áudio possui PCM/sinal/loops, mas não escuta perceptual aceita. Faltam dispositivos físicos, carga extrema/soak, revisão humana extensa de balanceamento/feel e cenários completos de acessibilidade/rede.

Lich staged fica para próxima etapa pelo [contrato proposto](arpg/lich-cast-contract.md), sem recorte Walker ou promoção do Brute rejeitado. Nenhuma aceitação desta avaliação se transfere automaticamente a fontes futuras. Servidor local5173 permanece disponível, Supabase desativado, ranking preservado.
