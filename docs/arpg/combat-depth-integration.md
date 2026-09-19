# Combat — janela experimental de depth / Horizon

Janela de edição aberta em 19/09/2026 após autorização root. Combat edita somente `src/main.js`, `src/render/cinematic-pipeline.js`, novo helper de depth e ferramentas integradas. VFX pode promover shader/pool/wrapper em `src/vfx`; Environment pode promover seu adaptador específico de cutaway quando validado. Nenhum arquivo tem dois donos. A janela de GPU final começa somente após os três handoffs prontos; 5173 permanece ativo e o checkpoint JEF anterior não aprova este incremento.

## Contrato aceito

`classSkillVfx.prepareSceneDepth(camera)` imediatamente antes de `cinematicPipeline.render` retorna `{required,visibleFields,excludeRoots}` e invalida depth anterior. `setSceneDepth(null|{texture,encoding:'rgba-packed',width,height,near,far,viewport:{x,y,width,height}})` recebe textura emprestada somente do frame/câmera atuais. Um passe compartilhado se required; zero passe se nenhum campo visível. Cor HDR e depth usam a mesma resolução/viewport; VFX não descarta textura/target. Main passará o wrapper como consumidor opcional ao pipeline, que chama prepare antes do prepass e set após ele, antes da cor. Pausa dt=0 mantém câmera/depth atuais sem avançar o efeito. Reset/expiry deve invalidar depth e remover pedido; dispose é idempotente.

## Oclusores e paridade

Meshes visíveis, opacos com depthWrite, ou alphaTest recortado; respeitar side/map/alphaMap/alphaTest/clipping/skin/morph/instancing. Transparências parciais/fades excluídos conservadoramente; raízes VFX explícitas excluídas. Environment deve fornecer hook específico de cutaway compartilhando uniforms/patch de discard, sem copiar a pátina do material color. Combat consumirá `material.userData.bipxDepthAdapter(depthMaterial)` se essa assinatura servir ao adaptador; favor registrar assinatura definitiva no handoff. Não clonar onBeforeCompile inteiro.

Prepass preserva materiais/visibilidade, background/override, renderer target/cube face/mip, viewport/scissor/test, clear color/alpha, autoClear, clipping e sombras; finally também em erro. Target packed reutilizado/alocado somente na primeira necessidade; resize acompanha buffer. Stats públicos incluem passes/visíveis/draws/resolução e exclusões.

## QA antes da janela final

Bounded fixture com 0/1/4/8 campos, fora do frustum, low/reduced, pause/reset/expiry/dispose, resize/viewport, skin/instancing/cadáver clipping e cutaway próximo de árvores/ruínas. Medir GPU timer real no pipeline integrado, separar depth e total; fixture é declarada como tal. Depois partida real com cast por input e checkpoint/JEF atualizado. Não repetir suíte global enquanto o candidato estiver mudando.

### Implementação em andamento

Pipeline já aceita `render(scene,camera,dt,classSkillVfx)` e prepara/publica depth dentro do render antes da cor. Helper `src/render/scene-depth.js` possui target packed lazy, cache de materiais com remoção ao source dispose, restauração em finally e estatísticas. API definitiva Environment **aceita**: `shareEnvironmentCutawayDepth(colorMaterial,depthMaterial)` via opção `adaptDepthMaterial` em `createCinematicPipeline`. Li o candidato isolado e seus nove checks; aguardando promoção do dono para importar no main. O hook userData proposto acima é opcional, não exigido. Tentativa única de notificação terminal retornou `agent_prompt_stalled`; sem retry/fila/interrupt, este documento é a coordenação durável.

Ferramenta Combat em preparo: `tools/verify-scene-depth.mjs` + `tools/scene-depth-preview.html`, focada em restauração de renderer inclusive exceção, paridade pixel a pixel instanced cutaway/clipping, ciclo de vida e custo GPU do pipeline. Usa wrapper externo `tools/arpg-gpu-run.mjs`. VFX continua dono de seus testes/pool/arte; GPU sempre sequencial. API pool já detectada em runtime. Sem rodar captura antes de Environment pronto.

### Rodada isolada 01:19 UTC

`output/playwright/2026-09-19T01-18-59-413Z-verify-scene-depth/scene-depth-report.json`: 8 grupos passaram usando override **explicitamente staged** de Environment na cópia temporária; não é ainda prova de runtime promovido. Cutaway/clipping instanciado: 0 mismatches em cada imagem256x256 de quatro combinações. Estado de renderer/scene/oclusores intacto inclusive exceção; nebulosa invalida depth corretamente. Target/material cache estáveis em32renders, 0pass sem campos/fora do frustum, 1pass em1/4/8/overflow, resize640x360/near.3/far170, pause/reset/expiry/dispose. Prepass60draws neste cenário (sem sombras no passe depth), 17 meshes adaptados. Custo GPU ainda não rodado. Cinco PNGs/um vídeo fixture; inspeção one-high/eight-high mostra identidade forte, oito campos saturam composição ao se sobreporem, sem aceite artístico/AAA.

Rodada01:18:22 falhou por expectativa do harness: incluía a nebulosa entre meshes cuja visibilidade deveria permanecer após erro. O contrato exige escondê-la quando depth é invalidado. Corrigido filtro apenas das raízes explicitamente excluídas do prepass; renderer/oclusores continuam comparados integralmente. Nenhuma correção runtime para esse resultado. Evidência de falha preservada.

### Runtime ligado 01:22 UTC

Environment promoveu `environment-cutaway.js` e `asset-dressing.js`. Main agora importa `shareEnvironmentCutawayDepth` e passa ao pipeline como `adaptDepthMaterial`. Janela de edições Combat encerrada para primeiro candidato de QA, salvo defeito demonstrado; inicia rodada integrada com fontes reais e GPU timer sob lock. VFX pode usar sua fixture na próxima reserva livre; não editar shaders/pool durante captura sem registrar candidato alterado.

### Rodada integrada real01:20:58 UTC — 9/9 / fonte estável

`output/playwright/2026-09-19T01-20-58-659Z-verify-scene-depth/scene-depth-report.json`: sem override staged, 206 fontes atuais idênticas antes/depois. Todos os oito grupos anteriores + timer GPU passaram.14casos (0/1/4/8 campos high e low/reduced; depth separado quando há campos),24queries úteis por caso após6warmups, nenhum disjoint. Prepass60draws único, medianaGPU .491–.563ms, p95 .545–.640ms. Total high p95 por0/1/4/8:4.880/6.255/3.526/5.205ms; low/reduced3.205/3.946/4.898/4.682ms. A ordem sequencial/frequência dinâmica gera valores não monotônicos; não inferir custo marginal negativo ou benchmark FPS desses timers. Pior total observado6.305ms. Memória/material cache estáveis na janela; descarte idempotente de recursos próprios.

GPU própria liberada; VFX adquiriu próxima reserva01:21:21 para revisão específica. Depois Combat executará combos por input real, assertando depthValid/passe único/adapter presente nos frames de campo visível. Não repetir13grupos globais por esta mudança de apresentação. Servidor5173/PID97873 preservado.

### Gate visual retido — 01:21 VFX

Li `output/playwright/2026-09-19T01-21-21-154Z-gravity-vfx-integration/integration-report.json`: **FAILED fonte estável**, quatro campos cobrem torso abaixo do gate original. Contrato/pipeline9/9 não substitui esse gate artístico de oclusão. VFX está investigando; Combat retém gameplay/JEF final até o dono fechar refino. Não reduza threshold nem trate falha como aprovação. Ficam preservados todos os resultados; nenhuma nova edição pipeline/main enquanto não houver defeito desse escopo.

### Coordenação GUI painted-v3

Root autorizou painted-v3; GUI prepara seis WebP256px (143958bytes total), um stylesheet e link/classe no index, sem JS/input/core/tooltip/esferas. Próxima janela de escrita reservada à GUI **após VFX concluir o reteste de sobreposição**, antes da captura final Combat. CPU GUI pode seguir agora. Combat publicará aqui sinal explícito para promoção assim que o gate VFX passar; enquanto isso preservar runtime GUI. Não gravar index/assets durante a captura VFX em andamento, pois invalidaria o manifesto compartilhado.

### SINAL DE JANELA GUI — ABERTA 01:25 UTC

Reteste VFX `output/playwright/2026-09-19T01-23-55-190Z-gravity-vfx-integration/integration-report.json` **PASS/source stable**, sem relaxar gate65%; pior torso87.603% com8/overflow10 campos. GPU VFX liberada. **GUI pode promover AGORA** o escopo painted-v3 autorizado (seisWebP,stylesheet,link/classe), preservando JS/input/core/tooltips/esferas. Combat aguardará confirmação no handoff GUI para congelar o manifesto e rodar captura integrada atual. VFX preservar suas fontes liberadas; revisão de imagens/docs pode seguir. Nenhum GPU Combat até GUI promover.

### Ajuste de janela01:26 — reteste VFX por defeito de cache

VFX demonstrou câmera fora/volta sem tick manter slot escondido por cache; corrigiu somente invalidação e passouCPU11/11. Gate artístico01:23 permanece histórico válido para mesmos shaders; pool novo precisa bounded final. GPU VFX reservada01:26:48. **GUI aguardar a liberação dessa reserva antes de promover**; a autorização de escopo permanece. Manifesto/gameplay Combat somente após VFX fonte final e GUI promoção. Sem nova suíte global.

### Janela de correções confirmadas01:29 — antes da captura global

GUI painted-v3 já promovida/liberada,32/32checks em01:27:26. Reteste VFX01:26:48 concluído; aguardar handoff final. Root autorizou incorporar duas correções confirmadas antes do manifesto:

- **SFX aplicado por Combat ao main atual**: somente os hunks de `...01-23-35-639Z-audio-disconnect-lifecycle/combat-disconnect-proposal.patch`, `git apply --check` antes. Sem substituir main por cópia histórica. playing exige rede não suspensa; close limpa apresentação/reset de samples/VFX; snapshot removido cancela silenciosamente. Recurso/CD/sequence intactos. Smoke real `audio-reconnect-gameplay` após freeze. Ferramenta antiga de reprodução observed/proposed não deve ser confundida com teste do main corrigido.
- **ANIMATION — JANELA ABERTA AGORA para promoção exclusiva** `src/assets/hero-locomotion.js` df93d75c→07952bfc2e36dfed257a9f6f27dd582981c89a8dd2c791a92c1c1724be65f2b5, conforme review root01:22 e18casts. Dono Animation pode copiar seu candidato validado e publicar hash/pronto. Não alterar takes/GLBs/flags ou demais módulos. No-slide seguefalse; CPU da ré rápida permanece isolada. Combat aguarda sua promoção antes de capturar. Rede/movimento pós-colisão serão revalidados.
- Physics crowd candidato fica reservado à **fase posterior** de integração main/server, conforme root. Não promover durante esta janela de arte/SFX/continuidade.

### FREEZE integrado01:32 UTC

Animation07952bfc promovida pelo dono e confirmada em disco; GUI painted-v3/32checks pronta; VFX pool final01:26:48 PASS/source stable. Combat encerrou alterações main/pipeline (SFX fix e getter somente leitura de poses/movimento para QA remota). Iniciando provas finais sequenciais sob GPU lock; nenhuma promoção adicional nesta janela. Módulos/provas históricas preservados. No-slide/AAA não aprovados. Regressão SFX real primeiro, seguida depth/combos/movimento/rede; manifesto final após estabilidade confirmada. Qualquer defeito abre novo candidato explicitamente.

SFX smoke real01:32:23: `output/playwright/2026-09-19T01-32-23-124Z-audio-reconnect-gameplay/audio-reconnect-summary.json`, **23/23/sourceStable:true**. Dois clientes/browser/WebAudio reais, input de grito/campo e fechamento somente do socket. Owner para loops, peer remove campo, nenhum falso colapso, identidade/sequence/CD/recurso preservados, sem replay cast/release/impact nem ressuscitar campo. Não é escuta perceptual. Nova fonte main cce6025d com getter somente leitura e patch aplicado. Banco/assets SFX não mudaram.

### CHECKPOINT FECHADO01:46UTC

213fontes/18relatórios iguais, CPU13/13, depth9/9, SFX23/23, combos3, timeline12casts, rede e pós-colisão/natural60s concluídos. JEF realHTTP200 requires_further_work, nenhuma nota aceita. [Relatório](../jef-arpg-horizon.md). GPU própria liberada; próximos runtime edits apenas na janela [Physics](combat-crowd-integration.md). Arte Environment/VFX continua staging isolado.
