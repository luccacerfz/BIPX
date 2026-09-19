# Physics — candidato isolado contra compressão de horda

**Entregue para integração por Combat; runtime ainda intacto.** Responde ao pedido Root posterior a `physics-control-policy.md`. Cópia própria em `output/physics/crowd-candidate-20260919/`. Nenhuma escrita em `src/physics/`, main/server, ferramentas congeladas ou arquivos de outros donos. Sem GPU, novos agentes, mensagens reenviadas ou restart5173; porta observada viva PID97873. Checkout `main`, HEAD `9124df5657474e9ad0a82634a53b987c75d70e9b`.

O candidato impede que o movimento voluntário entre em outro corpo antes da separação. Usa sweep contínuo contra estáticos e vizinhos atuais, com slide e delta limitado. Massa fixa de freeze/stun fica somente no crowd ordinário; pull explícito conserva massa móvel. A recuperação antiga de packs já sobrepostos permanece, pois tentar impor separação perfeita em cada correção local bloqueou sua convergência.

## Candidato e contrato pequeno

- `contacts.mjs`: cópia do módulo Physics com novo export `createActorIndex(bodies,{cellSize:4}?)`. Retorna índice temporário com `update(body)`, `remove(id)`, `query(...)`. Guarda cópias, ids estáveis/únicos, grade em XZ. `moveActor`/`stepActor` aceitam **`options.bodies`** como esse índice ou array de corpos atuais. Sem essa opção, o movimento atual permanece. `separateActors` conserva a recuperação existente e aceita `blockers` opcionais para a passagem restrita de recuperação. `trace:true` retorna segmentos somente para auditoria; deixar desligado no jogo.
- `control-policy.mjs`: referência concreta `separateControlledActors(world,bodies,dt,options?)`. Faz recuperação restrita a controlados/jogadores com orçamento.2m/s, seguida da separação ordinária com controlados fixos. Não altera entradas nem concede status. Para promovê-la em `src/combat/crowd-control.mjs`, ajustar o import para `../physics/contacts.mjs`.
- `navigation.mjs`: cópia byte-idêntica, sem alteração de API ou algoritmo.
- `contacts.patch`: diff contra o runtime Physics atual; **`git apply --check` passou**, sem aplicar. `manifest.json` contém hashes de todos os arquivos e evidências.

Integração proposta nos hooks existentes, quando Combat encerrar sua janela:

1. Construir **um índice por tick de monstros**, depois de skills/spawns, com todos os monstros vivos e jogadores. Corpo `{id,x,z,radius,y?,height?}`; usar os mesmos ids no índice e no movimento. No cliente, criar corpos a partir das posições mesh finais. Não adicionar jogadores duas vezes nem reutilizar ids de monstros para jogadores.
2. Em `updateServerMonsters`/`moveZombieWithPhysics`, chamar `stepActor(world,body,velocity,dt,{bodies:actorIndex})`; aplicar x/z, então `actorIndex.update({...body,x:result.x,z:result.z})` **antes do próximo ator**. Se morrer/remover no tick, `remove(id)`; se criar um summon, `update(newBody)`. Isso é indispensável: um índice contendo só posições antigas do início do frame não atende o contrato.
3. Ao final, substituir apenas o crowd ordinário pelo helper, com timers reais nas cópias. Cliente precisa passar `dt` a `resolveEnemyCrowding` e incluir `freezeTimer/stunTimer`. Copiar de volta somente x/z. Descartar/reconstruir o índice após esse crowd; não reutilizar os buckets anteriores à correção. Nunca persistir `inverseMass:0` em monster/zombie.
4. Manter `pullTargets` uma vez/campo/passo e **massa móvel explícita** nas cópias dos monstros: `{...t,inverseMass:1,pullScale:t.boss?.35:1}`; jogadores0. O pull e a resistência.35 permanecem no caminho existente. O índice ordinário é criado depois do pull, portanto nenhuma âncora histórica desfaz a atração.
5. Manter tick único de timers/ataques e budget de navegação4 com a rotação existente. Não embrulhar o tick inteiro em6 chamadas. Não passar o índice de monstros ao dash/charge: esses golpes mantêm sweep estático e a política de atingir/atravessar vítimas do core. Este candidato trata movimento de horda, não altera a semântica das skills.
6. Para preservar início válido, fornecer `actors` ao `findFreePosition` de novos monstros junto de `maxDistance:16`; incluir vivos/jogadores com raio real e aceitar somente `found:true`. Os spawns atuais consultam estáticos, mas ainda não passam a horda. **Nunca usar essa busca para corrigir caminhada/campo.** Packs já inválidos usam recuperação limitada, cujo pico distinto está declarado abaixo.

Não substituir main/server por cópias antigas. A auditoria injeta as chamadas novas na fronteira de dependências da VM; o dono ainda precisa integrar as chamadas reais e testar navegador/rede.

## Resultado principal: todos os picos registrados

Reprodução original antes de alterar o protótipo: `output/physics/2026-09-19T01-01-31-788Z-control-policy-proposal.json`, fonte estável. Confirmou1.325m de penetração pós-passo a10Hz. O candidato foi testado com10corpos durante3s, para **freeze e stun**, separadamente, nas três frequências.

| Frequência | Atual: pico pós-passo, controlado/vizinho | Atual: pico observado durante avanço* | Candidato: pico em todos os segmentos | Movimento do controlado |
|---|---:|---:|---:|---:|
| 10Hz / dt.1 | 1.325246m | 1.419229m | 0m | 0m |
| 20Hz / dt.05 | .046932m | .232975m | 0m | 0m |
| 60Hz / dt1/60 | .014713m | .069709m | 0m | 0m |

Mesmos números para freeze/stun. O candidato auditou1991/2447/1869segmentos por caso. **Não é só a posição final**: para cada segmento aceito, o verificador calcula analiticamente a menor distância a cada corpo vizinho na posição vigente daquela etapa. Também reproduz a ordem das correções de crowd e pull. `trace` não concede movimentos; registra os movimentos do próprio solver.

*Baseline registra o avanço de cada ator antes do crowd; como não tem trace interno, esses picos não são uma alegação de máximo absoluto de todos os intermediários antigos. A comparação pós-passo reproduz exatamente o diagnóstico anterior. Nos candidatos, todos os segmentos aceitos têm trace. Zero é o valor observado nessas fixtures; não promessa para qualquer estado inicial inválido.

## Controles, cenário, forças e regressões

Relatório principal `output/physics/2026-09-19T01-17-45-680Z-crowd-candidate.json`: **16/16**, `sourceStable:true`. `acceptedForProduction:false`: candidato isolado, ainda sem promoção.

- **Mapa real/120atores/3s/dt.1:**138colliders, bounds55; pico transitório0 em15.221segmentos, passo máximo.330000m. Cem buscas ao todo, máximo4por tick, exatamente30ticks de navegação. Nenhum ator controlado caminhou ou foi empurrado; consulta estática e bounds conferidos por passo.
- **Expiração, dez corpos:** freeze/stun deixam o controlado em0m durante o estado; todos retomaram movimento após expirar em10/20/60Hz. Menor deslocamento individual posterior5.319/5.605/5.839m; passos máximos.330/.165/.055m, sem restauração de posição ou teleporte. Pico transitório0 também depois da liberação.
- **Boss geométrico raio1.72:** timers.8/.65 fornecidos conforme contrato, corpo fixo sob controle e retomada depois. Pull normal.225m/boss.07875m no delta.05, razão.35 preservada. O teste não redefine nem revalida sozinho a autoridade que escolhe a duração da resistência.
- **Frame longo:** pedido5s aceito.1s; ator a200m/s para diante do boss emX=-2.30001; dois atores em direções opostas não se atravessam. Pico transitório0. Não há multiplicação do delta de status/IA.
- **Gravidade real sobre12controlados no cemitério:** centro derivado do projétil na grade(-15.5,-8.61); distância média3.182847→2.028392m/3s, mesmos valores anteriores. Passo máximo.075m, pico transitório1.55e-15m (erro numérico), correção ordinária pós-pull0. Centro, parede, bounds, jogador fixo e expiração continuam cobertos.
- **Cliente/Node:** funções literais de movimento/crowd, um bloqueador congelado e um perseguidor durante3s; diferença máxima0m. Isso não é prova multiplayer renderizada. Consulta de grade contra array completo:800movimentos/40corpos, erro0, mudança de célula e remoção conferidas.
- **Overlaps controlado/controlado e controlado/jogador existentes:**.20/.22m→.001m, passo máximo.01m a20Hz, sem mover jogador. Grade real e borda55 preservadas.
- Regressões adaptadas apenas nos imports/hashes para a cópia: **22/22** em `output/physics/2026-09-19T01-17-45-703Z-cpu/physics-cpu.json`; **12/12** em `...01-17-45-694Z-v2-cpu/physics-v2.json`; **16/16** em `...01-17-45-697Z-integration/physics-integration.json`. Fonte estável em todas. Cobrem solver estático, navegação, spawn, dash/charge, melee/LOS, campo, resistência e lifecycle existentes; ferramentas runtime originais não foram editadas.

### Limite preservado: configuração já comprimida

O teste adicional começa deliberadamente com80corpos sobrepostos em.300m. A recuperação existente atingiu **pico.721007m**, terminou em.001000m e teve passo máximo.346058m; esse pico não foi ocultado pela posição final. Isso **não** satisfaz o gate de começar livre e nunca criar compressão: é recuperação de entrada inválida. O candidato não promete resolver instantaneamente qualquer pack impossível nem permitir teleporte. Por isso o contrato inclui consultar atores no spawn. No teste de repouso original, a recuperação voltou a passar o limite de jitter<1e-6m.

## Custo observado por passo

Node, hook real de monstros em VM,3repetições de3s, warm-up anterior; grade aberta, IA/movimento/crowd incluídos, trace e auditor geométrico desligados. Inclui construção/atualização do índice. Transporte/dano são stubs. Não mede render, áudio, rede, dispositivos nem custo global; CPU não foi reservada exclusivamente. Não extrapolar para FPS do jogo.

| Atores | Hz | Mediana candidata | P95 candidata | Máximo candidato | P95 atual |
|---|---:|---:|---:|---:|---:|
| 10 | 10 | .192ms | .283ms | .498ms | .096ms |
| 10 | 20 | .130ms | .189ms | .366ms | .118ms |
| 10 | 60 | .079ms | .100ms | .301ms | .072ms |
| 120 | 10 | 11.021ms | 12.564ms | 14.083ms | 1.218ms |
| 120 | 60 | 2.703ms | 3.043ms | 4.197ms | .998ms |
| 400 | 10 | 45.496ms | 47.906ms | 49.438ms | 3.709ms |
| 400 | 60 | 10.715ms | 11.657ms | 16.063ms | 3.480ms |

**Custo com400atores continua material**: precisa prova integrada antes de promover desempenho. A primeira versão varria todos os pares e chegou aP95~197ms/100ms; foi substituída pela grade, mas isso não torna o custo final gratuito nem confere aceite global. A tarefa imediata de remover compressão foi resolvida nos cenários válidos; otimização adicional não foi escondida por reduzir o número de atores ou descartar passos.

## Reprodução, hashes e entrega

`node output/physics/crowd-candidate-20260919/verify.mjs` executa matriz, invariantes, cenários e custo. As três cópias `physics-verify.mjs`, `physics-v2-verify.mjs`, `physics-integration.mjs` no mesmo diretório reproduzem as regressões. `BIPX_CROWD_SKIP_PERF=1` serve só para diagnóstico sem benchmark; o relatório final citado executou o benchmark inteiro.

| Fonte | SHA256 |
|---|---|
| Runtime Physics preservado | `d63d1cb1bbcf1b22b524ae948b1588f62a2d3dd34e0c073231ff29cb6c1a8da3` |
| Candidato contacts | `bce8ee0bce3ce4ee9a7c97bfac026d4d1a62b511f0b76535f153be8a39e0e42f` |
| Candidato control-policy | `4380879146c479ba40ea649e998ab8ffdda25a7bfc76f6f982a8238b9a5316a1` |
| Candidato verificador | `b1b6384bbe1b9b7c60e39b7612510ba01b9ec2f9f971393044c6a40ac4997652` |

Navigation copia o hash `4c236c22...06c6bbf1` existente. Fontes no checkpoint final: main `36619edf3994db5d585559fd1806fca0b62a30b50a9ac23ea85f742fd0e3823d`, server `71de8e86...56dd9b7e`, core `a863e12f...00e96e63`, layout `987487e1...be577c`. Hashes completos no relatório/manifest. Main mudou entre checkpoints por trabalho externo a esta frente; todos os arquivos da execução final permaneceram estáveis e foram reconferidos após ela.

**Reconferência posterior01:24:** pacote candidato/artefatos continuam com todos os hashes íntegros, Physics runtime permanece `d63d1c...a8da3`. Main voltou a mudar fora desta frente para `e6e315d6f06a8badba5472ddb3f07f70599c57026a4549f47aa1b3a42075fa04`. A captura acima foi estável no hash36619edf, mas não é promovida automaticamente a esse checkout posterior. Observação gravada no manifest, sem sobrescrever provas nem perseguir a janela de escrita de Combat com uma alegação global.

Iterações rejeitadas e relatórios anteriores preservados: proteção rígida de toda correção bloqueou a horda inicialmente sobreposta; tentativa de relaxar só pares antigos não resolveu; a versão intermediária deixou jitter9µm; o auditor do mapa expôs1.14mm por afastamento numérico da parede. A versão final conserva a recuperação original e, havendo vizinhos, recua pelo segmento seguro em vez de empurrar pela normal da parede. Nenhum limite de teste foi afrouxado.

**Candidato CPU liberado para revisão/integração coordenada.** Runtime Physics/main/server continuam sem essa promoção; nenhuma próxima escrita neles foi agendada nesta frente. Documento é a entrega durável solicitada: fila Combat cheia, sem reenvios. Próximo gate do dono é integrar na janela própria e repetir freeze/stun+gravidade, rede e custo em gameplay; nenhuma GPU foi usada para este candidato.
