# Combat — canhão, density e limpeza de morte

O lote está integrado. VFX promoveu somente os oito arquivos aprovados; Physics promoveu `contacts.mjs`912c; Combat conectou `sweepVisual` e corrigiu o encerramento da apresentação ao morrer. Main final **afc7d5ac**, server29bbf681, contacts912c, navigation911e0, layout143/8e756fe4. Horizon, pipeline, Environment, Animation, GUI e SFX foram preservados nesta janela.

Jogar: http://localhost:5173/?offline=1. PID75665, HTTP200, Supabase desativado, ranking local7f580798 preservado. WASD/setas para mover; mouse/IJKL para mirar; Espaço/ataque básico;1/2/3 para skills; Esc para opções. Recarregar o cliente para receber o main final; a correção de morte não exigiu reiniciar o backend.

## Fontes e recibos

- [222 fontes finais](../../output/qa/arpg-cannon-density-checkpoint-20260919/source-manifest.json).
- [Promoção dos oito VFX](../../output/qa/vfx-cannon-origin-promoted-20260919.json), [promoção Physics](../../output/physics/crowd-density-promotion-20260919/2026-09-19T03-27-06-354812Z/receipt.json).
- [Integração03:33](../../output/qa/arpg-cannon-density-integrated-20260919/integration-receipt.json), [restart03:35](../../output/qa/arpg-cannon-density-integrated-20260919/local-server-restart.json).
- [Correção pontual de morte](../../output/qa/arpg-cannon-death-cleanup-20260919/cleanup.patch) e [recibo](../../output/qa/arpg-cannon-death-cleanup-20260919/receipt.json).
- [Proveniência de17relatórios completos](../../output/qa/arpg-cannon-density-checkpoint-20260919/evidence-provenance.json):14 capturados com main7bde570f e três com main finalafc7d5ac. São candidatos relacionados pelo diff de `endGame()`, **não17 relatórios de hash idêntico**. Cada captura permaneceu estável. Spawn tem vínculo separado com as dependências de backend atuais.

`sweepVisual` restringe somente a apresentação: consulta sólidos na altura visual e na altura autoritativa1.05, além dos corpos vivos elegíveis. Mantém o menor contato, inclusive t=0. O cano não muda dano, origem autoritativa, raio ou contato final. Nenhum snapshot completo de main/server foi copiado.

## Gates executados

| Prova | Resultado e escopo |
| --- | --- |
| Backend isolado03:33 | Seis grupos selecionados PASS, fonte estável. Não é uma suíte global13/13. |
| Spawn03:33 | Quatro checks PASS: latejoin/restart, corpos/boss/self, reconnect preservado e rejeição atômica sem espaço. WebSocket real e ocupantes sintéticos declarados. |
| Combos03:35 | Warrior high e dwarf high/low reduced:3/3 PASS com inimigos naturais e input real. Stun/freeze vivos, dash death, campo e canhão. |
| Canhão + profundidade | High130 frames com fogo/128 compartilhados; low144/142. Socket/callback válidos, explosão no contato real, um passe de profundidade compartilhado, pause e expiração PASS. |
| Rede03:42 | Seis casts nos dois clientes, canhão remoto, snapshot comum, reconnect e latejoin PASS. Sem soak ou rede degradada. |
| Input03:43 | Quatro cenários: duas classes paradas/em movimento, três skills por classe, custo/cooldown reais PASS. |
| Parede03:43 | Três projéteis dwarf param na cripta e preservam vítima atrás por LOS. Fixture de posição/HP e input real. |
| Natural03:44 |60s por classe, ambas PASS com três skills, kills/XP/upgrades. Main anterior à correção de morte. |
| Ciclo de vida03:50/03:53 | Main final, seis mortes/restarts, cast/travel/impact repetidos. Zero casts retidos. Contadores e UUIDs estáveis após primeira sequência completa. |
| Miss03:51 | Main final, fixture de mundo vazio, direção por teclas: detonação autoritativa aos22m, zero vítimas/kills/score e pool expirado. |

[Medições e caminhos completos](../../output/qa/arpg-cannon-density-checkpoint-20260919/measurements.json).

Natural: warrior max28kills/lvl4 e morte/restart naturais, média142.635FPS/P958.3ms/P998.6/pior41.8. Dwarf59kills/lvl6/onda2, média140.818FPS/P957.7/P9913.9/pior180.4 e uma longtask180ms. O orçamento57FPS/P95≤20 permaneceu igual, incluindo capturas/upgrades/restarts. Uma fuga WASD foi acionada no jardim(-11.65,-6.359), com movimento/progressão posteriores. Não reproduz nem encerra o caso histórico da manutenção(18.933,14.268),0XP/P9520.9. [Revisão Root](review/cannon-density-natural-followup.json).

O A/B density400 anterior foi aceito em seu escopo de fixture e não repetido: baselineframeP9521.0ms, candidato livre9.8ms; CPU17.5→5.9ms livre e6.9ms no replay pareado de estados/dt exatos. Isso não vira benchmark natural400 ou mobile deste lote.

## Falhas preservadas e correção

Lifecycle03:44 falhou porque o canhão permaneceu registrado após morte. `endGame()` zerava `active` antes de `cancelSkills()`; agora cancela antes e chama `classSkillVfx.reset()`, cobrindo também explosões já concluídas no core. Não altera recursos, cooldowns, sequência, recompensas ou simulação de dano.

Lifecycle03:47 também falhou no gate de memória:89/43→91/43→93/44 em fases diferentes ainda frias. O report permanece FAILED. Repetimos a mesma sequência completa, sem aumentar tolerância:93/44 em todos os três ciclos seguintes. A captura03:53 instrumenta, apenas na resposta isolada de Three, todos os incrementos/descartes GPU por UUID. Primeiro uso de viagem aloca o volume de voo e o núcleo; primeiro impacto aloca o volume da explosão e as brasas. Uma textura FloatType16×16 também surge no primeiro ciclo de impacto; o rastreador não prova seu proprietário. **Zero UUID novo na segunda sequência**. [Análise](../../output/qa/arpg-cannon-density-checkpoint-20260919/gpu-allocation-analysis.json), [aceite Root localizado](review/cannon-lifecycle-followup.md). Não é alegação global de ausência de leak/soak.

Miss03:48 falhou na distância esperada. A direção do raio de mouse não estava vinculada de forma exata ao corredor pré-analisado pelo solver; o primeiro harness também não salvou o trajeto completo antes do assert. Preservamos a falha e usamos direção fixa IJKL com corredor livre confirmado e trajeto registrado.03:51 passou, sem mudança de runtime. Não apresentamos a primeira captura como defeito de dano demonstrado.

## Revisão visual e limites

[Observações e hashes](../../output/qa/arpg-cannon-density-checkpoint-20260919/native-observations.json). Combat inspecionou os PNGs originais e extraiu frames dos WebM já gravados após a medição. Sozinho, o canhão apresenta núcleo luminoso, rastro laranja e saída ligada ao rifle. Na parede, o efeito aparece no contato e acompanha o recorte do cenário. A vida artificial1.000.000 da fixture transborda a esfera; isso não foi usado como prova do HUD normal200HP.

Nos frames de combo high/low em torno de release/impacto, **a gravidade domina a leitura e a explosão de fogo permanece pouco distinta**. Busca de timestamps por cor quente também encontra flash do inimigo/sangue; não é uma métrica de aprovação nem um pico de explosão comprovado. A revisão não viu playback contínuo nem ouviu o vídeo. O mínimo89.256% da cena staging aceita não apaga o histórico65.289% com margem0.289pp. Technical PASS e direção local aceita não concedem AAA.

Permanecem: hierarquia fogo/gravidade, grito fino/geométrico, corte pouco distinto, no-slidefalse, Lich explícito, passagem de manutenção, outliers/soak/dispositivos e escuta. CUA físico continua na solicitação de login macOS já pendente; nenhuma nova pergunta foi feita.

Runtime congelado e GPU Combat liberada. Próxima GPU coordenada por Root: Brute/SFX frontal em cópia, depois GUI compact recovery focal. Sem autorização de promoção desses candidatos. Environment surface-life/manutenção e Animation/Lich continuam separados. [JEF deste checkpoint](../jef-arpg-cannon-density.md).
