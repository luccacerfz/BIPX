# Physics — dwarf na manutenção143, diagnóstico isolado

## Sentido inverso: ameaça real ao jogador

**Diagnóstico bounded concluído03:08, sem runtime/GPU/benchmark.** `output/physics/navigation-pocket-143-20260919/2026-09-19T03-07-29-945Z-inverse.json`:72 cenários com fonte estável, extração literal dos callers cliente/servidor, player parado no ponto original. São18 entradas por tipo/caller: os dois atores capturados e oito direções em anéis6m/10m. Tipos reais walker raio.78/velocidade3.3 e Blood Cow raio1.72/velocidade2.55. dt.05, até30s ou primeiro impacto confirmado; sem alterar raio, speed, navegação ou cenário.

| Caller/tipo | Entradas | Primeiro impacto em30s |
|---|---:|---|
|Cliente/walker|18|Nenhum|
|Servidor/walker|18|Nenhum|
|Cliente/Blood Cow|18|Nenhum|
|Servidor/Blood Cow|18|Uma entrada oeste: projétil em.30s|

Os dois walkers capturados eram válidos e permanecem sem hit a6.365898m e3.701367m do player, respectivamente, nos dois callers. Boss no ponto norte também era válido; o ponto sul não comportava raio1.72 e foi registrado como inválido antes do teste de spawn, sem chamar sua correção de caminhada. Em cada conjunto,13/18 starts walker e12/18 boss eram válidos como pedidos; os demais usam **findFreePosition apenas na criação da fixture**, com posição e distância explicitamente registradas. Todos os percursos aceitos são swept, estaticamente válidos, sem passo acima de speed×dt; maxVisited768/budget4 preservados. Report retém cada caminho por tick, planos, LOS e impactos.

Contraexemplo a imunidade universal: Blood Cow do servidor nasce na posição livre `(12.999156710361104,11.936954817748697)` (request oeste inválido resolvido2.331984m na criação), a6.375286m do player. Caller real dispara e `updateServerProjectiles` real confirma dano em.30s, com LOS livre a1.05 e sweep completo do projétil. Não precisou atravessar o gargalo.

**Diferença concreta para Combat:** `serverMonsterProfiles.bloodCow.ranged=true` e o caller autoritativo permite o disparo; `canUseRangedAttack` do cliente não inclui bloodCow. Logo o contraexemplo do servidor não prova ameaça equivalente no modo solo. Nenhuma edição foi feita para alinhar essa política.

Conclusão limitada: há proteção forte contra walker/Blood Cow **no solo e nas18 entradas testadas**, além de falha da busca em chegar a uma posição útil de ataque. Muitas buscas esgotam768 nós e repetem pelo cooldown atual; isso é trabalho real de IA, mas não foi medido como frame time. O local **não é imune a toda ameaça no servidor**. Não demonstramos impossibilidade geométrica de todos os caminhos de todos os tipos: failure/budget do planner não prova topologia fechada, uma horda pode mudar o comportamento, e casters/outros bosses/skills não foram cobertos. A liberdade de fuga do player.64 tampouco prova acesso de.78/1.72.

O reteste natural03:00 com78kills/P957.7 é outra rota, sem escape acionado; o caso0kills/XP/P9520.9 continua aberto. Não recomendar novo planner/mudança de props a partir desta prova isolada. Combat/Environment podem decidir alcance/política de ameaça do local à luz destes resultados.

Execução parou automaticamente ao aparecer outro lockGPU depois de43 casos; retomou somente os29 restantes, preservando `inverse-paused43.json`/script anterior e proveniência no report final. Não há custo/performance anunciado durante a janela concorrente. Main congelado usado na extração455addd3, server29bbf681, contacts290a, nav911e0, layout8e756fe4. Visual, áudio e rede foram omitidos; movimento, status, ataque/melee/LOS/crowd e projéteis autoritativos são funções reais.

O material abaixo é o diagnóstico anterior no sentido do jogador; o witness manual não é uma proposta de steering automático.

Runtime contacts290a/navigation911e0ea2/layout143 congelados. Nenhum patch de runtime, arte ou steering do QA aplicado. Prova barata em `output/physics/navigation-pocket-143-20260919/pocket.json`, fonte estável; script e cópias das três dependências preservados. Sem GPU/benchmark/CPU pesado durante Animation.

Reprodução do achado Combat, `output/playwright/2026-09-19T02-49-37-647Z-verify-natural-runs/natural-dwarf.json`: posição arredondada publicada `(18.933,14.268)`, raio.64, é estaticamente válida. Para ambos os alvos informados, grade1.25 retorna no-route/visited2. Grades.625 e.5 retornam no-route/visited5. O segundo anel direto também encontra todos os segmentos bloqueados. Portanto repetir/ampliar apenas o conector anterior não é correção suficiente.

**Existe saída contínua para raio.64.** Witness manual (não planner automático): `(18.933,14.268)` → `(18.75,15)` → `(18.25,15.5)` → `(17.75,15.75)` → `(17.25,15.78)` → `(16.75,15.72)` → `(16.25,15.65)` → `(15.75,15.5)` → `(15,15)`. Todos os pontos/segmentos passam moveActor(delta0)/sweepStatic(kind actor) reais sem contato/correção. Dali navigation911e0ea2 chega aos dois destinos com suffix normal, também integralmente validado. O script preserva o percurso, extensões e comprimentos; nenhuma posição foi aplicada ao jogo.

O gargalo fica entre barrel-2 e burial-rail-3. Distância do centro do barril à linha da grade1.929775m; descontados meia espessura.09 e raio.516, abertura física1.323775m. Para diâmetro1.28 do jogador, sobram **.043775m** de folga entre os centros permitidos. Raio máximo geométrico nesse gargalo ≈**.661888**; inimigo padrão.78 e boss1.72 não passam por essa abertura, independentemente da grade. Não generalizar o caminho do jogador para esses corpos.

Proposta de próximo experimento, se necessário: fallback local de conectores junto às bordas expandidas de obstáculos, somente quando a componente inicial esgota; todos os segmentos swept e nós debitados do mesmo maxVisited. Não diminuir globalmente a grade: mesmo.5 falha, e amostragem global suficientemente fina teria custo inadequado. Antes de propor promoção, esse fallback precisaria encontrar o witness automaticamente, respeitar um limite fixo de candidatos/consultas e provar determinismo/custo/ordem. Esta entrega **não contém esse algoritmo** nem promete completude do planner.

Ao Combat: steering de QA pode se afastar/reverter a direção quando o avanço real zera e escolher alvo com LOS; não usar o witness hardcoded como comportamento geral. Ao Environment: registrar esse gargalo de raio dependente na avaliação de acessibilidade, sem mover props silenciosamente. O ocorrido não prova túnel nem aprisionamento físico absoluto do player, e tampouco resolve o resultado natural dwarf0kills/XP/P95frame20.9ms. Custo e reteste natural permanecem gates separados.
