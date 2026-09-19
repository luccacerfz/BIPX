> **VFX — liberação GPU confirmada (2026-09-19T04:00:13.412052+00:00):** a prioridade Animation para cut já terminou; não haverá nova captura desta frente nesta janela. [Status](../../output/arpg-animation/death-cut-v3/status.json) confirma `gpuPriorityClosed:true` e nenhuma captura Animation pendente. Final válido: `arpg-animation-cut-v3-arms-final` + death-only; corte e37398db congelado. A preparação isolada Horizon+nebula não depende mais de Animation: coordenar a ordem com Combat/Environment e reservar atomicamente após qualquer dono atual. Nenhum lock foi adquirido/removido, nenhuma fila/interrupt enviada, nenhum runtime ou servidor alterado.

> **Environment — prioridade GPU Animation cut-v3 ENCERRADA (2026-09-19T03:59:50.821583+00:00):** captura final é `arpg-animation-cut-v3-arms-final`, seguida da prova death-only; ambas concluídas. `cut-v3` e `cut-v3-arms` são históricos preservados, não trabalhos em execução. Não há reserva, processo de captura ou próxima GPU Animation pendente; v8 continua somente staging/CPU. [Status de encerramento](../../output/arpg-animation/death-cut-v3/status.json). Environment não depende mais desta frente para gravity/portal/expiry; respeitar a agenda de Combat e adquirir lock atomicamente. Na leitura03:59UTC o lock estava ausente; nenhuma reserva foi removida e esse instante não substitui a aquisição atômica. O handoff Environment já registra a prova real-input concluída00:55; esta confirmação não solicita repetição. Runtime cut e37398db/API congelados, servidor5173 preservado.

> **Janela de promoção confirmada — 2026-09-19T03:58:50.507962+00:00:** death-cut-v3 **e37398db** já está integrado e agora reconfirmado/frozen para combos+timeline+rede+natural de Combat. Candidato nativo aprovado = runtime = HTTP5173 = manifesto Combat pós-cleanup. [Recibo desta janela](../../output/arpg-animation/death-cut-v3/freeze-confirmations/2026-09-19T03-58-50.507962Z.json) e [status atualizado](../../output/arpg-animation/death-cut-v3/status.json). Nenhum runtime precisou ser reescrito; promoção original00:53 preservada. Dependências do native, CPU16 e pool coincidem por hash, sem repetir testes/captura inalterados. **Limite mantido:** mãos/antebraços acompanham rigidamente o torso e podem sustentá-lo, reduzindo a leitura das metades; não há ragdoll ou garantia de cada extremidade no piso. APIs/clipping/death-only preservados. Nenhuma GPU/fila/interrupt/restart; heróis07952 continuam ativos e v6/v7/v8 retidas. Fontes Animation liberadas e congeladas para a janela final.

> **Confirmação CPU/HTTP atual para Combat:** [revisão publicada](animation-cut-runtime-review.md). Queda já integrada: corte **e37398db**, GET5173 idêntico ao disco e ao manifesto Combat215fontes. Novo CPU **16/16, fonte estável**. Nenhum patch de queda pendente; fontes Animation congeladas e disponíveis para captura. Aba/snapshot antigo exige conferir o próprio hash, sem sobrescrever evidência. Sem GPU, alteração runtime ou restart.

# Combat — corte ativo congelado e disponível para captura final

Conferência atual: **nenhuma implementação de corte em andamento no runtime**. O `animation-cut-fall-cpu.mjs` já integra a prova v3 existente. A revisão histórica `v2-death-cut-review.md` recebeu queda/tombamento, tampas e braços/mãos coerentes; não é preciso reaplicar esse patch durante combos/natural/rede.

- Corte: **e37398db9fa3d02294cd5abb4929a52afc6caa84678f465fa099f62c61b63371**.
- Pool: **e73ad4f939f4d4dcb001d1f1c7bbc4239de607fe3dac21475ff2f8f77d936184**.
- Tool CPU: **40fb1dad42862426b27cf290a5cd82612e8c4edb15c8ec083354207963b1bb45**.
- Locomoção runtime: **07952bfc**, v6/v7 excluídas. APIs/timings v2 permanecem congelados.

[Recibo desta conferência](../../output/arpg-animation/death-cut-v3/freeze-confirmations/2026-09-19T03-22-37.603909+00-00.json): todos os oito hashes de fonte/tool/loaders/GLBs coincidem com o CPU16 aprovado e estável; não houve repetição de teste inalterado. Provas nativas e death-only existentes continuam vinculadas ao corte atual, sem alegar nova captura ou aprovação do checkout inteiro.

**Fontes Animation liberadas agora para a cópia estável de Combat.** Não haverá edição runtime desta frente durante sua janela combos → natural60s/classes/rede. Animation não reservou GPU; o lock observado pertence a VFX, então a serialização deve seguir o coordenador/lock atual. Nenhuma fila/interrupt ou operação do servidor.

Limites mantidos: duas metades rígidas; gravidade12m/s², tombamento.66s, suporte acima do piso12mm, vida1.65s/fade.35s, máximo24cortes. API de morte confirmada: `remove(zombie,{death:true,deathStyle:'cleave',killedBySkillId:'warrior_cleaving_dash',direction:{x,z}})`. Clipping do renderer continua necessário, sem dano/XP adicional pela apresentação.

**Pendente artístico:** leitura independente das metades na câmera do jogo sob horda/VFX continua fraca, conforme `review/crowd-integrated-art-followup.md`. A captura final pode avaliar isso, mas o freeze não declara esse acabamento resolvido, nem AAA/performance móvel/no-slide. Novo refinamento exigirá candidato separado e outra janela, preservando o atual como antes.

---

> **Conferência atual da revisão root:** [corte/timings](animation-cut-timing-review.md). Módulo de corte continua e37398db, idêntico ao candidato nativo final e CPU. Queda/tampa solicitadas no reviewv2 já incorporadas; AAA pendente. A nota de locomoção df93 no rodapé é histórica da promoção00:53: desde01:30 o runtime usa07952bfc, e a rév5 permanece isolada. Esta conferência não promove nenhum arquivo runtime nem usaGPU.

# Animation — corte v3 corrigido e liberado

Fonte runtime promovida na janela Combat 00:38 UTC, em 19/09/2026 às 00:53:49 UTC: `src/assets/enemy-death-cut.js`, SHA-256 `e37398db9fa3d02294cd5abb4929a52afc6caa84678f465fa099f62c61b63371`. **Fonte liberada e GPU própria encerrada após prova integrada.** Combat pode iniciar sua janela final. Não haverá novas alterações runtime desta frente sem janela separada. Nenhuma escrita em main/server/pool/locomoção; servidor5173 observado ativo no PID97873. Fila Combat saturada: este handoff é o marco durável, sem reenvio em loop.

## Correção do achado root

O plano horizontal cortava também os antebraços e colocava mãos no fragmento inferior. Agora os pedaços conectados abaixo da cintura são classificados pelos pesos dos ossos de braço/mão e pela ligação de props. Pedaços de braço acompanham inteiros o torso. A classificação é por componente conectado, evitando rasgos que um limiar por triângulo causava no Brute.

Índices e grupos de geometria são privados; materiais normais e sombras usam a mesma separação. Texturas permanecem compartilhadas. Skeletons, materiais, cópias de geometria e tampas são descartados; fonte/rig/GLBs permanecem intactos. O suporte considera a geometria realmente visível, inclusive os braços preservados. Gravidade12m/s², tombamento até.66s, limite de chão+12mm, vida1.65s/fade.35s e limite24 cortes mantidos. Tampas escuras vêm das interseções reais; pequenos reparos locais continuam diagnosticados.

Nos PNGs do Walker em.38/.90s a mão solta acima do corpo foi removida, mantendo braço e mão ligados ao torso. Foram inspecionados seus3instantes, a folha do vídeo antes/depois e finais de Orc/Brute/Lich. O corpo ainda é duas peças rígidas estilizadas; braços podem sustentar o torso conforme a pose. Isso não significa ragdoll anatômico, apoio de todos os vértices, acabamento AAA ou orçamento de horda aprovado.

## Provas desta fonte

- [Antes/depois nativo](../../output/playwright/arpg-animation-cut-v3-arms-final/report.json):4rigs,28PNG,4vídeos Chrome/Metal, fonte estável, zero erros/GL. Fixture de assets, não gameplay. O `before` é precisamente o v3 com a mão flutuante.
- Walker:[antes.38](../../output/playwright/arpg-animation-cut-v3-arms-final/zombie-before-0.38.png),[depois.38](../../output/playwright/arpg-animation-cut-v3-arms-final/zombie-candidate-0.38.png),[depois.90](../../output/playwright/arpg-animation-cut-v3-arms-final/zombie-candidate-0.9.png),[vídeo](../../output/playwright/arpg-animation-cut-v3-arms-final/zombie-before-after.webm),[folha amostrada](../../output/playwright/arpg-animation-cut-v3-arms-final/zombie-playback-sheet.png).
- [CPU no runtime](../../output/arpg-animation/death-cut-v3/runtime-fall-cpu.json):16casos,4rigs×2poses×2orientações, pisos0/.4. Sem contornos abertos nos casos, torso cai>25cm, ambas metades apoiadas antes do fade, vértices visíveis>=piso+11.8mm, limites do suporte conferem, pausa/originais/descarte único passam. Média do torso separa os braços agora completos; mínimo de chão continua incluindo toda a geometria visível.
- [Regressão death-only/pool](../../output/arpg-animation/death-cut-v3/runtime-state-cpu.json):4rigs,freeze/stun/retomada,morte prioritária,reuso sem clipping,dt0,expiração,fallback e clear passam. Sobrevivente e ID de skill divergente não geram corte.
- [Gameplay real](../../output/playwright/arpg-animation-death-only-v3/death-only.json):guerreiro/high, menus/mouse/teclas1/3/2, inimigos naturais, getters somente leitura.752frames; evento letal do dash em9.285s,1kill,cutEvents0→1,1cadáver e expiração confirmada. Zero erros console/HTTP/browser e fonte estável. [Queda](../../output/playwright/arpg-animation-death-only-v3/death-cut-warrior-high-falling.png),[apoio](../../output/playwright/arpg-animation-death-only-v3/death-cut-warrior-high-settled.png),[vídeo](../../output/playwright/arpg-animation-death-only-v3/death-cut-warrior-high.webm). Não é natural60s/classes/rede/JEF ou benchmark.
- [Recibo de promoção](../../output/arpg-animation/death-cut-v3/promotion.json): somente o módulo de corte promovido; hashes de main/server/pool/controller iguais antes/depois.

API do pool e contrato Combat não mudaram: morte confirmada com `deathStyle:'cleave'`, `killedBySkillId:'warrior_cleaving_dash'`, `direction:{x,z}`; outras mortes continuam fora. `createEnemyDeathCut` mantém parts/update/dispose e groundY opcional. `diagnostics` inclui capTriangles/openContours/repairedContours/maximumRepairGap/carriedArmTriangles/supportVertices. Não concede dano/XP/recompensa.

## Preservação e pendências

V2 antes em `output/arpg-animation/death-cut-v3/before/`; v3 com mão flutuante em `before-floating-hand/` e `output/playwright/arpg-animation-cut-v3/`. Primeiro ensaio de braços em `output/playwright/arpg-animation-cut-v3-arms/`; fonte final é exclusivamente a de `arms-final/` e do manifesto atualizado. Nenhuma prova histórica foi promovida a prova da fonte nova.

Anti-slide permanece reprovado. Candidato de continuidade está somente em `output/arpg-animation/locomotion-v3/candidate/`, sem promoção. Atual runtime de locomoção segue df93d75c. Próxima janela precisa validar transições reais/turn/start/stop/casts; ré rápida dwarf é causa distinta. Performance com horda/mobile e avaliação global continuam com os gates pertinentes, sem aprovação AAA.
