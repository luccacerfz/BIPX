# SFX ElevenLabs — contrato e entrega

## Propriedade confirmada

Terminal `term_f52b3e0f-3740-40c3-b943-06adabbcdbc7`; branch main, HEAD `9124df5657474e9ad0a82634a53b987c75d70e9b`. Apenas src/audio, assets/audio, ferramentas áudio e este handoff. Porta 5173, PID 2591, HTTP200 confirmados; servidor preservado. Pedido vigente: seis skills ativas.

## Contrato implementado — módulos liberados para integração

Import existente permanece: `import { createSampleBank } from './audio/sample-bank.js'`.
O objeto retornado fornece `playSkillSound(skillId, phase, options = {})`.

```js
audioManager.samples?.playSkillSound(skillId, phase, {
  castId,       // ID estável de cast, inclusive para múltiplos contatos/AOE
  pan,         // -1..1, mesma convenção getSpatialAudioOptions
  distance,    // unidades de mundo, atenuação existente
  local: true, // false para remoto: não tocar ready/resourcefail
  ageMs: 0,    // idade real do evento; >180ms é descartado
});
```

IDs: os seis de README.md. Fases: `cast`, `travel`, `impact`, `ready`, `resourcefail`. Chamar cast após aceite local/servidor; impact no evento de impacto confirmado; travel uma vez na emissão do projétil (não por frame); ready somente na transição cooldown >0 para 0, não em snapshot inicial; resourcefail somente para input local recusado. Não chamar cast na mera intenção GUI. Usar o MESMO castId para todos os contatos de uma área/perfuração: uma voz de impacto por cast. `local:false` preserva sons espaciais mas silencia feedback privado.

Retorno booleano: false para ID/fase desconhecidos; true para evento reconhecido, inclusive supressão por mute/cooldown/carregamento/idade/duplicação. Não gerar fallback procedural quando retornar true. Sem fila de reprodução tardia. `samples.load` continua Promise de preload; getState inclui `skillPlayedByPhase`, `skillSuppressed`, `recentSkillEvents`, `loadSettled`, `disposed`. `update({playing,paused,muted})` permanece obrigatório; `reset()` limpa vozes/IDs de casts numa nova partida; `dispose()` encerra fontes, aborta fetches e desconecta nós. O AudioContext, gesto e persistência `bipxAudioMuted` continuam sob o audioManager existente, sem segundo contexto/listener/UI.

Os exports adicionais de `src/audio/skill-sounds.js` são `SKILL_SOUND_PROFILES`, `SKILL_SOUND_IDS`, `SKILL_SOUND_PHASES`; nenhum é necessário no main. Os três travel do guerreiro são reconhecidos mas intencionalmente silenciosos (áreas instantâneas, sem projétil). Incendiary/arcane dwarf: o cast toca preparação; o disparo acontece em travel na emissão real após 0.18/0.40s, não antecipadamente. Sem timers locais de impacto. Impactos têm prioridade 2 e ready/fail throttle global 0.8/0.4s; variação sutil de pitch, máximo 16 SFX mais um loop ambiente. Cast local reduz temporariamente ataques básicos a 72%; boss/levelUp também reduzem skill bus.

## Integração solicitada ao Combat

- Aplicar chamadas acima no main, que pertence exclusivamente ao Combat.
- No startRun/endRun invocar samples?.reset(); em descarte definitivo samples?.dispose().
- Antes de playSkillSound sincronizar `samples.update({ playing: game.state === 'playing', paused: isGamePaused(), muted: audioManager.muted })` usando o predicado de pausa real do main. Isso evita um frame de atraso ao mutar.
- Se for expor debug, somente encaminhar à mesma API; auditorias devem distinguir debug/fixture de inputs reais.
- Correção de posição aplicada pelo Combat: cast usa origin, demais fases usam target. Conferido no main atual.
- GUI corrigiu o descarte de intenção em cooldown/resource: encaminha ao Combat para rejeição com feedback, sem conceder nada. Loading/paused/dead seguem bloqueados; conferido no código atual.

Integração no main já observada em `playSkillFeedback`, `playSkillsReady`, `presentClassSkill`, start/endRun. Combat agora informa ageMs estimado por serverTime/offset, conferido no main; o módulo não inventa idade de pacotes. Validação de sinal abaixo é isolada; a captura de gameplay é prova separada.

## Evidência

Em andamento. Treze fontes existentes inventariadas; chave apenas em env. Documentação oficial consultada em 18/09/2026 UTC: https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert (`eleven_text_to_sound_v2`, duração 0.5–30s, loop permitido v2). Nenhuma aprovação perceptual inferida de testes de sinal/JEF textual.


## Liberação v1 — 18/09/2026 23:49 UTC

**Fontes runtime de SFX liberadas.** Nenhuma escrita adicional de runtime/assets prevista para a janela de Combat. Os nomes v1 acima são históricos perante `skill-direction-v2.md`, recém-publicado; estes testes não aprovam a nova seleção nem loops persistentes de gravidade/buff. A transição foi sinalizada ao Combat via `codex queue` usando o UUID verificado em agents.json; o UUID recebido na mensagem de retomada retornou `no rollout found`.

- 8 novos cues reais ElevenLabs + 13 reaproveitados = 21. Houve 9 requests HTTP200: skillReady foi regenerado porque o primeiro sinal tinha RMS ativo -27.56dBFS após processamento. Nova versão -22.34dBFS; original e metadados anteriores preservados em source-history. Nenhuma chave em cliente/docs/manifest/logs. Modelo v2, prompts/duração/formato/custo e SHA256 no manifest; provider não retornou request-id (null, sem inventar recibo).
- 26/26 arquivos anteriores (13 originais + 13 derivados) têm hashes idênticos ao snapshot `docs/quality-trace-20260918T190858.json`.
- Processamento mede sinal, remove silêncio inicial, aplica fade/normalização com headroom e verifica loop. Não é nota perceptual.
- QA nativo CPU: [138 verificações](../../output/playwright/2026-09-18T23-31-24-451Z-audio-arpg-verify/arpg-audio.json), 30 combinações skill/fase, decode21, início<60ms das fases sonoras, pan/distância, preloading sem replay atrasado, dedup100 contatos, ready/fail globais, mute/pausa/reset/dispose, stress com horda e caudas físicas. Fonte de áudio estável e hashes ainda conferidos após retomada. Pico sinal 0.789209 (-2.06dBFS), sobreposição física máxima16; pausa pico0.000398, mute e pós-dispose zero.
- [Regressão do banco anterior](../../output/playwright/2026-09-18T23-31-26-940Z-audio-signal-check/audio-signal.json): PASS. CPU-only, porta efêmera, sem cena3D. Também é fixture, não gameplay.
- [WAV das seis skills + stress + quiet gaps](../../output/playwright/2026-09-18T23-31-24-451Z-audio-arpg-verify/arpg-skill-sequence-fixture.wav) é render nativo OfflineAudioContext de timeline sintética, sem alegação de gameplay.
- [Página/reel dos21 assets](../../output/playwright/arpg-audio-listening-review/index.html), 45.79s aproximados, som isolado. **Escuta perceptual pendente**: a sessão não dispõe de ferramenta que permita perceber áudio. Não foi atribuída nota auditiva nem inferida escuta de afplay/JEF textual/medição de sinal. Conforto em sessão longa e dispositivo físico permanecem pendentes.

Hashes completos e lista de arquivos no [release.json](../../output/playwright/arpg-sfx-v1-handoff/release.json).

| Arquivo | SHA256 |
|---|---|
| src/audio/sample-bank.js | f1a1a77d20303bf5e0c261fb0766a3a169655dfe2036faf36f1e2ea755bcadfb |
| src/audio/skill-sounds.js | e97475487642be432cd6c70acdc1442289594e4479c34e47c74e67ff22f078cc |
| assets/audio/manifest.json | c239e311c82412b7ffcba5543c9ef1f92d28abc205af5287eb488ddea483a20a |
| assets/audio/processed/manifest.json | c821841ae458f48f8291e7369b36a55d58f3707ca88d281117b4ff1bb798ed36 |

Arquivos escritos: src/audio/sample-bank.js; novo skill-sounds.js; assets/audio/manifest.json, arpg/*.mp3, source-history/skillReady-* e processed/manifest.json +8 derivados (os13 anteriores reprocessados com bytes idênticos); tools/generate-elevenlabs.mjs, audio-verify.mjs, audio-signal-check.mjs, audio-review-reel.mjs; novos tools/audio-arpg-verify.mjs, audio-arpg-gameplay.mjs, audio-test-server.mjs, audio-runtime-run.mjs; este handoff e evidências output/playwright. main/server/package/GUI não editados por SFX. node --check e git diff --check passaram.

Comandos sem editar package.json:

```sh
node tools/audio-arpg-verify.mjs
node tools/audio-signal-check.mjs
node tools/audio-review-reel.mjs output/playwright/arpg-audio-listening-review
# CPU fixtures acima usam servidor efêmero próprio, Chromium sem GPU.
# Os dois abaixo reservam GPU atomicamente e usam backend/ledger efêmeros:
BIPX_BROWSER_CHANNEL=chrome node tools/audio-runtime-run.mjs tools/audio-arpg-gameplay.mjs
BIPX_BROWSER_CHANNEL=chrome node tools/audio-runtime-run.mjs tools/audio-verify.mjs
```

A captura natural verifica as duas classes por inputs reais, não muda gameplay via debug, mede saída real do compressor, silêncio e mute persistente. Impacto só é exigido quando há evento de contato observado; ausência de contato é reportada como cobertura pendente. main/core global podem mudar sob outros donos: report conserva hashes globais e não promove captura com sourceChangedDuringRun a candidato estável.
