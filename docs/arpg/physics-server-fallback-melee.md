# Physics — fallback melee server: revisão geométrica CPU concluída

**Parecer favorável no escopo CPU do candidato16ac7e88;8/8grupos passaram.** [Report completo](../../output/physics/server-fallback-review-20260919/report.json), [resumo/hashes/integridade](../../output/physics/server-fallback-review-20260919/summary.json), [verificador próprio](../../tools/physics-server-fallback-review.mjs).58simulações/3761passos,188chamadas de dano e8de projétil observadas. **HP não aplicado; nenhuma prova de rede/browser/autoridade por esta revisão.** Nenhuma alteração nos fontes/candidato de Combat ou live.

## Base e patch exatos

Escopo combinado com Combat`msg_ca099cbcb0e1` após [fechamento do lote153](combat-environment-pursuit-integration.md),final-check05:36:28. Nova cópia própria`output/physics/server-fallback-review-20260919/{baseline,candidate}`,22arquivos no total (11por variante: grafo10inclui entrypoint +package.json), byte-idênticos às duas árvores do dono. Baseline server **29bbf681ab613cd79be702400e2b6a3eb49a275a03d173e3a7f2d3bdcb62eefb**; candidato **16ac7e88cf27a8398cafb4515048737927188c12a794a49f848d593bf3179da9**. Contacts912c/nav e46cc/layout9f6e153 reais e iguais nos dois lados. Manifesto integral e cópia imutável do script incluídos.

Comparação do arquivo inteiro confirmou somente três linhas do patch do dono: acrescenta `fallbackMeleeRange = meleeTiming ? meleeRange * 0.84 : meleeRange` e usa a variável no gate earrivalRadius. Assim, o nominal é restaurado apenas em famílias semtiming; Walker/runner conservam política anterior também durante perseguição. Perfis,raios,speed,dano,reachBonus,cooldowns,ranged,LOS.9 e prioridade de alvo*.84 não mudam. Esta é a proposta real revisada, mais restrita que o contrafactual Root de remoção global dos dois fatores.

Caller,spawn,targeting,status,crowd bodies,difficulty/balance e ranged cooldown extraídos literalmente; módulosPhysics/nav/crowd/timing/skills importados da própria cópia. Controle de dano/projétil é observer; broadcaster registra eventos. O script exige o diff literal esperado e falha se houver outro delta. Eleição doelite éfixture, usando perfis reais e spawn real; cooldown inicial colocado em0 para disponibilidade inicial explícita, valores posteriores originais.

## Geometria, elites e cooldown

| Família semtiming | Soma raios | Alcance nominal | Chamadas em5s a20Hz | Intervalo observado a10/20/60Hz |
|---|---:|---:|---:|---|
| Brute |1.82m|1.90m|8|.700/.650/.633333s|
| OrcPeon |1.49m|1.55m|6|1.000/.900/.900s|
| CowWalker |1.50m|1.58m|8|.700/.650/.633333s|
| BloodCow |2.36m|2.44m|6|.900/.900/.866667s|

Todos atacam com corpos separados; gate é inclusivo no nominal e não chama dano no primeiro tick a **nominal+.0001m**. Cada impacto observado revalida alcance/LOS reais. Nenhuma repetição por tick ou intervalo menor que o cooldown. A10Hz Orc produz5chamadas/5s, não6: subtração de.1 pode deixar resíduo positivo do timer.9 e consumir umtick adicional. Quantização/arredondamento de timer já existente, sem modificação neste patch; não chamar esses intervalos uma nova animação/timing.

Nove pares elite(tipo×furious/armored/executioner) de Brute/OrcPeon/CowWalker: raio mantém `profile.radius`, reachBonus **.12/.05/.82** aplicado uma vez. Todos golpeiam na faixa ampliada válida e não golpeiam acima dela; dano da chamada mantém multiplicadores/difficulty reais e bônus de wave. Boss não recebeelite. Frequência de spawn/elites não foi testada.

Quatro casos de parede fina dentro do alcance: corpos e jogador válidos, parede passa entre eles sem sobreposição, zero chamadas de dano/projétil em1s. O limiteY daLOS foi discriminado: maxY.89 permite golpe por cima; maxY.90 e1.1 bloqueiam a linhaY.9. **Comportamento geométrico da política existente**, não prova de encaixe visual de arma/corpo.

Caso único no layout153 completo: `burial-rail-2`, jogador(-14,18.26), Bruteexecutioner(-14,20.28). Distância2.02m < alcance2.72m, ambos corpos válidos, LOS bloqueada pela grade, **zero chamada no tick**. Demonstra que o negativo depende daLOS, não de posicionar os corpos fora de alcance. Não afirma contorno global da grade nem aprisionamento.

## Controles e limites

Walker/runner: contato e perseguição de6m ao redor de obstáculo sintético, baseline/candidato com **posições,planos,eventos,chamadas de dano exatamente iguais**. Primeiro hit observado no contorno:Walker2.15s/runner1.45s;1plano cada. Caster/BloodCow a20m: posições e chamadas de projétil/ranged cooldown iguais nos dois lados, nenhuma troca indevida por dano melee nesses controles.

Pós-update: penetração dinâmica máxima0 e deslocamento de recuperação estática0 nos3761passos; chords corporais de movimento livres nos casos registrados. Um inimigo porfixture: máximo1plano/tick,visitas≤768. **Não é nova prova do orçamento global4, horda ou pico intrapasso.** Não medido custo/FPS, não repetida matriz72/suíteglobal/natural. Primeiro report8grupos com controles somente em contato está preservado em`history/contact-only-controls`; último report adiciona apenas a perseguição necessária para exercitar a política do planner.

Os22arquivos próprios e22originais do dono ficaram estáveis; server/layout/nav/contacts live monitorados iguais. Baseline combinado e evidência Root foram somente lidos. Porta5173 continuaPID65261 e ledger7f580798 idêntico na conferência05:41. Nenhum GPU/browser/servidor próprio aberto, nenhum restart/promoção porPhysics. Fontes liberadas e nenhuma próxima escrita runtime prevista.

Combat mantém implementação/promoção e os gates WebSocket/HP real, cooldown servido, negativos e controles solicitados porRoot. Fallback continua instantâneo; não introduz marker/FSM nem resolve Brute07/v6, dano artístico/encaixe, latência ou rede por associação. A revisão não amplia alcance/raio/dano para outra política.

---

# Histórico de preparação

Preparação autorizada Root05:31, independente e **depois** do lote Environment/pursuit. Combat conserva ownership de server.mjs. Aviso de escopo enviado`msg_0f70ab182a05`: aguardar freeze pós-lote e patch/hash do dono antes de criar nova cópia executável. Nenhum baseline combinado, runtime, servidor5173 ou evidência anterior será modificado. Sem GPU.

Base lida: [diagnóstico Root](review/server-fallback-melee-unreachable.md), reprodutor literal e report12pares. O contrafactual remove somente fatores0.84/.84 em gate earrivalRadius, preservando fator de priorização de alvo. Isso não é ainda patch/HP/rede comprovados.

Escopo proposto ao Combat: quatro famílias semtiming(Brute,OrcPeon,CowWalker,BloodCow), alcance exato e imediatamente fora, cadência comdt10/20/60Hz, linhaY.9/parede e altura do sólido, elitesfurious/armored/executioner elegíveis e controlesWalker/runner/ranged. Extrair caller/spawn/profiles literalmente da nova cópia, usar contacts/nav/crowd/timing/skills reais; observer de chamadas de dano/projétil, sem alegar HP/transportes. Raios/speed/dano/cooldown/grade/budget não serão alterados.

Achado estático útil: spawnserver usa `radius:profile.radius` também paraelite, e `reachBonus:eliteProfile?.reachBonus??0`; não aplicar crescimento de raio inventado no teste. Bônus reais.12/.05/.82, boss não recebeelite. Gate novo deve consumir esse bônus uma única vez. Fallback aplica dano instantâneo condicionado àLOS no mesmo tick; não ganhaFSM/marker de animação por este patch. Brute07/atuaçãoV6 e network permanecem fora desta revisão.

Aviso final ao Combat aceito via Orca; resultado e limites disponíveis neste documento durável para Root. Leitura/aceite do dono não presumidos; nenhum pedido de promoção foi executado por Physics.

Coordenação final: `msg_f348a0746143`; correção de redação do inventário enviada separadamente (22total,11por variante). Manifesto/resultados não mudaram.
