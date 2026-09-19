# Dash — proposta mínima de apresentação pós-mixer

## Contrato vigente07:34 — seguir todos os frames enquanto efeito atual está vivo

ComplementoRoot em [seleçãoart1](review/dash-art1-selection.md) substitui a restrição pending-only do histórico. Pool final **e19eefbd8f975823ab2ee0bb556cd1f5922e838439651067fa42f85f5e790a8d**, wrapper **08d5abfe3d69563eb0be90101ddd90753b66e1b57deac528813ba777d5bfe1a5**; [CPU13](../../output/vfx-dash-art-v2/cpu-report.json)/freeze atual. Pais event-only e preparo-only preservados em history.

API aceita preparo/arco de execução existente enquanto seu slot estiver vivo, inclusive frames sem novo pacote remoto. `headSegment` identifica a esteira ainda aberta: só sua ponta e o arco seguem o socket; seu começo e todos os segmentos fechados permanecem fixos. Outro travel fecha o anterior e abre novo segmento a partir do último socket resolvido. Não cria geometria/evento no callback; não muda timestamp/life/TTL. Salto de socket>3.2m oculta somente o trecho aberto desconectado, sem impacto inventado.

Combat mantém tracking depois de cada flush aceito (cast/release/travel), até API retornarfalse. **Terminal+end normal mantém tracking durante a cauda visual de.09s já existente**, mesmo se root remoto ainda estiver interpolando; ao expirar o arco, retornafalse e encerra acompanhamento. Se a interpolação durar mais, o arco desaparece, não se prolonga nem se teleporta para contato final. RetiredID bloqueia recriação por pacotes atrasados, mas não remove imediatamente a entrada terminal já viva. Cancelreason/morte/reset/desconexão removem imediatamente. Expiração visual não terminal remove tracking até eventual próximo evento válido, sem aposentá-lo como se houvesse end recebido. Pausa não avança clock; usar mesma pose do mixer.

Stats acrescentam headSegment/following; pending é apenas diagnóstico de evento fresco, **não gate de callback**. CPU novo comprova4frames sem pacote e4de interpolação terminal, origem/histórico/aClock/aStyle fixos, término na vida original e teleporte sem ponte. Native deve agrupar local/remoto, fresh/between-event/terminaltail; não filtrar só os frames corrigidos ou só emit. Nenhuma aprovação nativa/arte remota antecipada.


## Implementado art2/API07:30 — preparo acompanha pose, demais fases pendentes

Root07:23 autorizou; Combat prepara hook/mapa em cópia d9e. Pool **eb588253b734c0057948e11277e54eac33849833f4359f04f07b088da54d9d8b**, wrapper **08d5abfe3d69563eb0be90101ddd90753b66e1b57deac528813ba777d5bfe1a5**, em `output/vfx-dash-art-v2/candidate/`. [Freeze2](../../output/vfx-dash-art-v2/freeze-manifest.json), [CPU11](../../output/vfx-dash-art-v2/cpu-report.json).

**Refinamento explícito à proposta original abaixo:** durante preparo existente e ainda vivo, updateDashTransform aceita atualizações de pose a cada frame, sem novo emit e sem prolongar life/TTL. Combat deve manter `preparing` desde cast até release/expiração; retorno false remove o tracking. Isso impede o arco curto de ficar no ar enquanto a mão anima. Depois de release, somente a pendência aberta por release/travel pode ser corrigida antes de update; update(0 também) fecha a pendência. Terminal+end normal preserva a resolução final. Cancel/end comreason, reset/dispose/expiry/ID inválido bloqueiam. MensagemCombat msg_598ca9de1f4e.

A API atualiza centro do arco +último aTo apenas, guarda lastEmitter resolvido para começo da próxima amostra, mantém todos os aFrom históricos, aClock/aStyle e sparks de contatos. Chamada repetida com mesma pose no frame é idempotente incluindo stats. Em vários travels recebidos no frame, corrige somente último segmento. A lista `stats.dash.records` expõe preparing/pending/pendingSegment/lastEmitter, e stats globais transformUpdates/lastCorrection. Nenhuma propriedade core muda.

CPU11 inclui replay das23poses nativas gravadas: buffer corrige para posição pós-render observada (limite Float32), sem alterar eventos e histórico; esse replay não substitui nova medição do socket desenhado. Preparo.08/.119/.16 ativo e segue pose; terminal/end,invalid/cancel/reset, múltiplos travels e freeze histórico passam. Native arte/local/remoto pendente, nenhuma promoção.


Estado07:21: proposta ao dono Combat; nenhuma mudança main/live implementada por VFX.

## Evidência concreta

[Native07:13:48](../../output/vfx-dash-art-v1/native-2026-09-19T07-13-48-249Z/report.json), um input real Digit2 confiável, personagem Aldric5c, qualidadehigh, cópia congeladaebb8. Observador encaminha `cinematicPipeline.render` uma vez e só lê depois.23 eventos travel frescos: received→drawn min **.046746779m**, máximo **.251301742m**, média **.167138772m**. Release e primeiro travel no mesmo frame; terminal/end reais. Movimento chega8m. Cast1/release1/travel23/end1; miss sem impacto inventado. Este recorte confirma atraso espacial local do emissor em relação à pose desenhada, não mede impacto perceptual global nem remoto.

[Paridade de código](../../output/vfx-dash-art-v1/native-2026-09-19T07-13-48-249Z/main-order-parity.json): função presentClassSkill e trecho heroVisual.update→classSkillVfx.update byte-idênticos no parentebb8 e lived9e. A prova não incorpora comportamento Lich novo. CPU6 anterior conferia apenas endpoint==payload, não espada desenhada.

## Interface proposta em cópia

`classSkillVfx.updateDashTransform(castId, { emitter: {x,y,z} }) -> boolean`.

VFX aceita somente registro já existente e pendente de apresentação no frame; não cria cast nem segmento, não emite evento, não avança clock ou TTL. Atualiza centro do arco vivo e endpoint final do segmento recém-criado. O começo do segmento mantém o socket pós-mixer do frame anterior; todos os segmentos históricos permanecem imóveis. Sparks/impactos conservam alvo/contato autoritativos. Repetição no mesmo frame é idempotente; ID desconhecido, NaN, cancelamento/expiry/reset/dispose retornam false. Terminal válido pode resolver o endpoint uma vez antes de congelar seu gesto curto; end normal do mesmo frame não deve apagar essa oportunidade. update consome a pendência; não fica seguindo espada depois de terminal.

Combat registra somente os castIds/actorIds recebidos em cast/release/travel de dash. Após `heroVisual.update` e o update dos remotos, antes de `classSkillVfx.update`, resolve o socket atual e chama essa API para as pendências. Não refazer presentClassSkill nem repetir `visual.cast`, SFX, history ou evento. End cancelado limpa a pendência; end normal após travel terminal permite a resolução final. Pausa mantém pose/clock, reset e desconexão limpam o mapa. Payload de core continua original; a apresentação nova fica em stats próprios, sem adulterar histórico de eventos.

A posição root já é movida pelo core; não somar delta root outra vez. Caso múltiplos eventos remotos cheguem no frame, só o endpoint de apresentação mais recente será resolvido; não reescrever posições históricas como se fossem novas amostras de pose. Remoto continua gate explícito até prova própria.

## Escopo/custo e próximos critérios

VFX modifica os mesmos2arquivos candidatos (pool+wrapper) apenas em nova cópia preservando art1. Combat é dono do mapa e hook main; não copiar snapshotebb8 sobre lived9e. Sem RT/draw extra; no máximo uma atualização por cast pendente por frame. Não mover clocks, alcance8m, raio.85, hit/death/corpse, trajetória/contacto ou SFX.

CPU direcionada deve comprovar arcos/endpoints corrigidos, histórico fixo, terminal/end/cancel/reset e contagens de eventos/contatos iguais. A próxima prova nativa, quando coordenada, deve separar a correção de socket da seleção artística. Art1 atual **não selecionado**: remover glyphs funcionou, mas lâmina/esteira/impacto ficaram discretos. Nenhuma nova captura ou promoção autorizada por este documento.
