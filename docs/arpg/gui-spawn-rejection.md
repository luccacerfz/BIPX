# GUI — spawn rejeitado, CSS promovido e contrato de integração

## CSS promovido03:04 UTC — FONTE GUI CONGELADA

Janela explícita Root/Combat após checkpoint Environment/JEF03:00, registrada em `combat-environment-integration.md`. **Promovido somente o candidato CSS6d88a4d2 em styles.css atual.** Nenhuma edição index/JS/input/assets/main/server pela GUI. Sem nova alteração runtime planejada, GPU não usada, nenhuma fila/interrupt. Combat pode seguir com sua QA real após os hooks próprios de rótulo/marker/limpeza.

[Recibo e hashes](../../output/gui-spawn-rejection/promotion/20260919T030451.798647Z/receipt.json), SHA256 `1294038c3dca8b08a5db8182b5927200e5001f57d70186b5355351c158a4301f`. Baseline integral arquivado ao lado em `styles.before.css` (hash `41fedcf08a00261200324e3a929f1dedc9f4a7b4165318018a19d5cef67cac11`). Promoção preserva todos os bytes anteriores e acrescenta newline + candidato810bytes, exatamente hash `6d88a4d2ef337830da67c3af7af4770c75ed482430d99919b66d904984a97cfd`. **styles.css final: `8ede8bb92ae3a92e3a8b5d80e4d3701bf2c49e7b6e562b732286f4d5ed015fc0`.**

Checks pertinentes: igualdade do bloco/prefixo/arquivo arquivado;16 arquivos GUI protegidos inalterados; `git diff --check` passou. GET `5173/styles.css` retornouHTTP200/SHA final idêntico. Servidor18430 preservado, sem restart GUI. A prova visual/temporal de staging abaixo continua histórica; recuperação/retry/voltar/reabrir com main+CSS atuais será validada por Combat. Não houve suíte global nem alegação de aceite integrado nesta promoção.

## Histórico — preparação e QA isolada antes da promoção

**PRONTO EM STAGING; RUNTIME INTACTO.** Pedido Root atual incorporado. [Pacote](../../output/gui-spawn-rejection/manifest.json) em `output/gui-spawn-rejection/`; proposta anterior `gui-spawn-rejection-proposal.md` e evidências02:29 preservadas. Sem edição main/server/index/styles/presentation/HUD, commit/deploy ou agente novo. Environment já publicou freeze das quatro fontes às02:30; `combat-environment-integration.md` ainda exige sinal específico para promoção GUI. Esta entrega é a proposta revisável para essa próxima janela.

## Diagnóstico: observado, hipótese e prova

`combat-spawn-ui-followup.md` e PNG original02:13 foram lidos/inspecionados. No PNG1280×800, texto monumental ultrapassa a coluna e CTA está quase preto. O PNG sozinho não permite concluir por que o fundo sumiu. Na reprodução DOM com o CSS atual, o texto longo ocupa713.34px numa coluna410px.

Para testar a hipótese gradient/hover/transition, rodei **o handler atual de main sem modificá-lo**, via menu/input real contra o servidor fixture já existente (`spawnFixture`). Um bloqueador sintético radius30 numa sala inativa provoca `runStartRejected`; nenhum `runStarted` recebido, estado permanece menu. Não houve patch de estilos/strings nessa medição. [Diagnóstico nativo e amostras](../../output/gui-spawn-rejection/evidence/2026-09-19T02-34-33-197Z/spawn-ui-staging.json); [report nativo limpo](../../output/gui-spawn-rejection/evidence/2026-09-19T02-34-33-197Z/native-rejection-baseline.json).

| Instante após mutação do título | Hover | background-image | background-color | Texto/opacity |
| --- | --- | --- | --- | --- |
| Imediato0.1ms | false | gradiente original | rgba(0,0,0,0) | rgb(21,32,39)/1 |
| Primeiro RAF5.7ms | true | none | rgba(0,0,0,0) | rgb(21,32,39)/1 |
|180.5ms | true | none | rgba(222,197,155,1) | rgb(21,32,39)/1 |
|301.7ms | true | none | rgb(222,197,155) | rgb(21,32,39)/1 |

Botão habilitado e focado em todas as amostras. Assim, a **transparência transitória foi reproduzida no fluxo real de rejeição**, não atribuída a disabled nem inferida apenas pelo screenshot. O gradiente some antes de o background-color terminar a interpolação de180ms. A cor de fundo transparente não tem contraste independente do cenário; não atribuo ratio exato ao primeiro frame sem amostragem do fundo compositado. A captura [após300ms](../../output/gui-spawn-rejection/evidence/2026-09-19T02-34-33-197Z/native-rejection-baseline-after300ms.png) não substitui esse diagnóstico temporal.

O mesmo registro mostra `labelConnected:false`, `childCount:0` após `playButton.textContent`: o texto acessível do botão continua “Tentar novamente”, mas o span/ícone e a referência DOM foram removidos. O candidato preserva esses nós.

## Solução mínima e contrato de ownership

**Combat/main:** conservar marca BIPX e kicker Noite Zumbi; o texto local do formulário explica “Entrada indisponível. Ainda não há espaço livre para aparecer. Tente novamente em instantes.” Atualizar somente o rótulo `#play-button-label` para “Tentar novamente”, preservando nó/ícone. Não reconstruir o botão nem trocar handlers. Considerar os outros caminhos que hoje usam `innerHTML` no game-over/back ao preservar a referência; o helper deve obter/normalizar um único label existente, sem duplicá-lo. Nome/escolha não são resetados.

Marcador proposto: `#message[data-run-start-rejected="true"]` somente na rejeição validada que abre o login. Motivo com `role="status"` e retry descrito por `aria-describedby="message-copy"`; estabelecer o status antes da atualização do texto. Foco no retry com rolagem suficiente para vê-lo em viewport curta. Em nova entrada aceita, voltar ao menu/login normal ou outra mensagem, limpar marcador/atributos transitórios e restaurar strings do estado apropriado. Voltar retorna foco ao botão de entrada; reabrir retorna ao nome preservado. [Contrato completo](../../output/gui-spawn-rejection/state-contract.json). Toda autoridade/readiness/revalidação de pedido continua existente.

**GUI/CSS:** [candidate.css](../../output/gui-spawn-rejection/candidate.css),810bytes, SHA256 `6d88a4d2ef337830da67c3af7af4770c75ed482430d99919b66d904984a97cfd`. [Patch revisável de styles.css](../../output/gui-spawn-rejection/styles.patch), não aplicado. Escopo somente no marcador de rejeição: texto local legível; retry com fundo opaco #c6aa7c, texto #152027, hover #dec59b; remove transição de background nesse estado. Contraste calculado7.45:1 normal /9.91:1 hover. Não espera180/300ms para esconder o defeito. No landscape compacto, onde o CSS base esconde message-copy, inclui apenas o motivo numa linha notice do grid. Sem novo painel, sem alteração dos demais títulos/CTAs ou do HUD/input.

Não é necessário alterar index/presentation nesta proposta. Se Combat preferir status permanente em markup, qualquer atributo no index será negociado na mesma janela; nenhuma mudança antecipada. Código de simulação em `fixture.html` existe só para demonstrar o contrato, não será importado no jogo.

## Validação e comparação do candidato

[Rodada complementar51 checks](../../output/gui-spawn-rejection/evidence/2026-09-19T02-36-24-199Z/spawn-ui-staging.json): **fonte estável**, diagnóstico nativo anterior reutilizado apenas após comparar TODOS os hashes runtime e conferir seu report limpo. Dois checks nativos passaram na rodada inicial; a etapa DOM dessa primeira execução falhou404 porque o servidor não serve output/. Falha preservada, sem aprovação geral daquela rodada. Corrigido só o harness: duas rotas QA servem fixture.html/candidate.css do staging, sem mudar servidor. A repetição cobre apenas a etapa pendente, sem refazer a medição nativa já válida.

No candidato, computedStyle retorna fundo opaco já em0ms, em180ms e em300ms, nas quatro resoluções. Rejeição repetida preserva identidade de label/ícone, nome Lua QA e classe Lyra; Tab/Enter acionam uma única ação local. Voltar recebe foco visível, limpa o estado simulado e devolve foco à entrada; reabrir preserva nome/seleção. Reduced-motion respeitado; nenhum overflow horizontal de documento/menu. Em320×568 há rolagem vertical intencional para alcançar retry.

Imagens inspecionadas:

- [Desktop1280×800](../../output/gui-spawn-rejection/evidence/2026-09-19T02-36-24-199Z/desktop-proposal-focus.png)
- [Portrait393×852](../../output/gui-spawn-rejection/evidence/2026-09-19T02-36-24-199Z/portrait-proposal-focus.png)
- [Portrait320×568 com rolagem/foco](../../output/gui-spawn-rejection/evidence/2026-09-19T02-36-24-199Z/small-proposal-focus.png)
- [Landscape852×393 com motivo visível](../../output/gui-spawn-rejection/evidence/2026-09-19T02-36-24-199Z/landscape-proposal-focus.png)

Essas quatro imagens são **fixture DOM**, identificada no próprio frame, sem jogo/rede nem fundo montado de gameplay. O diagnóstico nativo separado usa jogo real com condição sintética de servidor. Chrome visível, toque emulado; não é aparelho físico nem leitor de tela. Checks/foco/contraste não equivalem a nota10, recuperação real do candidato, natural60s ou aprovação global.

## Promoção coordenada e pendências

GUI aguarda somente o sinal específico de janela Combat, sem nova pergunta ao usuário. Combinar o lote: Combat strings/estado/limpeza no main e GUI patch CSS de810bytes. Depois verificar **apenas** rejeição→retry aceito e rejeição→voltar/reabrir com código integrado, foco/announcement, nome/escolha/label DOM e portrait. Não rodar suíte global por este acabamento. Teste de recuperação servidor da rodada02:13 permanece evidência distinta; não é prova do candidato ainda staged.

GPU própria liberada após02:36; recursos próprios encerrados, lock de outros preservado,5173 não reiniciado. [Manifesto/hashes](../../output/gui-spawn-rejection/manifest.json) SHA256 `41f64e8c4872f94b61f38b6e96f38864e97348bfe98451701d318e3f7da994b8`. Baseline mostra seis arquivos protegidos byte-idênticos desde preparação; nenhum runtime editado. `node --check` e `git diff --check` passaram.

Reprodução completa futura com GPU livre: `node tools/ui-spawn-rejection-staging.mjs`. Reutilização bounded do diagnóstico idêntico: `BIPX_UI_NATIVE_REPORT=output/gui-spawn-rejection/evidence/2026-09-19T02-34-33-197Z/spawn-ui-staging.json node tools/ui-spawn-rejection-staging.mjs`; aborta se qualquer hash runtime mudar, em vez de atribuir prova antiga a nova fonte.
