# Combat — lote visual compacto e Surface-life

Lote posterior ao checkpoint04:00, autorizado por Root em19/09. **GUI e Surface-life promovidos pelos donos, com fonte congelada.** Mainafc7d5ac, server29bbf681, contacts912c, navigation911e0 e layout143 permanecem congelados. Nenhuma promoção de layouta5f4/9e45, Brute, Lich, AldricOPAQUE ou candidatos VFX neste lote.

[Manifesto222fontes](../../output/qa/arpg-visual-polish-checkpoint-20260919/source-manifest.json) · [quatro deltas, HTTP e preservação](../../output/qa/arpg-visual-polish-checkpoint-20260919/source-audit.json) · [JEF04:26 e adendo](../jef-arpg-visual-polish.md).5173/PID75665 continua ligado, ledger7f580798 preservado, sem restart neste lote. Recarregar **http://localhost:5173/?offline=1** para os novos visuais.

## GUI compacta: integrada

Seleção Root: [`gui-compact-recovery-selection.json`](review/gui-compact-recovery-selection.json). Janela Combat por mailbox `msg_282c79ef47cd`; coordenação VFX `msg_16771a508fb9`; confirmação de uso do smoke do dono `msg_eddf59679114`. Não houve captura Combat concorrente ou repetição da matriz35.

GUI aplicou exatamente545bytes `00e53e45b8606e6ebdea29b70ad84a19067c83fbd754a2ef396c718c9cb390f8`, preservando o prefixo inteiro do stylesheet e adicionando uma newline. [Recibo](../../output/gui-compact-recovery-v1/promotion/2026-09-19T04-16-58-373Z/receipt.json), [diff](../../output/gui-compact-recovery-v1/promotion/2026-09-19T04-16-58-373Z/styles.patch). Styles final `385f8f9a101fdb55b2fffd0cc3b77b2613782789b9237bd39beacadbda9d3ab3`; nenhum JS/index/HUD/main foi modificado.

[QA focal do dono9/9](../../output/gui-compact-recovery-v1/promotion/2026-09-19T04-16-58-373Z/promotion-qa.json),222fontes estáveis durante a captura, sem page/console/HTTP errors. Cliente/servidor reais, sala privada com bloqueador sintético, CSS servido pelo runtime sem injeção; Chrome320×568 com toque emulado. Recusa autoritativa real → retry com `runStarted`, marcador limpo, posição CSS de sticky para static, dois orbs. HTTP5173 serviu os bytes promovidos sem restart.

Combat inspecionou os dois originais: [recusa320](../../output/gui-compact-recovery-v1/promotion/2026-09-19T04-16-58-373Z/integrated-rejected-320x568.png), [retry320](../../output/gui-compact-recovery-v1/promotion/2026-09-19T04-16-58-373Z/integrated-retry-320x568.png). Motivo e ação estão simultaneamente legíveis; som separado acima do formulário. Nome e seleção de Aldric mantidos. O status sticky cobre a parte superior dos retratos na posição focada do retry, compromisso já selecionado por Root; rolagem/teclado preservam acesso ao restante na prova staged35. Após retry, HUD e cena aparecem e a recusa desaparece.

Os testes staged de Voltar/reabrir, foco de cards e igualdade fora do breakpoint continuam históricos04:03; o smoke integrado04:16 só prova os9checks descritos. Não são teste de aparelho físico, teclado virtual, leitor de tela, zoom, escuta ou acessibilidade global. O comentário original “Staging only” foi preservado nos bytes selecionados para manter a identidade do candidato.

## Surface-life: integrado

Direção: [`surface-life-promotion-direction.json`](review/surface-life-promotion-direction.json). Janela Combat `msg_b84fb2bde97d`, VFX informado em `msg_0f66ce43ca8e`. Somente `src/render/asset-dressing.js`947c7cd9, `src/render/cemetery.js`ef17cfbe e `src/render/environment-composition-ground.js`3a8ca80f, com hashes completos em [manifesto selecionado](../../output/environment/surface-life-v1/selection-manifest.json).

Diff lido por Combat: chão recebe textura de pedra já existente por parâmetro, máscaras locais de terra/musgo/desgaste e variação de rugosidade/normal.14decorações existentes de raízes/cogumelos/roseiras/oferendas têm ajuste baixo sem collider; guard explícito proíbe override de sólido. Sem GLB, luz, material ou collider novo. O passe cutaway/depth permanece intocado. Custo adicional do sampler/shader não foi cronometrado e não herda o custo medido da versão anterior.

[Recibo04:23](../../output/environment/surface-life-promotion-20260919/2026-09-19T04-23-25-925Z/receipt.json) e [CPU6/6](../../output/environment/surface-life-promotion-20260919/2026-09-19T04-23-25-925Z/cpu.json) conferidos. Combat confirmou os três hashes e CSS385f8f9a por HTTP5173 e apenas esses quatro deltas entre222fontes. Layout, nav, core, servidor, pipeline, VFX, personagens e assets mantêm hashes anteriores.

Environment executou uma sequência curta de input real04:26, sem injeção de estado: Lyra saiu do spawn e alcançou(-6.532,-5.505), lançou gravidade ao jardim e esperou expirar. [Report nativo](../../output/playwright/environment-surface-life-integrated-20260919/surface-life-integrated.json), fonte atual222 exata, zero page/console/HTTP/request/GL errors.66props/46lotes/15materiais/30texturas e143colliders; campo ativo teve1passe compartilhado,17materiais adaptados e foco1; ao expirar, foco0/slots0/passes0. Não é medição do custo novo do shader ou natural60s.

Combat viu os originais [campo ativo](../../output/playwright/environment-surface-life-integrated-20260919/surface-life-integrated-garden-active-depth.png) e [expirado](../../output/playwright/environment-surface-life-integrated-20260919/surface-life-integrated-garden-expired-surface.png): chão mais quente discretamente junto ao jardim, heroína e contato visíveis, outline desaparece ao fim. O frame ativo é inicial e não aprova o corpo completo do Horizon ou a convivência com fogo. Pontilhado de copa, repetição e overlay de primeira instrução permanecem. A/B03:16 mantém seu escopo de fixture; esta sequência separada executa main atual e input real. Nenhuma captura Combat duplicada.

## Proveniência e contratos

Os17reports históricos do checkpoint04:00 seguem byte a byte intactos: [conferência](../../output/qa/arpg-contract-reconciliation-20260919/historical-preservation.json).14 usam main7bde e3 usam afc7, conforme proveniência original; os novos visuais não alteram essa atribuição. JEF04:00 permanece histórico. **JEF real04:26:51, HTTP200, `requires_further_work`,12notas aceitasnull, alvo10 e fullGoalCompletefalse.** Não foi executada nova suíte global.

[Adendo após envio](../../output/qa/arpg-visual-polish-checkpoint-20260919/post-submission-addendum.json): o report Environment04:26 foi lido depois da submissão. Corrige a ausência declarada no payload, sem modificar o JSON avaliado nem atribuir ao modelo essa prova não enviada. Também registra o novo [achado estático AldricBLEND](review/aldric-opaque-material-audit.md): corpo opaco não participa do depth por metadado transparente. Efeito visual ainda depende do A/B nativo do candidatoOPAQUE, isolado com VFX/Animation; original runtime preservado. Sem nova avaliação para inflar escore.

[Reconciliação da revisão23:27](combat-contract-reconciliation.md): emissor único GUI, timing autoritativo, sweeps com altura, dedup e suspensão/reconnect conferidos. Natural agora exige receipts/custo/CD reais:16CPU passaram, mas o runner mais forte não foi executado em browser. Essa rodada foi adiada antes de começar para priorizar as promoções visuais. Apresentação atual passou6CPU com funções literais do main. Não trocar essas provas por aceite artístico, no-slide ou teste físico.
