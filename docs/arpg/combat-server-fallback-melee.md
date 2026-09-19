# Server fallback melee — promovido e servido

**05:55 UTC:** candidato **16ac7e88** promovido com patch de três linhas, após o [par WS causal](../../output/server-fallback-melee-v1/protocol/2026-09-19T05-51-38-819Z-rail/report.json) passar com os mesmos dez hashes. `burial-rail-2`: player(-14,18.26), Brute executioner(-14,20.28), distância2.02<nominal2.72, corpos válidos/separados, HP200→200 por1.45s. Controle livre na mesma distância/alcance: HP200→113, três hits, cadência preservada e mensagens idênticas em dois clientes. Estado fixo por IPC declarado; não gameplay natural. O wall distante anterior continua sem poder discriminar LOS sozinho.

[Physics independente](physics-server-fallback-melee.md):8grupos/58simulações, elites e limites/LOS/controle temporal. [Promoção](../../output/server-fallback-melee-v1/promotion.json): somente server mudou entre225 fontes; [reinício](../../output/server-fallback-melee-v1/restart.json)65261→**5973**, HTTP200/Supabaseoff/ledger7f580798 intacto. [Smoke servido](../../output/server-fallback-melee-v1/served-smoke.json)2PASS: quatro fontes públicas HTTPexatas, entrypoint privado404 e grafo Node10 exato; dois clientesWS em menu com estado entregue. Sem startRun em5173 para não registrar partida no ranking. Prova de HP vem do servidor isolado com o mesmo grafo.

[Adendo de integração](../../output/server-fallback-melee-v1/integration-addendum.json) preserva todos os reports anteriores. Tentativa rail05:51:21 usou `wall.id` em vez de `colliderId`; tentativas smoke05:54:29/48 esperaram HTTP200 do entrypoint privado e usaram `yaw` em vez de `rotation`. Correções só dos harnesses, sem mudar fonte/gates de dano; arquivos FAILED arquivados. Não houve GPU/suíte global/novo benchmark/aceite artístico.

## Histórico — preparação e validações anteriores

Autorização Root após fechar Environment/pursuit; diagnóstico [caller inalcançável](review/server-fallback-melee-unreachable.md). Nova cópia de10dependências atuais/layout153 em `output/server-fallback-melee-v1`, original29bb preservado. Único delta **server16ac7e88**. Nenhum live/restart/GPU.

[Patch mínimo](../../output/server-fallback-melee-v1/server.patch): acrescenta `fallbackMeleeRange = meleeTiming ? meleeRange * .84 : meleeRange`, usa a variável no gate e arrivalRadius. Fallback semtiming passa ao alcance nominal existente+reachBonus; Walker/runner mantêm .84 na aproximação e seus próprios marcadores. Não muda raio, velocidade, dano, CD, LOS. Lich/Brute07/Animation independentes.

## Evidências e proveniência

[66CPU](../../output/server-fallback-melee-v1/cpu.json)PASS: caller literal +contacts/navigation/crowd/status reais, quatro famílias×elites×contato/nominal, CD, fora de alcance, parede fina dentro do nominal, freeze/stun e paridade exata Walker/runner/ranged. Geometria sintética e dano observado por chamadas; nãoHP.

[WS17checks](../../output/server-fallback-melee-v1/protocol/2026-09-19T05-42-11-410Z/report.json) passaram, mas report global continua **FAILED** pelo último arranjo ranged emz+8 ter sido relocado por obstáculo. Corrigido somente arranjo paraz−8 e executado [um controle ranged restante](../../output/server-fallback-melee-v1/protocol/2026-09-19T05-43-35-252Z/report.json), PASS/clean. Mesmos10hashes16ac; não chamar conjunto de18/18suitePASS. Tentativa05:41 falhou pela fixture ler radius no snapshotsemcampo; retorno privado corrigido, fonteintacta. [Recibo congelado](../../output/server-fallback-melee-v1/receipt.json).

Servidor real efêmero+dois clientesWS: Brute200→113 (3×29), OrcPeon200→152(3×16), CowWalker200→122(3×26), BloodCow200→113(3×29); mesmas mensagens nos dois clientes, intervalosSimTime≥CD, corpos sem penetração. Cada família manteve200 fora do nominal e atrás de sólido153. Elite reachBonus.82 exercitado; timedWalker/runner não dão dano imediato e atingem apósmarker; freeze/stun bloqueiam; casterranged emiteprojétil real eHPdiminui. Nada altera ledgerlive.

Fixtures usam posicionamento/HPinicial restaurado/speed0 para distâncias estáticas e reachBonuselite explícito. Runtime caller/damage/transport reais; não partida natural nem teste de rolagem probabilística de elites. ParedeWS fica fora do nominal; LOSdentrodoalcance é provaCPU com parede fina real no solver. Broadcastobserverforwarding só registra tempo/HP.

## Próximo passo na preparação histórica

Physics revisa geometria/elite/spawn/rail em cópia própria, sem editar este candidato. Candidato pronto para revisão do lote; **não promovido**. Só promover com hash estável e smoke do servidor servido, preservando5173/Supabaseoff/ledger. JEF05:35 permanece diagnóstico anterior e não será reescrito; futura integração significativa requer nova atribuição de fonte.
