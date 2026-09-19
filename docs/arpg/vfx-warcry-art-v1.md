# Grito de guerra — art1 preservado, art2 em preparação isolada

## Integrado06:35; conferência independenteVFX06:36

Combat aplicou somente main`ebb8c9b2` e os9VFX autorizados. [ReciboCombat](../../output/warcry-moving-integration-v1/promotion.json) e [verificação independenteVFX](../../output/vfx-warcry-art-v1/art2-follow/integrated-verification.json):228 hashes em disco iguais ao recibo e10HTTP200 com SHA exato do manifesto final. GUIboss/server16ac/env153/GLBs/pipeline/contacts preservados nos228 arquivos. Ledger/PID semrestart atestados pelo reciboCombat; VFX não reiniciou5173 nem promoveu por conta própria.

**Fontes live e pacote congelados para checkpointJEF novo pelo Combat.** Nenhum cast/custo repetido. Limites de native/arte/rede/pausa-preparo e histórico de v2/v3 continuam explícitos abaixo. Critério globalAAA/no-slide não aprovado por esta entrega.


## Atual06:35 — grito móvel nativo3/3 e pacote final congelado

[Contrato/recibo e evidências atuais](vfx-warcry-follow-contract.md#gate-nativo-concluído0631-seleção-root-e-integração-autorizada0634). Root selecionou art2-follow + composição-v3 para integração mínima pelo Combat. Input real parado/high, móvel/high e móvel/low-reduced: root/socketlag0,2.27m durante preparo, onda fixa, pausa do buff/expiry/depth único passam. Shader artístico selecionado não mudou. GPU encerrada06:31:59; nenhuma nova captura. Manifesto9 + patch com parents/hashes congelados; manter fontes até Combat concluir. Sem promoção por VFX/AAA; revisão nativa anterior e limitações preservadas abaixo.


## Atual06:20 — art2 selecionado; lag de preparação corrigido em cópia

[SeleçãoRoot](review/warcry-art2-selection.md) incorporada, substituindo estado antigo “aguarda seleção”. Avanço incremental, não acabamentoAAA/final. [Contrato updateCastTransform aceitoCombat e fontes](vfx-warcry-follow-contract.md): dois arquivos adaptados sobre composição-v3, shader artístico111e preservado byte a byte, sem wrapper histórico sobreposto.

CPUcore atual10/60Hz confirma atraso2.3833m→0 no preparo andando6.5m/s, eventos/clocks/deduplicação intactos, onda fixa apósrelease, local/remoto/pausa/expiry/reset/reduced. Main em cópia peloCombat; castnativo com socketanimado e custo prepass ainda pendentes nesse candidato coerente. GPU VFX encerrada, filaAnimationv12→Brutev6. Nada promovido automaticamente.


## Atual05:49 — art2 capturado e revisado, GPU encerrada

[Quatro originais e relatório](../../output/vfx-warcry-art-v1/art2/native-2026-09-19T05-49-07-327Z/report.json), [revisão artística](../../output/vfx-warcry-art-v1/art2/native-2026-09-19T05-49-07-327Z/visual-review.json): high.22/.48/1.8 e low/reduced.48. Preparação agora mostra energia dourada concentrada junto ao tronco/arma na câmera ARPG; release ganhou pressão no chão e fitas curvas. Poeira ainda fraca e curvas algo simétricas/ornamentais; sustain1.8 continua discreto, próximo às faixas laterais do baseline. Portal azul é cenário. **Art2 entregue para seleção, sem aprovação final/AAA ou promoção.** Art1b preservado.

Aldric GLB exato5c1903a0 viaHTTP nas duas metades, uma requisição, sem clone/mutação: material transparent:false/depthWrite:true, corpo1draw no depth, um prepass. Gate65 inalterado: mínimo111/121=91.7355% no preparo; demais atores/fases121/121.1draw do pool,57.344bytes, preparo4/release27high ou11low/sustain6, fontes estáveis/zeroGL. Release observado.383333s pela amostragem60Hz do core.38; buff8s autoritativo. Sem custoGPU/claimFPS nesta rodada artística curta.

Warcry111e989b e wrappere0675bb0 congelados em art2/candidate; runtime intacto. WebM contém2sRAF e holds da captura, revisão contínua não alegada. Browser/HTTP/token próprios encerrados; recibo desativado. Animationv11/canopy anteriores já encerraram; mensagens antigas de espera abaixo são histórico.


**Preparo CPU05:28 encerrado:** art2pool111e989b/wrapper e0675bb0 inalterados. Runner/fixture preparados para GLB Aldric OPAQUE5c exato em ambos os painéis, sem mutação manual; flags reais/draw corporal/shared prepass serão registrados. Três fases high e release low/reduced, sem repetir diagnóstico Aldric. Sintaxe2PASS, nenhum native desta edição. [Recibo/hashes](../../output/qa/vfx-refinement-freeze-2026-09-19T05-28-38Z.json), [estado consolidado](vfx-v2-refinement-status.md). Ferramentas anteriores arquivadas em art2/iterations/pre-exact-aldric-harness. Nenhuma GPU antes de Combat encerrar combos/rede/natural e do focal prioritário composição.

**Decisão Root04:17: art1b NÃO selecionado como entrega artística final.** [Review](review/warcry-art1-native-review.json): preparação quase imperceptível, release sem força de expansão e aura1.8 pouco alterada. Fontes e provas históricas abaixo preservadas. O portal azul é cenário.

**Achado Root Aldric incorporado ao diagnóstico:** material0 BLEND com textura totalmente opaca impede participação corporal no depth. [Auditoria](review/aldric-opaque-material-audit.md). Fixture usa apenas overrideHTTP do GLB OPAQUE5c1903a0; flags vêm do loader real, material trocado na mesma malha/pose. Dois pares .22/.48 medirão os draws corporais efetivos no prepass, igualdade de todas as matrizes dos ossos e os mesmos cinco ROIs65. Não normaliza outros materiais nem altera GLB/rig/shareddepth/runtime. Hipótese de melhoria visual ainda pendente. Runner exige esses checks, não basta ausência de console errors.

Art2 começa em [`art2/decision.json`](../../output/vfx-warcry-art-v1/art2/decision.json), inicialmente cópia byte a byte de art1b. Diagnóstico bounded separa mesma geometria com depth normal, bypass somente de diagnóstico e ganho de material, antes de acrescentar partículas. A hipótese principal é largura/alpha/contraste insuficientes, sobretudo poeira escura; auto-oclusão ainda não isolada. Depois: concentração corporal, pressão/poeira breve ancorada no chão e trajetórias de release, mantendo8s contidos. Nada de mudança de timing/status/rig/SFX/autoridade. GPU somente após GUI545bytes + QA focal Combat; CPU preparado, nenhuma captura art2 ainda. Canhão/gravidade permanece próxima tarefa aberta.

Pedido incorporado: enriquecer `warrior_war_cry` com concentração no tronco/arma, release real.38s, onda breve de pressão/poeira e fitas/sparks; buff real8s contido e término legível. Gameplay, SFX, Animation/rig/material, eventos e fontes live permanecem congelados. Nenhuma promoção autorizada nesta entrega.

Diretório: [`output/vfx-warcry-art-v1/`](../../output/vfx-warcry-art-v1/). Baseline preserva as222fontes do lote integrado03:33, verificadas byte a byte, mais harness anterior e vídeo/telemetria real Aldric03:35. [Manifesto](../../output/vfx-warcry-art-v1/baseline/manifest.json). A alteração posterior de morte no main por Combat não é incorporada silenciosamente nessa baseline histórica.

Baseline atual inspecionada em oito frames originais extraídos do WebM de gameplay `combo-warrior-high`: preparo pouco evidente, release fino junto ao piso e aura dourada discreta. O portal azul anterior ao cast é cenário, não evidência do buff. Aldric, câmera ARPG e cemitério são reais. Frames selecionados não constituem revisão de playback contínuo nem aprovação artística.

Originais MIT preservados em `references/`: Linear `NeonTrailMaterial`8c377c88, HandCast `ChaosRibbonMaterial`3431252f e Samurai `BladeImpact`496862cd. [Hashes e commits](../../output/vfx-warcry-art-v1/references/provenance.json). O estudo adapta faixas afiladas, variação por semente e trajetória de sparks com arrasto; não substitui o rig nem duplica animação.

**Estado final art1b04:08:** módulo novo `candidate/warcry-vfx.js` conectado somente ao wrapper copiado. [Sete grupos CPU PASS finais](../../output/vfx-warcry-art-v1/cpu-2026-09-19T04-07-53-476Z.json): core literal10/60Hz, release sem buff fabricado, snapshots por ator/expiry, pausa, low/reduced, depth compartilhado/invalidação, pool32/overflow e reset/dispose. [Native oito A/B](../../output/vfx-warcry-art-v1/native-2026-09-19T04-07-53-675Z/report.json): fonte estável, zero erros/GL, depth real compartilhado. Os28módulos runtime VFX permanecem byte-idênticos. Art1a04:05 e fontes em `iterations/art1a/` preservados, rejeitados localmente por fitas quase invisíveis dentro do corpo. Art1b reposiciona a energia no contorno externo de Aldric2.7m, mantendo centro livre e raio3m.

Harness: `tools/warcry-art-vfx-preview.html` e runner `tools/warcry-art-vfx-native.mjs`; adapter literal, Aldric/cemitério reais e parâmetros ARPG48°/17m/20m/lookAhead2.6,1440×900 por painel. O socket é o capturado por cast/release no adapter atual, sem alegar seguimento contínuo dos ossos na preparação em movimento. GPU foi adquirida atomicamente após liberação Combat/Brute/Environment e liberada em finally. O diagnóstico perceptual do canhão foi encerrado antes desta captura: [resultado/limites](vfx-cannon-integrated-art.md). Nenhuma GPU/browser/servidor próprio ativo;5173 preservado.

## Arte antes/depois entregue

[Preparo.22](../../output/vfx-warcry-art-v1/native-2026-09-19T04-07-53-675Z/high-0.22.png) · [release.48](../../output/vfx-warcry-art-v1/native-2026-09-19T04-07-53-675Z/high-0.48.png) · [buff1.8](../../output/vfx-warcry-art-v1/native-2026-09-19T04-07-53-675Z/high-1.8.png) · [low/reduced release](../../output/vfx-warcry-art-v1/native-2026-09-19T04-07-53-675Z/low-reduced-0.48.png). Os oito PNGs originais, incluindo término8.5 nas duas qualidades, foram inspecionados. [Review, hashes e seis frames selecionados do WebM](../../output/vfx-warcry-art-v1/review.json). Playback RAF curto2s gravado; revisão por amostras, sem alegação de vídeo contínuo/gameplay.

Preparo ganhou linhas quentes concentrando junto ao torso/arma; release distingue fitas ascendentes, sparks e pressão breve até3m; sustain volta a duas faixas abertas laterais e poucos motes. Low/reduced preserva essas fases, reduz sparks e congela os deslocamentos decorativos de sustain. O buff ainda é discreto na câmera ampla e próximo da paleta dourada do personagem. As fitas longas do release podem ler como antenas; o término também continua sutil. **Art1b está pronto para julgamento, não selecionado automaticamente como solução final ou AAA.** Não alterar gestos do dono Animation para mascarar essas limitações.

Gate original65 sem afrouxamento, mesmas regiões121pixels/limiarRGB65 nos cinco atores: menor high76.033% e low/reduced75.207% no release; demais amostras100%. Isso sustenta só essas poses/câmera, não horda/global. Pool32atores,57.344bytes de atributos instanciados,1draw do grito; release27instâncias high/11low-reduced, sustain6/4. Usa1depth compartilhado real (54draws opacos nesta cena), **sem um segundo prepass**, mas a baseline de grito sozinha não solicitava depth: o custo adicional dessa solicitação precisa medição se a direção for selecionada. Nenhum benchmarkGPU/soak/mobile nesta etapa curta de arte.

## Contrato e freeze para Combat

Sem API nova obrigatória no main: `createClassSkillVfx` mantém `emit`, `syncState`, `update`, `reset`, `dispose`, `setQuality`, `setReducedMotion`, `prepareSceneDepth`, `setSceneDepth` e `getStats`. O wrapper copiado encaminha apenas `warrior_war_cry` ao novo pool; `syncState({buffs:[{id,position,remaining,duration}]})` conserva duração e posição autoritativas. O pool não inventa buff por release. `getStats().warcry` explicita capacidade, clocks, instâncias, depth, overflow e registros; `states.buffs` continua compatível. O depth agrega `warcryActors` e raízes de exclusão aos consumers atuais.

Possível lote futuro limitado a **dois arquivos**, não autorizado para promoção agora:

| Arquivo em candidate/ | SHA256 |
| --- | --- |
| `class-skill-vfx.js` | `e0675bb091e00008f9eb4e554e01197efcb45a8c7a428c83c30f9dc1e5eefd76` |
| `warcry-vfx.js` | `b1034c9048b8b59d1dc253c1a34be7805154b53b416a01f1511b7eb04c65aa51` |

[Recibo/fonte live preservada](../../output/vfx-warcry-art-v1/freeze-receipt.json). Cópia art1b/harness congelada em `iterations/art1b/`. Próximos gates após seleção: acabamento visual pendente, custo real do passe solicitado pelo grito, movimento/socket, convivência/horda e input/rede no lote do Combat. Não repetir suíte global antes de seleção nem promover pastas/snapshots.

## Diagnóstico Aldric04:34 encerrado; prioridade seguinte composição

[Cinco pares nativos e flags reais](../../output/vfx-warcry-art-v1/art2/diagnosis-2026-09-19T04-34-38-848Z/report.json), [revisão](../../output/vfx-warcry-art-v1/art2/diagnosis-2026-09-19T04-34-38-848Z/visual-review.json). Corpo0→1draw no depth, sem alteração de poses; mudança visual discreta. Art1 não selecionado, nenhum novo5pares inalterado. Animation promoveu metadataAldric5c separadamente04:52; snapshots originais continuam rotulados0e5.

[Composição fogo/campo](vfx-cannon-depth-composition.md) foi priorizada por Root e concluída como protótipo em cópia para revisão. Art2 continua somente preparaçãoCPU, candidato geométrico ainda art1b. Próxima mudança artística do grito deve usar diagnóstico de minificação/material/poeira já registrado, não adicionar contagens antes de corrigi-los. Nenhuma captura art2 adicional programada nesta janela; Physics→Lich têm prioridadeGPU.

## Art2 — implementação CPU05:13, sem captura nova

[Decisão/alterações e hash](../../output/vfx-warcry-art-v1/art2/decision-art2-geometry.json), [sete gruposCPU](../../output/vfx-warcry-art-v1/art2/cpu-2026-09-19T05-13-48-346Z.json). Apenas warcry-vfx.js mudou na cópia art2; art1b e cópia anterior do arquivo intactas. Concentração no tronco/arma com core menos afilado; pressão no plano do chão em vez de arco billboard; poeira acompanha frente eased com folga do chão; plumas seguem arcos radiais baixos, sustain duas fitas contidas. Capacidade32/umdraw/contagens por fase iguais. Core literal10/60Hz, buff8s/release.38, snapshots/pausa/lifecycle/depth passam nos escopos CPU existentes. Nenhum rig/asset/core/SFX/runtime alterado.

Material AldricOPAQUE será usado por identidade explícita no próximo recorte; rodada04:34 continua original/probe conforme seus reports. Não houve render de art2: legibilidade, silhueta/pressão/poeira reais e custo permanecem pendentes. Recibo de GPU antigo desativado para não reutilizar janela. Composição selecionada e prova focal GLB Dwarfdc0867da/custo1+8 continuam prioritárias após GUI Simulator/Physics/Lich.
