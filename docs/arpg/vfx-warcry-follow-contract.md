# Grito selecionado — acompanhamento de preparação em cópia

## Integrado06:35; conferência independenteVFX06:36

Combat aplicou somente main`ebb8c9b2` e os9VFX autorizados. [ReciboCombat](../../output/warcry-moving-integration-v1/promotion.json) e [verificação independenteVFX](../../output/vfx-warcry-art-v1/art2-follow/integrated-verification.json):228 hashes em disco iguais ao recibo e10HTTP200 com SHA exato do manifesto final. GUIboss/server16ac/env153/GLBs/pipeline/contacts preservados nos228 arquivos. Ledger/PID semrestart atestados pelo reciboCombat; VFX não reiniciou5173 nem promoveu por conta própria.

**Fontes live e pacote congelados para checkpointJEF novo pelo Combat.** Nenhum cast/custo repetido. Limites de native/arte/rede/pausa-preparo e histórico de v2/v3 continuam explícitos abaixo. Critério globalAAA/no-slide não aprovado por esta entrega.


Root art2 selecionado em [review](review/warcry-art2-selection.md); contrato aceito Combat msg_08cc24754bdc. Fontes em [art2-follow/candidate](../../output/vfx-warcry-art-v1/art2-follow/candidate), [manifesto/hashes](../../output/vfx-warcry-art-v1/art2-follow/freeze-manifest.json) e [patch2arquivos](../../output/vfx-warcry-art-v1/art2-follow/warcry-follow.patch). Runtime intacto, sem promoção.

```js
const kept = classSkillVfx.updateCastTransform(castId, {
  origin: renderedRootWorldPosition,
  emitter: currentWeaponWorldPosition,
});
```

Retorna boolean; somente preparo já existente de warrior_war_cry. Não cria record, replay de cast/release, SFX/status, clocks, buff ou movimento físico. Aceita root/emissor world-space finitos; emissor explicitamente inválido rejeita tudo, sem alterar root. Se ausente, traduz o último offset pelo delta do root. Dados são copiados; buffers atualizados na chamada seguinte de VFX.update(dt). Local/remoto usam o mesmo contrato, sem serializar esse canal.

Combat mantém castId→ator aceito, coleta transformação após movimento/mixer/updateWorldMatrix, antes de VFX.update. Release/end/reset/desconexão retiram o acompanhamento; retornofalse permite retirar entradas obsoletas. Release retornafalse por definição: releaseOrigin copiada no evento real permanece fixa, mesmo que snapshots movam a aura. A API não autoriza reenviar eventos ou alterar core.

Dois arquivos mudam sobre composição-v3 congelada: novo warcry-vfx.js e class-skill-vfx.js. O wrapper foi adaptado sobre essa base, preservando fields.prepareSceneDepth→cannon.setGravityComposition→cannon.prepareSceneDepth e união de raízes com o grito. Shaders autoraisart2 byte-idênticos ao selecionado111e; só canal de transform e exposição de releaseOrigin nos stats. Pacote combinado tem9arquivos vs runtime atual; não copiar diretório nem wrapperhistórico.

## Verificação CPU concluída

[Relatório](../../output/vfx-warcry-art-v1/art2-follow/cpu-report.json) usa core atual e transform/socket idealizados, sem render ou input. Em6.5m/s, atraso máximo de preparo2.383333m→0 a60Hz e1.95m→0 a10Hz; parado0. Um cast/um release, nenhum impact fabricado; contadores de eventos, clocks e deduplicação não mudam pela API. ReleaseOrigin permanece constante enquanto ator continua andando; buff expira pelo core.

Passaram IDs local/remoto independentes, transforminválido atômico, fallback de emissor, low/reduced, pausa30updates, end/reset/dispose e convivência dos descritores de gravidade com a requisição compartilhada de depth. Prova CPU não substitui socket animado real nem gameplay.

## Histórico06:20 — gate então pendente

Combat prepara main em output/warcry-moving-integration-v1 sobre live226/mainaf0c/placa selecionada. Consumir estes dois arquivos junto da composição-v3 coerente, sem promoção. Depois cast real parado/movendo, socket, pausa/expiry e custo limitado do prepass; sem matrizglobal. OrdemGPU confirmada por Combat: peeroculto VFX concluído06:14 → Animationv12 → Brutev6. Nenhuma novaGPU VFX reservada. Main permanece propriedadeCombat.

## Gate nativo concluído06:31; seleção Root e integração autorizada06:34

[Relatório nativo](../../output/vfx-warcry-art-v1/art2-follow/native-2026-09-19T06-31-25-728Z/report.json), [análise dos dados](../../output/vfx-warcry-art-v1/art2-follow/native-2026-09-19T06-31-25-728Z/analysis.json) e [revisão dos nove PNGs originais](../../output/vfx-warcry-art-v1/art2-follow/native-2026-09-19T06-31-25-728Z/visual-review.json). Cópia privada do main Combat `ebb8c9b2` sobre suas226 fontes, mais pacote final9VFX; snapshot228 arquivos estável,9HTTP hashes exatos. Core `a863e12f` e assets reais preservados. Nenhum rig/material/target/cast/clock fabricado. Menu, tecla1 e movimentoD reais; observador somente lê o estado, timer envolve o renderer.render existente no target packed-depth.

| Caso | Frames preparo | Movimento no preparo | Erro root/socket | Drift da onda |
| --- | ---: | ---: | ---: | ---: |
| Parado high | 22 | 0m | 0/0m | 0m |
| Móvel high | 22 | 2.2737m | 0/0m | 0m |
| Móvel low/reduced | 21 | 2.28085m | 0/0m | 0m |

Cada caso teve um cast e um release, nenhum impact; pausa do buff250ms conserva clock/tempo. Ao expirar: buffnull, registro/instâncias/preparing registry0, sequence1, depthpasses0 e jogador ainda playing. Resource/CD/sequence validados pelo helper natural nos dois casos móveis. No parado, primeiroRAF já posterior ao input: preservada essa lacuna de snapshot anterior, sem atribuir a ele prova pareada de recurso. Pausa durante preparo permanece provaCPU; não foi repetida em nativo. Aldric real carregou transparent:false/depthWrite:true/opacity1.

Um prepass em todos os frames com grito visível; GL0/console0. EXT timer disponível,4warmups+12amostras por caso, nenhum disjoint. Medianas do **renderer.render dentro do depth**: .330250ms paradohigh, .304437ms móvelhigh, .4664165ms low/reduced. Resolução depth1440×900 high e1224×765 low. Não inclui preparaçãoCPU do passe, color/bloom, nem comparação pareada/FPS; diferença entre qualidades não é conclusão de performance.

Nove stills em resolução original mostram concentração junto a corpo/espada e release fixo no chão; sustain contido. Poeira permanece discreta e fitas ornamentais. Frames móveis de buff encontram copa recortada; não usar como prova global de silhueta. Portal azul é cenário. Três WebM reais entregues, sem alegar revisão perceptual contínua ou AAA. Sem repetir ROI/custo/peers de gravidade, sem atribuir esses gates a esta captura.

**Pacote congelado e liberado para integração mínima pelo Combat**, conforme seleção Root atual: [manifesto final9 e parents](../../output/vfx-warcry-art-v1/art2-follow/integration-manifest.json), [patch combinado](../../output/vfx-warcry-art-v1/art2-follow/combined-runtime.patch), [recibo final](../../output/vfx-warcry-art-v1/art2-follow/release-receipt.json). Patch aplicado em cópia temporária gera exatamente os9SHA. Wrappercdbdf764/warcry2cd4dc08 preservam Horizon9000/058f/c189 selecionado, sem wrapperhistórico. Aplicar somente9arquivos + mainmínimo pelo dono; preservar GUIboss/server16ac/env153/GLBs/ledger. VFX não fará escrita concorrente. HTTP pós-integração e checkpointJEF novo pertencem ao lote Combat, sem novo cast/custo.

GPU/browser/HTTP próprios encerrados06:31:59.270Z. Combat recebeu liberação `msg_611fb579376b` e pacote final `msg_ce000b4e70de`; Lichparede seguinte pode prosseguir.5173 não reiniciado por VFX. Runtime ainda não promovido por esta frente neste registro.
