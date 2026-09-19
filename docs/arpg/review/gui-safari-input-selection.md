# Seleção root: evitar autozoom residual do nome no Safari

2026-09-19, revisão root após a captura05:20Z. Selecionado o candidato CSS de 70 bytes `output/gui-ios-safari-v1/input-16px.candidate.css`, SHA256 `6026285be87e1d96d5f29fcc7556001f2025cdd1e5d833e54845772f6921a4cc`. Alteração única: `.name-field input` usa 16px sob `(pointer: coarse)`; pointer fino mantém o estilo existente. Não alterar viewport meta, resetar zoom nem impedir zoom manual.

Root leu o handoff e a telemetria, e inspecionou em resolução original `20-staging-baseline-blur.png`, `23-staging-candidate-blur.png` e `24-staging-candidate-hud.png`. Antes, o zoom 1.0661578 e offsets 12/43 persistem após Done. No candidato, a escala permanece 1; após Done/Start os offsets são zero. A captura24 mostra tempo/progresso, arma, Som/Pause, duas esferas e três skills dentro da área visível. A captura23 mantém o formulário rolável; não se exige que todo seu conteúdo caiba simultaneamente.

Autorizada integração somente desse CSS pela GUI, coordenando com Combat para não mudar fontes durante seu checkpoint atual. Guardar baseline385f8f9a, aplicar delta mínimo sobre a fonte atual, verificar bytes servidos e registrar SHA antes/depois. Não copiar styles inteiro de snapshot nem reiniciar servidor. A comparação nativa existente fundamenta esta correção pequena; não se exige nova matriz ou boot para permitir sua aplicação.

O aceite integrado por Safari permanece uma observação posterior, distinto da prova em staging. QWERTY completo só foi visto no original05; scroll com QWERTY, dispositivo físico, VoiceOver e desempenho não foram aprovados. Correção do recorte não equivale a aceite global mobile/AAA.

## Integração conferida

GUI aplicou o delta em05:37:32Z após liberação Combat `msg_7ceaf37c89d6`. Root conferiu independentemente: arquivo live é exatamente baseline59579bytes + candidato70bytes; resposta HTTP é idêntica aos59649bytes finais, SHA256 `0dfb40e3a4b21e6e34b7de521a9544a9fc1f9a278718c35468e4962964c6a3ac`. Nenhum outro arquivo entre225fontes mudou no recibo; PID65261 preservado. [Recibo](../../../output/gui-ios-safari-v1/promotion/2026-09-19T05-35-00-012447Z/receipt.json). O nome do diretório corresponde à preparação05:35; a aplicação é05:37. Não houve nova captura integrada, restart ou boot; os limites acima permanecem.
