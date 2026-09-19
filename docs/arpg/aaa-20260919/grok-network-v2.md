# Grok 3 — orçamento de movimento v2 (isolado)

v1 **preservada** (`grok-network-v1/candidate/server.mjs` `9fb876ab…`). Runtime vivo **não editado** (`server.mjs` `eb80b8a6…`, `class-skills.mjs` `6fa8f870…`). 5173 PID 95599 HTTP 200. GPU não usada.

Candidato: `output/qa/aaa-20260919/grok-network-v2/candidate/`. Review negativo original: `output/qa/aaa-20260919/coordinator-review/network-dt-negative.json`.

## Defeitos v1 (reproduzidos, não apagados)

| Caso | v1 | Causa |
| --- | --- | --- |
| 1,1 m após 220 ms | aceito **0,5 m** | `stepActor` default `maxDt=.1` descarta 0,12 s do `packetDt` |
| 100 pacotes no mesmo timestamp | **13,54 m** | `minDt=1/60` dá crédito novo por mensagem |

## Correção v2

Módulo novo `src/combat/network-move.mjs` (`c535045e…`). `server.mjs` v2 `3858ae82…`. Solver `contacts.mjs` **intacto**.

- Crédito = `6.5 × speedMultiplier × buffSpeed × elapsed`, `elapsed = clamp(now - moveClock, 0, 0.25)`. **Sem** piso 1/60 e **sem** slack 1.25 no preço do pacote.
- Acumulador limitado a `speed × 0.25`. Timestamp igual → `elapsed=0` → zero crédito extra.
- Consumo em **metros** via `moveActor` (deslocamento completo). Tempo de catch-up acima de 0,25 s fica em `discardedDt`. Na parede o orçamento do pedido é gasto; o deslocamento físico pode ser menor (1,1 m pedidos, 0,51 m até o sólido no CPU).
- Dash/charge: x/z do cliente ignorados; `moveBudget=0` enquanto `isSkillMoving`.

Speeds: base 6,5; grito 7,475; quatro stacks `+Velocidade` 9,1.

## Provas

CPU `evidence/cpu-dt.json`: 1,1 m / 220 ms **consome 1,1**; burst mesmo t **0 m**; gap 1 s `elapsed=0.25` `discardedDt=0.75`.

WebSocket `evidence/verify-ws.json` **14/14**, dois clientes, sem horda, sem 5173:

| Caso | Resultado |
| --- | --- |
| 1,1 m / 220 ms | dist **1,1**, **0** corrections |
| 100 pacotes agrupados | **0,93 m** (só acumulador residual, cap 1,625), 100 corrections |
| 20 / 60 / 120 Hz | 1,976 / 1,527 / 1,241 m vs 2,275 / 1,625 / 1,30; 20 Hz sem correction |
| diagonal 1,1 m | passa |
| parada / reinício | 0 m depois 1,1 m |
| buff 1,15 | 1,38 m em 220 ms (pedido 1,4) |
| stacks velocidade 4 | multiplier 1,4 |
| dash vs teleporte cliente | salto 4 m (faixa da skill, não 40 m) |
| zero clientes ligados | buff 6,8 → 5,8 em 1 s; campo expira sozinho; resume na graça sem replay de reward |

## Lacuna de apresentação (integrador)

`skillSnapshot.active` existe no candidato de rede. `src/main.js:6924` `syncPersistentSkillPresentation` ainda percorre só `buff` e `fields`. Late join **não** reconstrói o projétil visual. Não declarar canhão/gelo visíveis após late join até o Combat ligar `active` nisso. Esta frente não editou `main.js`.

## Integração

Patches vs v1: `output/qa/aaa-20260919/grok-network-v2/patches/`. Combat aplica sobre fonte estável. v1 permanece para diff. Sem GPU, sem JEF, sem 10/10 global.
