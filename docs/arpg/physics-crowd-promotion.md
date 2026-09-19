# Physics — módulo de contatos promovido e API congelada

**Confirmado para Combat em 19/09/2026, 01:52 UTC:** autorização lida integralmente em [combat-crowd-integration.md](combat-crowd-integration.md), revisão independente [crowd-cache-followup.md](review/crowd-cache-followup.md) conferida. `src/physics/contacts.mjs` foi promovido como cópia byte-idêntica do candidato otimizado validado. **API congelada e fonte liberada para a integração de Combat.** Nenhuma próxima escrita runtime prevista nesta frente.

| Arquivo | SHA256 atual |
|---|---|
| `src/physics/contacts.mjs` | `290a3f35b23e00ff86dcb5dad6911c5e8dfbda0b517cba4e7a63a02b69f07a80` |
| `src/physics/navigation.mjs` — preservado | `4c236c22b7e6d1a3df8d4b0069ae60a2814b29fbd2de3e9ebd88375906c6bbf1` |

Somente `contacts.mjs` mudou no runtime nesta promoção. Pré-imagem d63d1c preservada em `output/physics/2026-09-19T01-51-17-727Z-promotion/contacts-before.mjs`; registro, hashes e resultados em `promotion.json` no mesmo diretório. Pacotes bce8ee0 e 290a3f35, seus verificadores, perfis e evidências anteriores permanecem intactos. Seus manifests descrevem os checkpoints históricos de staging; esta confirmação posterior é o estado atual da promoção.

## Contrato final para os hooks atuais

Exports: `createCollisionWorld`, `sweepStatic`, **`createActorIndex`**, `moveActor`, `stepActor`, `findFreePosition`, `separateActors`, `pullActors`. Import browser/Node puro, sem dependência de DOM ou Three. Navigation conserva `findNavigationPath` e `getPursuitDirection`.

- `createActorIndex(bodies, {cellSize: 4} = {})` retorna `{update(body), remove(id), query(minX,minZ,maxX,maxZ)}`. Copia os corpos de entrada; IDs estáveis e únicos por `String(id)`, inclusive entre jogadores e monstros. Query ordenada lexicalmente por ID, array independente por chamada. Update/remove invalidam o cache; remove retorna boolean. Atualizar dados pelo método `update`, sem editar snapshots retornados.
- `moveActor(world, body, displacement, options)` e `stepActor(world, body, velocity, dt, options)` aceitam `options.bodies = actorIndex` ou array com posições atuais. O próprio `body.id` deve coincidir com o ID usado no índice. Chamadas sem `bodies` preservam o caminho estático anterior. Subpassos/dt, raio/altura e resultados existentes continuam iguais.
- `trace:true` opcional registra segmentos aceitos em move/step/separate/pull para QA; desligado no gameplay e nas medidas de custo. `separateActors(...,{blockers})` aceita corpos externos para proteger a recuperação do subconjunto controlado. Recuperação ordinária limitada permanece; não substituir todos os pares por bloqueadores rígidos.
- `findFreePosition(...,{actors,maxDistance:16})` já aceita os atores atuais para spawn livre; aceitar apenas `found:true`. Nenhuma procura de spawn para corrigir caminhada. `pullActors` continua em lote uma vez por campo/passo, inimigos com massa móvel explícita, jogadores fixos e resistência de boss .35.

O [contrato completo do candidato](physics-crowd-candidate.md) continua vigente: índice único depois de skills/pull/spawns; `update` imediatamente depois de cada movimento e criação, `remove` em remoção; reconstruir após crowd. Um tick de status/navegação, orçamento 4 com rotação. Aplicar índice somente à perseguição ordinária; dash/charge conservam sweep estático e atravessamento de vítimas do core.

**Combat continua dono de main/server e `src/combat/crowd-control.mjs`.** A política `separateControlledActors` permanece como referência isolada em `output/physics/crowd-optimized-20260919/control-policy.mjs`: controlados fixos no crowd ordinário, recuperação limitada de pares inicialmente inválidos e pull explicitamente móvel. Nenhum helper foi criado no runtime por Physics e nenhum snapshot antigo foi copiado para main/server. Combat pode adaptar o helper/import relativo e conectar os hooks atuais sem mudança adicional de API Physics.

## Verificação após a promoção

Execuções novas usando o módulo runtime, todas sem alteração de fonte durante o teste:

| Verificação | Resultado | Evidência |
|---|---:|---|
| Solver estático, bounds, crowd e spawn | 22/22 | `output/physics/2026-09-19T01-52-02-052Z-cpu/physics-cpu.json` |
| Primitivas v2, dash/charge, navegação e pull | 12/12 | `output/physics/2026-09-19T01-52-02-061Z-v2-cpu/physics-v2.json` |
| Hooks literais cliente/servidor presentes neste checkpoint | 16/16 | `output/physics/2026-09-19T01-52-02-072Z-integration/physics-integration.json` |
| Cache/índice, paridade de segmentos e 400 atores | 6/6 | `output/physics/2026-09-19T01-51-17-727Z-promotion/2026-09-19T01-52-02-069Z-optimization-safety.json` |

Os seis grupos de cache importam **`src/physics/contacts.mjs` diretamente**, com navigation atual e cópia do helper apontando ao mesmo módulo. Os hooks e demais dependências dessa fixture continuam congelados para comparação exata com bce8ee0. Passaram invalidação/mutação, raios/alturas variados, 2.100 movimentos e os mesmos segmentos dos 400 atores a 10/20/60 Hz. Pico transitório observado 0 m, controle 0 m; mapa real com 400 atores preservou 120 planos em 30 ticks, máximo 4/tick. Os 16 checks de hooks atuais são compatibilidade anterior à nova ligação do índice, **não aprovação antecipada dos hooks que Combat ainda vai adaptar**.

**Observação posterior ao teste:** main/server mudaram durante o fechamento do handoff, fora das escritas Physics, enquanto a janela de integração do dono está aberta. `promotion.json` registra os hashes testados e os observados depois. O módulo contacts continua no hash congelado; os checks de hooks acima não são promovidos às novas fontes. Reexecutar a integração quando Combat concluir suas chamadas/helper.

Reprodução: `node tools/physics-verify.mjs`, `node tools/physics-v2-verify.mjs`, `node tools/physics-integration.mjs` e `node output/physics/2026-09-19T01-51-17-727Z-promotion/runtime-cache-verify.mjs`. A fixture de promoção e o helper de QA ficam somente no diretório de evidência.

## Limites e continuidade

Desempenho continua sendo o A/B de staging: P95 400/60 Hz 12.456→7.492 ms, incluindo índices; não foi repetido nem promovido a FPS integrado nesta etapa. O pico .721 m da recuperação do pack inicialmente inválido continua declarado; zero das entradas válidas não apaga esse limite. Próximos gates de Combat: hooks novos/clientes/servidor/helper, testes em servidor e ranking isolados, controles/pull/boss/spawn/expiração/rede/custo e só depois a atualização de 5173. GPU permanece serializada; Physics não tomou lock nem abriu navegador nesta promoção.

5173 continua no PID97873, sem restart por Physics. Main/server e ferramentas originais foram apenas lidos/executados, não editados. Nenhum queue, interrupt, agente extra, commit ou deploy. Esta é a confirmação durável solicitada; a [liberação no handoff Physics](physics-handoff.md) aponta para este registro.
