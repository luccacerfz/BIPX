# GUI — placa de boss v1, selecionada e integrada

## Integração06:14 — dois deltas, HTTP conferido

Root selecionou a arte em [gui-boss-label-selection.md](review/gui-boss-label-selection.md). Combat abriu a microjanela `msg_b784e333732c` e aplicou como escritor único o móduloGUI exato e o import/substituição da pintura no main vigente. GUI não escreveu runtime concorrentemente. **Promovido:** `src/ui/boss-label-painter.js`4.748bytes/SHA `9a606982e7681de31bc60d6f7de9970f9f3d9fd582bbceaf5098824e95b481c6`; main final `af0c3ae0a3f2ac93f1a5da7c07ac13b6ced64c0df3f9228006873afa1f0091f7`.

Verificação independente GUI: módulo byte-idêntico ao selecionado; main byte-idêntico ao baselinec0fbc com **somente** um import e a substituição do blocoCanvas2D. Nenhuma outra linha alterada, portanto criação/escala/material/posição, healthRatio, throttle110/140ms, thresholds e tail de textura/contadores preservados. SintaxeNode dos dois arquivos passou. GET5173 de main e módulo retornou200/`text/javascript`, bytes/SHA idênticos ao disco. Styles0dfb permaneceu idêntico e servido200; listenerPID5973, nenhum restart/GPU GUI.

[Pacote, baseline e manifesto](../../output/gui-boss-label-v1/integration/2026-09-19T06-14-49-515211Z/manifest.json), [recibo independente e HTTP](../../output/gui-boss-label-v1/integration/2026-09-19T06-14-49-515211Z/verification.json), [integração pelo Combat](combat-gui-boss-integration.md). ManifestoSHA `7e242905b9c0876ca8d75e9a55de6cbe31b8e02b04d60d6c9e6d5334ba4ec905`. O primeiro archiveGUI já encontrou os deltas aplicados: o `patch --check` forward recusado é histórico de patch já aplicado, não falha do runtime; não foi reaplicado. O arquivo inicialmente nomeado `main.before.js` contém af0c pós-promoção, explicitamente identificado no recibo; baseline verdadeiroc0fbc também preservado separadamente.

**FonteGUI congelada/liberada.** Sem repetir A/B, matriz, GPU ou pedir nova confirmação. Evidência visual06:05 abaixo permanece a comparação staging selecionada; a verificação integrada atual é CPU/sintaxe/HTTP, sem nova alegação de gameplay natural/mobile/custoCPU/AAA/global.

## Histórico — entrega staging06:05, seleção posterior acima

Pedido Root incorporado após encerramento SafariCSS0dfb. **Prancha e um A/B nativo concluídos às06:05, GPU liberada; seleção artística pendente, sem promoção.** Fonte referência: `createBossLabelSprite`/`updateBossLabel` no mainc0fbc, canvas384×128/sprite5.4×1.8. Original inspecionado: `output/playwright/2026-09-19T05-25-12-057Z-physics-combined/north-moving-melee.png`, Vaca Sanguinária74/74, aproximadamente210×70px na câmeraARPG. Retângulo/borda vermelha saturada e tipografia pesada destoam do latão/serif do HUD inferior.

## Resultado visual e evidência06:05

Originais inspecionados: [prancha100%/50%/baixoHP/nome longo](../../output/gui-boss-label-v1/evidence/2026-09-19T06-05-25-654Z/boss-label-state-board.png), [baseline na câmeraARPG](../../output/gui-boss-label-v1/evidence/2026-09-19T06-05-25-654Z/boss-arpg-baseline.png), [candidato na mesma cena](../../output/gui-boss-label-v1/evidence/2026-09-19T06-05-25-654Z/boss-arpg-candidate.png). Nome marfim e moldura chanfrada conversam com o HUD inferior; canal vermelho continua visível sem a antiga borda saturada. Números ganharam espaço e contraste; nome longo está completo em duas linhas. A leitura reduzida é pequena por desenho, especialmente no nome longo: julgamento artístico independente permanece aberto, sem notaAAA.

A prancha é fixtureCanvas2D, não gameplay. O A/B1440×900 usa o jogo real copiado, um boss criado pelo spawn existente e pausa real; **não é partida natural**. A saúde desse spawn foi743.270873/743.270873, exibida744/744 pelo arredondamento original, sem sobrescrever HP. Não reproduz os74/74 da captura histórica. Pose, câmera, saúde, posição, escala, IDs da placa/textura, guardas/contadores e recursos foram exatamente iguais entre A/B.167calls,491.053triângulos,42texturas e106geometrias nos dois lados; esses contadores não medem custo de pinturaCPU.

Comparação dos PNGs inteiros:9.926pixels diferentes, todos no retângulo da placa `[687,143,868,199)`; o restante é pixel-idêntico. Nenhuma edição/composição dos PNGs. Na textura, pixels com alpha caíram38.448→35.088(−8,74%), bounds16..367/y14..113 dentro dos anteriores14..369/y8..115. Nome longo cabe sem ampliar a placa. [Report nativo](../../output/gui-boss-label-v1/evidence/2026-09-19T06-05-25-654Z/report.json), [revisãoCPU dos originais](../../output/gui-boss-label-v1/evidence/2026-09-19T06-05-25-654Z/visual-review.json), [manifesto final com SHA/bytes](../../output/gui-boss-label-v1/native-manifest.json).

Zero erros de página/HTTP. Fontes live, cópia e arte permaneceram estáveis durante a rodada. A cópia225fontes difere do live no `server.mjs`, alterado independentemente depois do snapshot; os dois hashes estão no report/review. Isso não é aprovação do backend atual. Mainc0fbc/styles0dfb/arte cliente são a fonte declarada.5173 não foi reiniciado/operado pela GUI; leitura06:08 encontrouPID5973, diferente do registro histórico65261. [HTTP200/CSS servido idêntico e listener atual](../../output/gui-boss-label-v1/evidence/2026-09-19T06-05-25-654Z/live-http-preservation.json).

Hashes de entrega: painter4.748bytes `9a606982e7681de31bc60d6f7de9970f9f3d9fd582bbceaf5098824e95b481c6`; patch1.797bytes `c4f991804a11cad4bb1c6ab8ba90c7c0e91ee7b2e4d332d95cc00108e523611f`. CandidatoPNG `55c6bd8ee7c53ee285e8f7e65eb0bef086031daf1770e999aab22cb9a0d168c3`; pranchaPNG `8628a4f49585a32e8e54ef95ffc001ecfd0e00fa37462cefbe2d9a4a4b8b4583`. Módulo continua apenas em output, aguardando seleçãoRoot e futura integração mínima pelo Combat.

## Direção e revisão do brief

Paleta: pedra `#07141b`, aresta `#373d3b`, latão gasto `#b39a6e`, nome marfim `#f2e4cd`, sangue `#b33b48`, canal escuro `#331b24`. Nome central serifado Iowan/Palatino/Georgia; números AvenirNext/Segoe/Arial. Um contorno fino chanfrado, canal vermelho com relevo interno e dois pequenos terminais metálicos, sem glow que amplie a área pintada. Cor por tipo reduzida aos terminais; vida mantém semântica vermelha em todos.

Revisão antes de construir: rejeitado o caminho de título extra/coroa/brilho pulsante porque gastaria a área que pertence ao corpo/cena. A distinção vem do corte do metal e do nome, coerentes com as esferas/placas BIPX, sem copiar marca/arteDiablo. Layout384×128: nome y40 ou duas linhas y29/52; canal48–337/y67–88; valores y101. Área externa16..368/y14..114, dentro da anterior14..370/y8..116. A prancha medirá alpha/ocupação, não assumirá geometria como aprovação artística.

## Módulo e integração proposta

[Candidato](../../output/gui-boss-label-v1/candidate/boss-label-painter.js): `paintBossLabel(context, {label, health, maxHealth, healthRatio, accent})`. Recebe o contexto/canvas existente; não importaThree, cria textura/sprite/material, escolhe posição ou modifica dados. Preserva o nome completo, ajusta tipografia e até duas linhas para o caso longo; números continuam `Math.ceil(health)`/`Math.ceil(maxHealth)`. Retorno descritivo usado pela fixture, ignorável em produção. Save/restore impede vazamento de estadoCanvas2D.

Destino **futuro, só após seleção**: `src/ui/boss-label-painter.js`. Nenhum arquivo foi criado em src/ui live nesta fase. [Patch proposto ao Combat](../../output/gui-boss-label-v1/combat-main.patch) insere um import e substitui exclusivamente o blocoCanvas2D por uma chamada. Não aplicar automaticamente. Proposta integral para inspeção em `candidate/main.proposed.js`; não copiar main inteiro.

VerificaçãoCPU: criação384×128/CanvasTexture/SRGB/SpriteMaterial/depthTestfalse/depthWritefalse/renderOrder20/scale5.4×1.8 byteidêntica. Guardas110/140ms e threshold3.5%/5.5%, healthRatio/accent originais byteidênticos. Após a pintura, texture.needsUpdate, perfStats.labelUpdates, lastLabelHealth e lastLabelUpdate byteidênticos; posição/altura não tocadas. Isso demonstra fronteira do patch, não prova custoCPUzero: a pintura usa gradientes/text metrics; desempenho ainda não medido.

[Cópia225fontes e hashes](../../output/gui-boss-label-v1/preparation.json), [manifesto candidato](../../output/gui-boss-label-v1/staging-manifest.json). Cópia está em `output/gui-boss-label-v1/game` e mantém fontes originais. `styles.css0dfb40e3`, mainc0fbc, Env/nav/Safari e evidências históricas intactos. Nenhum restart5173, commit, agente novo ou mudança de autoridade.

## Método das comparações executadas

[PranchaHTML](../../output/gui-boss-label-v1/board.html): baseline real extraído do main versus candidato,100%,50%,6/74 e nome longo;384×128 e210×70. Canvas e textos sintéticos explícitos, não gameplay. PNGs individuais originais e alpha bounds/ocupação exportados sem pós-composição. PranchaCPU anterior preservada em `output/playwright/2026-09-19T06-01-45-810Z-gui-boss-label-cpu-board`, com WebGL/GPU desativados.

[Runner nativo](../../output/gui-boss-label-v1/native.mjs): depois da prancha, **um A/B1440×900** no jogo completo copiado. UI inicia a partida; fixture cria uma BloodCow pelo spawn real, sem sobrescrever HP/posição/escala; pausa offline pela API existente. O harness suspende só o próximoRAF de animate para conservar exatamente a pose/câmera. A/B repinta a mesmaCanvasTexture e chama o mesmo pipeline, sem update de simulação. Guarda exige saúde/pose/câmera/posição da placa/IDs/tamanho/contadores/drawcalls/triângulos/texturas iguais; nenhuma alegação de partida natural/performance. Cena diversa do PNG histórico, idêntica entre os dois novos lados do A/B.

O main live/copied em disco não é editado pelo runner: somente a resposta isolada recebe imports da pintura e hooks de observação/fixture. Proposta de integração é separada. Inputs/saúde/posição não entram no delta proposto.

## Coordenação

Preparo inicial comunicado ao Combat `msg_856dcbd8114d` e VFX `msg_11267a31feeb`. Root06:01 autorizou explicitamente a janela após liberaçãoVFX05:58, confirmada no handoff06:03; mensagens antigas de espera foram superadas. Início avisado ao Combat `msg_aca1c09ee6f2` e VFX `msg_71f6a74bbd3d`, seguido de mkdir atômico próprio.

Browser/HTTP/token próprios encerrados06:05:29; runner22729 e servidor22731 confirmados inexistentes, lock próprio removido pelo token. [Recibo](../../output/gui-boss-label-v1/evidence/2026-09-19T06-05-25-654Z/gpu-release.json). Fim avisado ao Combat `msg_482282fb2bbc` e VFX `msg_f1d4aa4844eb`. [Gate](../../output/gui-boss-label-v1/gpu-window.json) consumido e `authorized:false`, sem outra GPU GUI planejada. Nenhum runtime/promote/restart. SeleçãoRoot e integração futura continuam pendentes; não atribuir esta fixture a gameplay natural/mobile/performance/global.
