# GUI — proposta mínima para runStartRejected (isolada)

**Pronta para a próxima janela Combat/Environment; não promovida.** Pedido de `combat-spawn-ui-followup.md` incorporado. Nenhum arquivo runtime foi editado: index/styles/main/módulosGUI continuam byte-idênticos ao baseline desta proposta.5173 preservado. GPU usada somente após lock livre, com reserva própria atômica; browser/backend/lock próprios encerrados. Sem suíte global, sem captura do jogo em execução, sem fila/interrupt.

## Diagnóstico confirmado

PNG original1280×800 inspecionado: `output/playwright/2026-09-19T02-13-10-153Z-verify-player-spawn-browser/spawn-rejected-no-free-space.png`. O título substitui BIPX e herda a fonte monumental de `.message h1` (`styles.css:49`): Range de texto713.34px para coluna410px na reprodução DOM. Não é problema de autoridade/spawn.

Contraste fraco reproduzido: `.primary-button` tem gradiente sobre background-color transparente (`styles.css:57`), hover troca para cor sólida (`:58`), com transição de `background` (`:26`). No primeiro frame do hover, browser retorna **background-image:none + background-color:rgba(0,0,0,0)**, texto rgb21/32/39; só depois interpola a cor opaca. A amostragem de260ms está no report, não é inferência apenas do PNG.

## Contrato proposto ao Combat — strings/estado/main

Na rejeição que devolve ao menu, preservar `#message-title = 'BIPX'` e `#message-kicker = 'Noite Zumbi'`. Usar o parágrafo existente do formulário:

> Entrada indisponível. Ainda não há espaço livre para aparecer. Tente novamente em instantes.

Manter `Tentar novamente` no rótulo do botão, preservando seus filhos/ícone e `#play-button-label` quando presentes. A atribuição atual a `playButton.textContent` remove esse span e deixa a referência capturada em main desacoplada do DOM; não é necessário remover os filhos para mudar o texto. Nenhuma nova ação/listener/atalho.

Publicar `message.dataset.runStartRejected = 'true'` apenas enquanto essa rejeição está visível. O CSS staged depende desse marcador. Limpar o marcador quando houver runStarted/start aceito, retorno ao menu/login normal ou outro estado de mensagem, restaurando as strings normais de cada fluxo. Não inferir prontidão pelo CSS nem remover `disabled`/revalidação existentes. Conservar o foco na ação de retry; em viewport curta garantir que a ação focada possa ser rolada para dentro da área visível.

Para o motivo ser descrito ao focar retry: `aria-describedby="message-copy"` em `#play-button` durante esse estado; `role="status"` no parágrafo para anúncio polido. Remover/restaurar atributos transitórios ao limpar o estado. A fixture exercita esses atributos; o ciclo real de aplicação/limpeza continua sob Combat na próxima janela.

## CSS preparado pela GUI

[`candidate.css`](../../assets/ui/arpg/source-history/spawn-rejection-candidate/candidate.css), **810bytes**, SHA256 `6d88a4d2ef337830da67c3af7af4770c75ed482430d99919b66d904984a97cfd`. Não importado pelo runtime. Sem mudança index necessária para os seletores propostos.

Somente sob `#message[data-run-start-rejected="true"]`: motivo usa cor de texto existente; retry recebe fundo dourado sólido #c6aa7c/texto #152027 e hover #dec59b, sem transição de background. Contraste sRGB calculado **7.45:1 normal / 9.91:1 hover**. Outline global de teclado, disabled, reduced-motion e handlers permanecem.

O login compacto681+px/altura<=520 hoje esconde `#message-copy`; o candidato reinsere apenas esse motivo numa linha `notice` do grid durante rejeição. Não muda o restante do menu, HUD, esferas, tooltip ou input. Essa regra foi inspecionada na captura852×393.

## Validação isolada e limites

[Report30/30](../../output/playwright/2026-09-19T02-29-08-966Z-ui-spawn-rejection-candidate/spawn-ui-proposal.json), fonte global estável, sem erros de página/HTTP. HTML copiado do index com scripts de jogo removidos; fundo escuro sólido e selo explícito **Fixture GUI · sem jogo/rede**. Nenhuma montagem usando screenshot de gameplay. Isto comprova apresentação/DOM, não rede/autoridade/reentrada.

- [Desktop1280×800 com foco](../../output/playwright/2026-09-19T02-29-08-966Z-ui-spawn-rejection-candidate/desktop-proposal-focus.png): marca dentro da coluna, motivo no formulário, retry dourado com foco visível.
- [Portrait393×852](../../output/playwright/2026-09-19T02-29-08-966Z-ui-spawn-rejection-candidate/portrait-proposal-focus.png): marca/motivo e duas ações legíveis, sem recorte horizontal.
- [Compacto320×568](../../output/playwright/2026-09-19T02-29-08-966Z-ui-spawn-rejection-candidate/small-proposal-focus.png): rolagem/foco do retry; não exige todos os controles visíveis ao mesmo tempo.
- [Landscape852×393](../../output/playwright/2026-09-19T02-29-08-966Z-ui-spawn-rejection-candidate/landscape-proposal-focus.png): motivo permanece visível na linha nova e botão alcançável por teclado.

Teste mantém estados enabled/disabled por contrato da fixture; Tab alcança retry, Enter gera uma ativação nativa local, reduced-motion remove transições.30 checks incluem geometria e amostragem do fundo durante hover; screenshots revisados visualmente. Não se atribui o clique local à recuperação funcional do servidor, já comprovada separadamente por Combat.

[Manifesto](../../assets/ui/arpg/source-history/spawn-rejection-candidate/manifest.json) SHA256 `c01cde88b50401fceca92cd2667be0eadc316cebddd75b5d8fe468c41420dfd3` registra CSS/HTML/runner, baseline runtime, PNG original e novas evidências. Reproduzir apenas com GPU livre: `node tools/ui-spawn-rejection-candidate.mjs`. Syntax/diff checks passaram. Na próxima janela: Combat publica strings/marker/limpeza; GUI promove CSS e ambos verificam só rejeição/retry real, contraste/foco e portrait. Não promover esta fixture como candidato integrado.
