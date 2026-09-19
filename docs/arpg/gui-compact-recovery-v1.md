# GUI — compact recovery v1, promovido e congelado

## Promoção selecionada Root,04:16 UTC

[Seleção Root](review/gui-compact-recovery-selection.json) autorizou exclusivamente o CSS545bytes00e53e45. Combat abriu a janela por mailbox `msg_282c79ef47cd`, fonte mainafc7d5ac congelada; VFX publicou GPU/fontes liberadas e recebeu coordenação. [Recibo/arquivo baseline/diff/manifesto](../../output/gui-compact-recovery-v1/promotion/2026-09-19T04-16-58-373Z/manifest.json). **Somente styles.css mudou:** baseline `8ede8bb92ae3a92e3a8b5d80e4d3701bf2c49e7b6e562b732286f4d5ed015fc0` preservado integralmente, seguido de newline + bytes exatos do candidato selecionado. Hash final **`385f8f9a101fdb55b2fffd0cc3b77b2613782789b9237bd39beacadbda9d3ab3`**. O comentário original do candidato foi preservado como parte dos bytes aprovados.

GET5173/styles.css retornou HTTP200 e esse mesmo SHA; servidorPID75665 manteve-se ligado, sem restart. Index/main/input/HUD/assets/áudio não foram editados. Antes/depois conferem222fontes e exatamente uma mudança runtime. Syntax do runner e diff-check pertinentes passaram.

[Smoke focal integrado9/9](../../output/gui-compact-recovery-v1/promotion/2026-09-19T04-16-58-373Z/promotion-qa.json), sourceChanged:false, zero page/console/HTTP errors. **Sem CSS injetado e sem repetir a matriz35**: carregamento do stylesheet promovido, uma recusa real em320×568, motivo e retry juntos, som fora do card, foco/labelspan/ícone/nome/Aldric mantidos; bloqueador removido e resposta real `runStarted` recebida, marker limpo/posição static e duas esferas. [Recusa integrada](../../output/gui-compact-recovery-v1/promotion/2026-09-19T04-16-58-373Z/integrated-rejected-320x568.png), [retry integrado](../../output/gui-compact-recovery-v1/promotion/2026-09-19T04-16-58-373Z/integrated-retry-320x568.png): ambos originais inspecionados. Ponteiro movido para fora do HUD após retry apenas no teste; nenhum comportamento runtime alterado.

Fonte GUI novamente congelada. Browser/servidores/token próprios encerrados; Combat/VFX receberam `msg_03a8a730c89c` / `msg_d9b4f44f3d06`. Nenhuma próxima captura GUI prevista. Delta limitado para próximo JEF, sem reinterpretar17 reports do checkpoint04:00. Continua sendo Chrome com toque emulado e servidor real com bloqueador sintético; sem mobile físico, teclado virtual, screen reader ou aceite global. As provas/limites do staging abaixo permanecem históricos, incluindo o compromisso visual expressamente aceito pelo Root.

## Histórico — candidato validado antes da promoção

Na entrega04:03, o candidato ainda não estava promovido. CSS final545bytes, SHA256 `00e53e45b8606e6ebdea29b70ad84a19067c83fbd754a2ef396c718c9cb390f8`. [Candidato](../../output/gui-compact-recovery-v1/candidate.css), [manifesto/hashes de staging](../../output/gui-compact-recovery-v1/staging-manifest.json). Naquele lote não houve edição styles/index/main/HUD/assets/áudio;5173/PID75665 foi preservado, HTTP200 e SHA servido do styles iguais ao baseline.

## Diagnóstico e solução mínima

A revisão [integrada Root](review/gui-recovery-integrated.md) e os PNGs originais320/393 foram lidos. Em320×568, o foco nativo no retry rola o parágrafo de motivo, anterior aos cards/nome, para fora do viewport. O controle de som é fixo, fora do scrollport do menu, e permanece sobre a parte superior dos cards. Em393×852 o contexto e a ação já cabem. [Diagnóstico CPU inicial](../../output/gui-compact-recovery-v1/cpu-diagnostic.json) preservado como histórico.

O candidato usa exclusivamente o marker existente `#message[data-run-start-rejected="true"]`, com media query portrait, largura<=680px e altura<=690px. Reserva68px acima do scrollport no caso medido (safe-area respeitada), abaixo do botão de som de44px. O próprio `#message-copy` fica sticky dentro do formulário, com fundo opaco e detalhe âmbar; nenhuma duplicação de texto, reordenação DOM ou novo handler. O overflow continua auto; todas as informações e controles permanecem no documento e alcançáveis por rolagem. Sem alteração do som ou de sua posição.

A versão inicial tinha scroll-padding-top120px; a prova de teclado mostrou a base do card focado29px além do viewport. Esse padding foi removido apenas do candidato. A centralização nativa agora deixa o card inteiro visível. Candidato inicial e rodadas incompletas foram preservados com os respectivos verificadores.

## Evidência nativa focal

[Report35/35](../../output/gui-compact-recovery-v1/evidence/2026-09-19T04-03-45-927Z/compact-recovery.json), **222 fontes estáveis**, zero page/console/HTTP errors. Cliente/servidor reais atuais, sala privada com bloqueador sintético de spawn; CSS injetado somente no browser QA. Duas variantes no mesmo runner: baseline e candidato. Não é partida natural. Chrome visível com toque emulado, deviceScale1; perfil desktop é o mesmo contexto touch-capable redimensionado. Sem aparelho físico, teclado virtual ou leitor de tela.

| Medida320×568 | Baseline | Candidato |
|---|---|---|
| Motivo, intervalo vertical | −71…−13,44px, fora | 91…164,56px, visível |
| Retry, intervalo vertical | 392,13…445,13px | 476,13…529,13px |
| Som / início do scrollport | Som14…58px / menu0px; sobre card | Som14…58px / menu68px; separados |
| Rolagem disponível | overflow auto;877/568px | overflow auto;893/500px |

- [Antes320](../../output/gui-compact-recovery-v1/evidence/2026-09-19T04-03-45-927Z/before-320x568.png) e [candidato320](../../output/gui-compact-recovery-v1/evidence/2026-09-19T04-03-45-927Z/candidate-320x568.png): inspeção visual confirma estado/motivo e retry juntos, sem som cobrindo card visível. A marca e o título geral do formulário continuam acima dessa posição de scroll; não se afirma que tudo cabe simultaneamente. O status “Entrada indisponível” contém o contexto prioritário da recusa.
- [393×852](../../output/gui-compact-recovery-v1/evidence/2026-09-19T04-03-45-927Z/candidate-393x852.png), [desktop1280×800](../../output/gui-compact-recovery-v1/evidence/2026-09-19T04-03-45-927Z/candidate-1280x800.png), [landscape852×393](../../output/gui-compact-recovery-v1/evidence/2026-09-19T04-03-45-927Z/candidate-852x393.png): menu/formulário/motivo/retry/som e posição CSS têm geometria exatamente igual ao baseline. As imagens foram inspecionadas, não apenas contadas. Landscape mantém a interseção histórica de5px entre som e borda vazia superior do formulário; nenhum texto/controle está sob ela, e esta proposta não amplia o escopo para redesenhar landscape.
- [Card focado](../../output/gui-compact-recovery-v1/evidence/2026-09-19T04-03-45-927Z/candidate-focus-character-warrior-320x568.png) e [Voltar focado](../../output/gui-compact-recovery-v1/evidence/2026-09-19T04-03-45-927Z/candidate-back-focus-320x568.png): Shift+Tab real percorre nome→personagem→Voltar, sem mudar ordem. Verificado o contorno visual do card, além do rádio13px; controles focados não ficam sob som/status. Nome, Aldric selecionado, labelspan e SVG mantêm identidade.
- Enter em Voltar e clique real para reabrir removem marker, restauram CSS normal e preservam nome/classe/DOM. Nova recusa e remoção do bloqueador permitem [retry aceito](../../output/gui-compact-recovery-v1/evidence/2026-09-19T04-03-45-927Z/candidate-retry-playing-320x568.png): resposta real `runStarted`, marker limpo e duas esferas presentes. Essa imagem mostra tooltip de skill sob o ponteiro estacionário depois de fechar o menu; nenhum cast foi solicitado. Isso não é aceite de HUD/tooltip nem mudança proposta neste escopo.

Compromisso visual explícito: o status sticky passa sobre a parte superior dos retratos quando retry está focado em320px. A seleção completa reaparece ao rolar/navegar por teclado; nenhum conteúdo foi escondido por display/visibility e os retratos/nomes/textos originais permanecem. O candidato prioriza entendimento da recusa junto à ação. Swipe em dispositivo físico, zoom/fontes ampliadas, screen reader e conforto prolongado permanecem fora desta prova.

## Coordenação, histórico e entrega

Root autorizou a janela imediatamente após término Brute, sem novas fontes runtime. SFX publicou encerramento real às03:58:46 em `brute-motion-v4.md`; lock ausente/nenhum runner Brute ativo conferidos e [sinal registrado](../../output/gui-compact-recovery-v1/gpu-window.json). SFX/VFX avisados por mailbox sobre a prioridade Root. Cada rodada usou mkdir atômico/token próprio; o finally fechou browser/servidores privados e removeu somente a reserva GUI. Sem remoção de lock alheio, fila, interrupt ou processo do usuário.

GPU GUI liberada às04:03 após rodada final. Recibos de aviso SFX/VFX/Combat: `msg_b8c84baa5f8c`, `msg_421dbf4bdc01`, `msg_2b38fbe1bcd3`. Nenhuma próxima captura GUI planejada. Hash runtime styles `8ede8bb92ae3a92e3a8b5d80e4d3701bf2c49e7b6e562b732286f4d5ed015fc0`; main capturado do dono `afc7d5acd1a5fbe33b03367acf93aec5e404d7aa720e7869bf9c9c6a0f76d7b1`. O manifesto identifica222 fontes, candidato, runner e cada PNG.

Histórico incompleto preservado:04:01 guarda indevida de interseção em landscape já existente;04:02:16 defeito real do padding do candidato;04:02:56 harness avaliava `runStarted` cedo demais, antes de confirmação do servidor, pois `playing` é otimista. Última rodada aguarda resposta real. Nenhuma tentativa anterior foi promovida a PASS.

O runner histórico `tools/ui-compact-recovery-v1.mjs` pressupõe baseline anterior à promoção; não repetir sobre o runtime promovido como se ainda fosse um A/B válido. A aplicação autorizada04:16 usou `tools/ui-compact-recovery-promote.mjs`, que recusa baseline inesperado/duplicação. Nenhuma nova execução necessária. Sem suíte global, nota artística ou aprovação geral de acessibilidade/gameplay.
