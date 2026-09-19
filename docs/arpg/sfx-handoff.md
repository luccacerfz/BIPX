# SFX ElevenLabs — v2 implementado, integrado e liberado

Propriedade: somente src/audio, assets/audio, tools áudio e este handoff. Checkout main compartilhado, WIP preservado; src/main.js/server/package são do Combat. Porta5173 intocada. Histórico v1: `assets/audio/source-history/arpg-v1/sfx-handoff.md` e `output/playwright/arpg-sfx-v1-handoff/release.json`; não valida v2.

## Lifecycle de desconexão — reprodução CPU confirmada / patch para Combat

**A inferência estática foi reproduzida, sem GPU, rede real ou escuta.** Ferramenta: [`tools/audio-disconnect-lifecycle.mjs`](../../tools/audio-disconnect-lifecycle.mjs). [Report completo e spies](../../output/playwright/2026-09-19T01-23-35-639Z-audio-disconnect-lifecycle/disconnect-lifecycle.json), [funções extraídas](../../output/playwright/2026-09-19T01-23-35-639Z-audio-disconnect-lifecycle/extracted-functions.json), [patch mínimo proposto para main](../../output/playwright/2026-09-19T01-23-35-639Z-audio-disconnect-lifecycle/combat-disconnect-proposal.patch). O patch **não foi aplicado ao runtime**; main e SFX permanecem intactos.

Origem: main SHA256 `e6e315d6f06a8badba5472ddb3f07f70599c57026a4549f47aa1b3a42075fa04`; sample-bank `039e8e433ea1e2bcbaf72f755375e32008e4b0838bae1ec8c022a7e720ecd68c`. Fontes iguais antes/depois. A versão atual chama `syncPersistentSkillPresentation(syncAudio)` a cada frame e habilita áudio a10Hz; a reprodução usa esse contrato novo. `isMultiplayerSuspended`, `syncPersistentSkillPresentation`, `presentClassSkill`, `clearRemotePlayers`, callback real do close e chamada real de update de animate foram extraídos literalmente. Estado de transporte/snapshots/3D é fixture; o sample bank e OfflineAudioContext são reais. Quatro renders offline de18s, com corte em.5s e observação em14.7s: **14.2s após desconectar**, sem esperar/renderizar um jogo por18s de parede.

| Caso | Fonte observada | Cópia com patch proposto |
|---|---|---|
| Queda do socket local | 286 chamadas status a10Hz, buff remaining6 e gravity remaining4 constantes/ageMs0; ambos continuam ativos após14.2s | reset imediato; snapshots/cache vazios, zero status durante suspensão, zero loops |
| Dedup | Uma voz de cada skill; o problema é renovar a duração, não empilhar vozes | Reconnect sozinho não inicia áudio; somente snapshot novo reconstrói sustains |
| Saída de ator remoto | end reason disconnect para seu campo é silencioso e encerra apenas a voz remota; buff local permanece | Mesma política preservada |
| Snapshot removido após cancelamento remoto | **Colapso falso confirmado:** o end sintético sem reason inicia uma cauda quando o snapshot finalmente some | reason snapshot-removed cancela silenciosamente; zero colapsos falsos |
| Expiração autoritativa real | End expired produz uma cauda | Continua produzindo exatamente uma cauda; não é confundido com remoção de snapshot |

**30 asserções passaram no reprodutor**, significando que ele confirmou as falhas da fonte observada e o comportamento corrigido da cópia; NÃO é PASS de lifecycle do main de produção. Spies preservam sequência/chamadas/opções/remaining e flags local/remote; amostras registram loops antes, imediatamente depois, após14.2s, reconnect sem snapshot, snapshot novo e expiração. Recurso47, cooldowns[9,4,2] e sequence11 permanecem idênticos nos quatro casos. Nenhum cast/release/impact é emitido pela reconstrução. O sinal renderizado inclui ambiente; silêncio de cancelamento significa nenhuma cauda de skill inventada, não silêncio total do jogo.

Patch restrito ao dono Combat:

1. Nas três chamadas de samples.update, playing exige jogo ativo **e** !isMultiplayerSuspended().
2. No close, limpar remoteSkillSnapshots/persistentSkillPresentation/skillSoundTravel/onlineSkillMotion e resetar samples/classSkillVfx, sem resetar classSkillState/recurso/recargas/sequence.
3. No início de syncPersistentSkillPresentation, retornar apresentação vazia enquanto suspenso; evita reapresentar estado antigo. Snapshots só voltam pelo fluxo normal de rede.
4. Na remoção inferida de snapshot, passar `reason:'snapshot-removed'`; a API SFX existente converte motivos não-expired em cancel. Release/impact/expiração continuam exclusivos de eventos autoritativos.

Patch SHA256 `834fcc507d518e2247b733d76cc99f5abac734aa40ed8501bb1630b77545f557`. `git apply --check` passou contra a fonte atual; `node --check` passou na cópia proposta. Aplicação cabe ao Combat, sem edições cruzadas. Reproduzir CPU: `node tools/audio-disconnect-lifecycle.mjs`. A ferramenta conserva fonte observada/proposta, diff e hashes em novo diretório datado; versões anteriores preservadas.

**Native pontual preparado, ainda não executado:** [`tools/audio-reconnect-gameplay.mjs`](../../tools/audio-reconnect-gameplay.mjs), sintaxe verificada. Dois clientes reais, grito+campo por input, fechamento do socket do dwarf com ambos ativos, estado local/remoto após450ms, reconexão, identidade/sequence/recurso/recarga e ausência de replay/colapso falso. Sem concessão de gameplay, IPC de alvos ou sessão60s. Comando somente após encerramento da janela VFX estável e integração do patch: `BIPX_BROWSER_CHANNEL=chrome node tools/audio-runtime-run.mjs tools/audio-reconnect-gameplay.mjs`. O filho exige a reserva SFX pertencente ao PID pai; runner fecha apenas seus próprios browser/servidor e libera sua reserva.

Na conferência, `vfx-handoff.md` ainda declara integração Horizon/QA em curso; ausência momentânea de lock não encerra essa janela. Portanto nenhuma GPU foi reservada. Servidor5173 HTTP200 preservado. **Nenhuma mensagem enfileirada no Combat**, conforme instrução root; este handoff é a entrega da prova/patch. Fontes SFX permanecem congeladas; pendências são aplicação por Combat e smoke nativo após a janela.

## Freeze final SFX após auditoria root — 18/09/2026, 21:26 BRT

**Módulo e assets SFX liberados; zero novas escritas runtime previstas.** Nenhum drift nos hashes vigentes `039e8e43…`/`6c1dfc59…`, nem nos28 cues/manifestos. Leituras root: índice da auditoria, timeline v2, direção de arte VFX e contratos. Achados de dedup/idade/timing estão contemplados na API e nos testes; não há escuta/nota AAA inferida da revisão visual. A pendência de desconexão em main está descrita abaixo e continua encaminhada ao Combat; liberação do módulo não aprova esse gate de rede.

[Manifesto atual completo](../../output/playwright/arpg-sfx-v2-handoff/post-review-release.json) inclui hashes do runtime, candidato global e novas provas:

- **Core atualizado PASS:** [fixture core→WebAudio](../../output/playwright/2026-09-19T00-25-04-993Z-audio-arpg-core-verify/arpg-core-audio.json), warrior138/dwarf93 asserções, loop80/50 atualizações. Core `a863e12f3c26cf629ad7051d64f40bb855f2a87d8e3e1510aad1f8c000e96e63`.
- **Warrior natural PASS:** [report](../../output/playwright/2026-09-19T00-25-33-917Z-audio-arpg-gameplay/arpg-audio-gameplay-warrior.json), [PCM real](../../output/playwright/2026-09-19T00-25-33-917Z-audio-arpg-gameplay/arpg-gameplay-warrior.wav). Três casts/releases, aura1voz com137 refreshes, ready/resourcefail, espada básica, pausa zera loops, mute persiste após reload. 10.709s, pico0.394461, mute residual8.73e-9.
- **Dwarf natural PASS:** [report](../../output/playwright/2026-09-19T00-25-33-917Z-audio-arpg-gameplay/arpg-audio-gameplay-dwarf.json), [PCM real](../../output/playwright/2026-09-19T00-25-33-917Z-audio-arpg-gameplay/arpg-gameplay-dwarf.wav). Três casts/releases/impactos, campo1voz com88 refreshes, ready/resourcefail, rifle, pausa zera loops/mute persistente. 10.709s, pico0.390291, mute residual5.49e-9.

Ambas `sourceChangedDuringRun:false`, `audioChangedDuringRun:false`, mesmo mapa de hashes globais entre classes, zero page/console/request/HTTP errors. Main capturado `c7012192c595f6062c99008ce13d78d4024fe974cddeb555f02cf839dc93e4f1`. Única advertência é ScriptProcessorNode deprecated do tap de teste, fora do runtime de produção. Sem mutação de gameplay: menu, teclas, mouse e movimento reais; debug somente leitura e captura silenciosa do compressor.

Limites preservados: dash/escudo não tocaram vítimas nessa rodada; contato/morte provados em fixture, não nesta captura. Grito não causa impacto por design. Expiração completa dos loops permanece provada no core; gameplay os interrompe pela pausa. Rodadas curtas não aprovam60s/rede/reconnect/dispositivo/conforto/escuta. Não houve nova geração nem substituição de áudio.

Reserva GPU própria PID79085 adquirida atomicamente e liberada no finally; browser/servidor/ledger efêmeros encerrados. Servidor5173 permaneceu HTTP200. Combat e GUI avisados via codex queue; podem reservar a GPU atomicamente. Nenhum interrupt, alteração cruzada ou encerramento de processo do usuário.

## Entrega vigente — alinhamento com combat-v2-contract.md

**Checkpoint após anúncio coreCPU15:** API/fontes SFX continuam liberadas e os hashes de runtime, core, main e contrato são idênticos aos do snapshot `contract-options-release.json`; nenhuma nova escrita runtime SFX. A suite abaixo continua vinculada às fontes verificadas.

**Pendência de integração encaminhada ao Combat (inspeção estática, ainda sem reprodução em browser):** `src/main.js` handler WebSocket close (~10172) mantém `remoteSkillSnapshots`/`persistentSkillPresentation` e não chama samples.reset. `publishArpgState` (~6662) segue chamando syncPersistent a10Hz enquanto suspenso; samples.update (~5919) recebe playing pelo estado do jogo sem considerar suspensão de rede. Logo um snapshot antigo remaining>0 pode renovar a voz de buff/campo durante toda a desconexão. O end broadcast do servidor chega aos outros clientes, não ao socket que caiu. Proposta ao dono: resetar samples e limpar snapshots/cache de apresentação no close, impedir reconstrução de status enquanto isMultiplayerSuspended e sinalizar áudio inativo nesse período. Preservar recurso/cooldown/sequence de classSkillState. Aceitação específica: desconectar com aura/campo ativo, activeSkillLoops=[] antes de reconectar, sem colapso por cancelamento nem replay de release/impact. Não é defeito novo no módulo SFX; reset/update/end já estão cobertos na suite. Nenhuma alteração cruzada feita.

Contrato Combat v2 lido integralmente e incorporado. Correção concreta de compatibilidade: a entrada direta `playSkillSound(skillId, 'status', options)` agora aceita `status`, `remaining`, `statusDuration`/`duration` e trata `end` com `reason`, tal como `playSkillEvent`. Nenhum import novo, alteração de main/server ou nova geração; os28 assets permanecem idênticos. O adaptador de evento inteiro continua integrado no main. `targetId` passa a identificar mortes do dash quando não houver contactId.

```js
// No mesmo samples retornado por createSampleBank, sem imports adicionais:
samples.playSkillSound('dwarf_gravity_shot', 'status', {
  castId, status: 'gravity', remaining, duration: 5, pan, distance,
});
samples.playSkillSound('dwarf_gravity_shot', 'end', {
  castId, status: 'gravity', reason: 'expired', // colapso uma vez
});
// reason:'death'/'cancelled' encerra sem colapso; reset/dispose encerram todos.
// Preferido no main: samples.playSkillEvent(event, {local, ageMs, pan, distance}).
```

Preparo/gesto e duração do status são conceitos separados: o loop usa `remaining`, depois `statusDuration`, depois `duration`. Portanto buff8s/campo5s seguem o estado autoritativo, sem usar o gesto .85s como duração do campo. Release continua separado de cast/travel; impacto depende de evento real. `status:freeze/stun` é silencioso para não empilhar som por vítima; término natural de freeze conserva a fratura, término de stun é silencioso. `sustain` segue disponível como alias interno compatível.

**Fontes liberadas novamente; próximas escritas runtime: nenhuma, salvo defeito concreto.** Snapshot vigente: [contract-options-release.json](../../output/playwright/arpg-sfx-v2-handoff/contract-options-release.json). Hashes novos:

| Arquivo | SHA256 vigente |
|---|---|
| src/audio/sample-bank.js | 039e8e433ea1e2bcbaf72f755375e32008e4b0838bae1ec8c022a7e720ecd68c |
| src/audio/skill-sounds.js | 6c1dfc59287a7de0907d3fcfb8e92d34be54808a270090d9d41f0bade93b890d |

QA CPU após a correção (fontes estáveis em cada execução): [banco255 checks](../../output/playwright/2026-09-19T00-20-23-526Z-audio-arpg-verify/arpg-audio.json), [loops20 checks](../../output/playwright/2026-09-19T00-20-23-531Z-audio-arpg-loop-verify/arpg-loop-lifecycle.json), [core warrior138/dwarf93](../../output/playwright/2026-09-19T00-20-23-526Z-audio-arpg-core-verify/arpg-core-audio.json), [regressão do mix](../../output/playwright/2026-09-19T00-20-23-519Z-audio-signal-check/audio-signal.json). Pico físico16, pico de sinal0.801537 no stress, silêncio final dos loops exato; direct status/options, cancelamento por reason, término deduplicado entre as duas APIs e duas vítimas targetId foram exercitados. WebAudio nativo em fixtures, não gameplay novo nem escuta perceptual. Nenhuma GPU utilizada; servidor5173 preservado.

Fontes e handoff anteriores à correção preservados em `assets/audio/source-history/arpg-v2-before-contract-options/`. **As seções e hashes de fechamento anteriores abaixo são históricos**; capturas naturais mantêm seus hashes próprios e não aprovam esta revisão do runtime. Escuta, AAA, gameplay60s/rede/dispositivo permanecem pendentes de seus gates específicos.

## Reconfirmação do pedido vigente — 18/09/2026, 21:16 BRT

`skill-direction-v2.md` relido integralmente junto do README, prompt SFX e handoff Combat. **Brief v2 incorporado em toda a propriedade SFX**, com os seis IDs abaixo; a seleção v1 permanece somente histórica. Nenhuma regeneração ou escrita runtime adicional foi necessária: todos os hashes de fontes e assets SFX continuam idênticos à entrega v2.

| ID canônico | Apresentação sonora implementada |
|---|---|
| `warrior_war_cry` | Preparo, grito no release, loop de energia enquanto o buff está ativo e término |
| `warrior_cleaving_dash` | Preparo, whoosh/corte, contato confirmado e morte somente com killed:true |
| `warrior_shield_charge` | Corrida de armadura e impacto metálico associado ao contato/stun |
| `dwarf_explosive_cannon` | Carga térmica, disparo de canhão e explosão no impacto real |
| `dwarf_frost_shot` | Carga fria, disparo, congelamento cristalino e fratura ao terminar |
| `dwarf_gravity_shot` | Preparo/disparo arcano, impacto, loop de sucção no campo e colapso ao terminar |

O core mudou depois da captura natural anterior. Revalidação CPU com **core atual**: [arpg-core-audio.json](../../output/playwright/2026-09-19T00-16-24-551Z-audio-arpg-core-verify/arpg-core-audio.json), PASS warrior138/dwarf93 asserções, 80/50 atualizações dos loops sem reiniciar voz, end real encerra ambos, morte confirmada do dash e sinal sem clipping. Fixture de alvos/física com WebAudio nativo; não é nova captura de gameplay. Hash do core: `16e1013af30e9c7e2a10c024c81c2de2409c41cd2f9abd2210d36f16b7d2809b`. Menor contagem de eventos em relação à prova anterior não altera os critérios: cada cast/release, impactos observados, kill confirmado e ciclo completo dos dois loops continuam verificados.

As chamadas `playSkillEvent` continuam presentes em `presentClassSkill` e `syncPersistentSkillPresentation`. Status buff/gravity atualiza sustain; fase end encerra status/campo, cancelamento não produz colapso. Dedup permanece por castId, com contactId para mortes confirmadas. Snapshot/hash desta reconfirmação em [revalidation.json](../../output/playwright/arpg-sfx-v2-handoff/revalidation.json). Capturas naturais anteriores mantêm sua proveniência e limites; não são promovidas automaticamente ao novo main/core.

**Fontes SFX liberadas; próximas escritas runtime: nenhuma, salvo defeito concreto.** Esta reconfirmação não reservou GPU: somente teste CPU com `--disable-gpu` e servidor efêmero próprio. Servidor5173 observado ativo no PID60907; nenhuma ação SFX de restart/encerramento. Escuta perceptual, qualidade AAA, sessão60s, rede e dispositivo físico continuam sem aprovação SFX global.

## API v2 concreta para integração

Import existente `createSampleBank` permanece. `samples.playSkillSound(skillId, phase, options)` agora usa **somente os seis IDs canônicos v2** de skill-direction-v2.md. IDs anteriores retornam false. Fases aceitas: `cast`, `release`, `travel`, `impact`, `status`, `sustain`, `end`, `kill`, `cancel`, `ready`, `resourcefail`. Fase sem som apropriado é reconhecida e silenciosa; não usar fallback procedural.

```js
samples.update({playing, paused, muted});
samples.playSkillSound(skillId, phase, {
  castId,         // obrigatório em sustain/end/cancel
  contactId,      // somente kill pode ter som distinto por vítima, ainda limitado
  targetId,       // fallback de identidade da vítima quando contactId está ausente
  status, reason,// buff/gravity no status; end não-expired cancela silenciosamente
  pan, distance, // posição origin no preparo/grito, projétil/contato/campo nas outras fases
  local, ageMs,  // ready/fail só locais; evento velho >180ms não inicia som
  remaining,     // segundos autoritativos restantes do buff/campo no sustain
  statusDuration,// fallback de duração do status, antes de duration
  duration,      // fallback quando não há remaining; cap técnico12s
});
```

`cast` = preparação; `release` = voz/grito/impulso/disparo real; `travel` é reconhecido silenciosamente para não duplicar release. Se o core usa `{phase:'travel',release:true}`, encaminhar `release` somente nessa primeira emissão. `impact` acompanha contato/área real, nunca teclado. `kill` só morte confirmada causada pelo dash; não usar para sobreviventes.

`sustain` inicia ou atualiza a **mesma** voz identificada por skillId+castId; disponível para `warrior_war_cry` e `dwarf_gravity_shot`. Mandar remaining atualizado e pan/distância no evento/status snapshot; não reinicia em atualizações repetidas. Máximo3 loops no total e2 por tipo, dentro do orçamento16 vozes do sample bank (ambiente é uma voz adicional; música/SFX procedurais do audioManager têm seu orçamento separado). Expiração de segurança no tempo informado evita loop órfão se faltar end. Loop gravidade fica na posição do campo, aura segue o ator mediante atualização espacial.

`end` cancela o loop mesmo se pausado/mutado/evento velho, marca cast encerrado e toca término quando permitido. `cancel` cancela sem término audível. `sustain` atrasado de cast encerrado não ressuscita loop. Morte/fim/reset: `samples.reset()` encerra todas as vozes/loops e IDs; `samples.dispose()` aborta fetches e desconecta tudo. Pausa/mute/inativo encerra loops; retomada exige snapshot ativo com remaining (não há replay automático). Não há novo AudioContext ou storage/UI: gesto e `bipxAudioMuted` continuam no audioManager existente.

`getState()` inclui activeSkillLoops, loopRefreshes, loopStops, skillPlayedByPhase, skillSuppressed, loaded/loadSettled/errors e contadores de vozes. `load` permanece preload Promise. O core v2 emite cast/release/travel/impact/status/end. O adaptador abaixo já corresponde a esses eventos; integração solicitada via codex queue e agora conferida no main em presentClassSkill/syncPersistentSkillPresentation.

### Adaptador preferido para o evento inteiro do core

`samples.playSkillEvent(event, { local, ageMs, pan, distance })` existe no mesmo objeto; substituir apenas a chamada de apresentação no main. Ele preserva castId/contactId/killed/remaining/statusDuration/reason do evento e encaminha:

- status buff/gravity -> sustain com remaining autoritativo;
- status freeze/stun -> silencioso (impacto da área/escudo já soa);
- end com reason death/cancelled/etc -> cancel sem colapso;
- end natural -> encerra loop + cauda; end de stun -> silencioso;
- impact killed:true de warrior_cleaving_dash -> impacto + morte deduplicada por vítima.

Feedback privado ready/resourcefail continua em playSkillSound. Snapshots de latejoin/reconnect ou retorno da pausa devem encaminhar os buffs/campos ainda ativos como status, com remaining atual; não reproduzir grito/disparo antigo. `getState().activeSkillLoops` deve zerar ao acabar/morrer/resetar.

## Catálogo e geração

21 cues anteriores preservados. Mais7 fontes reais ElevenLabs HTTP200 geradas: skillWarCry (voz não verbal), skillWarBuff (loop), skillShieldRush, skillShieldImpact, skillCannonBlast, skillGravityLoop (loop), skillGravityCollapse. Originais em assets/audio/arpg-v2; recibos/prompt/modelo/hash no manifest; chave só env. Reuso de katana/hit/kill/frostNova/talisman e cues v1 apropriados. Sources v1 preservados em source-history/arpg-v1, sem import runtime.

Documentação oficial conferida nesta sessão antes das novas calls: https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert. `eleven_text_to_sound_v2`, mp3_44100_128, loop suportado; duração0.5–30s. Processamento de loops faz crossfade, normalização e medição da junção. Sinal técnico não prova escuta.

## Estado de QA

V2: módulo liberado e adaptador integrado pelo Combat em eventos e snapshots persistentes. Prova natural v2 passou nas duas classes com fonte estável. Não há aprovação global/auditiva.

V1 histórico: 138 checks de sinal CPU passaram; captura natural Lyra passou com PCM, mute persistente e fontes globais estáveis. Guerreiro falhou timeout esperando cast; não ocultado e não promovido. Artefatos `output/playwright/2026-09-18T23-48-37-265Z-audio-arpg-gameplay`. GPU foi liberada pelo finally do runner; browser/servidor efêmeros fechados. 5173 preservado.

Escuta perceptual/comforto/dispositivo físico continuam pendentes: esta sessão não dispõe de ferramenta que permita perceber áudio. Nenhuma nota inferida de sinal, afplay ou JEF textual.


## Liberação técnica v2

**src/audio e assets/audio liberados, sem escritas futuras planejadas salvo defeito concreto.** [Snapshot completo de hashes e recibos](../../output/playwright/arpg-sfx-v2-handoff/release.json). Evidências abaixo têm sourceHashesMatchNow:true no fechamento; nunca equivalem a gameplay ou escuta.

| Prova | Resultado |
|---|---|
| [Banco v2 nativo CPU](../../output/playwright/2026-09-19T00-05-10-566Z-audio-arpg-verify/arpg-audio.json) | 237 verificações, 60 pares skill/fase (silêncios intencionais incluídos), headroom pico0.801537, máximo físico16 incluindo loops/caudas, pausa/mute/cleanup |
| [Ciclo de vida dos loops](../../output/playwright/2026-09-19T00-05-14-641Z-audio-arpg-loop-verify/arpg-loop-lifecycle.json) | 16 checks: uma voz atualizável, expiração, end antigo durante mute, cancel sem colapso, retomada com snapshot ativo, cap3, morte/reset/dispose, silêncio final exato |
| [Core real -> WebAudio em fixture](../../output/playwright/2026-09-19T00-04-32-587Z-audio-arpg-core-verify/arpg-core-audio.json) | Warrior218/dwarf143 asserções (incluem eventos), 159/99 atualizações sem reiniciar voz; grito/dash/escudo/canhão/gelo/gravidade, morte dash confirmada e end real do core; alvos e física são fixture, não gameplay |
| [Regressão do mix anterior](../../output/playwright/2026-09-19T00-05-15-129Z-audio-signal-check/audio-signal.json) | PASS: pan, distância, prioridade, ducking, supressão e cap16 |

[WAV v2 das fases e stress](../../output/playwright/2026-09-19T00-05-10-566Z-audio-arpg-verify/arpg-skill-sequence-fixture.wav) é timeline sintética renderizada pelo WebAudio. [Audition dos28 assets](../../output/playwright/arpg-v2-audio-listening-review/index.html), 61.47s, inclui dois ciclos de cada loop; não é gameplay. Escuta continua pendente, nenhum score dado.

| Arquivo | SHA256 |
|---|---|
| src/audio/sample-bank.js | 43ae31345380a687377e9f7d413c0e03566a86e8eb70601afd0c9b0cadb9b3cb |
| src/audio/skill-sounds.js | 212c304dcbf5dd67e46a374790d0c79d5a8eca59d9ace857ce1a21b1a9d28328 |
| assets/audio/manifest.json | cb5a31a739ddbafb91da22c26253ef08ddc0643a0fb16444ac813d6074b20b01 |
| assets/audio/processed/manifest.json | fe17e86b672b1490eccd46eb50a7964e2fac4b1bcb74fa9fd4496f93711641dd |

Os13 originais+13 derivados históricos continuam byte-identical. v1 ganhou8 fontes reais (mais1 regeneração preservada); v2 ganhou7. Total28 cues; v2 originais em arpg-v2, derivatives em processed, provenance prompt/model/duration/loop/httpStatus/characterCost/hash no manifest. request-id não foi retornado pelo provider e permanece null.

Arquivos SFX modificados/criados: src/audio/{sample-bank,skill-sounds}.js; tools/generate-elevenlabs.mjs, audio-verify.mjs, audio-signal-check.mjs, audio-review-reel.mjs, audio-arpg-verify.mjs, audio-arpg-loop-verify.mjs, audio-arpg-core-verify.mjs, audio-arpg-gameplay.mjs, audio-test-server.mjs, audio-runtime-run.mjs; assets/audio manifests, novos cues/derivados e source-history; este handoff e output/playwright. audio-process.mjs foi executado sem alterar seu código. main/server/package/GUI não foram editados pelo SFX.

Reprodução:

```sh
node tools/audio-arpg-verify.mjs
node tools/audio-arpg-loop-verify.mjs
node tools/audio-arpg-core-verify.mjs
node tools/audio-signal-check.mjs
# Após integração v2, reserva atômica + backend/ledger efêmeros, preserva5173:
BIPX_BROWSER_CHANNEL=chrome node tools/audio-runtime-run.mjs tools/audio-arpg-gameplay.mjs
BIPX_BROWSER_CHANNEL=chrome node tools/audio-runtime-run.mjs tools/audio-verify.mjs
```

Primeiros4 usam servidor efêmero próprio e Chromium sem GPU; últimos2 recusam iniciar se lock GPU já existir. Não encerram processos/abas do usuário. Gameplay v2 exige os novos IDs e outputs cast/release, impactos quando confirmados, ready/fail, silêncio/persistência mute. Arquivos de validação foram preparados; execução natural v2 iniciada com reserva atômica de GPU após integração do adaptador.

Registro: tentativas de iniciar regressão GPU v2 retornaram `GPU_BUSY` e não abriram processos. Lock dos pares preservado. O ambiente explicitamente recusou audio input ao tentar carregar um MP3 para escuta, confirmando a limitação perceptual declarada. Não houve escuta simulada ou nota inventada.


## Captura natural v2 — entrega integrada

**PASS nas duas classes**, usando teclas1/2/3 e ataque básico reais, sem mutação de gameplay/debug sound. O adaptador `playSkillEvent` foi aplicado por Combat em `presentClassSkill` e `syncPersistentSkillPresentation`. `sourceChangedDuringRun:false` e `audioChangedDuringRun:false` para ambas; zero page/console/network/HTTP errors. Única advertência: ScriptProcessorNode do tap de captura de teste está deprecated; não existe no áudio de produção.

- [Warrior report](../../output/playwright/2026-09-19T00-10-40-057Z-audio-arpg-gameplay/arpg-audio-gameplay-warrior.json) e [PCM WAV real](../../output/playwright/2026-09-19T00-10-40-057Z-audio-arpg-gameplay/arpg-gameplay-warrior.wav): 10.667s, pico0.38012. Três casts/releases; aura do grito1voz, 137 atualizações; som de recarga e falha; ataque básico; pausa zera loops; mute pico residual8.72e-9 e persiste no reload.
- [Dwarf report](../../output/playwright/2026-09-19T00-10-40-057Z-audio-arpg-gameplay/arpg-audio-gameplay-dwarf.json) e [PCM WAV real](../../output/playwright/2026-09-19T00-10-40-057Z-audio-arpg-gameplay/arpg-gameplay-dwarf.wav): 10.709s, pico0.39066. Três casts/releases e três impactos confirmados; campo1voz com87 atualizações; recarga/falha, rifle básico, pausa zera loops, mute pico5.18e-9 e persiste.

Não ocorreu contato do dash/escudo nessa captura natural curta: som de contato/morte correspondente está provado na fixture do core, não nesta partida. Grito não tem impacto de dano por design. Expiração/end natural é coberta pelo core fixture; a captura do jogo interrompe os loops pela pausa. Não inferir daqui rede,60s, conforto, hardware ou nota auditiva10. Esses gates continuam próprios da avaliação global/humana.

Browser, contexts e servidor/ledger efêmeros SFX fechados; reserva própria GPU liberada pelo finally (outro dono pode reservar imediatamente). Servidor usuário PID2591/5173 continua ativo. Nenhuma escrita runtime pendente. Hashes de runtime permanecem os da tabela e foram rechecados após captura; release.json inclui hashes dos reports/WAVs. Sem commit/merge/push/deploy.
