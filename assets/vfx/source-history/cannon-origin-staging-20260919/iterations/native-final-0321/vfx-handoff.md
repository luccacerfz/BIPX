# Astra · VFX & Arsenal — v2 / Horizon congelado, canhão em staging

**Janela03:21 ENCERRADA: browser/servidor isolado e reserva GPU VFX liberados.** [Native core/socket/adapter](../../output/playwright/2026-09-19T03-21-25-047Z-cannon-origin-vfx-native/cannon-origin-report.json):21PNGs, dois playbacks RAF, contrato e gate de composição passaram, fontes estáveis durante a rodada. Snapshot de mainf4dfc154 e215fontes preservado. Revisão artística final dos originais em andamento, sem nova captura sobre live. Physics pode seguir com a promoção contacts autorizada por Combat; Environment informou suas duas vistas já concluídas03:18, não repetir. Canhão permanece **isolado e NÃO PROMOVIDO**; o aceite técnico não é prova de gameplay/AAA. Os estados03:04/03:17 abaixo são histórico superado por esta rodada.

Direção vigente: [skill-direction-v2.md](skill-direction-v2.md). A seleção inicial foi substituída; fontes/evidências anteriores são histórico. Propriedade: `src/vfx/`, ferramentas `*vfx*`, assets VFX e este documento. `main.js`, servidor e package pertencem exclusivamente ao Combat. Checkout compartilhado/WIP preservados; sem commit/merge/push/deploy. 5173 permanece ligado.

**Estado atual: runtime LIBERADO/CONGELADO; canhão NÃO PROMOVIDO.** Preparação v2 concluída no staging: [plano exato/API/sete hashes](vfx-cannon-integration.md), [manifesto](../../output/qa/vfx-cannon-wrapper-prepared-20260919.json), [diagnóstico composição](vfx-cannon-composition.md). CPU final18+7PASS; fatorial corrigido02:26 e confirmação normal02:27PASS com fonte estável. Gate completo high1 **65.289%**, high4 **76.860%**, low/reduced1/4 **90.083%**, sem baixar65. Margem high1 só0.289p.p.; não é aprovação ampla/AAA/gameplay. **QA VFX encerrada02:27; reserva GPU própria LIBERADA, sem CPU pesado ativo.** Combat pode retomar. Nenhuma edição runtime/main/renderers;21fontes Horizon preservadas. **Continuidade cano→trajeto é gate pendente antes de promoção**, conforme [auditoriaRoot](review/cannon-origin-followup.md). Sem novas filas/retries.

**Atualização origem03:04 — CPU aceita pelo Root; native pendente.** [Contrato/implementação/histórico](vfx-cannon-origin.md), [manifesto novo de oito arquivos](../../output/qa/vfx-cannon-origin-prepared-20260919.json). Core + adapter literal52/52 em10/30/60/120Hz; auditor independente sem crossing nem aprisionamento. Bloqueio abandona bridge, limpa rastro, retoma autoridade com ocultação40ms, sem impacto falso. Fontes isoladas preservam composição02:27 e runtime. Captura core+adapter/socket atual preparada para próxima janela Combat/Physics após GUI, incluindo quina/near target/high/low/reduced/gate65. **Nenhuma GPU VFX ativa; nenhuma promoção; não repetir filas.** CPU não aprova aparência nem gameplay.

**Ordem da próxima janela confirmada com Combat:** aguardar **liberação explícita Physics density143 + hash final do main publicado em [combat-cannon-visual-contract.md](combat-cannon-visual-contract.md)**. Combat fará somente a ordem `role=status` antes de `textContent` entre janelas. Não iniciar GPU apenas porque o lock ficou livre; depois dos dois marcos, conferir hash, criar cópia fixa e reservar atomicamente. Sem promoção runtime. O patch HUD de03:14 abaixo é proposta separada e não deve entrar silenciosamente nesse diff/freeze.

**Conferência GPU 2026-09-19T03:17:04.892261+00:00:** `/tmp/bipx-arpg-gpu.lock` ausente neste instante; nenhuma reserva VFX a liberar ou aguardar. Physics publicou conclusão/liberação das seis capturas143 em `physics-crowd-density.md`. Falta ainda o hash final de main no contrato Combat antes do native do canhão; não iniciar pelo simples desaparecimento do lock. Animation mantém seu native de corte sob agenda Combat/mkdir atômico. Contrato `deathStyle:cleave,direction,death:true` confirmado; VFX não cria metades/rigs. Resultado CPU dos quatro rigs comunicado por Animation é prova dessa frente, não nova captura VFX.

Horizon experimental já tem prova integrada Combat: [checkpoint213fontes](../../output/qa/arpg-horizon-integrated-20260919/source-manifest.json), [proveniência](../../output/qa/arpg-horizon-integrated-20260919/evidence-provenance.json), [medidas/gameplay](../../output/qa/arpg-horizon-integrated-20260919/measurements.json), [reviewRoot](review/integrated-art-followup.md). Combos com178frames de campo high/185low com depth atual e um prepass, seis skills/rede/natural60s avaliados pelo dono. JEF real01:46 permanece requires_further_work/textual, não AAA. Nossa [QA Horizon final01:26](../../output/playwright/2026-09-19T01-26-48-130Z-gravity-vfx-integration/integration-report.json) e [handoff](vfx-gravity-integration.md) continuam válidos no escopo dos hashes;21fontes VFX iguais ao baseline. 5173 preservado.

## Readiness dos adapters — auditoria03:14

[Prova CPU com funções literais atuais](../../output/qa/vfx-adapter-contract-2026-09-19T03-14-26-961Z.json), fontes estáveis. Executados `buildArpgState`/`syncPersistentSkillPresentation` extraídos do main, `getSkillHud`, normalizador GUI e `getEnemyControlState` reais. Não é inspeção de nomes isolados nem prova de browser.

| Ligação | Estado confirmado |
| --- | --- |
| Core timers→VFX | **Mapeamento explícito presente no main:** `freezeTimer/stunTimer`→`freezeRemaining/stunRemaining`, por ID, apenas alvos vivos/controlados. Buff acompanha posição atual. |
| Timers→Animation | `getEnemyControlState` já aceita os timers canônicos; retorna remaining e paused. Timer0 prevalece sobre alias antigo. Não requer renomear o core. |
| Death cut/clipping | `renderer.localClippingEnabled=true` presente no main. Remoção/corte pertencem a Animation/Combat e exigem morte autoritativa. Esta auditoria não refaz prova visual do corte. |
| Core HUD→GUI | **Normalização explícita ainda ausente no main.** `buildArpgState` retorna `id/name`; GUI aceita aliases e deriva description, mas isso não satisfaz o pedido explícito do adapter. |

Patch restrito pronto para Combat, **não aplicado**: [`main-hud-adapter.patch`](../../assets/vfx/source-history/adapter-contract-staging-20260919/main-hud-adapter.patch), [baseline/hashes](../../assets/vfx/source-history/adapter-contract-staging-20260919/manifest.json). Altera somente `buildArpgState`: preserva campos do core, acrescenta `skillId`, `label`, `description` derivada dos multiplicadores reais. Execução isolada confirmou saída normalizada idêntica na GUI e texto atual `Dano +35% · Movimento +15%`. Conferir baseline e aplicar apenas em janela do dono; não copiar main inteiro.

Readiness: VFX v2/status e clipping conectados nas fontes; a captura independente pode observar esses caminhos no live/Horizon, sem confundir com o canhão volumétrico ainda isolado. O requisito adicional de **HUD normalizado explicitamente no main permanece pendente de Combat aplicar o patch**. Não declarar integração total desse requisito. `skill-timeline-browser.mjs` usa cópia fixa e GPU serial; sua captura não foi iniciada por esta frente. Nenhum restart5173/backend/browser/GPU ou alteração runtime nesta auditoria; resposta pelo handoff, sem interrupt/fila repetida.

## Resposta Combat — contrato v2 e snapshots confirmados

`combat-v2-contract.md` relido integralmente em19/09; os seis IDs canônicos já são os únicos aceitos no wrapper atual e no candidato do canhão. O freeze de runtime mencionado neste handoff refere-se à **v2/Horizon integrada**, não à seleção v1. Histórico v1 preservado; nenhuma migração reversa. Thread Combat correto: `01a0b6ce-ab1e-7012-9a5b-add00d2b8032` (`providerSessionId`). Resposta entregue por este handoff, sem interrupt nem nova tentativa na fila cheia.

Consumimos fases distintas `cast/release/travel/impact/status/end`. Tempos preparo/gesto do contrato: grito.38/.85, dash.22/.78, escudo.28/1.10, canhão.30/.72, gelo.28/.68 e gravidade.42/.85s. Release vem do evento real, não de timer visual inferido. Buff8s acompanha o ator; gravity5s permanece no centro autoritativo; freeze3s/stun2.2s por alvo usam remaining recebido, inclusive limites boss. Corpo essencial permanece em low/reduced; volume decorativo não concede dano/controle.

API disponível: `classSkillVfx.syncState({buffs,statuses,fields})`, snapshot completo agregado de todos os donos. Formato de cada entrada:

```js
classSkillVfx.syncState({
// Buff do jogador: position acompanha sua posição apresentada atual.
buffs: [{ id: buff.castId, position: actorPosition,
  remaining: buff.remaining, duration: 8 }],

// Somente inimigos vivos; mesmo ID usado em targetId nos eventos status/end.
statuses: [{ id: enemy.id, position: enemy.mesh.position,
  freezeRemaining: enemy.freezeTimer || 0,
  stunRemaining: enemy.stunTimer || 0,
  radius: enemy.radius + .2, height: enemyHeight + .3 }],

// Centro fixo do campo; usar os dados autoritativos, sem seguir o atirador.
fields: [{ id: field.castId, position: {x:field.x,y:field.y,z:field.z},
  radius: field.radius, remaining: field.remaining, duration: field.duration }]
});
```

Arrays omitidos equivalem a vazios; `syncState({})` limpa os estados. Chamadas por frame mantêm posições atuais/interpoladas sem alterar duração da autoridade; recebimento recente evita descontar dt duas vezes. Eventos status e snapshots com os mesmos IDs compartilham slots. Reconectar/latejoin reconstrói esse snapshot sem reenviar `cast/release/impact` nem morte/recompensa. Capacidade de estados256, excedente contado em `states.dropped`; low/reduced conserva essa capacidade. `reset()` limpa transientes e estados.

Dash `impact` aceita o `killed`/`targetId` reais do payload, mas VFX não usa contato para inferir morte nem criar corpse. Combat/Animation continuam responsáveis pela remoção autoritativa. Sempre fornecer o `radius` do core: canhão3.4, gelo4, gravity5 e faixa efetiva de dash/charge; os defaults históricos do wrapper live não substituem esses dados. O candidato isolado já corrige o fallback artístico do canhão3.2→3.4, sem promover durante o freeze.

Conferência de fontes/API, sem nova execução de suíte ou alegação de gameplay. A API acima já está integrada no adapter atual do main; novas edições main/server/core pertencem ao Combat. Próxima captura VFX permanece core+adapter do canhão e gate65, após a reserva Physics ativa.

## Confirmação Animation — corte e estados v2

Contrato conferido nas fontes atuais em19/09: Animation é dona de `enemy-death-cut.js` e do fluxo `animatedEnemies.remove`; VFX não instancia rigs/cadáveres nem chama remoção. A forma atual publicada por Animation/Combat é `remove(zombie,{death:true,deathStyle:'cleave',killedBySkillId:'warrior_cleaving_dash',direction:{x,z}})`. A proposta `deathStyle:'bisect'` com esse mesmo ID e `deathDirection` continua aceita como alias. Usar somente morte confirmada; não repetir remoção a partir de impacto, status, latejoin ou reconnect. `renderer.localClippingEnabled=true` já está presente no main e continua sob ownership Combat.

VFX mantém arco/rastro no caminho real e slash/impact no contato recebido, com deduplicação por cast/contato. O impacto do dash pode receber `killed` e `targetId`, mas não gera corpse nem infere morte de sobreviventes; um contato energético não é prova de bissecção. Nova apresentação específica de morte, se necessária, deve consumir o mesmo evento confirmado sem replay adicional. Nenhuma nova emissão foi acrescentada neste alinhamento.

Nomes finais já existentes: Combat replica `freezeTimer/stunTimer`; `getEnemyControlState` da Animation aceita esses timers e aliases `freezeRemaining/stunRemaining`, com timer canônico0 prevalecendo. O adapter atual de `syncState` fornece `freezeRemaining/stunRemaining` ao VFX apenas para inimigos vivos. Animation controla mixers/poses; VFX controla crosta/estrelas pelos remaining recebidos e limpa por snapshot/end/reset. Gestos continuam via `visual.cast({skillId,castId,duration,impactAt,elapsed})`; `impactAt` marca release, não contato do projétil.

Conferência estática de contrato, sem nova alegação de playback. Nenhum módulo runtime/Animation foi editado. O próximo gate desta frente permanece native do canhão em staging, sob janela Combat/Physics; este alinhamento não autoriza promoção nem reabre a seleção antiga de skills.

## Contrato para fixture Environment — áreas reais

**Procedência das fixtures comunicadas por Environment:** [rodada00:02 junto ao shrine](../../output/playwright/environment-skills-v2-vfx/environment-skills-v2.json) preservada; [rodada corrigida00:08](../../output/playwright/environment-skills-v2-vfx-clear/environment-skills-v2.json) já existe, centro(9,-7) livre para ator.64 conforme handoff Environment. Ambas:18 combinações, `syntheticFixture:true`, `assertions:passed`, `sourceChangedDuringRun:false`, sem erros de página/console/HTTP/requests. Os JSONs fixam wrapper **c24be16039179fab073cd1be36e8656e3403703e1b797d1e93b98e5b860a068a**; o wrapper live desta conferência é **400afd2637bc1f3e74c6b83854dc6693d7c94aea856933160712c1e88d12cdda**. Portanto são evidências históricas da v2 inicial/recorte, anteriores ao Horizon atual e ao canhão em staging. O recorte das copas e a limitação junto ao shrine foram relatados pelo dono Environment; nesta conferência VFX revisou metadados/procedência, sem reinspeção das21imagens. Não transferir a aprovação técnica para gameplay, arte AAA, depth/Horizon ou bridge do canhão atuais. Nenhuma alteração adicional de fixture/assets/colliders por VFX.

Confirmado no checkout: limite4 em `environment-skill-focus.js`, quinto argumento de `asset-dressing.update` e chamada Combat já presentes; a pendência de hook citada na mensagem da fixture00:02 é histórica. A fixture pode consumir `createClassSkillVfx` de `src/vfx/class-skill-vfx.js`, API abaixo, sem alterar módulos VFX. Isso usa a versão live/Horizon; canhão volumétrico preparado permanece separado e só deve entrar numa comparação explicitamente identificada como staging, com hashes do [manifesto](../../output/qa/vfx-cannon-wrapper-prepared-20260919.json).

`skillAreas` e `syncState` são contratos diferentes: Environment recebe `{skillId,position:{x,y,z},radius,remaining}`; VFX recebe snapshots completos `{buffs,statuses,fields}` com IDs conforme exemplos abaixo. Usar o mesmo centro/raio/tempo da autoridade: canhão3.4m, gelo4m, gravidade5m/5s. Fogo/gelo são impactos; não inventar campo persistente de dano para manter cutaway. Se Combat fornecer foco transitório pós-impacto, seu remaining deve representar apenas a duração de apresentação acordada. O produtor live atual retorna buff/gravidade; ampliar fogo/gelo precisa de integração do dono Combat.

Para color/depth, preservar `shareEnvironmentCutawayDepth(colorMaterial,depthMaterial)` no pipeline existente. `pipeline.render(scene,camera,dt,classSkillVfx)` mantém um prepass compartilhado; nenhuma segunda textura/passe na fixture. World/cutaway deve ser atualizado antes do render, com as mesmas áreas do frame. Validar remoção/remaining<=0/reset, quatro áreas e excedente, copa/santuário/ruína e high/low/reduced sob reserva GPU atômica. Capturas de contraste continuam fixtures, sem afirmar gameplay ou continuidade cano→trajeto.

## API concreta v2

```js
import { createClassSkillVfx } from './vfx/class-skill-vfx.js';
const classSkillVfx = createClassSkillVfx({
  THREE, scene, quality, reducedMotion, combatVfx, elementalVfx,
});
classSkillVfx.emit({ skillId, phase, origin, direction, target, castId,
  emitter, radius, groundY, contactId, release, terminal,
  status, targetId, remaining, statusDuration, duration });
classSkillVfx.syncState({ buffs, statuses, fields });
classSkillVfx.update(dt); // simulation seconds; zero pauses
classSkillVfx.prepareSceneDepth(camera); // pipeline-owned prepass request; invalidates old depth
classSkillVfx.setSceneDepth(depthContractOrNull); // same-frame borrowed RGBA-packed depth
classSkillVfx.setQuality('high'); // high/medium/low
classSkillVfx.setReducedMotion(true);
classSkillVfx.reset();
classSkillVfx.getStats();
classSkillVfx.dispose();
```

Somente seis IDs canônicos: `warrior_war_cry`, `warrior_cleaving_dash`, `warrior_shield_charge`, `dwarf_explosive_cannon`, `dwarf_frost_shot`, `dwarf_gravity_shot`. IDs v1 são rejeitados, sem barra/arsenal adicional.

Fases:

- `cast`: antecipação no aceite, jamais impacto. `emitter` opcional fornece arma/mão em mundo; sem ele há fallback vertical na raiz, que **não prova alinhamento à arma**.
- `release`: execução autorizada; grito produz onda, dash arco da espada, escudo feedback metálico, canhão flare/pluma, gelo/gravidade descarga inicial. Não exige vítima.
- `travel`: `origin` anterior e `target` atual reais, `castId` obrigatório. Dash/charge seguem deslocamento resolvido; dwarf atualiza corpo essencial e rastro decorativo. `release:true` também executa release uma única vez. `terminal:true` remove corpo no último segmento sem inventar hit. Saltos >8m/gaps de snapshots não são ligados por rastros falsos.
- `impact`: target = contato/detonação confirmada. `contactId` deduplica vítimas/retransmissão. Explosões de canhão/gelo/gravidade são uma por detonação, não uma por vítima. Dash/escudo recebem contatos individuais. Impactos dwarf encerram seus corpos.
- `status` e `end`: aceitam `status:'buff'|'freeze'|'stun'|'gravity'`, `remaining`, `statusDuration`/`duration`; buff/field identificados por castId, freeze/stun por targetId. End de status não cancela outro corpo do mesmo cast.
- `end` sem status remove corpo sem inventar explosão. Um corpo sem atualização por .3s expira; simulação pausada congela esse prazo.

`radius` e `groundY` vêm da simulação/superfície. Qualidade/reduced não diminuem a área exibida. Fallbacks de raio são artísticos; integração deve sempre passar o raio do core.

Snapshot completo autoritativo (recomendado por frame para posições atuais e reconnect):

```js
classSkillVfx.syncState({
  buffs: [{ id: buff.castId, position: actorPosition, remaining, duration: 8 }],
  statuses: [{ id: enemy.id, position: enemyPosition,
    freezeRemaining, stunRemaining, radius: enemyRadius + .2, height: enemyHeight + .3 }],
  fields: [{ id: field.castId, position: fieldCenter,
    radius: field.radius, remaining: field.remaining, duration: field.duration }],
});
```

Arrays completos substituem o estado anterior; `syncState({})` limpa. IDs iguais aos eventos impedem duplicação. Buff acompanha posição do ator; o centro gravitacional permanece no ponto fornecido. Snapshot recém-recebido não desconta dt duas vezes. Expiração/remoção produz fratura curta do gelo e colapso arcano, sem dano ou controle. Reset/dispose não fabricam feedback de término.

Instâncias `combatVfx`/`elementalVfx` emprestadas continuam atualizadas, configuradas, resetadas e descartadas pelo dono original. O wrapper nunca avança nem descarta esses pools. Possui somente os corpos e estados adicionais. Sem injeção, cria pools próprios com ambiente desativado para fixture.

## Aparência, limites e acessibilidade

| Sistema | Implementação |
| --- | --- |
| Grito | onda dourada no release, halo durável/tempo no chão, faixas douradas e motes aderidos ao torso/ombros |
| Dash | arco principal junto à lâmina, rastro fino contínuo e crescents espaçados pelo caminho efetivo; contato individual e nenhum hit fictício |
| Escudo | frente curva azul/dourada com crista, bordas de pressão e poeira, choque metálico nos contatos, estrelas sobre cada alvo realmente stunned |
| Canhão | corpo térmico facetado, pluma no cano, fogo/trilha, explosão com coroa vazada, fogo periférico e brasas |
| Gelo | corpo cristalino, trilha, fratura, anel da área, crosta facetada parcial até o torso e cristais em alturas diferentes nos alvos frozen; quebra ao terminar |
| Gravidade | corpo roxo, trilhas, campo com funil baixo inclinado, núcleo escuro pequeno/borda violeta e fragmentos tridimensionais convergentes; colapso ao terminar |

- Um batch de corpos: 64 slots alocados; limite ativo high64/medium40/low20. Corpo mantém dimensões/posição em low/reduced; reduced remove o rastro decorativo, não o corpo.
- Um batch de estados/áreas: 256 slots invariantes por qualidade, incluindo buffs, freezes, stuns e fields. Quando excedidos, `states.dropped` registra a limitação; a implementação não prova cobertura de mais de256 estados simultâneos.
- Um batch de cristais/fragmentos: três/dois/um cristais por frozen e cinco/três/dois fragmentos por campo em high/medium/low. Área e quantidade de alvos marcados permanecem iguais.
- Um batch adicional de volumes:576 slots fixos (duas superfícies por256 estados e64 frentes/arcos de deslocamento). Crosta não troca o rig. Funil tem até.92m de altura, núcleo até.76m de diâmetro; todos dentro do campo real. Escudo/arco usam largura limitada ao raio recebido, com TTL curto e remoção imediata no terminal/end.
- O máximo de quatro draws adicionais era o budget da versão00:38, agora histórico. Horizon acrescenta até8campos ×4draws ao pool, mais um prepass compartilhado do pipeline quando há campo visível. Batch de áreas/corpos/status continua compartilhado; sem luz por partícula ou renderer extra. Budget/custo atual no [contrato Horizon](vfx-gravity-integration.md). Pools Samurai/Elemental conservam seus próprios budgets e atendem também inimigos.
- Materiais depth-tested, sem depth-write; campos e fogo vazados preservam o centro do alvo. Reduced congela órbitas/debris/turbulência, mantém área, estado e projétil.
- `getStats` inclui versão2, fases por ID, rejeições, dedup, pathDistance, corpos, estados/frozen/stunned/fields, `dropped`, pools e limites. Contadores são cumulativos; reset zera transientes e clocks.

## Três fontes realmente usadas

Commits dos clones locais conferidos com `git rev-parse HEAD`, fontes reais inspecionadas. Tentativa de abrir páginas pinadas pelo navegador de pesquisa falhou com cache miss; inspeção real foi nos clones Git já existentes. MIT integral preservada em `SAMURAI-LICENSE.txt` e `ELEMENTAL-LICENSE.txt`.

| Fonte pinada | Adaptação concreta v2 |
| --- | --- |
| [Samurai](https://github.com/achrefelouafi/SamuraiThirdPersonTemplateThreeJS/tree/496862cda55bfba3be6d02eec5aee3ca808a31a3), `vfx/BladeImpact.js`, `ShockRing.js`, `shaders/lib/blackbody.glsl.js` | Pools existentes de faíscas/brasas com dinâmica analítica e emissão térmica, impacto, arcos e onda de choque passam a responder a cast/release/path/contact das skills v2. Coroa de fogo vazada é extensão BIPX; não importação de Phoenix completo. |
| [HandCast](https://github.com/achrefelouafi/HandCastAbilityThreeJS/tree/3431252f7ad88059681d4b9b6484cb7483f7d0d6), `assets/GlacialGeometry.js`, `materials/GlacialShardStormMaterials.js` | Topologia facetada, anéis torcidos/chips, pivôs de fratura, normais e lattice de seis ramos reutilizados no projétil/coroa/fratura e gelo persistente. Corpos partilham geometria instanciada; não mesh opaco gigante ou IceStatue integral. |
| [Linear](https://github.com/achrefelouafi/LinearAbiltyCastingExtendedThreeJS/tree/8c377c886ac2c68b26bc65c8f3507905818b974a), `materials/NeonTrailMaterial.js`, `SingularityMaterial.js` | Trilha com envelope afilado, fase/pitch por fio e billboard; ring AA e enrolamento usados em contato/campo roxo. BIPX adiciona abertura central, braços com velocidade radial para dentro e debris procedurais. Atração real vem do core; shader não desloca inimigos. |

Preservados: VFX elemental dos inimigos (void/glacial/toxic), Three0.164.1, licenças, fontes originais e v1 em `assets/vfx/source-history/initial-skills-20260918/manifest.json`. Não portados: sandboxes completos, veículos/drone, Phoenix completo, pipelines/câmeras, screen refraction, todo o catálogo das fontes.

## QA e integração

- API v2 entregue ao Combat por `codex queue`, providerSessionId `01a0b6ce-ab1e-7012-9a5b-add00d2b8032`. Uma primeira tentativa usou um messageId fornecido como thread e retornou `no rollout found`; endereço corrigido, fila funcionando. Não usar `orca terminal send --interrupt`.
- CPU v2: `node tools/class-skill-vfx-cpu.mjs`; última execução16/16 em `output/qa/class-skill-vfx-v2-2026-09-19T00-08-47-931Z-cpu.json`, fonte estável. Exercita buffers reais, contato/raio, corpos low/reduced, status/eventos/snapshots, TTL, reset/dispose, overload e recursos emprestados. Não é render/gameplay.
- CPU elemental anterior preservado e rerodado7/7. O acumulador de distância ganhou tolerância consistente: agora fogo28 amostras e arcano24 instâncias em8m, iguais em30/60/144Hz. Corrige emissão duplicada por arredondamento.
- Nativo v2: `node tools/class-skill-vfx-native.mjs`; reserva `/tmp/bipx-arpg-gpu.lock` atomicamente e libera apenas token próprio. Servidor efêmero, Chrome/Metal, fecha somente seu contexto. Primeira v2 rejeitada por preparação de dash invisível aos120ms; preparação ajustada para durar a janela. Candidato final nativo passou; fontes de runtime liberadas ao Combat às00:11 UTC em19/09/2026.
- Os takes `23-30-28`/`23-32-34` da seleção inicial passaram em seus escopos, mas **não validam v2**. O corpo substituto da fixture inicial foi removido: o verificador v2 exige a mesh real do wrapper inclusive em low/reduced.
- Corte de cadáver pertence à integração Combat/Animation: Animation publicou `animatedEnemies.remove(zombie,{death:true,deathStyle:'bisect',killedBySkillId:'warrior_cleaving_dash',deathDirection})`, clones privados com planos complementares/fade. Combat deve encaminhar somente mortes confirmadas do dash e habilitar clipping. VFX não duplica esse corpse nem recompensa; QA independente do corte está no handoff Animation.

Captura v2 nativa final e inspeção visual concluídas no escopo de fixture descrito abaixo. Pendente: janela integrada estável para gameplay natural, rede/status/reconnect, arma/mão real, horda/oclusão, desempenho/mobile e JEF textual honesto. Nenhuma nota AAA/10 ou aprovação global foi atribuída.


## Candidato nativo v2 liberado

Evidência final: [`2026-09-19T00-08-48-141Z-class-skill-vfx-v2/verification.json`](../../output/playwright/2026-09-19T00-08-48-141Z-class-skill-vfx-v2/verification.json). **60 capturas**, seis loops nativos de2.25s, fonte estável, zero erros de browser/shader/GL; ANGLE Metal Apple M5 Pro. Includes antes/antecipação/release/viagem/impacto/estado, high/medium/low e reduced. Todos PNGs têm SHA256 no report; WebM no subdiretório video. Fixture sintética explícita, sem modelo/colisão do gameplay.

Inspeção visual: seis identidades revisadas em high, três corpos reais revisados em low/reduced, freeze/stun/campo revisados em low/reduced. O corpo roxo foi corrigido após a primeira v2 parecer branco demais; fogo periférico foi alterado para chamas dispersas após a versão com pequenos anéis repetidos. A coroa térmica permanece estilizada; não é fogo volumétrico completo. Os cristais de congelamento marcam os pés, não encapsulam o rig inteiro. As estrelas de stun são pequenas e ainda precisam revisão na horda/câmera real.

Recursos na fixture:28 geometrias/0 texturas antes e após800 detonações;19 geometrias após dispose; zero draws de VFX após reset. Só duas das três draws adicionais máximas estiveram simultaneamente ativas nesses quadros. Os seis loops tiveram p95 entre16.7–16.8ms; isso é fixture desktop limitada, **não** frame time de horda/mobile/natural60s.

Regressão dos inimigos: [`2026-09-19T00-10-00-884Z-elemental-vfx/verification.json`](../../output/playwright/2026-09-19T00-10-00-884Z-elemental-vfx/verification.json), fonte estável, cinco capturas e lifecycle/GL aprovados. Execução envolvida pela reserva atômica desta frente;5173 intacto.

Integração de `emitter` real e `syncState` confirmada por inspeção do main atual feito por Combat; isso ainda não substitui playback. Ferramenta nova `node tools/class-skill-vfx-gameplay.mjs` prepara captura de input real nas duas classes high e dwarf low/reduced usando servidor efêmero, opções da interface e telemetria somente leitura. Aguarda slot/janela integrada; não editar fontes VFX durante a janela do Combat.

## Arquivos desta revisão

- Runtime novo: `src/vfx/class-skill-vfx.js`, `class-skill-bodies.js`, `class-skill-fields.js`, `class-skill-volumes.js`.
- Runtime estendido: `src/vfx/elemental-vfx.js`, `elemental-shaders.js`; módulos/licenças anteriores preservados.
- QA: `tools/class-skill-vfx-{support,cpu,native,gameplay}.mjs`, `tools/class-skill-vfx-preview.html`.
- Histórico: `assets/vfx/source-history/initial-skills-20260918/`; evidências em `output/qa/` e `output/playwright/` indicadas neste documento.
- Contrato/entrega: este handoff. Integração em `src/main.js` pertence ao Combat e não foi editada por esta frente.

## Iteração visual após revisão independente

Antes preservado em `assets/vfx/source-history/v2-before-art-direction-20260919/manifest.json`, com cópias dos módulos e do handoff. A prova integrada anterior passou3/3 em [`00-21-05-601Z`](../../output/playwright/2026-09-19T00-21-05-601Z-class-skill-vfx-gameplay/class-skill-vfx-gameplay.json), usando input real e cópia estável. Essa versão ainda tinha aura/campo planos e gelo nos pés; é baseline, não prova da nova aparência.

Depois: [`00-29-00-799Z/verification.json`](../../output/playwright/2026-09-19T00-29-00-799Z-class-skill-vfx-v2/verification.json),60 capturas/6 loops, zero erros browser/shader/GL e fontes estáveis. A primeira tentativa `00-27-19-867Z` foi **rejeitada** por filamento da gravidade sobre o torso em low/reduced; funil rebaixado e opacidade refinada. Sem afrouxar o gate, a nova tentativa preservou100% da pequena região de torso amostrada nos4 impactos de gravidade. Isso não prova oclusão na horda inteira.

Inspecionados individualmente: buff/escudo/gelo/gravidade da primeira tentativa, gravidade/gelo/dash da segunda. A crosta é parcial e estilizada; não encapsula braços/pernas nem acompanha deformação por osso. Buff usa posição/altura do ator, sem alterar material de arma/armadura. Gravidade ganhou profundidade com núcleo/funil/fragmentos; o anel do chão continua necessário para alcance. Esta iteração não foi classificada como AAA/10.

Geometrias29 antes/depois de800 detonações,0 texturas,19 geometrias após dispose e zero draws após reset. Máximo observado3 das4 draws adicionais, p95 fixture16.7–16.8ms. CPU18/18 em [`00-30-05-584Z`](../../output/qa/class-skill-vfx-v2-2026-09-19T00-30-05-584Z-cpu.json), acrescentando volume/altura/centro/low e frente seguindo trajetória resolvida/terminal. Buff/freeze/gravity continuam consumindo somente snapshots reais; cadáveres não recebem status visual inventado.

API permanece igual. Para alinhamento preciso do arco durante o dash, Combat pode acrescentar `emitter` da espada também em `travel` de `warrior_cleaving_dash`; o wrapper já consome. Sem isso, o arco acompanha a posição resolvida+.95m, não a deformação exata da lâmina. Pedido enfileirado antes da saturação da fila. Não foi solicitado hitstop nem alterado timing de dano.

## Gameplay depois da direção de arte

[`00-30-38-775Z/class-skill-vfx-gameplay.json`](../../output/playwright/2026-09-19T00-30-38-775Z-class-skill-vfx-gameplay/class-skill-vfx-gameplay.json):3/3 passaram, fonte da cópia estável e checkout igual ao final. Warrior high12.07s, dwarf high14.39s, dwarf low/reduced13.04s de simulação natural; não são natural60s nem benchmark. Input de menu/settings/teclado, sem spawn, dano, recurso, cooldown ou início via setters de debug. Dwarf executou gravidade→gelo→fogo; todos os três corpos foram observados antes do impacto nos dois modos.

Estados reais observados:warrior buff1 e stun1; dwarf high freeze3/pull1/campo1; low/reduced freeze2/pull6/campo1. Corpos/status VFX acompanharam esses estados no histórico. A nova calibração de dano de controle é do Combat; nenhuma vítima morta foi adornada para fabricar prova de freeze/stun. PNGs release do buff, execução do escudo, gelo high e gravidade low/reduced inspecionados individualmente; frames decodificados do WebM high/low também revisados. Isso é inspeção amostrada, não escuta nem avaliação contínua de conforto temporal. Os vídeos originais e hashes permanecem no report.

### Integração aplicada pelo Combat: posição por frame

Inspeção às00:34 encontrou `syncPersistentSkillPresentation()` somente dentro de `publishArpgState()` (10Hz), com possível atraso posicional de~100ms durante dash. A proposta abaixo foi registrada; às00:38, nova inspeção confirmou que Combat implementou sync visual por frame, manteve áudio/HUD10Hz, adotou posição atual/interpolada local/remota no buff e adicionou emitter da espada em travel do dash. A rodada final cobre essa nova integração. `src/main.js` não foi editado por VFX. Proposta histórica:

```js
// Em main.js, preservando o caminho atual de HUD/áudio10Hz:
function syncPersistentSkillPresentation({ visualOnly = false } = {}) {
  // ... montagem de next/values e classSkillVfx.syncState existentes ...
  if (visualOnly) return; // depois do syncState, antes de soundState/persistentSkillPresentation
  // ... áudio/status de10Hz já existente ...
}
// No update, após movimento/interpolação e antes de classSkillVfx.update(dt):
syncPersistentSkillPresentation({ visualOnly: true });
```

Combat usa `player.position` para ator local e `remotePlayers.get(owner.id)?.mesh.position` para remoto interpolado, mantendo remaining/duration da autoridade. Centro de gravity permanece value.x/y/z. Freeze/stun continuam com posição real do mesh; per-frame evita atraso durante pull. Comunicação do achado pela fila correta encontrou limite100, mas a integração foi confirmada nas fontes depois. QA remota/latejoin dessa apresentação continua no escopo do Combat; inspeção estática não substitui essa prova.

## Fonte final congelada, antes do protótipo

Último ajuste de runtime às00:38: aura alargada somente na envoltória dos ombros de Aldric (raio do grito intacto), e volumes ativos compactados para não enviar512 slots vazios à GPU durante uma investida. Evidências posteriores a ambos:

- [CPU18/18](../../output/qa/class-skill-vfx-v2-2026-09-19T00-38-12-396Z-cpu.json).
- [Nativo60/60](../../output/playwright/2026-09-19T00-38-12-562Z-class-skill-vfx-v2/verification.json), shaders/GL limpos, fonte estável.
- [Gameplay3/3](../../output/playwright/2026-09-19T00-38-29-988Z-class-skill-vfx-gameplay/class-skill-vfx-gameplay.json), fonte copiada estável e checkout correspondente ao final. Sync por frame/emitter durante dash incluídos. Stun2 observado em warrior, freeze1 em cada modo dwarf; estados/contatos anteriores de3 e2 congelados permanecem na rodada00:30, sem atribuir números históricos à rodada00:38.

Todos os hashes `src/vfx/*` dessa rodada foram novamente comparados durante o estudo isolado: **inalterados**. Nova avaliação global/JEF/natural60s/rede pertence ao Combat; os testes desta frente não constituem AAA/10.

## Estudo isolado: núcleo e acreção gravitacional

Código/documentação: [`gravity-accretion-prototype-20260919/README.md`](../../assets/vfx/source-history/gravity-accretion-prototype-20260919/README.md). Não há import em runtime. `tools/gravity-vfx-prototype.{html,mjs}` reutiliza os helpers existentes, copia a fonte e injeta o protótipo só no servidor efêmero. Nenhum framework novo de QA, renderer de produção, câmera de gameplay ou contrato autoritativo foi alterado.

Comparação final: [PNG high lado a lado](../../output/playwright/2026-09-19T00-48-22-097Z-gravity-vfx-prototype/gravity-vfx-prototype-high-1.8.png), [PNG low/reduced](../../output/playwright/2026-09-19T00-48-22-097Z-gravity-vfx-prototype/gravity-vfx-prototype-low-reduced-1.8.png), [vídeo A/B](../../output/playwright/2026-09-19T00-48-22-097Z-gravity-vfx-prototype/gravity-ab-playback.webm), [report/hashes](../../output/playwright/2026-09-19T00-48-22-097Z-gravity-vfx-prototype/prototype-report.json).

Dois painéis no mesmo canvas nativo, com Lyra,4 zumbis e cemitério reais. Câmera base48°/17m/20m idêntica, aspecto de cada painel explicitado no report. Estados e posições controlados: **fixture de assets reais, não partida nem prova de atração física**. O núcleo escuro ganhou borda violeta, disco inclinado/brilho assimétrico e oclusão correta da metade traseira; o campo usa apenas um limite externo discreto. Filamentos têm fase luminosa convergente; fragmentos seguem espirais3D para dentro. Reduced congela essa dinâmica e preserva as formas.

Resultado:10 capturas;2 playbacks de~5.3s/319 amostras cada,3.801 pares radiais não reiniciados convergentes em high e1.590 estáticos em low/reduced; raio5m/duração5s invariantes, nenhuma draw do protótipo após expirar, dispose concluído, zero erros de diagnóstico. Todas as regiões de torso amostradas preservaram100% dos pixels dentro do limiar existente65, sem enfraquecer o mínimo65%. Limite: regiões pequenas de4 atores, não horda completa. Hashes da aplicação permaneceram idênticos durante toda a captura;5173 não foi tocado.

Inspecionados individualmente os PNGs1.8s high/low finais e frames1.8/3.6/4.8 intermediários. Melhor separação entre núcleo, acreção e alcance; o disco continua pequeno na câmera ampla e precisa julgamento artístico independente em playback. Sem nota AAA, sem alegação de escuta. A primeira execução00:44 teve erro no serializador do verificador (`samples` não definido), preservada; não foi erro de shader.00:45 passou;00:48 é o candidato final com depth-write só no pequeno núcleo e cor do disco refinada.

**Não promover antes de janela acordada com Combat.** Este estudo usa5 draws por campo e precisa adaptação ao pool compartilhado/medição sob múltiplos campos antes de produção. Fontes de runtime/GPU permanecem liberadas para a validação global; nenhuma nova tentativa de enfileirar mensagens após instrução root sobre fila cheia.


## Iteração Horizon/nebula em CPU — coordenação

Direção vigente: [gravity-reference-followup.md](review/gravity-reference-followup.md). Novo candidato exclusivamente em `assets/vfx/source-history/gravity-horizon-nebula-prototype-20260919/`; runtime congelado. O shader Horizon original e o raymarch AstralNebula serão adaptados do commit pinado, preservando fontes integrais/licença. Fixture existente passará pelo `createCinematicPipeline` real, sem modificar esse módulo.

**Depth para Combat:** `AstralNebulaMaterial` amostra RGBA-packed depth, resolução do drawing buffer e camera near/far. Como o HDR target atual não expõe depth, a fixture terá um prepass próprio com `MeshDepthMaterial(RGBADepthPacking)` dos assets opacos, no mesmo renderer, antes do compositor inalterado. O custo desse passe será contabilizado. Isso não é integração runtime; futura promoção precisa contrato explícito de depth/encoding/oclusores do pipeline de Combat. Sem refração global, sem renderer WebGL extra.

**GPU:** próxima janela prioritária da Animation cut; mensagem única enviada à sessão correta (receipt01a0b728-876f-7111-a5f9-528c1cbc328f). Preparação CPU até liberação. Fila de Combat permanece sem novas tentativas; este documento registra a proposta.

À01:00 UTC, verificados `animation-cut-v3-handoff.md` (liberado00:53:49) e revisão root `v3-cut-arms-followup.md`: cut concluído, sem processo de GPU ativo/lock. VFX inicia apenas QA isolada sob reserva atômica própria.


## Horizon + AstralNebula original — resultado isolado final

Direção [gravity-reference-followup.md](review/gravity-reference-followup.md) atendida com GLSL original extraído literalmente e controlador novo, sem esfera/rim simplificados: billboard preto, photon ring AA com energia conservada/assimetria, halo diferencial e nebula raymarched achatada com cavidade/shear. Fontes originais pinadas, MIT, hashes e versão anterior preservados. Raio5m/tempo5s, crescimento/colapso e low/reduced mantidos. Detalhes/APIs no [README do candidato](../../assets/vfx/source-history/gravity-horizon-nebula-prototype-20260919/README.md).

Prova atual: [report](../../output/playwright/2026-09-19T01-00-39-181Z-gravity-vfx-prototype/prototype-report.json), [high1.8s A/B](../../output/playwright/2026-09-19T01-00-39-181Z-gravity-vfx-prototype/gravity-vfx-prototype-high-1.8.png), [low/reduced1.8s](../../output/playwright/2026-09-19T01-00-39-181Z-gravity-vfx-prototype/gravity-vfx-prototype-low-reduced-1.8.png), [vídeo](../../output/playwright/2026-09-19T01-00-39-181Z-gravity-vfx-prototype/gravity-ab-playback.webm). Baseline runtime/candidato com mesmos assets, câmera16:9 e compositor real inalterado. Um renderer WebGL, duas cópias canvas de apresentação; depth prepass próprio da fixture, não API existente no jogo. Zero erros e fontes da aplicação idênticas ao final. CPU602frames,10capturas,319amostras por playback;7.603pares radiais convergentes high/2.544estáticos reduced. Gate de torso65% sem afrouxamento: pior76.86% no ator central/high, demais100%; quatro atores, não horda.

GPU local EXT timer/Chrome Metal,1280×720,36amostras úteis por caso, nenhum disjoint: runtime→candidato com depth mediana4.03→5.38ms high e2.83→3.82ms low/reduced. p95respectivos4.73→6.22 e3.31→4.84ms. Depth sozinho mediana~.68ms/148draws. Cópias canvas fora da medição; rAF do benchmark inclui espera da query, portanto não usar como FPS. Custo do cenário controlado, não aceite de performance global/mobile/multicampo.

PNGs high.35/1.8/3.6/4.8, low1.8 e3frames decodificados do vídeo inspecionados: núcleo/anel têm presença clara e volume violeta; colapso fecha para dentro. Frente do gás vela parcialmente o ator central e recorta piso/placas pela depth. Readability nestas posições passou; acabamento em horda móvel e julgamento artístico independente seguem sem nota AAA. Não é gameplay/cast natural desta nova fonte.

**Para Combat:** candidato permanece isolado. `setSceneDepth({texture,width,height,near,far})` consome RGBADepthPacking do mesmo frame/câmera; depth texture `.r` requer decode adaptado e nova prova. Propõe-se depth compartilhado por todos os campos, com contrato de oclusores/transparências, em janela futura. Não promover o prepass por campo nem copiar uma segunda câmera/renderer para produção. Runtime congelado, todas as fontes `src/vfx/*` iguais ao manifesto00:50; sem edição main/pipeline. GPU própria encerrada e5173 preservado. Sem nova tentativa na fila cheia do Combat.

## Novo pedido explícito incorporado / janela Horizon01:12

`skill-direction-v2.md` foi relido integralmente. Os seis IDs canônicos estão implementados; v1 é rejeitado. Os três corpos de projétil pertencem ao wrapper `ClassSkillProjectileBodies`, com posição real, persistência em high/medium/low/reduced e limpeza terminal/TTL. Não dependem de mesh criada apenas no fixture. Grito/buff, dash, escudo/stun, fogo e gelo preservados; corte de cadáver continua exclusivamente Animation/Combat. CPU18/18 novamente passou em01:12, inclusive corpos e fases reais. Gameplay histórico00:38 e checkpoint integrado Combat00:54–01:01 permanecem provas distintas, anteriores ao incremento de gravidade.

Root recomendou Horizon/nebula para integração experimental e Combat abriu janela em `combat-depth-integration.md`. Promoção em propriedade VFX concluída, **QA de integração ainda em curso**: [contrato e estado atual](vfx-gravity-integration.md). Runtime não está mais no freeze00:38; esse freeze fica histórico. Não promover QA anterior à fonte nova. Nenhuma mudança do canhão neste incremento; direção orgânica ficará depois da gravidade.

## Handoff final Horizon01:26:48 — fonte/GPU liberadas

QA posterior à correção de câmera pausada concluída: [report final](../../output/playwright/2026-09-19T01-26-48-130Z-gravity-vfx-integration/integration-report.json), [CPU11/11](../../output/qa/gravity-vfx-pool-2026-09-19T01-26-14-677Z-cpu.json), [wrapper18/18](../../output/qa/class-skill-vfx-v2-2026-09-19T01-28-13-114Z-cpu.json). Um depth compartilhado em1/4/8campos, nenhum sem campos/fora da câmera, overflow10 explícito; copa/ruína com adaptador compartilhado, pausa sem tick, reset/expiry/dispose/reduced e alocações estáveis. Raios5m/tempo5s preservados. Proteção de silhueta com mínimo78.51% em1campo/87.60% em8, acima do gate original65%, apenas nas regiões amostradas.

Pool final `faa591e5c6dde6627fd9b053376e909c8c40b549d6abe531aa08fcb44deab7f4`. Fonte final/copias históricas/hashes/limites no [manifesto](../../output/qa/vfx-gravity-horizon-integrated-20260919.json) e [contrato detalhado](vfx-gravity-integration.md). GPU high1campo p50/p955.229/5.969ms;8campos5.690/11.003ms na fixture1280×720. Low/reduced1campo3.629/4.744ms. Sem inferência de FPS natural/AAA/mobile.

**Fonte VFX congelada para Combat.** Os seis IDs v2 e corpos próprios no wrapper permanecem incorporados. Nenhum arquivo de pipeline/main/cutaway/cadáver editado por VFX. Gameplay/rede/checkpoint atuais serão capturados pelo dono Combat após promoções GUI/SFX/Animation; provas históricas dessas frentes não são atribuídas à nova fonte. Canhão orgânico permanece próximo trabalho artístico, fora desta integração.

## Próximo canhão — somente staging autorizado

Root solicitou agora estudo volumétrico com materiais GH reais. Candidato em [`cannon-volumetric-staging-20260919/README.md`](../../assets/vfx/source-history/cannon-volumetric-staging-20260919/README.md), sem imports em runtime. Originais HandCast/Linear VolumetricFireMaterial+FireAbility e Samurai blackbody/MIT preservados. CPU9/9 passou; fixture A/B usa câmera/assets/compositor/depth atuais. GPU aguarda término da rodada Combat iniciada01:32; fontes Horizon e demais runtime continuam iguais ao manifesto final. Integração futura só após arte/custo/janela próprios; não atribuir gameplay atual ao canhão staging.
