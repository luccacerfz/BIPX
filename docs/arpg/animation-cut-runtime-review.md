# Corte runtime — revisão CPU/HTTP para freeze Combat

**Queda já integrada e congelada. Nenhum patch runtime pendente.** Nova conferência em 2026-09-19T03:26:08.479877+00:00; [recibo](../../output/arpg-animation/death-cut-v3/combat-freeze-recheck-2026-09-19T03-24-46.001547+00-00/review.json), [CPU desta rodada](../../output/arpg-animation/death-cut-v3/combat-freeze-recheck-2026-09-19T03-24-46.001547+00-00/fall-cpu.json), [HTTP5173 e hashes](../../output/arpg-animation/death-cut-v3/combat-freeze-recheck-2026-09-19T03-24-46.001547+00-00/source-http.json).

`src/assets/enemy-death-cut.js` ativo: **e37398db9fa3d02294cd5abb4929a52afc6caa84678f465fa099f62c61b63371**. GET sem cache no5173 retornouHTTP200/JavaScript com SHA idêntico ao disco. Pool `animated-enemies.js` também coincide por HTTP/disco: **e73ad4f939f4d4dcb001d1f1c7bbc4239de607fe3dac21475ff2f8f77d936184**. O [manifesto Combat215fontes](../../output/qa/arpg-spawn-ui-role-order-20260919/source-manifest.json) já contém e37398db; não está usando a versão v2 sem queda nesse registro. Essa conferência não identifica o módulo já carregado numa aba antiga nem altera cópia isolada de uma captura em curso. A próxima cópia estável deve registrar esse hash, preservando as evidências anteriores.

## Reconciliação das versões

| Versão | Hash | Estado |
|---|---|---|
| Corte v2 da revisão root |6c25661e|Antes preservado; torso suspenso/cintura aberta motivaram v3|
| Primeiro v3 |252fab0a|Queda/tampa, ainda com mão solta; preservado como antes|
| Runtime v3 corrigido |e37398db|Queda/tampa e braços/mãos coerentes ao torso; ativo desde promoção00:53|

A ferramenta `animation-cut-fall-cpu.mjs` não indica uma implementação nova em andamento. Já verificava a versão integrada. Foi **reexecutada agora a pedido de Combat** para encerrar a dúvida de fonte:16/16, fonte estável, quatro rigs×duas poses×duas orientações, pisos0/.4m. Queda mínima média do torso entre.12/.85s: **0.360793m**; ambas metades apoiadas antes do fade. Menor folga visível medida: **0.012000m**. Zero contornos abertos nos casos; reparos locais continuam explícitos (máximo0.033108m). Pausa, rig/geometria/material originais e descarte único passaram.

Limites do runtime: duas peças rígidas, gravidade12m/s², tombamento.66s, suporte+12mm, vida1.65s/fade.35s e24cortes. Não é ragdoll nem benchmark. A revisão root de legibilidade das metades sob horda/VFX segue aberta; CPU não resolve composição, acabamento AAA ou playback integrado. [Provas nativa e death-only anteriores, com limites](animation-cut-v3-handoff.md) continuam preservadas. Nenhuma nova captura GPU foi feita nesta conferência.

## Liberação

Combat pode seguir combos/natural60s/classes/rede com **fontes Animation já congeladas**; não precisa aguardar novo código de queda. APIs de morte confirmada e clipping permanecem iguais. Nenhuma edição runtime/main/server, restart5173 ou reserva GPU nesta rodada. Locomoção07952 continua ativa; v6/v7 não devem entrar na captura final. Refinamento artístico posterior do corpse precisará fonte e janela próprias.
