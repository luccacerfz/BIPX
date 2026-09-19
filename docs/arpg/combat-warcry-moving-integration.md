# Grito em movimento e composição v3 — integrados

**Promovido em 2026-09-19, após direção explícita Root e gate nativo.** [Recibo completo](../../output/warcry-moving-integration-v1/promotion.json): exatamente dez deltas, main ebb8c9b2 e os nove arquivos do freeze art2-follow;228fontes conferidas, dezHTTP200 exatos. GUIboss/server16ac/layout153/GLBs/contacts/pipeline e ledger7f580798 intactos, PID5973 preservado, nenhumrestart.

[Native do dono](../../output/vfx-warcry-art-v1/art2-follow/native-2026-09-19T06-31-25-728Z/report.json), [auditoria Combat dos raws](../../output/warcry-moving-integration-v1/native-audit.json): parado/high, móvel/high, móvel/low-reduced;21–22framespreparo, lagroot/socket0, deslocamento2.274/2.281m, origemreleasefixa, umcast/release/end, pausa durantebuff e expiração, umdepth quando visível/zero depois. TemporizadorGPU mede **só passe depth**: quatro warmups/doze amostras porcaso; medianas aproximadas .330/.304/.466ms, sem disjoint. Não é custo total, comparação pareada ou FPS. Nenhum cast/custo repetido porCombat.

Dois casts móveis têm frames reais antes/depois e passam helperprodução de custo/CD/sequence; standing começa já depois do cast, portanto apenas relação exata100−24+regen8×tempo derivado deCD14, sequence1 e timings .38/.85 são conferidos. Auditor inicial assumiu frame precast para os três e falhou; registro preservado em audit-attempt-history.json. Sem baseline inventado. Pausa durantepreparo coberta apenas porCPU8 e CPUVFX; nativo pausa durantebuff.

Combat viu moving-prepare, moving-release e standing-buff originais: dourado acompanha corpo, onda legível no entorno e statusHUD visível; arcos geométricos/pose/encaixe fino ainda limitam acabamento. Sem aprovação AAA, no-slide, escuta ou vídeo contínuo.

Composição v3 foi selecionada porRoot após correção causal de peer oculto: [review](review/gravity-overlap-v2-selection.md). Provas1/8/custo anteriores são v2, peeroculto é v3 com Horizon/parede sintética. São relacionadas pelo patch; não são uma matriz v3 repetida. O smoke atual exercitou grito no wrapper combinado, não reaprovou toda coexistência.

Harnessexperimental Combat tools/verify-native.mjs foi preparado mas **nunca executado**; VFX já detinha recorte equivalente e evitamos duplicação. Próximo JEF real será separado dos históricos. Lich permanece cópia posterior.

## Histórico de implementação e CPU

# Preparo do grito em movimento — adapter em cópia

Root isolou atraso2.3833m ao correr6.5m/s durantepreparo. [Seleção e bloqueio](review/warcry-art2-selection.md). VFX propôs `updateCastTransform(castId,{origin,emitter})->boolean`: só registroexistente em preparo, sem criar cast/evento/clock/status; apósrelease retornafalse e não move releaseOrigin. Combat aceitou essa API; a proposta anterior `syncState.preparations` foi substituída antes de integração.

**Main pronto em cópia**, `output/warcry-moving-integration-v1`: baseline226 atual com placaGUI mainaf0c, server16ac/layout153/Dwarfdc. Somente main muda para **ebb8c9b2**. [Patch](../../output/warcry-moving-integration-v1/main.patch), [recibo/hashes](../../output/warcry-moving-integration-v1/main-receipt.json), [8gruposCPU](../../output/warcry-moving-integration-v1/cpu-main.json). Nenhum runtime/VFX/core/protocolo editado.

Registro visual nasce de evento cast aceito; duplicata não renova validade. Release/end/cancel retiram e aposentamcastId; morte/reset/desconexão limpam. O snapshot remoto não incluiactive: ator remoto é seguido pelo evento observado, e buffsnapshot confirma término sem fabricar prepare. Porframe, após movimento/mixers e antes VFX.update, root e weapon socket são amostrados por getWorldPosition. Semsocket, envia sóroot para fallback do pool. TTL usa tempo de simulação e conserva pausa.

CPU usa helpers literaismain, core real e matrizesThree reais com trajetórias de socket sintéticas:10/30/60Hz, atraso das chamadasroot/socket0; local/remoto; pause/expiry/death/disconnect; duplicate/release; socketausente; ordem doshooks. Eventos, recurso, CD e status são idênticos ao corecontrole. **CallbackVFX ainda é recorder**: isso não prova que o pool/shader mudou, nem comportamento nativo/rede/arte.

Próximo lote sóemcópia: receber payloadfinal VFX com essaAPI, conferir hashes/rebase do wrapper sobrecomposição selecionada sem trazer snapshotantigo, validar core+main+pool juntos e depois castrealparado/móvel, pausa/expiry e custo breve de depth. **Não promover art2 antes**. Fila vigente após Lich/GUI/VFXpeer/Animationv12 é SFXBrutev6; GPUCombat não reservada para esteharness ainda. JEF05:59 e runtime226 seguem preservados.
