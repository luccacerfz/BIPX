# Ré Lyra v5 — aterrissagem corrigida em cópia; take ainda retido

Continuação bounded solicitada pelo root. **Nenhum runtime foi alterado.** `hero-locomotion.js` ativo segue `07952bfc`; sidecar ativo segue `6cb29422`. Servidor5173 PID97873 preservado. Nenhuma GPU, fila, interrupt ou novo agente. Physics/Combat podem continuar sua janela; este candidato não está liberado para promoção.

## Causa demonstrada no mesmo material

[Traço e comparação reproduzíveis](../../output/arpg-animation/backward-v5/comparison.json). O diagnóstico acompanha **DwarfBody, vértice14493, pé esquerdo**, sem trocar o witness entre quadros. São precisamente os landings elegíveis destacados pelo auditor intacto: frame433 em6.5 e frame360 em9.1. Antes/no/depois do touchdown estão no JSON; os traces completos preservam480quadros por velocidade. Hook em cópia instrumentada; comparação com ator gêmeo sem observador deu perturbação máxima **zero**. Não são gameplay nem captura nativa.

No donor9.1, frame360, velocidades mundiais X/Z em m/s:

| Etapa/componente | X | Z |
|---|---:|---:|
| Ator |0|9.100000|
| Quadril renderizado |≈0|9.100000|
| Quadril driver |≈0|9.100000|
| Ankle driver |1.212125|8.601040|
| ToeBase driver |3.150226|6.816765|
| Sola material driver |4.441072|7.359221|
| Sola sob quadril superior, antes IK |3.862129|3.199195|
| Sola depois do IK |4.303063|7.040170|
| Sola depois do clamp vertical |4.303064|7.040169|

A compensação da passada ainda não cancela o deslocamento do ator na entrada do contato. O delta do ponto material em relação ao ankle contribui **(+3.228947,−1.241820)m/s** em X/Z por rotação/deformação do pé. O IK recoloca a cadeia inferior na referência do driver: a diferença contra a pose inferior sob o quadril superior é **(+.440934,+3.840974)m/s**. Isso não é teleporte planar do quadril; é a diferença entre duas poses/referências. Direção/stride e solução do pé deixam o resultado próximo do material do driver: delta **(−.138009,−.319051)m/s**. O clamp do piso muda a velocidade XZ em menos de.000002m/s.

A primeira flag de contato ainda encontra o pé avançando: o anchor anterior não existe nesse quadro, é criado só após a solução. O bloqueio só freia o material no quadro seguinte. A máscara usa altura/velocidade do ToeBase e amostras discretas; ela não garante velocidade mundial nula da sola ao cruzar a fronteira. Não a alteramos para ocultar essa chegada. O ganho de capacidade do donor (nominal4.322, rate1.987 em9.1, stride1.06) resolve mismatch/alcance do ciclo, mas não implica aterrissagem adequada. O traço anterior do take original está preservado em `backward-v5/original-trace/`.

## Correção localizada

Somente `output/arpg-animation/backward-v5/candidate/src/assets/hero-locomotion.js` recebe a alteração; SHA **3d61e143ba7c8b6282c0ffea4d4705fe23746c431611844b064915ee394de0fd**. [Diff limitado ao staging](../../output/arpg-animation/backward-v5/landing-staging.patch).

Para `RunBackwardRetargetV2`, o perfil amostra a sola deformada na próxima entrada de apoio. Durante a metade final do swing, um blend quintic aproxima o material desse ponto previsto no mundo, usando o tempo restante e a velocidade recebida do caller. O ponto fica fixo durante a aproximação. Só sua coordenada XZ é usada: o Y negativo do ponto fonte registrado no trace não é um destino de piso. O solver vertical/folga, máscara de contato, amostras160, roll dos pés e take permanecem. Nenhum bone é alongado; a contribuição adicional recebe o limite geométrico já usado por07952.

O primeiro ensaio sem limite geométrico melhorou o ciclo estável, mas introduziu reach de até.400m na entrada/casts e penetração. **Rejeitado**, preservado em `variants/planned-unlimited/hero-locomotion.js` e `matrix/planned.json`. O candidato atual limitado tem **zero aumento de reach e zero penetração adicional por quadro** contra donor nos20casos. Não reutiliza RunBackwardFast nem target-foot rejeitados.

Sidecar em staging continua donor-foot v4 **d3cd29b3a56dedece8a96462ad32f10105de914fc1a0a7faeb69a54bbcc58861**, sem nova edição de curvas. GLBs, rig, torso, props, gameplay e auditor não foram editados.

## Antes/no/depois da aterrissagem

Velocidade horizontal do mesmo vértice14493, m/s; todos esses quadros permanecem nas traces, mesmo quando não elegíveis ao patch do auditor:

| Velocidade / quadro | Donor antes | Candidato limitado |
|---|---:|---:|
|9.1 /359, antes|14.744|1.118|
|9.1 /360, touchdown|8.251|0.497|
|9.1 /361, depois|0.284|0.284|
|6.5 /432, antes|10.822|0.723|
|6.5 /433, touchdown|6.442|0.397|
|6.5 /434, depois|0.212|0.212|

A trajetória começa a desacelerar antes da flag de contato. O alvo não foi simplesmente travado no primeiro quadro de apoio. [Trace final](../../output/arpg-animation/backward-v5/final-trace/summary.json), [trace donor](../../output/arpg-animation/backward-v5/donor-foot-trace-toe/summary.json). Os JSONs contêm vetores exatos; a tabela acima está arredondada.

## Auditor independente120Hz sem alteração

[Oito casos finais, fonte estável](../../output/arpg-animation/backward-v5/candidate/output/qa/arpg-root-review/2026-09-19T02-02-24-277Z-sole-contact.json). SHA do auditor **50294fbcabf02b45f11a013245b7d87cb8bdfb7340c616e9ecebccd0f5e39583**, igual ao root. Os outros seis casos são iguais ao donorv4. Não foram retiradas transições, modificadas métricas ou contadas ausências de amostras como aprovação.

| Ré | Original07952 | Donorv4 | V5 limitado |
|---|---:|---:|---:|
|6.5 apoioP90 m/s|.137075|1.418485|1.418485|
|6.5 transiçãoP90 m/s|1.946317|5.643988|.574743|
|6.5 cobertura patch|31.528%|19.444%|19.444%|
|9.1 apoioP90 m/s|.259328|.922169|.922169|
|9.1 transiçãoP90 m/s|3.882069|6.134007|.659761|
|9.1 cobertura patch|23.889%|17.500%|17.500%|
|9.1 reach máximo m|.093232|0|0|
|9.1 sola mínima m|−.015636|.002|.002|

Contagens de apoio/transição preservadas contra donor:6.5 **376/30**;9.1 **303/33**. Released-both continua count0/null, não pass. Apoio donor continua pior que o runtime original. Transições ainda têm máximos de1.826/2.454m/s; a pior9.1 agora é um release, não o landing tratado.

## Start/stop, curva e três casts em30/60Hz

[Matrix donor](../../output/arpg-animation/backward-v5/matrix/donor.json), [candidato limitado](../../output/arpg-animation/backward-v5/matrix/planned-bounded.json), [original07952](../../output/arpg-animation/backward-v5/matrix/original.json).20casos por fonte: duas velocidades × duas taxas × arrancada/parada, curva90° com retorno e cada cast dwarf. Cada sequência dura5s. **Todos os quadros são mantidos, incluindo entrada imediata no gait, início/fim do cast e idle.** Mesmos critérios8mm/3mm/.05m/s da seleção física; sem warmup excluído nesta matriz. Totais misturam steady e transientes; JSON também separa os grupos. Não comparar diretamente esses P90 com o ciclo constante120Hz.

|Hz|m/s|Caso|TransiçãoP90 donor → v5 m/s|ApoioP90 v5 m/s|Reach v5 m|Sola mínima v5 m|
|---|---|---|---|---|---|---|
|30|6.5|start-stop|3.866 → 0.863|3.615|0.000|-0.000|
|30|6.5|turn|11.294 → 6.322|0.625|0.000|-0.021|
|30|6.5|explosive_cannon|4.854 → 2.091|0.197|0.000|0.002|
|30|6.5|frost_shot|4.854 → 2.112|0.197|0.000|0.002|
|30|6.5|gravity_shot|4.854 → 2.066|0.197|0.000|0.002|
|30|9.1|start-stop|9.049 → 2.428|3.223|0.000|-0.000|
|30|9.1|turn|6.207 → 0.265|0.488|0.201|0.002|
|30|9.1|explosive_cannon|4.951 → 0.304|0.240|0.000|0.002|
|30|9.1|frost_shot|4.951 → 0.304|0.240|0.000|0.002|
|30|9.1|gravity_shot|4.951 → 0.304|0.240|0.000|0.002|
|60|6.5|start-stop|4.013 → 2.319|0.666|0.000|-0.000|
|60|6.5|turn|12.101 → 1.443|0.508|0.046|-0.027|
|60|6.5|explosive_cannon|5.003 → 1.872|1.304|0.000|0.002|
|60|6.5|frost_shot|5.003 → 1.872|1.304|0.000|0.002|
|60|6.5|gravity_shot|5.003 → 1.872|1.304|0.000|0.002|
|60|9.1|start-stop|5.333 → 1.875|6.249|0.000|-0.000|
|60|9.1|turn|13.200 → 2.257|0.440|0.421|-0.005|
|60|9.1|explosive_cannon|7.514 → 2.518|0.440|0.000|0.002|
|60|9.1|frost_shot|7.514 → 2.518|0.440|0.000|0.002|
|60|9.1|gravity_shot|7.514 → 2.518|0.440|0.000|0.002|

Flags de contato idênticas, trajetórias/velocidades do ator idênticas, sem aumento de reach ou penetração por quadro. Torso relativo ao quadril máximo1.14e−13. **Isso não é aprovação física**: a curva9.1/60Hz conserva reach.420730m (donor), e o original no mesmo caso chega a.286820m. Arrancada/parada conserva apoio alto; a curva6.5/30Hz ainda tem transiçãoP90 6.322m/s. Casts6.5/60Hz ainda têm transiçãoP90 1.872m/s. Dados dos piores patches e velocidade de todos os materiais nas transições, sem gate de altura, estão no comparativo.

## Propriedade de torso, arma e rig

[20replays pareados de todos os transforms superiores e objetos não-bone](../../output/arpg-animation/backward-v5/pose-parity.json), incluindo rifle e DwarfMuzzle. Diferença de posições locais/comprimentos e escalas dos bones **zero**; diferença máxima relativa ao quadril **1.14e−13**. A ausência de deformação interna é distinta de igualdade absoluta no mundo.

O gate absoluto1e−9 **falhou em um caso**: curva9.1/30Hz, frame53. A mudança no residual de apoio pede ao pelvis yield existente uma descida adicional de **.001918022529m** do corpo inteiro. A arma acompanha; após subtrair essa translação comum, resíduo máximo2.22e−16. Não afrouxamos o gate, não escondemos o frame e não ajustamos o runtime para fazê-lo passar. [Log da falha final](../../output/arpg-animation/backward-v5/pose-parity.log). Os outros19casos têm igualdade absoluta. Essa diferença permanece registrada para decisão de acabamento/peso, sem alegar paridade mundial total.

## Reproduzir e continuar

Ferramentas próprias: `tools/animation-backward-trace.mjs`, `animation-backward-matrix.mjs`, `animation-backward-compare.mjs`, `animation-backward-pose-parity.mjs`. Trace/matrix recebem snapshot e destino novo; recusam sobrescrever. Compare produz `comparison.json`; pose-parity grava evidência antes de retornar exit1 pela falha absoluta documentada. Artefatos existentes são históricos, usar destinos novos ou nova cópia para repetir.

Próxima causa distinta: apoio/roll do donor e transientes de curva, mantendo este ganho de aterrissagem. O novo take como conjunto segue retido, pois ainda piora apoio/cobertura contra07952. Nenhuma promoção, aprovação AAA ou no-slide global. **Não reservar GPU com este conjunto ainda reprovado**; uma futura comparação nativa requer candidato melhor, mesma câmera e janela/lock após Combat. Fonte ativa liberada e imutável durante Physics; esta frente continua apenas em cópia.
