# VFX / Combat — integração experimental Horizon + nebula

**LIBERADO — fonte VFX congelada após PASS nativo01:26:48 UTC.** Pool/shaders/wrapper promovidos sob a janela de Combat; pipeline e adaptador cutaway dos respectivos donos consumidos sem override. GPU própria encerrada e reserva liberada. Gameplay final pode consumir esta fonte após as demais promoções coordenadas por Combat. [Manifesto final](../../output/qa/vfx-gravity-horizon-integrated-20260919.json). Aprovação artística continua experimental; não é aceite AAA/global.

Runtime VFX anterior e candidatos preservados. Este documento é o contrato durável. Novos campos ficam na propriedade VFX; `main`, pipeline/prepass pertencem a Combat; cutaway compartilhado pertence a Environment. Envios Orca diretos sem interrupt tiveram recibo `agent_prompt_stalled`, mas foram consumidos e reconhecidos no handoff Combat; sem retries/fila.

## API implementada do wrapper

```js
// Depois de syncState/update/movimento/câmera; imediatamente antes do render:
const request = classSkillVfx.prepareSceneDepth(camera);
// request = { required, visibleFields, excludeRoots:[gravityGroup] }
// required=false => nenhum prepass; depth da frame anterior foi invalidado.
// Se required: Combat faz UM prepass para todos os campos visíveis.
classSkillVfx.setSceneDepth({
  texture, encoding:'rgba-packed', width, height, near:camera.near, far:camera.far,
  viewport:{x:0,y:0,width,height},
});
// Sem depth válido: setSceneDepth(null), núcleo/limite/debris essenciais continuam.
// Mesma textura emprestada; VFX nunca modifica/descarta target/renderer.
```

`width/height` são os pixels totais da textura de depth e target HDR de cor. `viewport` é o retângulo ativo nesse mesmo target, em pixels e origem inferior esquerda; shader amostra `gl_FragCoord.xy / resolution`, sem UV de canvas CSS. Near/far/projeção devem coincidir nos dois passes. Nada de textura do frame anterior: prepare invalida a referência, set publica somente após o prepass corrente. Câmera muda/reduced/pausa não autorizam depth antigo. Estados autoritativos ainda vêm exclusivamente de `syncState` e eventos existentes.

Pool implementado: até8 campos completos pré-alocados, quatro geometrias compartilhadas e quatro draws por campo (Horizon,nebula,debris,sparks); limite externo no batch de áreas existente. Cobre sala atual4 jogadores (CD12s/duração5s). Sem campos/fora do frustum: zero draws do pool e nenhuma solicitação de depth; o batch de áreas pode continuar ativo para estados existentes. Overflow tem fallback essencial de centro/limite e contador explícito; não altera área/duração.1/4/8 e overflow10 validados; custo abaixo.

## Oclusores e estado

Combat preserva target/viewport/scissor/clear/autoClear/override/background/sombras/clipping após prepass, inclusive em erro. Depth deve respeitar mapas alpha, side, skinning/morph/instâncias e planos de clipping dos cadáveres. Adotar patch específico de Environment para discard de cutaway conforme `review/gravity-depth-integration.md`; **não reutilizar onBeforeCompile de material color inteiro no MeshDepthMaterial**. Copa descartada na cor não pode permanecer oclusor invisível. Excluir raízes VFX explícitas e translúcidos que não escrevem depth; definir o comportamento de fades no contrato de Combat.

QA bounded antes de gameplay: zero campos,1/4/8visíveis, todos fora da câmera, copa/ruína com cutaway ligado, viewport/resolução/near/far, pausa/latejoin/reset/expiry/dispose/reduced, estabilidade de alocação e GPU timer. Preservar comparativo anterior e não repetir suíte global por edição. Canhão orgânico fica depois da gravidade.

## Promoção VFX em01:12 UTC — API pronta / QA GPU pendente

Janela confirmada em `combat-depth-integration.md`. Promovidos `gravity-field-pool.js`, `gravity-field-visual.js`, `gravity-horizon-source.js`, `gravity-noise.glsl.js`, `gravity-common.glsl.js`; conectados `class-skill-fields.js` e `class-skill-vfx.js`. Contrato prepare/set acima está implementado exatamente. Grupo excluído tem também `userData.excludeFromSceneDepth=true`. Um batch de área mantém limite5m; pool4camadas por campo (Horizon,nebula,debris,sparks), geometrias compartilhadas. Núcleo/debris permanecem sem depth; nebula não reutiliza textura velha. Frustum seleciona prioritariamente até8visíveis; overflow mantém marcador central/área, diagnosticado. Sem pós-explosão extra quando campo expira; colapso ocorre antes do fim real.

Antes preservado integral em `assets/vfx/source-history/gravity-runtime-before-horizon-20260919/`; candidato1campo e staging intactos. CPU pool9/9: `output/qa/gravity-vfx-pool-2026-09-19T01-12-37-882Z-cpu.json`; wrapper18/18: `output/qa/class-skill-vfx-v2-2026-09-19T01-12-38-020Z-cpu.json`. Render/depth/cutaway/custo multicampo aguardam pipeline e adaptador Environment; **não usar esses passes CPU como liberação de gameplay estável**. VFX está preparando a fixture bounded sobre os módulos reais, sem novo framework. Nenhuma edição em pipeline/main/Environment.

Refino CPU01:19: preparação de câmera não modifica registros emprestados/congelados; evita atualizar transforms duas vezes no mesmo frame.10/10 em `output/qa/gravity-vfx-pool-2026-09-19T01-19-26-191Z-cpu.json`. Fallback canônico de raio gravitacional corrigido para5m. Fixture `tools/gravity-vfx-integration.{html,mjs}` pronta para0/1/4/8/overflow10, offscreen, lifecycle, cutaway A/B real e GPU queries. Ela importa pipeline/adaptador runtime, não substitui a implementação dos donos.

## Candidato01:26 — correção final de câmera pausada

Reteste01:23:55 passou multicampo/oclusão/cutaway/custo; antes01:21:21 falhou ator3em4campos (28.10%). Shader agora atenua cor/alpha sobre geometria opaca alta reconstruída do depth real; preserva65%gate sem alteração. A proteção é por altura da geometria, não máscara de IDs de atores. Candidato anterior/shaders preservados.

À01:26, auditoria encontrou cache de transformação que podia manter slot escondido quando a câmera saía/voltava **sem novo update de simulação**. Corrigida apenas invalidação do cache em `gravity-field-pool.js`; shader/arte não mudaram. CPU11/11 em `output/qa/gravity-vfx-pool-2026-09-19T01-26-14-677Z-cpu.json`. Essa alteração sucede o PASS01:23; aguardar captura bounded final desta fonte antes de congelar manifesto/gameplay. Nenhuma captura Combat observada/lock ocupado; GUI também está na janela de promoção autorizada por Combat. Após esse teste, VFX congela fontes e libera GPU.

## Liberação final — integração01:26:48 / CPU01:28:13

[Report nativo final](../../output/playwright/2026-09-19T01-26-48-130Z-gravity-vfx-integration/integration-report.json): **PASS, fonte estável durante a captura**, zero erros browser/HTTP/GL. É fixture controlada de assets/câmera reais no pipeline HDR+bloom atual; não partida. O campo `promoted:false` significa que a ferramenta não promove arquivos; a promoção runtime já ocorreu separadamente sob a janela acima. GUI/SFX/Animation posteriores pertencem ao próximo manifesto Combat, não a esta prova.

-10 capturas de fases,2playbacks de319amostras,4casos multicampo e2A/B de copa/ruína. Alto preserva7.148pares radiais convergentes; low/reduced mantém2.392pares estáticos. Área5m e duração5s intactas.
-Um prepass compartilhado com1/4/8campos; nenhum sem campos/fora da câmera/reset/expiry.17materiais adaptados ao cutaway nos cenários de copa/ruína; depth e cor usam o patch compartilhado Environment. Near/far/viewport/restauração e paridade pixel a pixel adicionais estão no [QA Combat01:20:58](../../output/playwright/2026-09-19T01-20-58-659Z-verify-scene-depth/scene-depth-report.json), anterior apenas à proteção de silhueta/cache VFX, sem mudança de pipeline/adaptador.
-Pausa com câmera fora/volta sem tick:0passes→1pass,4slots/16draws reaparecem e depthValid=true. Latejoin/encoding inválido/overflow/reduced/reset/expiry/dispose cobertos entre CPU e nativo.51geometrias/53texturas estáveis após20trocas; pool possui8slots/4geometrias,32materiais/32meshes fixos. CPU testa1.000substituições sem alocar meshes/geometrias/materiais/instance buffers; não é alegação de zero alocações JavaScript.
-Gate original de torso65% mantido: mínimo78.51% com1campo,88.43% com4,87.60% com8/overflow10. Quatro regiões11×11px, não horda inteira. Shader reconstrói altura da geometria pelo depth e atenua gás/Horizon sobre silhuetas opacas altas; não é máscara de IDs de atores. Oito campos sobrepostos ainda saturam a composição e precisam julgamento independente.
-[CPU pool11/11](../../output/qa/gravity-vfx-pool-2026-09-19T01-26-14-677Z-cpu.json) e [wrapper18/18](../../output/qa/class-skill-vfx-v2-2026-09-19T01-28-13-114Z-cpu.json). Os corpos dos três projéteis permanecem no wrapper e legíveis em low/reduced; demais cinco skills não foram redesenhadas nesta promoção. Discard color inteiro não é invocado no depth.

GPU EXT timer local Chrome/Metal,1280×720,24queries úteis/caso após6warmups, sem disjoint; inclui compositor/depth, exclui cópias2D de apresentação:

| Modo | Baseline1campo p50/p95 | Novo1campo p50/p95 | Novo4campos p50/p95 | Novo8campos p50/p95 |
| --- | --- | --- | --- | --- |
| high |4.015/4.169ms|5.229/5.969ms|2.722/8.708ms|5.690/11.003ms|
| low/reduced |2.853/3.291ms|3.629/4.744ms|5.009/5.815ms|4.762/8.530ms|

Pior amostra12.187ms high/8campos. Medianas não monotônicas na sequência local; não inferir custo marginal negativo, FPS natural ou aprovação mobile. Custo separado do prepass medido por Combat: mediana.491–.563ms/p95.545–.640ms no seu cenário; não somar como se fosse uma amostra desta rodada.

Comparativos: [high1.8](../../output/playwright/2026-09-19T01-26-48-130Z-gravity-vfx-integration/gravity-vfx-integration-high-1.8.png), [low/reduced](../../output/playwright/2026-09-19T01-26-48-130Z-gravity-vfx-integration/gravity-vfx-integration-low-reduced-1.8.png), [8campos](../../output/playwright/2026-09-19T01-26-48-130Z-gravity-vfx-integration/gravity-vfx-integration-fields-8.png), [copa](../../output/playwright/2026-09-19T01-26-48-130Z-gravity-vfx-integration/gravity-vfx-integration-cutaway-tree.png), [ruína](../../output/playwright/2026-09-19T01-26-48-130Z-gravity-vfx-integration/gravity-vfx-integration-cutaway-ruin.png), [playback](../../output/playwright/2026-09-19T01-26-48-130Z-gravity-vfx-integration/gravity-integrated-ab-playback.webm). Nos A/B de oclusores, esquerda depth sem cutaway/direita adaptado, com color cutaway igual. Runtime final arquivado em `assets/vfx/source-history/gravity-horizon-runtime-final-20260919/`; falha01:21 e candidatos01:23/01:26 preservados.

**Combat: fonte VFX liberada, não haverá nova edição runtime durante sua captura.** Hash do pool `faa591e5c6dde6627fd9b053376e909c8c40b549d6abe531aa08fcb44deab7f4`; demais hashes e evidências no manifesto.5173/PID97873 preservado. Próxima prova é cast por input com depthValid/passe único/adaptador, depois checkpoint integrado conforme sua coordenação. Refinamento orgânico do canhão fica para próxima janela, sem desviar desta integração.
