# Environment — manutenção, candidato isolado9e45

**Staging concluído e congelado para revisão; nenhuma promoção.** Dois placements mudam visual e collider pelo mesmo módulo puro. CPU causal e dois pares nativos concluídos; Root aceitou a direção artística local. Gameplay integrado e requisito amplo de ameaça do boss continuam abertos. Nenhuma escrita em main/server/Physics/runtime/assets. Surface-life selecionado é preservado, fora do lote ativo canhão+contacts.

[Manifesto/hashes](../../output/environment/maintenance-access-v1/selection-manifest.json) · [patch único](../../output/environment/maintenance-access-v1/maintenance-access-v1.patch) · [CPU](../../output/environment/maintenance-access-v1/cpu.json) · [nativo](../../output/environment/maintenance-access-v1/native-summary.json).

## Continuidade preservada — nova variante separada

9e45 e suas evidências continuam congelados. A barreira física diagnosticada por Physics motivou somente o staging [maintenance-access-v2](environment-maintenance-access-v2.md), hash a5f4, com um deslocamento adicional do barril. Acesso corporal foi demonstrado, mas o caller offline ainda falha no objetivo/grade; sem promoção, reclassificação retroativa desta seleção ou novas mudanças aqui.

## Seleção artística Root — 03:48 UTC

[Revisão dos quatro originais](review/maintenance-access-native-selection.json) aceita a direção local9e45: barril compõe estoque ao norte, entrada oeste visualmente clara e viga afastada do player. Manifesto e quatro PNGs reconferidos pelos hashes da revisão. Surface-life selecionado preservado. **Aceite artístico local, sem promoção ou nova captura.** Não mover mais props antes do diagnóstico Physics separar pose/corredor físico de grid/arrivalRadius com corpos/ataques/budget intactos. Walkers e tiro servidor corrigidos não encerram ameaça do BloodCow offline. Freeze do lote canhão respeitado; somente docs desta frente atualizados.

## Freeze para diagnóstico BloodCow offline de Physics

Confirmação Environment em `2026-09-19T03:48:46.451627+00:00`: candidato **9e45b0c2ddb41e125c225e35083d7ed308fc8151357f8b7fbf845196b6371d40** e cópias contacts290a/navigation911/main455/server preservados por hash. Sem CPU/GPU/benchmark próprio ou próxima captura; nenhuma escrita nesses arquivos durante o recorte Physics. Diagnóstico autorizado em cópias daquele dono: poses melee/LOS, conexão corporal raio1.72 desde duas origens capturadas, arrival/grid/budget768; preservar o contraexemplo servidor. Resultado esperado em `docs/arpg/physics-maintenance-boss-approach.md`.

A ausência momentânea de lock/PID não substitui a conferência de encerramento Combat, que Physics está fazendo. Environment não assume nem reserva a janela desse dono. Se o diagnóstico demonstrar bloqueio geométrico, uma nova proposta de placements será separada, mantendo9e45 e suas provas; nenhum ajuste antecipado de cenário, caller, corpo ou planner. Sem promoção.

## Mudança local

| Prop | Baseline143 XZ | Candidato XZ | Preservado |
| --- | --- | --- | --- |
| barrel-2 |17.2,14.6|15.8,12|Asset, escala, yaw.5, material, círculo raio.516 |
| fallen-beam-3 |19.7,14.3|20.2,14.3|Asset, largura2.4, yaw1.45, altura.16 e box |

Somente `candidate/src/render/environment-layout.js` difere do snapshot CPU. SHA-256 **9e45b0c2ddb41e125c225e35083d7ed308fc8151357f8b7fbf845196b6371d40**; baseline **8e756fe4022c7916074220d44c0ff605aa8fdc9d80fdf6c61d8a03fb475fc8a7**. Permanecem143colisores, arena55, y0, mesmas APIs e todos os props; nada removido, acrescentado ou encolhido. A viga avança50cm a leste; o barril volta para o estoque ao norte, abrindo circulação junto à cerca. Eixos, centro, outros conjuntos e ameaça/corpos não mudam.

## Causalidade e tentativas preservadas

1. Só barril em(15.8,13.5): saída do player passou, mas quatro walkers capturados não atacaram em30s. `attempt-1-barrel-only/` e report03:20:43 preservados. A viga ainda bloqueava posição de aproximação válida para raio.78.
2. Barril nessa posição + viga deslocada:36walkers passaram, mas o barril fechou o único tiro serverBloodCow do baseline. Mesma origem real(12.999156710361104,11.936954817748697), novo LOS atinge barrel-2 emt.4539835. Contraexemplo [Root](review/maintenance-access-first-proposal.json)/[Physics](physics-maintenance-access-review.md) confirmado; proposta rejeitada por perda de ameaça e preservada em `attempt-2-west-barrel/` / report03:29:59. O `passed` estrutural não era aprovação de gameplay.
3. Final9e45 recoloca o barril em(15.8,12): mantém aproximação dos walkers e restaura aquele tiro. Sem mudar caller, raio, budget, ataque ou política ranged. Os72 finais terminaram antes da mensagem Root sobre a tentativa2; não repetir essa matriz sem mudança ou defeito novo.

## Comparação CPU dos mesmos callers

[Proveniência](../../output/environment/maintenance-access-v1/caller-provenance.json), [baseline72](../../output/environment/maintenance-access-v1/2026-09-19T03-28-54-584Z-baseline-full-inverse.json), [candidato72 final](../../output/environment/maintenance-access-v1/2026-09-19T03-32-16-276Z-candidate-full-inverse.json). Baseline reproduz **exatamente todos os resultados e rotas** do report Physics03:07, não apenas totais. Ambas as variantes usam as mesmas posições `actual` originais, sem realocar spawns ao trocar layout. Nenhuma delas obstrui esses starts.

Callers main455addd3/server29bb, contacts290a, navigation911e0 e dependências transitivas congelados e verificados por bytes. É comparação causal com o diagnóstico original; **não é prova do runtime contacts912c/main atual**. dt.05, até30s, velocidade/corpos/ataques/LOS originais, maxVisited768 e budget4 preservados. Cada segmento aceito auditado com sweep, velocidade limitada e posição livre.

| Caller/tipo | Baseline com hit | Final9e45 com hit | Primeiro hit |
| --- | ---: | ---: | --- |
| Cliente walker |0/18|18/18 melee|1.65–6.35s|
| Servidor walker |0/18|18/18 melee|1.65–6.35s|
| Cliente BloodCow |0/18|0/18|Sem ameaça em30s|
| Servidor BloodCow |1/18|1/18 projétil|.30s, mesma origem oeste|

Todos os impactos melee têm LOS livre; walkers visitam no máximo148nós. Os casos capturados norte atacam3.15s em ambos os callers; sul2.60/2.65s. **Boss solo continua sem ameaça nestas18origens.** Preservar o único disparo servidor corrige a regressão introduzida, mas não resolve esse limite herdado nem concede acesso universal. Não declarar satisfeito o critério amplo de boss ameaçar o refúgio.

Player raio.64: entrada e saída contínuas pela mesma rota,35passos cada a6.5m/s, sem correção/desvio/segmento em sólido. Três trajetos paralelos locais, X16.5→18.5 com Z14.7/14.9/15.1, livres com raio.64. Distância física barril/cerca1.323775→3.795016m; **essa medida entre dois sólidos não é largura garantida da rota inteira**. O ponto original permanece quase tangente ao barrel-1, que não mudou. O teste não promete conforto universal em todas as direções nem horda.

## Dois pares nativos para seleção

Chrome visível/Metal,1440×900,03:34:50.892–03:34:53.693UTC. Mesma câmera/luz/atores/tempo por par, fontes estáveis, zero erros page/console/HTTP/request/GL. GPU reservada atomicamente e liberada pelo token próprio em finally; browser/servidor efêmeros encerrados. Nenhuma próxima captura Environment prevista.

| Vista | Baseline143 + superfície selecionada | Layout9e45 + mesma superfície |
| --- | --- | --- |
| Conjunto |[PNG](../../output/playwright/environment-maintenance-access-v1/access-baseline-overview.png)|[PNG](../../output/playwright/environment-maintenance-access-v1/access-candidate-overview.png)|
| Recanto |[PNG](../../output/playwright/environment-maintenance-access-v1/access-baseline-pocket.png)|[PNG](../../output/playwright/environment-maintenance-access-v1/access-candidate-pocket.png)|

Os quatro originais foram examinados. O barril passa a compor o estoque superior; a abertura junto à cerca fica legível e a viga se afasta do corpo. A identidade de manutenção e todos os assets continuam presentes. Copas pontilhadas, repetição de cruzes/pavimento e limite artístico do piso continuam visíveis; não AAA.

As cópias `native-baseline/` e `native-candidate/` receberam exatamente os três módulos Surface-life selecionados: dressing947c7cd9, cemeteryef17cfbe, ground3a8ca80f. **Os215hashes servidos diferem somente no layout.** Snapshots CPU e tentativas antigas permanecem intactos. Contatos no chão acompanham a posição via layout; imagens são fixture com atores estáticos, não gameplay/input. Não executam o main da cópia nem repetem o A/B de superfície já selecionado.

Orçamento idêntico:66props/46lotes/15materiais/30texturas,249683triângulos dressing; contato528triângulos/um lote. Cena completa conjunto146draws/561561triângulos; recanto127/521058; memória45geometrias/47texturas, iguais nos dois lados. Zero nova textura/GLB/material/instância/luz/passe. Isto não mede GPU-time/FPS.

## Recorte para confirmação Physics

[Extrato focal](../../output/environment/maintenance-access-v1/physics-focal-review.json) reúne quatro walkers capturados e o serverBloodCow oeste, com hashes dos reports baseline/e598 rejeitado/9e45 selecionado. É extração dos resultados existentes, **nenhuma nova simulação**. Seleção permanece9e45: barril(15.8,12), viga(20.2,14.3); tiro oeste1shot/.30s/LOSnull, capturados norte3.15s/sul2.60–2.65s. O achado e598 continua válido como motivo de rejeição histórica. Physics pode confirmar somente esse recorte e clearance, sem repetir72.

## Coordenação Physics — 03:41 UTC

Resposta ao pedido sobre candidate6e09/preflight03:20: ambos históricos. Fonte atual congelada **9e45b0c2ddb41e125c225e35083d7ed308fc8151357f8b7fbf845196b6371d40**, nos placements e reports finais acima. O caso serverBloodCow oeste final tem `shots:1`, hit.30s e `finalLOS:null` da mesma posição real;36walkers têm melee. Revisar esse recorte, não repetir72 sem necessidade.

Imports auditados novamente: `inverse.mjs` importa todos os helpers combat de `./baseline/src/combat/`, inclusive `crowd-control.mjs`; seu contacts transitivo e o contacts direto são **290a3f35…** em ambos A/B. Não há mistura com912c. Para um reteste com912c, usar nova cópia de revisão Physics com todas as dependências diretas/transitivas alinhadas e hashes explícitos, preservando os reports originais. O reteste290a causal histórico e a validação integrada912c são provas diferentes.

Environment está sem CPU/GPU/benchmark ativo e sem captura futura desde03:34:53; fontes disponíveis para leitura. À03:41 o lock estava ausente e nenhum runner QA concorrente foi observado. **Isso é observação instantânea, não reserva global:** Combat ainda anuncia QA do lote canhão+contacts em seu handoff. A janela sem concorrência deve respeitar o encerramento/coordenação desse dono e ser reservada atomicamente no momento do recorte; não iniciar só pelo lock ausente. Nenhum novo reteste foi executado por Environment nesta resposta.

## Disponibilidade e gates seguintes

Fonte final9e45 congelada; [patch](../../output/environment/maintenance-access-v1/maintenance-access-v1.patch) contém só duas linhas de placements. Originais/baseline/pacotes e evidências rejeitadas preservados. Runtime Environment continua8e756fe4/ec488add/2d512097/d9335c23; nav911e0 inalterado. Contacts912c foi promovido pelo dono Physics, fora desta comparação. Servidor5173 observado após captura PID75665, operado exclusivamente por Combat; ledger7f580798…byte-idêntico. Environment não reiniciou nem operou o serviço.

Physics recebeu atualização única `msg_cb0d19a08443`,03:37UTC, com fonte9e45 e o contraexemplo restaurado; mailbox aceito, leitura não presumida. A revisão publicada da tentativae598 é histórica para este novo hash. Próximos gates antes de propor promoção: diagnóstico independente de9e45/LOS e limite de boss, gameplay real/callers integrados com contacts912c e autoridade atual. Não copiar snapshots/main/server ou promover automaticamente. Surface-life permanece selecionado para futura janela própria, independente desta decisão geométrica.
