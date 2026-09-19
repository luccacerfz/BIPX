# Revisão root — Environment e recuperação de entrada

Revisão dos quatro PNGs Environment e quatro GUI originais listados com hashes em [registro](environment-gui-followup.json). Nenhum vídeo contínuo, áudio ou aparelho físico foi avaliado nesta revisão.

## Environment integrado

As fontes de composição promovidas às02:30 e navigation911e0ea2 foram lidas. O patch de navegação acrescenta apenas um segundo anel inicial se o primeiro não conecta; mantém sweeps com corpo real, limite de nós e expansão ordinária. Reports independentes do dono e Combat registram chegada do boss em5.85s e gate layout7/7. Não houve necessidade de mudar o cenário ou o raio do boss.

A prova nativa02:43 é fixture sintética com render real:8/8, fontes estáveis, zero erros; quatro comparações de cor/depth com clipping/cutaway tiveram zero pixels divergentes. Nos originais cripta/jardim/manutenção, o centro e o limite do campo roxo permanecem identificáveis, com oclusão por objetos sólidos; no enquadramento próximo, o corpo continua visível em frente ao núcleo. A copa recortada exibe pontilhado, e chão/cruzes ainda são repetitivos. Isso não aprova movimento, horda ou acabamento AAA.

Medição EXT_disjoint_timer_query_webgl2 em1280×720:24 amostras úteis por caso após6 warmups, A/B alternado no mesmo layout143. O modo plain desliga somente o shader de composição do chão, mantendo malha de contato e restante do cenário. Floor-only HDR P95:1.503749→1.608875ms, diferença0.105126ms. Cena completa com um campo teve P95 composto5.856958–6.554624ms nas quatro vistas. A mediana de manutenção varia muito; não interpretar diferença de P95 como custo causal por frame, FPS de gameplay ou comparação integral com o layout138. Reports: `output/playwright/environment-composition-integrated-v1/`.

## GUI de rejeição

O diagnóstico nativo reproduziu a causa temporal: hover remove o gradiente, mas a transição de cor parte de transparente; em180ms o botão já voltou a dourado. O estado também eliminava o span do rótulo ao atribuir textContent ao botão. A proposta mantém marca/título, mostra motivo local e usa fundo opaco desde o primeiro frame.

Selecionei CSS6d88a4d2 e contrato de estado para próxima integração coordenada. Desktop e portrait têm texto legível, botão dourado e foco ciano visível. Em320×568 a captura focada rola verticalmente para o botão; não é prova de título/motivo simultaneamente visíveis. Landscape compacto mantém o motivo. Os quatro frames do candidato são DOM fixtures explicitamente rotuladas;51 checks do dono não substituem rejeição→retry aceito e voltar/reabrir com main integrado. Combat foi informado para integrar depois de encerrar a janela Environment, sem nova permissão do usuário.

Fontes relacionadas: [handoff Environment](../environment-handoff.md), [navegação](../physics-navigation-connectors.md), [handoff GUI](../gui-spawn-rejection.md). Servidor5173 permaneceu com PID66986 na verificação root; reload de backend pertence a Combat. Goal ativo, avaliação AAA e dispositivo físico pendentes.
