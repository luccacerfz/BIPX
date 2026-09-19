# Grok 2 — reconexão e autoridade de movimento (candidato isolado)

**Runtime vivo não editado.** Integração é Combat. Browser/GPU e fluidez visual ficam para etapa coordenada. Status HUD da gravidade e solver de crowd não entram neste lote.

Candidato: `output/qa/aaa-20260919/grok-network-v1/candidate/`. Baseline byte-idêntica ao vivo em `.../baseline/`. Provas: `output/qa/aaa-20260919/grok-network-v1/evidence/verify-baseline.json` (bugs reproduzidos, 10/10 checks) e `verify-candidate.json` (correção, 10/10). Patches: `output/qa/aaa-20260919/grok-network-v1/patches/{server.mjs,class-skills.mjs}.diff`.

Live após os testes: `server.mjs` `eb80b8a675cb8b01d335916f1d63fcd297cb3052203f91135350e79840a140bd`, `class-skills.mjs` `6fa8f8709bbf47b5015535c438a77ad97b933a8dbb2da05c6b0df21b8cee93c3`. 5173 PID **95599** HTTP 200. Ledger `7f580798…` intacto.

## Política implementada

**Disconnect / graça 30 s.** `removeClient` deixa de chamar `cancelSkills`. Buff, campo e `active` continuam no objeto do cliente. `updateRoomWorld` avança `getSkillClients` (playing com vida, ligados ou não), para o relógio autoritativo não congelar na ausência. Sem connected players, não há spawn nem wipe; skills ainda andam. `playerLeft` leva `resumable:true` e `resumeGraceMs`. Identidade, `runId` e progressão permanecem. Ao expirar a graça, `expireClient` emite `cancelSkills` com `reason:'expired'` e remove o token.

**Snapshot `active`.** `skillSnapshot` serializa até três casts da classe, com `hitIds` como array de strings. `restoreSkillSnapshot` reconstrói `Set` só para apresentação/resume. Cast de outra classe é descartado. O servidor **nunca** aplica snapshot vindo do cliente; `beginSkill` ignora `damage`/`hitIds` forjados. Late join lê `world.skillStates[].skills.active`.

**Teto de locomoção.** Derivado do contrato vigente, não de 12 m/s inventados:

- base `player.speed = 6.5` (`src/main.js:1505`, ambas as classes)
- `stats(progression).speedMultiplier` = `1 + 0.1 * stacks` (máx. 4 → 1,4)
- buff de grito `getSkillModifiers().speed = 1.15`
- folha de pacote `1.25` (frames 20–60 Hz agrupados)
- dt do último `state` limitado a `[1/60, 0.25]` s (`stepActor` maxDt)

Velocidade ordinária máxima = `6.5 × speedMultiplier × buff × 1.25`. Dash/charge continuam só no `moveCaster` autoritativo (`isSkillMoving` / `skillMovementUntil` ignoram x/z do cliente). Excesso → `stepActor` + `positionCorrection`.

## Evidência

Comando: `node output/qa/aaa-20260919/grok-network-v1/verify-network.mjs {baseline,candidate}`. Servidor efêmero, dois clientes WebSocket, sem fixtures de horda, sem 5173, sem GPU.

| Caso | Baseline (defeito) | Candidato |
| --- | --- | --- |
| Resume na graça | identidade ok | identidade ok |
| Disconnect no grito | buff some (`reason=disconnect`) | buff permanece, sem end de disconnect |
| Late join no campo | vê `fields` | vê `fields` |
| Disconnect no campo | peer recebe gravity end disconnect | peer **não** recebe end de disconnect |
| Late join no canhão | `active` ausente, só `lock` | `active[0].skillId=dwarf_explosive_cannon`, `released`, `hitIds=[]` |
| Payload adulterado | custo/cooldown reais | igual (recurso 70–76, CD > 0) |
| Teleporte 40 m | aceito em campo aberto | `positionCorrection`, deslocamento < 3 m |
| Burst irregular ~1,1 m / 220 ms | aceito | aceito (< 3 m) |
| Resume após 30,5 s | `resumed:false`, novo id | igual (graça expirou) |

CPU: snapshot JSON roundtrip no candidato restaura `Set`; snapshot warrior com `active` de anão vira lista vazia.

## O que não cobre

- Dois browsers / GPU / fluidez visual
- HUD da gravidade (P2 anterior)
- Crowd 10 corpos / 100 ms
- JEF e produção pública (Render 503)
- Promoção ao runtime vivo

Combat aplica os diffs sobre fonte estável, com o mesmo `verify-network.mjs candidate` antes de qualquer restart de 5173.
