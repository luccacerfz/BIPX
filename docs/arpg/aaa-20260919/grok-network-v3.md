# Grok 4 — prova de movimento v3 (isolado)

v2 **preservada** (`grok-network-v2/candidate/server.mjs` `3858ae82…`). Runtime vivo **não editado** (`eb80b8a6…` / `6fa8f870…`). 5173 PID 95599 HTTP 200. GPU não usada. VFX/`main.js` não tocados.

Candidato: `output/qa/aaa-20260919/grok-network-v3/candidate/`. Patch incremental: `output/qa/aaa-20260919/grok-network-v3/patches/server.mjs.diff` (`65aa604a…`).

## O que a v2 media errado

`walkHz` parava o loop **antes** de `t >= seconds` e comparava a distância com `speed * duração nominal` (folga 0,35–0,45 m). O último pacote real era mais curto; 20 Hz dava 1,976 m vs 2,275 m “esperados”.

v3 envia até `lastT >= 5 s`, espera o `playerState` do observador e compara **destino do último pacote** com a posição aceite. Tolerância `max(0.02, speed × 0.008)` — limiar de correction e 8 ms de loop, não 0,4 m.

## Call sites de `normalizePlayerState`

Negativo v2 preservado em `evidence/cpu-calls.json`: `{x:40}` sem colisão virava `x=40`.

v3: x/z **só** de `options.position` já colidido. Sem `position`, x permanece o do servidor. Dois usos no handler `state`: dash passa `{x,z}` do skill mover; walk passa o resultado de `moveActor`. Definição + 2 calls = 3 ocorrências. Nenhum outro call site.

## Provas WebSocket (`evidence/verify-walk.json`, 16/16)

Trajeto livre 36 m no heading `a=2.705`. Mundo idle (sem spawn) rotulado; não é fixture de horda.

| Caso | lastT | requested m | accepted m | corrections |
| --- | --- | --- | --- | --- |
| 20 Hz 5 s | 5.019 | 32.6235 | 32.6235 | 0 |
| 60 Hz 5 s | 5.004 | 32.5260 | 32.5260 | 0 |
| 120 Hz 5 s | 5.003 | 32.5195 | 32.5195 | 0 |
| diagonal 5 s | 5.002 | 32.5130 | 32.5130 | 0 |
| parada 5 s | — | 0 | 0 | 0 |
| livre 5 s | 5.017 | 32.6105 | 32.6105 | 0 |
| jitter 20–220 ms 5 s (seq monótona) | 5.130 | 33.3450 | 33.3450 | 0 |
| burst 100 pacotes | — | 100 | 0.286 | 100 |
| gap 400 ms | — | 2.600 | 1.625 | — |
| buff 1,15 × 2 s | 2.011 | 15.0322 | 15.0322 | 0 |
| pós-expiração 6,5 × 2 s | 2.015 | 13.0975 | 13.0975 | 0 |
| stacks 1,4 × 2 s | 2.020 | 18.3820 | 18.3820 | 0 |

Gap: `discardedDt=0.169` (400 ms − 250 ms), aceite = `6.5 × 0.25`. Convergência após correção: erro **0**. Burst fica sob o cap 1,625 m.

## Merge Fable +Área (snapshot `active`)

Contrato `output/qa/aaa-20260919/fable-area-v1/grok-snapshot-field-contract.md`. Só o candidato v3 (`class-skills.mjs` `43660d35…`). v2 e runtime vivos intactos.

- `snapshotActive` passa `areaMultiplier` (`?? 1`) e `radius` (`?? def.radius`).
- `restoreActive` ignora `radius` do snapshot; `sanitizeAreaMultiplier` (clamp 1–2.25) + `getSkillRadius`. Legado sem campo → 1 → raio base (canhão 3,4). Forjado `radius:500` / `areaMultiplier:77` → 2,25 / 5,1.
- `fields[]` rederivam da mesma forma (gravidade 1,65 → 6,423 m).
- `beginSkill` deste candidato ainda não congela o multiplicador: isso fica no patch Fable. CPU: `output/qa/aaa-20260919/grok-network-v3/evidence/cpu-area-snapshot.json`.

## Limites

Protocolo, não fluidez visual. Origem frost/gravity e raio de área são outras frentes. Late-join de `active` no `main.js` continua lacuna de apresentação.
