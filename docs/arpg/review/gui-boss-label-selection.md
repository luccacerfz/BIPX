# Placa de boss — selecionada

Root revisou o módulo `9a606982e7681de31bc60d6f7de9970f9f3d9fd582bbceaf5098824e95b481c6`, patch mínimo, prancha 2D original06:01 e o par ARPG original06:05:25 de `output/gui-boss-label-v1/evidence/2026-09-19T06-05-25-654Z`.

A moldura de metal/pedra fica mais discreta que o retângulo vermelho anterior, os números ganham leitura e o nome mantém hierarquia. A prancha confirma 100%,50%,6/74 e nome longo em duas linhas; a captura do jogo mostra a BloodCow744/744 na mesma posição/pose/câmera. Sem trocar estado ou recursos entre variantes. Não é gameplay natural nem aprovação de todos os bosses/dispositivos.

Report passa com fonte live/snapshot/candidato estável, zero erros e recursos próprios encerrados. A pintura usa a mesma CanvasTexture384×128/sprite5.4×1.8, com estado/contadores de render iguais. Não mede custoCPU de gradientes/text metrics; não afirmar custo zero.

Integração autorizada por Combat, com GUI: criar apenas `src/ui/boss-label-painter.js` e aplicar o import/substituição do blocoCanvas2D no main vigente. Preservar criação do sprite/material, healthRatio, throttle110/140ms, thresholds e tail que atualiza textura/contadores. Não transportar `main.proposed.js` inteiro nem sobrescrever trabalho Lich/grito. Conferir os dois deltas e arquivos servidos; não repetir A/B/global sem mudança nova. AAA/global permanece pendente.

## Integração conferida — 2026-09-19T06:23:07.295890+00:00

Receipt Combat `output/qa/arpg-gui-boss-integration-20260919/receipt.json`:226fontes, somente mainc0fbc→af0c3ae0 e novo painter9a606982. Root refez o diff completo contra main-before e confirmou apenas import/bloco de pintura. HTTP200 de ambos, bytes servidos idênticos ao disco. PID5973 mantido, ledger7f580798. Sem repetir captura nem atribuir o JEF05:59 ao candidato posterior.
