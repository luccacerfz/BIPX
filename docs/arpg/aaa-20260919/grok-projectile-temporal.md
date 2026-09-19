# Grok 6 — temporal de projétil v1 (focal, não aceite final)

Revisão focal de `grok-native-v4`. **Não é aceite final.** Candidato novo `output/qa/aaa-20260919/grok-projectile-temporal-v1/candidate` copiado de v4. **v4, latejoin-v1 e runtime vivo não foram sobrescritos.** Sem JEF, deploy, commit, 5173, ranking.

Tarefa `task_a46948f2ea09`, dispatch `ctx_e52c341b96ff`.

## Fontes

| Arquivo | SHA-256 |
| --- | --- |
| latejoin-v1 `class-skill-vfx.js` (negativo original) | `47eb8d0a76db74a863cea3f5b59bbe1da5b07757189d2a3e709b2643d1e1bad3` |
| grok-native-v4 `class-skill-vfx.js` (negativo same-seq vazio) | `579a28485665659e03c6af441c2531e1c2fbe74fc2b7638529736b6371afa99a` |
| temporal `class-skill-vfx.js` (CPU heading/caminho/trilha) | `b8e562c2228ba8ffcd086fc15131c6cba008c06ff31b7745b66712c2fb62fc8c` |
| temporal `src/main.js` | `38a188bf25214508605e0f57e1dda7359ba5bc7a86d11f335d03df36d464ea1d` |
| v4 `src/main.js` (inalterado) | `96d0627554dce7dea578b81336f5b50bcad91a1d2c08ffca4785a71f5405e65b` |
| vivo `src/main.js` | `d9e6fed48d8609acbd495f9a1c747bbe8e6b9d3cc00447aa75e4896b156b6d3b` |
| vivo `class-skill-vfx.js` | `cdbdf7642e0526f8c7fe1d38c4458e0dd71aff522b4bf6ea115cd3083ae766b9` |

Patches incrementais vs **latejoin-projectile-v1**:

- `output/qa/aaa-20260919/grok-projectile-temporal-v1/patches/class-skill-vfx.js.diff` `1f6b36e6…`
- `output/qa/aaa-20260919/grok-projectile-temporal-v1/patches/main.js.diff` `9e967463…` (`serverTime` em `syncProjectiles`)

Autoridade (`server.mjs`, `class-skills.mjs`, origin-bridge, cannon emit) **não mudou**.

## 1) Same-seq v4 recua / apaga corpo

v4 deixou de recusar `sequence === snapshotSequence` (necessário: `world.seq` não é tick). Mas `sequence <` **não impede** um snapshot **mais antigo com o mesmo seq** e `owners=[]` de correr o loop de `retireSnapshot`. CPU v4: `acceptedEmptySameSeq=true`, corpo some.

`world.serverTime` já existe em `getWorldSnapshot`. Temporal:

- Recusa `serverTime <= snapshotServerTime` (mesmo timestamp e antigo).
- Não usa `world.seq` como relógio.
- TTL: `snapshotUntil = min(existente, clock+remaining)` — repetição não estende.
- `owners` vazio só aposenta se o timestamp foi **aceito** (mais novo).
- Live `travel`, terminal e troca de `epoch` continuam a ganhar.

CPU `evidence/temporal-cpu.json`: v4 negativo reproduzido; temporal recusa same/older; repeat não estende TTL; empty mais novo aposenta; live/terminal/epoch precedem; 6 casos late-join (3 slots × high/reduced) com `serverTime`.

## 2) Saltos frost/gravity 1,2 m / 1,0 m a 20 Hz

Travel vivo fazia `bodies.set(..., visualTo)` no fim do pulso. Frost 24 m/s × 50 ms = **1,20 m**; gravity 20 m/s × 50 ms = **1,00 m**. CPU v4: saltos `1.200, 0, 0, 1.200…` e `1, 0, 0, 1…`.

Temporal interpola **só entre segmentos já confirmados** (frost/gravity). Não prevê além de `confirmedTo`, não atravessa parede (o segmento já passou no origin-bridge), não atrasa terminal (hide imediato). Cannon e o bridge de origem ficam no caminho anterior.

CPU frame 1/60:

| | máx salto v4 | máx salto temporal |
| --- | ---: | ---: |
| frost | 1,200 m | 0,400 m |
| gravity | 1,000 m | 0,333 m |

0,400 = 24/60; 0,333 = 20/60. Terminal esconde no mesmo `update(0)`.

## Correção `positionCorrection` (a única do nativo v4)

Não é teleporte de 40 m. CPU do normalizer **antes de zerar o orçamento**:

1. Pacote em t=1016, dt=16 ms, budget=6,5×0,016=0,104 m, pedido 0,104, leftover 0, sem correção.
2. Segundo pacote com **o mesmo `Date.now()`** (elapsed=0): budget 0, pedido 0,104 **descartado**, |cliente−servidor|=0,104>0,02 → `positionCorrection`.

Causa concreta: dois `state` no mesmo milissegundo. O ponto nativo v4 `(1,284, −7,688)` no cemitério também pode ser bloqueio de `moveActor`; o buraco sistemático do orçamento é o dt zero. Não afirmei zero correções.

## Nativo focal (dois Chrome)

`native-2026-09-19T10-24-28-026Z/` `report.json` `710a8499…`. Lock GPU próprio `grok-projectile-temporal-v1`, depois liberado (Fable voltou a ocupar). 5173 PID intacto HTTP 200.

**Late join real após release:** preload de assets **sem WS**; caster Digit2; observador só então `?ws=` + `autoplay=1`. Não é o nativo v4 com WS no menu antes do cast.

| | valor |
| --- | --- |
| `snapshotWitness` | `syncProjectiles` seq=2, `serverTime` 1789813471411 |
| corpo no witness | 1, `aOrigin≈(1,637, 1,05, 2,370)` |
| eventos no witness | cast 0, release 0, travel 0, impact 0 |
| amostra playing | bodies 1, audio 0, cast 0, release 0, impact 0, travel 5 (pulsos **depois** do snapshot) |
| score/dano | 0 |

O body **veio do snapshot** (`snapshotOnly` no sync, eventos ainda zerados). Travel=5 depois é handoff ao vivo, não replay de cast/release. `startGame` chama `clearEntities`→`classSkillVfx.reset()`; o witness é no `syncProjectiles` do welcome/runStarted, antes do render — único jeito de ver `snapshotOnly` no mesmo chunk TCP que os `skillEvent`.

**Voo dois clientes**, jitter **declarado** 20–80 ms só em `presentClassSkill` remoto de travel:

| | valor |
| --- | ---: |
| frames com corpo | 52 |
| salto máx / médio | **0,418 m / 0,350 m** (v4 era 1,20 m no pulso) |
| velocidade aparente máx / média | 28,7 / 21,1 m/s (frost 24; teto de gate 30) |
| terminal escondeu | sim |
| áudio | 0 |

Não é matriz 3×2 nem protocolo de prova visual.

## Follow-up CPU (msg_ba620e73a89a) — sem GPU

Inbox lida. Três bugs da interpolação v1 fechados em CPU (`verify-geometry-cpu.mjs`, `evidence/geometry-cpu.json`):

1. **Heading:** `stepVisual` no endpoint (`dist=0`) usava `+Z`. Agora conserva `visualHeading`; frost apontado −Z permanece −Z em repouso.
2. **Caminho:** novo `confirmedTo` não corta diagonal. `pendingTo` (máx. 8) percorre os vértices confirmados. Extra além da fila é **ignorado** (atraso, não salto de vértice).
3. **Trilha:** não emite o pulso 20 Hz inteiro no evento. `paintPresentedTrail` no passo do corpo; se um `update` atravessa B, emite A→B e B→…, **não** a corda A→C. Snapshot e reduced continuam sem trilha.

Freeze para Astra: `FREEZE.md`. Fable `hideBody`/`clampMuzzleLead` **não** está neste wrapper.

Ordenação só (`serverTime`+TTL, sem interpolação): `output/qa/aaa-20260919/grok-snapshot-order-v1/` + `docs/arpg/aaa-20260919/grok-snapshot-order.md`.

**Nenhuma captura nativa nova.** Astra/root audio têm a GPU.

## Limites

- Focal, não aceite final. Cannon continua no pulso vivo de 0,3 s (pedido: preservar cannon).
- `snapshotOnly` some no render assim que chega travel ao vivo no mesmo tick — daí o witness no sync.
- Velocidade aparente 28,7 > 24 em um frame de catch-up com jitter; média 21,1.
- `positionCorrection` dt=0 documentada, **não corrigida** neste patch (não era o pedido de projétil).
- GPU: a rodada nativa anterior saiu da fila; **não** há nova captura até aviso. Fila `pendingTo` cheia descarta destinos novos.

## Não tocado

`grok-native-v4/`. `latejoin-projectile-v1/`. vivo `src/main.js` / `class-skill-vfx.js` / `server.mjs`. 5173. ranking. Sem commit/merge/push/deploy/JEF.
