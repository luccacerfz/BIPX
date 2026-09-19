# Grok 7 — snapshot order/TTL only (sem interpolação)

Tarefa `task_4993eaf6e1b2`, dispatch `ctx_8671722799f1`. **Substitui** o trabalho de interpolação. `grok-projectile-temporal-v1` permanece congelado para Astra (`class-skill-vfx.js` `b8e562c2…`) e **não foi editado nesta entrega**. Sem GPU, sem JEF/deploy, 5173 HTTP 200.

Candidato completo (242 arquivos) derivado de `latejoin-projectile-v1/candidate`: `output/qa/aaa-20260919/grok-snapshot-order-v1/candidate/`.

## Fontes

| Arquivo | SHA-256 |
| --- | --- |
| latejoin-v1 `class-skill-vfx.js` | `47eb8d0a76db74a863cea3f5b59bbe1da5b07757189d2a3e709b2643d1e1bad3` |
| order `class-skill-vfx.js` | `61fe50f7d109901a3156a67fd51b339a1cc02a2dc39ed8f1f971e6ef50443925` |
| latejoin-v1 `src/main.js` | `96d0627554dce7dea578b81336f5b50bcad91a1d2c08ffca4785a71f5405e65b` |
| order `src/main.js` | `38a188bf25214508605e0f57e1dda7359ba5bc7a86d11f335d03df36d464ea1d` |
| v4 `class-skill-vfx.js` (negativo same-seq vazio) | `579a28485665659e03c6af441c2531e1c2fbe74fc2b7638529736b6371afa99a` |
| temporal congelado (não tocado) | `b8e562c2228ba8ffcd086fc15131c6cba008c06ff31b7745b66712c2fb62fc8c` |
| vivo `src/main.js` | `d9e6fed48d8609acbd495f9a1c747bbe8e6b9d3cc00447aa75e4896b156b6d3b` |

Patches incrementais vs latejoin-v1:

- `output/qa/aaa-20260919/grok-snapshot-order-v1/patches/class-skill-vfx.js.diff` `70bf9945…` (60 linhas)
- `output/qa/aaa-20260919/grok-snapshot-order-v1/patches/main.js.diff` `4b678519…` (`serverTime` em `syncProjectiles`)

Neste wrapper **não existem** `visualAt`, `stepVisual`, `pendingTo` nem interpolação.

## Contrato

`syncProjectiles({ epoch, sequence, serverTime, ageMs, owners })`:

- Recusa se `serverTime` não é finito, ou `serverTime <= snapshotServerTime` (duplicata e antigo).
- `world.seq` igual **com timestamp novo** aceita e refresca o corpo.
- `snapshotUntil` só diminui (`min` com o restante); repetir o mesmo timestamp não estende TTL.
- `bodyUntil = snapshotUntil` nos corpos reconstruídos (não o pulso vivo de 0,3 s).
- `owners` vazio só aposenta depois de um timestamp **aceito** (mais novo).
- Live travel, terminal e troca de `epoch` continuam a ganhar.

## CPU (`verify-order-cpu.mjs`, 6+negativos)

`evidence/order-cpu.json` `6cfad341…`. Wrapper real, Three.js, 3 skills × high/low.

| Caso | Resultado |
| --- | --- |
| 6 snapshots restauram corpo, sem replay de evento/trilha | passa |
| mesmo `seq`, `serverTime` novo | aceita, corpo fica |
| mesmo `serverTime` + `owners` vazio | recusa, corpo fica |
| timestamp antigo + vazio | recusa, corpo fica |
| timestamp novo + vazio | aposenta |
| duplicata não estende vida | passa |
| live / terminal / epoch | passam |

Negativos preservados:

- **v1 latejoin:** `sequence <=` recusa o mesmo seq vazio; corpo **permanece**.
- **v4:** `sequence <` **aceita** o mesmo seq vazio e **apaga** o corpo. É isto que o relógio `serverTime` corrige.

## `positionCorrection` (distinção)

O CPU de dois pacotes `state` no **mesmo milissegundo** (elapsed=0, budget=0, descarte > 0,02 m) mostra **um mecanismo** capaz de emitir `positionCorrection`. **Não prova** a causa da única correção nativa v4 em `(1,284, −7,688)`: não houve correlação de horário de pacote nem de collider.

## Fora de escopo

Interpolação / heading / trilha: Astra5 revisa `grok-projectile-temporal-v1` (snapshot `8d1c7263` reprovado em curva/overflow; freeze posterior `b8e562c2` não foi re-testado por mim aqui). Fable `hideBody` não entra neste patch. Sem GPU. Sem server/autoridade/movimento/live/5173/ranking. Sem commit/merge/push/deploy/JEF.

Astra5 (`term_1fa68ad4-8318-410e-add2-a122fa192c7d`) pode revisar este snapshot-order congelado.

## Adendo TTL (msg_b4ee53d0d12d) — fonte order **não** alterada

`verify-ttl-cpu.mjs` / `evidence/ttl-cpu.json`. Hash do wrapper continua `61fe50f7…`.

Gelo/gravidade: timestamps novos com `elapsed` repetido; o relógio avança até o prazo original; corpo visível depois de 0,3 s e some só após o remaining. Canhão: visibilidade viva usa watchdog `cannon-vfx` `clock-lastTravel<=0.3` (clear ~0,55 s), independente do `snapshotUntil` do wrapper; canhão **não** foi editado.
