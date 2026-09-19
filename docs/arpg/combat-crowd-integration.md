# Combat — janela Physics dinâmica otimizada

**Janela aberta após checkpoint Horizon01:46UTC**, conforme Root.213fontes/18relatórios/HTTP200 requires_further_work preservados em `output/qa/arpg-horizon-integrated-20260919/`. Capturas Combat encerradas/GPU própria liberada. Staging Environment/VFX pode capturar sob lock; nenhum runtime de arte será promovido nesta janela.

Physics é dono de contacts/ferramentas; Combat de main/server e novo `src/combat/crowd-control.mjs`. **Dono Physics: preferir crowd-optimized-20260919 após publicar handoff final; janela aberta para promover apenas contacts validado e publicar hash/API.** Combat adapta hooks ao código atual, sem copiar snapshots históricos. Até confirmação, não iniciar captura com imports incompletos.

Contrato: índice temporário único por tick após skills/spawns com monstros vivos+jogadores, IDs únicos. Atualizar índice imediatamente após movimento/spawn/remove; `stepActor(...,{bodies:index})` só perseguição ordinária. Controlados fixos no crowd ordinário, recuperação limitada de entradas inválidas, timers reais/dt. Pull com massa móvel explícita/resistência boss.35, índice construído depois dele; dash/charge continuam sweep estático. Spawn consulta atores em findFreePosition, nunca reposiciona caminhadas. Um tick de timers/navegação, budget4.

Plano de prova: CPU solver/segurança de cache mais hooks reais cliente/servidor; freeze/stun/pull/parede/boss/spawn/expiração/paridade. Servidor/ranking isolados antes de5173. GPU serializada: contatos/combos/rede/custo integrado. P95CPU400@60 12.456→7.492ms e400@10 50.943→21.037ms são medições do staging, não FPS atual. Custo material permanece. [RevisãoRoot](review/crowd-cache-followup.md).

5173PID97873 permanece vivo; preservar flags Supabase vazias e bytes do ranking. Restart backend somente após testes isolados e nova verificação do processo real. Novo runtime/JEF será candidato distinto. Sem reset/clean/commit/merge/push/deploy.

## Hooks aplicados e spawn corrigido — 02:06UTC

Contacts290a3f35 promovido pelo dono, API congelada. Combat integrou índice por tick/main e world.actorIndex/server com try/finally; update imediato após cada avanço e summon/spawn, remove em morte de monstro/jogador, descarte após crowd. Helper compartilhado separateControlledActors consome timers/dt reais, pull mass1 explícito; dash/charge intactos. Spawn de monstro consulta todos os corpos.

Achado Root de spawn do jogador incorporado: createInitialPlayerState resolve x/z juntos usando sala/corpos vivos (inclui desconectado vivo, exclui self); startRun só troca sessão após found. Sem espaço envia runStartRejected e conserva runId/recursos/CD/sequence/recibo anterior; UI oferece nova tentativa. Welcome usa posição realmente atribuída, reconnect não reposiciona. runStarted agora aplica a posição no cliente antes de enviar seu state.

Primeiros16CPU de hooks reais PASS, depois17/17com custoVM em01:58; são anteriores ao ajuste spawn-player. Protocolo de skills retestou5gruposPASS. Falha inicial de fixture preservada: montava alvo em cima do jogador antes de movê-lo; novo spawn livre relocou corretamente alvo. Harness passou a posicionar jogador antes e afirmar coordenadas exatas, mantendo dano/autoridade.

Novo teste spawn02:05:4gruposPASS,12casos slots×monstro/boss/player, exclusão self/resolução única; WebSockets reais latejoin/restart/resume/sem espaço/retry. Arranjos de ocupantes sintéticos declarados. Primeira tentativa sem espaço usou raio100 inválido para bounds55 e falhou; fixture corrigida para raio30, sem alterar runtime por isso. Relatórios preservados.

Freeze atual de fontes para prova integrada; captura browser spawn em andamento, depois custo120/400 com updateZombies realmente ativo, combos/rede. StressLevel16 histórico pula IA/movimento via perfStressImmortal e NÃO será usado como custo Physics.5173 ainda executa backend anterior; novo backend só em servidor isolado até gates passarem. Environment/VFX staging sem promoção.

## Medição e fixtures — 02:16UTC

Correção exclusiva do medidor conforme Root: peers() só materializa snapshot quando audit=true, antes do movimento. Runtime Physics intacto. O P95400@60=28.940ms de01:58 permanece histórico com cópiasO(N²) extras do harness, não FPS nem custo puro de runtime. Nova medição manterá índice/update/navegação/IA/crowd; custo nativo também permanece gate próprio.

Browser spawn: primeira rodada02:05 errou URL estática (/tmp sem assets); segunda02:11 passou entrada ocupada, mas a fixture gigante de rejeição foi relocada pelo solver vivo durante input. Nada alterado no runtime para satisfazer fixtures. Reteste usa servidor de assets separado e sala inativa apenas para UI de rejeição; rejeição atômica/retry em sala viva já provados por WebSocket02:05. Históricos preservados.

Arte continua congelada. VFX pode usar um intervalo curto isolado após a próxima medição nativa120/400, antes dos testes de combos/rede; respeitar lock atômico. Promoção cannon/composição apenas depois de fechar Physics.

## GPU120/400 concluída — intervalo VFX liberado02:15UTC

Native IAativa em `output/playwright/2026-09-19T02-13-41-998Z-verify-crowd-gameplay/crowd-gameplay.json`: funcional2/2/sourceChangedfalse.120:142.38FPS/P95frame8.30ms/P95crowdCPU3.40ms.400:61.75FPS/P95frame21.60ms/P95crowdCPU18.00ms. **400reprova orçamento P95<=20ms**, apesar da média>=57; nenhum threshold reduzido. Fixture sintética120/400, controles expiram no tick real, nunca perfStressImmortal,10s medidos excluem1.5s warmup/capturas. GPU própria liberada; VFX pode capturar seu bounded isolado agora. Combat aguarda aviso/locklivre para combos/rede e medidorCPU; sem promoção runtime paralela.

Spawn browser02:13:2/2PASS/sourceChangedfalse (sala viva entrada ocupada, sala inativa apenas UIsem espaço/retry). Tool usava telemetry defaultheadless true embora chamada explícita Chromeheadlessfalse; metadado inconsistente é ressalva histórica, launcher corrigido para próximas capturas. Capturas e fontes preservadas.

## CPU final02:17 e regressões02:16

`output/playwright/2026-09-19T02-16-08-868Z-quality-suite/suite.json`:13/13PASS, runtime e ferramentas estáveis. `output/qa/arpg-crowd-integrated-20260919/2026-09-19T02-17-56-484Z/crowd-integration.json`:17/17PASS/sourceStable após spawn. Medidor corrigido P95400@60=6.448708ms;400@10=20.08875ms. Baseline anterior sem sweepdinâmico custa3.144208/3.489708ms, respectivamente, mas não conserva controlados sob pressão. Não chamar28.94→6.45 de otimização de runtime: foi remoção de trabalho extra do auditor, com mesmo solver/cenário. Custos exatos de índice/update/IA/navegação/crowd continuam medidos; VM não éFPS.

PNG UIrejeição inspecionado: título longo ultrapassa coluna e contraste do botão é baixo na captura; proposta preservada em combat-spawn-ui-followup.md.2checks funcionais não aprovam arteGUI. Fonte fica congelada nesta etapa.

## Janela encerrada02:27UTC

Todos os gates funcionais previstos concluídos; custo400frameP95falha21.6ms>20 explicitamente mantido. JEFHTTP200 requires_further_work,214fontes/15relatórios em docs/jef-arpg-crowd.md. Backend5173atualPID66986, ranking byteidêntico e smokeWebSocketmenuPASS. Esta fonte fica preservada como checkpoint; Environment abre próxima janela separada. Canhão continua staging.
