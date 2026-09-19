# Grok 5 — late join nativo v4 (isolado)

Revisão independente de `main.js` + `class-skill-vfx.js` sobre a base congelada `latejoin-projectile-v1` (v3+área+UX+dash+origem visual+`syncProjectiles`). Defeito encontrado: o pulso vivo de 0,3 s some o corpo e o mesmo `world.seq` recusa o refresh. Candidato isolado em `output/qa/aaa-20260919/grok-native-v4/`. **Negativo v1 preservado.** Runtime vivo, `latejoin-projectile-v1`, 5173 e ranking **não editados**. Sem JEF, sem deploy, sem protocolo de prova visual.

Tarefa `task_ed15c688f4f7`, dispatch `ctx_16058cb8a120`.

## Fontes

| Arquivo | SHA-256 |
| --- | --- |
| latejoin-v1 `class-skill-vfx.js` (negativo) | `47eb8d0a76db74a863cea3f5b59bbe1da5b07757189d2a3e709b2643d1e1bad3` |
| v4 `class-skill-vfx.js` | `579a28485665659e03c6af441c2531e1c2fbe74fc2b7638529736b6371afa99a` |
| v4 / v1 `src/main.js` (idênticos) | `96d0627554dce7dea578b81336f5b50bcad91a1d2c08ffca4785a71f5405e65b` |
| v4 `server.mjs` | `bcbeb948a8b292559c9daed87a6a0e42caba8fde620efe0f53b2ee84b10a5131` |
| v4 `class-skills.mjs` | `058bda880930384a6a5baa210905ab2be52e38d3f88f435ed41824fc3872406d` |
| vivo `src/main.js` | `d9e6fed48d8609acbd495f9a1c747bbe8e6b9d3cc00447aa75e4896b156b6d3b` |
| vivo `src/vfx/class-skill-vfx.js` | `cdbdf7642e0526f8c7fe1d38c4458e0dd71aff522b4bf6ea115cd3083ae766b9` |
| vivo `server.mjs` | `eb80b8a675cb8b01d335916f1d63fcd297cb3052203f91135350e79840a140bd` |
| patch incremental | `output/qa/aaa-20260919/grok-native-v4/patches/class-skill-vfx.js.diff` `951d4fd2…` |

`main.js` da base já chama `classSkillVfx.syncProjectiles({ epoch, sequence, ageMs, owners })` em `syncServerWorld`. O defeito está no wrapper VFX, não no wiring.

## Defeito (v1, reproduzido)

`world.seq` incrementa em spawn/kill, não a cada broadcast de mundo (~120 ms). Com o projétil ainda no ar o cliente recebe o **mesmo** `sequence`. v1 faz `if (sequence <= snapshotSequence) return false`, então o segundo snapshot não reabre o corpo.

O travel vivo grava `bodyUntil = clock + 0.3`. v1 depois faz `bodyUntil = min(bodyUntil, snapshotUntil)`. Se o pulso de 0,3 s já passou, o `min` mantém o corpo escondido mesmo com tempo autoritativo restante. CPU: `evidence/same-seq.json` — v1 `sameSeqRefresh: false`.

## Patch v4 (só VFX, isolado)

1. Recusar só `sequence < snapshotSequence`. Igual continua refresh de corpos `snapshotOnly`.
2. `bodyUntil = snapshotUntil` (tempo restante do snapshot, teto 2 s), não o pulso de 0,3 s.
3. Eventos ao vivo, terminais e seq mais antiga continuam a ganhar: snapshot não dá rewind, não ressuscita terminal, não emite cast/release/impact/áudio/trilha.

CPU `verify-cpu.mjs` 6/6 (3 slots × high/reduced): corpo restaurado na posição do snapshot, eventos inalterados, handoff ordenado, stale/expired recusados, cleanup por época. `verify-same-seq.mjs`: v1 recusa; v4 refresca frost e canhão sem replay de evento.

## QA nativo (Chrome real, WebSocket, lock GPU próprio)

`node output/qa/aaa-20260919/grok-native-v4/verify-native.mjs`

- Servidor isolado `localServer` (PORT 0, ranking descartável, Supabase vazio). Não tocou 5173 PID 95599 HTTP 200.
- Chrome `channel:'chrome'`, ANGLE/Metal, headless, 1280×800, teclado Playwright.
- Lock `/tmp/bipx-arpg-gpu.lock` `grok-native-v4 pid=…`, liberado no `finally`.
- Captura: `output/qa/aaa-20260919/grok-native-v4/native-2026-09-19T10-02-22-838Z/` (`report.json` `af4323b3…`). `passed: true`, `errors: []`.

### Late join dos 3 projéteis

Modo **declarado**: observador abre login+WS na sala `grok-native-v4` **antes** do play; o caster aperta Digit1/2/3; o observador clica play **no travel**. Não é conexão TCP no frame do disparo — o WS de menu já existe. Contadores `cast/release` no observador vêm de `skillEvent` ao vivo após o play, **não** do snapshot: o CPU prova que `syncProjectiles` não incrementa eventos nem chama `emit`/`emitTrail`. Áudio de skill hookado em `playSkillEvent`/`playSkillSound` ficou **0**. Sem invulnerabilidade.

`world.projectiles` no sample saiu `[]` — esse array não é o snapshot de class skill. A fonte do corpo é `skillStates` → `syncProjectiles` → atributos GPU.

| Skill | Corpos | Buffer renderizado | áudio | impact | dano/score/kills/xp/reward |
| --- | ---: | --- | ---: | ---: | --- |
| `dwarf_explosive_cannon` | 1 | `cannon.body=true`, muzzle/blast `wanted=false` | 0 | 0 | 0 |
| `dwarf_frost_shot` | 1 | `ClassSkillProjectileBodies.aStyle.w=1`, `aOrigin=(2.304, 1.050, 3.367)` | 0 | 0 | 0 |
| `dwarf_gravity_shot` | 1 | `aStyle.w=1`, `aOrigin=(1.468, 1.050, 2.146)` | 0 | 0 | 0 |

Screenshot do canhão mostra o fogo em voo entre os anões. Frost/gravity têm instância ativa no mesh nomeado; o snapshot existir sem `aStyle.w>0,5` / `cannon.body` **não** passaria.

Vídeos late join: `page@0b5850ce….webm` (canhão), `page@d14cebc7….webm` (frost), `page@74823c9a….webm` (gravity).

Expired / fora de ordem / mundo novo: **CPU**, não nativo separado. Resume aqui = retomar o corpo no voo via snapshot, não reconnect de 30 s.

### Movimento dois Chrome

Sala nova `grok-native-v4-motion` (a sala de late join fica cheia: 4/4 + graça 30 s). Walker guerreiro, watcher anão. **Rede simulada declarada** só no watcher: `applyNetworkPlayerState` remoto atrasado 20–220 ms **depois** de playing; autoridade do servidor intacta. Sequência por teclado: W 800 ms (base 6,5) → diagonal WD 700 ms → parada 400 ms → Digit1 grito + W 800 ms → pulsos 20/80/140/220/40/180 ms → parada 500 ms.

| Medida | Valor |
| --- | ---: |
| frames local / remoto | 238 / 239 |
| percurso local / remoto | 19,712 m / 19,426 m |
| velocidade local máx / média / fim | **7,475** / 4,971 / **0** |
| `positionCorrection` walker / watcher | **1** / 0 |
| correção | `(1,284, -7,688)` |
| erro remoto máx / médio (mesh↔target) | 1,160 m / 0,644 m |
| jerk remoto máx | 0,490 m |
| áudio skill no watcher | 0 |

7,475 = 6,5 × 1,15 (grito). Início 6,5, fim 0 = base e parada. 220 ms × 7,475 m/s ≈ 1,64 m: o erro máximo 1,16 m cabe no jitter declarado, não é teleporte. Uma correção local. Vídeos: walker `page@13a49fbd….webm`, watcher `page@c06f58cf….webm`.

Isso **não** é nota 10 de fluidez artística nem JEF. É medição com vídeo sob jitter declarado.

## Limites

- `cast/release=1` no observador: join com WS no menu; declarado. Snapshot sozinho não reproduz áudio/hit/dano/reward/trilha.
- Canhão `position` no sample serializou `{}`; o corpo vale por `cannon.body` + screenshot.
- Reconnect de 30 s / resume de run não foi o caso nativo.
- Patch é só `class-skill-vfx.js`. Integração Combat/Astra.

## Não tocado

Vivo `src/main.js` / `class-skill-vfx.js` / `server.mjs` / `class-skills.mjs`. Candidato `latejoin-projectile-v1`. Porta 5173 PID 95599. `/tmp/bipx-aaa-local-leaderboard.json`. GPU de Fable/Astra. Sem commit/merge/push/deploy.
