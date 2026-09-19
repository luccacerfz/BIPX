# Locomoção — medição independente após correção de elevação na passada

Nova execução de `sole-contact-audit.mjs`: `output/qa/arpg-root-review/2026-09-18T23-47-41-281Z-sole-contact.json`. Fonte estável, agora incluindo módulo/takes das skills entre os hashes. Mesmo auditor e seleção física de vértices da primeira medição; única mudança no auditor foi ampliar a lista de hashes. Nenhuma mudança no runtime feita por root.

O controlador `hero-locomotion.js` passou de `b958aca3ff8a0c1353c8af8007dbade40c69ab446ec258aea4bab92502bcabc6` para `df93d75c6a98f6ad809678788cbb9151c11a6e2f875715c839307ddb2d27dd60`. Comparação com `2026-09-18T23-25-18-929Z-sole-contact.json`.

## Melhora observada

Nas oito combinações testadas, não sobraram pares consecutivos de amostras que fossem simultaneamente liberados pelo controlador e satisfizessem todos os filtros físicos de patch estável junto ao chão. O campo correspondente é **count0/p90null**, nunca p90zero ou aprovação. A fração de frames de pé perto do chão sem contato declarado caiu substancialmente nas direções problemáticas: Lyra à frente53.9%→12.3%; strafe49.8%→11.1%; ré45.2%→8.4%. Aldric strafe31.0%→11.9%; ré45.1%→11.8%. Isso é compatível com maior elevação na fase aérea, e remove as centenas de amostras de arrasto de swing da primeira reprodução.

## O que permanece

| Caso | P90 do patch em apoio declarado | Amostras em transição de contato | P90 da velocidade horizontal na transição |
| --- | ---: | ---: | ---: |
| Aldric frente6.5 | .394m/s | 16 | 4.758m/s |
| Aldric strafe6.5 | .295m/s | 15 | 16.154m/s |
| Aldric ré6.5 | .598m/s | 0 | sem amostra |
| Aldric ré9.1 | .573m/s | 36 | 12.136m/s |
| Lyra frente6.5 | .209m/s | 33 | .335m/s |
| Lyra strafe6.5 | .314m/s | 6 | 11.007m/s |
| Lyra ré6.5 | .137m/s | 20 | 1.946m/s |
| Lyra ré9.1 | .259m/s | 20 | 3.882m/s |

Alguns eventos ainda trocam o contato com deslocamento muito rápido de um mesmo vértice junto ao chão. São poucas amostras e não equivalem à antiga fase inteira arrastando; investigar continuidade no release/plant e confirmar em playback próximo e câmera de jogo. P90 de16.154m/s a120Hz equivale a~13.5cm no intervalo observado, suficientemente grande para merecer revisão, sem converter isso sozinho em nota perceptual.

Lyra ré9.1 também registra alcance residual máximo.0932m e sola mínimaY=-.01564m. Aldric ré registra pequenos negativos~2–3mm. Não alterar critérios/contact flags só para ocultar dados; preservar roll físico e integridade de joelho/torso/arma. Os números medem translação real e skinning em terreno plano constante; curvas, frenagem, colisões, rede e input real ainda exigem prova própria.

Primeiro fixture de cast `output/playwright/arpg-animation-skills-v1/report.json` é anterior à seleção v2. Screenshot `dwarf_incendiary_burst-release.png` inspecionado: rifle permanece nas mãos e a silhueta de tronco/pernas está íntegra nessa pose. Um PNG não aprova playback ou contato; o report contém um erro404 que precisa de causa/escopo identificados. Não promover esse fixture a aprovação das novas habilidades.

Conclusão limitada: melhora numérica real da fase aérea, com transições e casos de ré ainda pendentes. `acceptedNoSliding:false` permanece.
