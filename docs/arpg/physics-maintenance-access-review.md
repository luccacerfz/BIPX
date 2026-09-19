# Physics — revisão de ameaça/rota maintenance-access-v1

**Atualização final9e45:** Environment substituiu e598 e restaurou o tiro oeste serverBloodCow em.30s, mantendo36walkers melee; e598 abaixo permanece rejeição histórica. O novo diagnóstico solicitado por Root está em [physics-maintenance-boss-approach.md](physics-maintenance-boss-approach.md): poses melee existem, mas uma barreira física fechada impede ligação corporal1.72 desde as duas origens; proposta analítica de abertura entregue ao dono, sem implementação. Relatórios72/contraprova server preservados.

## Revisão da segunda proposta — e598121e

**Walkers melhoraram; ameaça boss ainda pendente.** Durante a revisão, Environment selecionou nova cópia com `barrel-2` em `(15.8,13.5)` e `fallen-beam-3` deslocada de x19.7 para20.2, demais parâmetros intactos. Hash **e598121ef38dec0f6d91ec7836806cd6800a94f1f3c95752b57263922e2e6e83**. O primeiro candidato6e09 abaixo é histórico, não o arquivo atual. Nenhum módulo Environment foi editado por Physics.

[Registro independente de hashes e resultados](physics-maintenance-access-review.json). Li o harness atualizado, seus imports transitivos congelados e os reports completos Environment [baseline03:28:54](../../output/environment/maintenance-access-v1/2026-09-19T03-28-54-584Z-baseline-full-inverse.json) e [candidato03:29:59](../../output/environment/maintenance-access-v1/2026-09-19T03-29-59-954Z-candidate-full-inverse.json). O baseline reproduz **exatamente todos os resultados72 originais**, e ambos têm mesma fonte comum/72 starts efetivos/dt/raios/perfis/budget. Somente layout difere. Hash atual da proposta confere com o report, ambos sourceStable. Nenhuma simulação repetida por Physics.

| Caso | Baseline143 | Candidato e598 |
|---|---|---|
|Walker norte cliente/servidor|Sem movimento/hit30s|Melee3.40s, maxVisited30|
|Walker sul cliente/servidor|Sem movimento/hit30s|Melee2.60/2.65s, maxVisited15|
|Walkers18 origens por caller|0/18 impactos|18/18 impactos,1.70–6.35s, maxVisited155|
|Blood Cow cliente18 origens|0/18 impactos|0/18 impactos|
|Blood Cow servidor18 origens|1/18, tiro oeste.30s|0/18 impactos|

Todos os impactos walker registrados têm LOS livre; maior passo dos quatro capturados é.165m, compatível com3.3m/s×.05s. Não houve mudança de budget768. São corpos únicos em fixtures CPU dos callers reais, sem custo de frame medido; não estender a horda/native.

**Perda causal identificada:** na mesma origem efetiva oeste, serverBloodCow passa de1shot/impacto.30s/LOS livre para0shot/0impacto em30s. A nova posição de `barrel-2` intercepta o LOS registrado em t.4539835, ponto `(15.693023664995648,12.99521087199798)` aY.9. Nenhuma das18 origens boss da nova matriz demonstra ameaça. Isso não prova impossibilidade de toda outra abordagem, mas o critério de ameaça boss por alguma abordagem ainda precisa de testemunho real. Comuniquei ao Environment a opção de preservar essa linha na seleção de placement ou demonstrar outra origem válida, sem alterar callers/raios/budget. Recibo da mensagem: `01a0b7b7-be4c-7462-b3ab-31ae0709db3a`.

O risco de imports mistos foi resolvido pelo dono antes destes dois reports: combate/helper e seu contacts transitivo agora vêm do baseline congelado290a; navigation local também usa290a. Runtime912c não participa dessa comparação causal histórica. A futura integração912c terá source binding próprio pelos donos; não repetir a matriz inteira só para mudar o rótulo da prova.

Próximo recorte necessário: após a seleção Environment, conferir os quatro walkers causais e a ameaça boss que o placement selecionado pretende conservar/abrir, mais clearance explícito da rota player. Não repetir72 por Physics; inspeção visual/comfort e promoção permanecem com Environment/Root. Contacts912c continua congelado e nenhuma reservaGPU foi retida.

## Escopo e coordenação

Pedido Root recebido após a promoção autorizada de contacts912c. Physics revisa circulação e ameaça em cópia; Environment decide e escreve placements visuais/colisores. Sem novo planner, mudança de raio, caller, velocidade, dt ou budget768; sem remover decoração por conta própria. A promoção density e seu ganho não resolvem este cenário.

Mensagem enviada ao thread Environment `01a0b6d0-b187-7f03-98f0-2e03358f085f`, recibo `01a0b7b5-abdf-7401-86d1-f7152caf2ede`: fixture compartilhada, achado inicial comunicado, solicitado hash do candidato selecionado e janela CPU fora de GPU/performance dos pares. Nenhum reteste novo executado por Physics nesta revisão inicial.

## Fixture original preservada

- [Diagnóstico inverso72](../../output/physics/navigation-pocket-143-20260919/2026-09-19T03-07-29-945Z-inverse.json), [harness literal](../../output/physics/navigation-pocket-143-20260919/inverse.mjs) e [interpretação/limites](physics-navigation-pocket.md). O script histórico contém retomada dos43 primeiros casos; não executar às cegas como um teste novo.
- Player estacionado em `(18.933,14.268)`, raio.64; walkers reais.78, Blood Cow1.72; dt.05, até30s, mesma extração dos callers cliente/servidor e budget768. Dois walkers capturados: norte `(16.56428861789936,8.359204549834535)` e sul `(16.941432443892353,17.38789948292686)`, ambos starts válidos sem reposicionamento.
- Contraexemplo obrigatório ao alegado abrigo universal: serverBloodCow da origem oeste, posição efetiva livre `(12.999156710361104,11.936954817748697)`, causa dano por projétil em.30s. O pedido de spawn original estava inválido; usar a posição efetiva arquivada na comparação, sem recalcular spawn por variante. Cliente não inclui Blood Cow em `canUseRangedAttack`; preservar essa diferença, sem corrigi-la no ensaio de layout.
- Caso natural original0XP/P9520.9 e reteste de outra rota78kills/P957.7 continuam distintos. Nem a comparação causal proposta nem a promoção density reescrevem essa história.

## Leitura do primeiro candidato disponível

Candidato histórico layout **6e09d4faa528b6eb0f5b3bce0022d0b5178f70fd7802b2350a330dd01b09d7e2**, antes na cópia `candidate` e arquivado pelo dono em `output/environment/maintenance-access-v1/attempt-1-barrel-only/`. Diff observado contra143: somente `barrel-2`, de `(17.2,14.6)` para `(15.8,13.5)`, mesma largura1.2/yaw.5/solid. A fonte comum serve tanto `asset-dressing` quanto `getEnvironmentColliders`, portanto a proposta move visual e collider juntos por construção; isto não substitui inspeção visual nativa nem prova passagem confortável.

[Preflight Environment03:20](../../output/environment/maintenance-access-v1/2026-09-19T03-20-43-963Z-candidate-captured-inverse.json): fonte estável, quatro casos norte/sul × cliente/servidor. **Todos permanecem sem movimento e sem hit durante30s**, maxVisited768, distâncias finais6.365898m/3.701367m. A flag técnica `passed:true` confirma execução/invariantes do harness, não sucesso de aproximação. Esta primeira proposta ainda não atende a intenção de ameaça walker; não recomendar promoção com base nesses quatro resultados.

Environment já reutilizou o report72 com `fixedActualStarts:true`, sem realocar starts por candidato. Adaptações e hashes em [caller-provenance.json](../../output/environment/maintenance-access-v1/caller-provenance.json). O recorte preserva callers reais e é adequado para rejeitar cedo um candidato sem repetir os72 cenários.

## Próxima comparação causal, após seleção do dono

1. Registrar e congelar o hash/layout escolhido, com visual+collider e contagem/identidade de decoração preservados. Usar os mesmos módulos físicos em ambas as variantes. A captura03:20 usou contacts290a/main455; depois da promoção03:27 o runtime é912c. `crowd-control.mjs` importa `../physics/contacts.mjs` e navigation também tem import local: fixar todo esse grafo para não misturar solver antigo local com helper atual. Se atualizar para912c, registrar a mudança de base; não atribuí-la à geometria.
2. Repetir primeiro os quatro walkers capturados com mesmos starts efetivos, dt/perfis/arrivals/ataques/LOS/budget. Registrar percurso, primeiro impacto real, LOS no impacto, máximo passo e nós visitados. Rota planejada sem contato real não basta. Se continuarem imóveis, devolver o achado ao Environment antes de ampliar a matriz.
3. Conservar o caso oeste serverBloodCow e seu equivalente cliente como controle de ameaça/política. Boss precisa de ameaça real por alguma abordagem; não exigir passagem do corpo1.72 em cada abertura. Testar mais uma abordagem somente se a mudança local afetar aquela rota/LOS ou a seleção do dono depender dela.
4. Para o player.64, medir a folga real de uma rota contínua pela abertura selecionada, com todos os segmentos swept e margem mínima explícita. A saída antiga com4.38cm de folga é testemunho de possibilidade geométrica, não gate de conforto. Environment/Root selecionam a composição confortável; Physics informa clearance sem diminuir corpos.

Sem repetir a matriz72 inteira ou A/B density. Reteste CPU somente fora das janelas GPU/perf ativas e com proveniência estável. Esta revisão não autoriza promoção Environment, não prova inexistência de todos os caminhos e não é prova de horda/native/natural.
