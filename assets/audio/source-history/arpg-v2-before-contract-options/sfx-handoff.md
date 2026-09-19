# SFX ElevenLabs — v2 implementado, integrado e liberado

Propriedade: somente src/audio, assets/audio, tools áudio e este handoff. Checkout main compartilhado, WIP preservado; src/main.js/server/package são do Combat. Porta5173 intocada. Histórico v1: `assets/audio/source-history/arpg-v1/sfx-handoff.md` e `output/playwright/arpg-sfx-v1-handoff/release.json`; não valida v2.

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

Import existente `createSampleBank` permanece. `samples.playSkillSound(skillId, phase, options)` agora usa **somente os seis IDs canônicos v2** de skill-direction-v2.md. IDs anteriores retornam false. Fases aceitas: `cast`, `release`, `travel`, `impact`, `sustain`, `end`, `kill`, `cancel`, `ready`, `resourcefail`. Fase sem som apropriado é reconhecida e silenciosa; não usar fallback procedural.

```js
samples.update({playing, paused, muted});
samples.playSkillSound(skillId, phase, {
  castId,         // obrigatório em sustain/end/cancel
  contactId,      // somente kill pode ter som distinto por vítima, ainda limitado
  pan, distance, // posição origin no preparo/grito, projétil/contato/campo nas outras fases
  local, ageMs,  // ready/fail só locais; evento velho >180ms não inicia som
  remaining,     // segundos autoritativos restantes do buff/campo no sustain
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
