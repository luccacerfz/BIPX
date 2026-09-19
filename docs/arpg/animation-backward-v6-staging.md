# Ré Lyra v6 — transferência de apoio em cópia, sem promoção

Continuação autorizada pelo root após revisão v5. Runtime **07952bfc** e sidecar original preservados. Nenhuma GPU para este candidato, nenhuma edição de main/server ou arquivos do Lich/SFX. Freeze dos módulos v2 publicado separadamente no handoff.

## Causa rastreada

[Traço anterior, mesmos critérios do auditor](../../output/arpg-animation/backward-v6/support-trace-witness/summary.json), com JSONs por cenário e todos os frames. No regime6.5/9.1, contagens/P90 de apoio e transição reproduzem o auditor independente com diferença numérica menor que1e−9. Observação120Hz por4s com janela estatística1–4s idêntica ao auditor; a curva também guarda todos os300frames a60Hz, sem excluir início/troca de gait.

O anchor persistia num material que já tinha subido8–11.5mm acima do ponto mais baixo da bota: por exemplo9.1, frame124, witness39 está11.4765mm acima do patch atual. O limite antigo de12mm ainda o mantinha. Isso deixa o pé girar em torno de uma referência que já não representa a região apoiada. Na curva, a causa adicional é a aquisição de anchor durante o blend entre StrafeA e RunBackwardRetargetV2.

No pico9.1/frame262, mesmo material94 (72.3%ToeBase/27.7%Foot) corre **3.224598m/s** com anchor39 inalterado. Decomposição X/Z: translação ankle **(7.625702,3.327954)m/s** + rotação/deformação do offset **(−4.655982,−4.584455)m/s** = material **(2.969720,−1.256501)m/s**. Angular do Foot16.6267rad/s. A previsão puramente rígida pelo Foot difere10.677mm porque há articulação/skin de ToeBase; não atribuir toda a velocidade a uma troca discreta do anchor. Em6.5/frame475, material2 chega2.097871m/s, e esse máximo praticamente persiste na correção: parte do defeito de roll/deformação continua aberta.

Na curva9.1/60Hz, o gait muda no frame200; no205, ainda dentro dos.14s de fade, o anchor antigo exige.420730m além do alcance. Hip=(14.9848,.9546,19.2106), alvo=(14.5112,.2440,18.3023). O controlador escolhe então um novo witness já elevado em.189m. Isso não equivale a apoio físico; o caso segue reprovado. Não alteramos flag ou retiramos esses frames.

## Correção e experimento rejeitado

[Patch limitado ao staging](../../output/arpg-animation/backward-v6/staged-roll.patch): transferência ao patch mais baixo quando o witness anterior sobe mais de3mm, **somente para RunBackwardRetargetV2 já com peso completo**. O3mm é uma escolha de tolerância geométrica de transferência, não mudança nos critérios de seleção do auditor. Os resultados abaixo medem seus efeitos com todos os critérios anteriores; não os apresentam como aprovação por definição.

Mantidos foot/toe roll authored, posições/escalas/comprimentos originais, máscara de contato, duração, velocidade do gameplay e blend de aterrissagem v5. A nova regra opera sobre o material efetivamente apoiado, sem congelar todo o pé.

Ensaio sem guard durante blend: apoio melhorou e pico global da curva caiu.421→.355m, mas o mesmo frame206 piorou **+.186258m** em reach. **Rejeitado e preservado** em `variants/unconditional-3mm/`, `matrix-handoff3mm.json` e `handoff3mm-support-trace/`. Não usamos a queda do máximo global para esconder a piora por quadro. A revisão final só usa a tolerância do novo perfil quando sua action atingiu peso.999; enquanto a pose mistura takes, preserva a transferência anterior.

Candidato final `66ed1484f070212c92792b886de89008da16cc4702148825ca03fdd9d5a65d67` em `output/arpg-animation/backward-v6/candidate/src/assets/hero-locomotion.js`. Sidecar continua donorv4d3cd29b3; RunBackwardFast e target-foot rejeitados continuam excluídos.

## Auditor independente intacto

[Ré6.5](../../output/arpg-animation/backward-v6/candidate/output/qa/arpg-root-review/2026-09-19T02-27-10-067Z-sole-contact.json) e [ré9.1](../../output/arpg-animation/backward-v6/candidate/output/qa/arpg-root-review/2026-09-19T02-27-10-389Z-sole-contact.json), fonte estável, auditor SHA50294fbc inalterado.

|Métrica|07952 original|V5|V6 final|
|---|---:|---:|---:|
|6.5 apoioP90 m/s|.137075|1.418485|.676366|
|6.5 transiçãoP90 m/s|1.946317|.574743|.372532|
|6.5 cobertura|31.528%|19.444%|19.444%|
|9.1 apoioP90 m/s|.259328|.922169|.296830|
|9.1 transiçãoP90 m/s|3.882069|.659761|.489240|
|9.1 cobertura|23.889%|17.500%|17.500%|

Contagens idênticas àv5: apoio/transição376/30 em6.5,303/33 em9.1. Reach0 e sola mínima~.002m nos ciclos. Released-bothcount0/null permanece ausência de amostras, não pass. Ganho de aterrissagem preservado: mesmo witness14493 nos frames433/360 continua~.397/.497m/s. Apoio máximo ainda2.098/2.734m/s. **Apoio/cobertura ainda piores que07952: não promover nem chamar no-slide.**

## 20casos30/60Hz e integridade

[Comparativo por quadro](../../output/arpg-animation/backward-v6/comparison.json), [matrix final completa](../../output/arpg-animation/backward-v6/matrix-blend-aware.json), [paridade de poses/props](../../output/arpg-animation/backward-v6/pose-parity.json). Todos os frames mantidos, entradas de velocidade/posição e flags iguais àv5. Aumento de alcance e penetração por quadro **zero**. Diferença máxima world dos objetos superiores/arma2.22e−16, relativa ao quadril1.42e−14, posições/escalas locais de boneszero. Esta igualdade é **contra v5**, portanto não apaga a descida comum de1.918mm já registrada contra donorv4.

|Hz|m/s|Caso|ApoioP90 v5→v6|TransiçãoP90 v5→v6|Reach v6 m|
|---|---|---|---|---|---|
|30|6.5|start-stop|3.615 → 3.615|0.863 → 0.863|0.000|
|30|6.5|turn|0.625 → 0.625|6.322 → 6.322|0.000|
|30|6.5|explosive_cannon|0.197 → 0.197|2.091 → 2.091|0.000|
|30|6.5|frost_shot|0.197 → 0.197|2.112 → 2.112|0.000|
|30|6.5|gravity_shot|0.197 → 0.197|2.066 → 2.066|0.000|
|30|9.1|start-stop|3.223 → 3.223|2.428 → 2.428|0.000|
|30|9.1|turn|0.488 → 0.488|0.265 → 0.265|0.201|
|30|9.1|explosive_cannon|0.240 → 0.240|0.304 → 0.304|0.000|
|30|9.1|frost_shot|0.240 → 0.240|0.304 → 0.304|0.000|
|30|9.1|gravity_shot|0.240 → 0.240|0.304 → 0.304|0.000|
|60|6.5|start-stop|0.666 → 0.619|2.319 → 2.319|0.000|
|60|6.5|turn|0.508 → 0.457|1.443 → 1.437|0.046|
|60|6.5|explosive_cannon|1.304 → 0.667|1.872 → 0.614|0.000|
|60|6.5|frost_shot|1.304 → 0.667|1.872 → 0.614|0.000|
|60|6.5|gravity_shot|1.304 → 0.667|1.872 → 0.614|0.000|
|60|9.1|start-stop|6.249 → 6.249|1.875 → 1.776|0.000|
|60|9.1|turn|0.440 → 0.439|2.257 → 2.257|0.421|
|60|9.1|explosive_cannon|0.440 → 0.440|2.518 → 1.706|0.000|
|60|9.1|frost_shot|0.440 → 0.440|2.518 → 1.706|0.000|
|60|9.1|gravity_shot|0.440 → 0.440|2.518 → 1.706|0.000|

Curva9.1/60Hz conserva.420730m de reach;6.5/30Hz conserva transiçãoP90 6.322m/s. Arrancada/parada6.5/30Hz mantém apoioP90 3.615m/s e9.1/60Hz6.249m/s. Nenhum desses casos foi removido do gate. A nova regra não resolve a captura de apoio durante crossfade; apenas impede aplicar prematuramente a tolerância do take ainda não dominante.

## Próxima revisão e ownership

Investigar a referência de apoio durante Strafe→ré, com fase/pose misturadas, e o roll/deformação do forefoot que mantém máximos altos mesmo com witness baixo. Qualquer nova correção deve conservar a desaceleração de aterrissagem v5, os resultados v6 e a auditoria intacta. Sem GPU até candidato melhor que o baseline no conjunto relevante e janela posterior do Combat.

Heróis e suas ferramentas seguem Animation. Lich asset/marker.597143/L_Hand fica no staging doSFX conforme root; não editar seus novos arquivos nem integrar o perfil sem confirmação visual. Servidor5173 não alterado. A liberação v2 de skills/corte permanece válida e separada destes ensaios de locomoção.
