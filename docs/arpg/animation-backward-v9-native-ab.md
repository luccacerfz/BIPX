# V8 × V9 — comparação nativa diagnóstica

Estado: **concluída, fonte estável e GPU liberada04:33UTC**. Combat liberou a ordem via `msg_b04187cf0402`; Environment publicou encerramento Surface-life antes da aquisição atômica. Lock próprio PID70972 e todos os recursos encerrados. Combat/VFX avisados por `msg_d6068904256f` / `msg_119a98d0757d`. Nenhuma nova captura planejada.

Pedido Root: quatro clipes em velocidade real1×, mesma história completa a30/60Hz e câmera ARPG/próxima com corpo inteiro. Foco: início do apoio, release56/112 e recuperação até60/120. Não há nova busca angular, take10, retarget, suporte corporal ou promoção.

Fontes congeladas: v8 `45588e13`, v9 `cae3cb8e`, take `d3cd29b3` igual. Runtime `07952bfc` e take ativo `6cb29422` preservados. GLB Aldric original `0e5da9d8`, sem incorporar OPAQUE `5c1903a0` do experimento VFX.

[Manifesto isolado](../../output/arpg-animation/backward-v9/native-ab-staging/manifest.json) · [preflight](../../output/arpg-animation/backward-v9/native-ab-staging/preflight.json) · [continuidade CPU](../../output/arpg-animation/backward-v9/native-ab-staging/continuity.json).

Preflight:364frames = (61+121) ×2fontes; diferença máxima posição/reach0 e flags iguais. É paridade do harness, não aceite anti-slide. Cada replay começa no frame0; a mudança de direção começa1.5s. Trajetória6.5m/s e história preservadas. As poses exatas são replay separado, com prefixo inteiro, preservando o vídeo contínuo original.

Release112/60Hz: distância horizontal por frame cresce apenas2.4618mm, conforme correção Root. A diferença vetorial do deslocamento é36.7128mm e a diferença de posição entre candidatos nesse instante29.6903mm; são medidas diferentes. O antepé v8 gira11.818° nesse passo, v9 aproximadamente0°, enquanto ankle gira16.02° nos dois. Nada disso isoladamente prova salto visível ou slide: o flag já é swing e não há patch físico qualificado. A liberação56/30Hz reduz velocidade horizontal6.710→5.828m/s, mas muda o instante de rotação do antepé. A revisão abaixo separa esses escopos.

Câmera ARPG reproduz os parâmetros desktop atuais:48°, offset0/17/20, lookAhead−2.6, targetY1.2 e follow1−pow(.001,dt), com aim constante−Z. A próxima3/4 usa38°, offset4.8/2.4/−4.8 e alvoY1.1; luz/material/piso/rig/arma iguais entre lados. Fixture de locomoção, sem gameplay, horda, VFX ou colisão. Overlays distinguem flag de apoio e quantidade de vértices do patch físico medido pela referência; zero vértices não é PASS.

## Captura e revisão concluídas

[Player dos quatro clipes1× + poses](../../output/playwright/arpg-animation-backward-v9-ab-1789792325630/index.html) · [report](../../output/playwright/arpg-animation-backward-v9-ab-1789792325630/report.json) · [hashes](../../output/playwright/arpg-animation-backward-v9-ab-1789792325630/artifact-hashes.json) · [revisão do proprietário](../../output/playwright/arpg-animation-backward-v9-ab-1789792325630/owner-review.json).

Chrome nativo/Metal,2880×900 (cada painel1440×900),4clipes/44PNGs, zeroerro. História61/121frames completa para cada fonte e câmera. Runtime protegido sem drift; máxima diferença de material CPU/browser1.3323e−13m, posição/reach0, flags iguais. Bounding boxes de todos os vértices deformados nas44poses ficam em |NDC|≤.583, com corpo visível e overlays fora dele. A geometria não foi reenquadrada por candidato.

| Simulação / vista | Tempo simulado | Tempo real | Maior gap render |
|---|---:|---:|---:|
|30Hz próxima|2.03333s|2.04030s|16.8ms|
|30Hz ARPG|2.03333s|2.04870s|16.8ms|
|60Hz próxima|2.01667s|2.01850s|16.8ms|
|60Hz ARPG|2.01667s|2.02680s|16.8ms|

**Limite de evidência:** os vídeos WebM são gravação nativa Playwright25fps, com playback real1× e browser~60Hz; não contêm cada frame60Hz. As poses PNG exatas e o trace preservam os landmarks. Inspecionei29originais:22próximos (todos os landmarks) e7ARPG, mais frames decodificados dos vídeos para conferir apresentação/overlay1×. Não alego julgamento humano de fluidez contínua. O [parecer independente Root](review/animation-backward-v9-native-followup.json) inspecionou outros cinco originais e confirmou telemetria, com a mesma ressalva.

## Leitura de pose, peso e continuidade

- **Release não sustenta nova rejeição por8.977m/s:** na sequência111→112/60Hz e55→56/30Hz não identifiquei quebra grosseira nova do corpo, rig ou rifle em v9. A bota entra em swing; não classificar sua velocidade isolada como slide. Na câmera ARPG a diferença é pequena. Projeção exata do vértice39 em112: diferença entre candidatos1.125px ARPG/4.400px próxima; passo na tela1.661→2.119px ARPG e7.820→8.367px próxima. Em56/30Hz a diferença entre candidatos é2.749px ARPG/8.584px próxima. [Dados por frame](../../output/playwright/arpg-animation-backward-v9-ab-1789792325630/screen-continuity.json). São medidas geométricas, não limite perceptual.
- **Apoio e roll:** o antepé v9 conserva orientação mundial durante108–112; v8 gira mais em108–111. O contato de borda fica mais estável, mas o corpo mantém a mesma transferência de peso limitada e a região inteira não está validada. No111 o flag diz apoio e o patch físico ézero; não transformei essa ausência em PASS. Em55 o patch2→4vértices não torna a piora.018→.034m/s do par comum uma melhora.
- **Entrada anterior continua prioritária:** f53/30Hz e106/60Hz mostram sola ainda~21/26mm acima do piso apesar do flag apoio. Na entrada54/107 ambos chegam a~2mm; em107 há giro do antepé17.16° e velocidade39=4.452m/s nos dois. A redução material de v9 começa depois. Isso é discrepância pose/estado/tempo de aquisição, não uma nova falha introduzida pela liberação v9.
- **Recuperação rápida é compartilhada e não toda authored:** em112 o driver39 já se move11.679m/s enquanto finalv9=8.977; em113 o final chega17.230 contra driver9.106, e em114 cai6.763 contra7.379. V8 tem19.865→7.391 nesses dois passos. Há aceleração/desaceleração adicionada pela resolução/blend, a investigar em aterrissagem seguinte; a magnitude de swing não prova salto/slide por si. A pose mostra abertura da passada e recuperação sob o corpo, sem elevar o quadril para compensar. Não foi demonstrada incompatibilidade absoluta da velocidade6.5m/s com o rig/take; nenhuma mudança de velocidade/flags é proposta silenciosamente.

**Decisão:** v9 continua retida, mas retiro a leitura de8.977m/s como motivo autônomo de rejeição visual. Ganho material60Hz.763592→.053884 permanece causal/local; região120 com velocidade vertical.051358m/s em108, cobertura, entrada e próximas aterrissagens continuam abertas. Sem promoção/no-slide/AAA. Nenhum corpo conjunto ou take10 implementado.

Root autorizou como próximo passo somente estender a mesma trajetória CPU6.5/30–60Hz até as próximas aterrissagens e ao menos dois ciclos completos. Sem repetir GPU, busca angular ou matriz9.1/start-stop/casts. O pacote Lich fica com Combat em cópia para integração/revisão posterior.

