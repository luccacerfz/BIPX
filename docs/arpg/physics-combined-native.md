# Physics — combinado153: focal nativo concluído em nova cópia

**4/4 PASS, fontes congeladas e GPU liberada.** [Report nativo05:25:12](../../output/playwright/2026-09-19T05-25-12-057Z-physics-combined/report.json), [replay dos passos observados](../../output/playwright/2026-09-19T05-25-12-057Z-physics-combined/post-capture-audit.json), [recibo final e hashes](../../output/physics/combined-native-20260919/receipt.json). Snapshot novo229arquivos;226fontes live e226da cópia anterior reconferidas intactas. Sem promoção, escrita live ou restart nesta frente. A tentativa falha05:23 e todos os históricos permanecem preservados abaixo.

## Resultado funcional

| Caso | Resultado real observado | Planejamento |
|---|---|---|
| Norte fixo | Primeiro melee2.8483s, distância3.08760m,HP200→171.8948,LOS livre | 1plano/14nós |
| Sul fixo | Primeiro melee6.6675s, distância3.08584m,mesmo dano real/LOS livre | 4planos no percurso,máx74nós/um por tick |
| Norte móvel | WASD5.01844m,hit1.4934s; alvos novos planejados1.1461s e1.6112s | 3planos,novos2/1nós |
| Cripta por teclado | Entrada/soleira livres;W para em(12.3,-15.83499);S recua,A/D atravessam frente | 298segmentos varridos livres,Y0,nenhuma pose inválida |

Porta bloqueou avanço corporal.64 após1.1s deW mantido; sondas independentes do `sweepStatic` real identificam `crypt-entry-door` tanto para corpoY0/altura2 quanto linhaY.9. Não é teste de projétil lançado por input; essa coberturaCPU já pertence ao Environment. Zero errosJavaScript/HTTP nos quatro recortes; bosses visíveis e nenhum inimigo/ameaça invisível reportado. Dano/range/speed/raio originais preservados: boss3.073231m/s,r1.72,damage28.1052,melee3.10; jogador6.5m/s,r.64.

ReplayCPU pós-captura obrigatório: **1746ticks,1615segmentos livres,erro máximo0**, posições válidas em todos os passos; excesso voluntário≤2.50e-15m de ruído numérico. No móvel,39quadros recebem crowd, correção máxima.0183683m; input do jogador produz pico inicial.0375150m e final≤.001m. **Não se afirma zero sobreposição transitória.** Os27deslocamentos totais acima da velocidade de caminhada incluem essa correção e são explicados pelo replay exato. Nenhum dt foi injetado; o replay consome histórico real deRAF/input.

[Nove PNGs originais inspecionados e observações](../../output/playwright/2026-09-19T05-25-12-057Z-physics-combined/visual-review.json), quatroWebM preservados. Aproximações/melee mostram boss/Aldric visíveis; entrada/soleira/porta/saída da cripta observadas. O PNG sul captura texto−29 mas HUD ainda200; telemetria dehit e passos confirma171.8948. Não relabelar esse frame como atualizaçãoHUD imediata nem afirmar revisão contínua de vídeo/áudio/arte AAA.

## Fonte comum e todos os deltas

Node próprioPID58852/porta51043 importou exatamente a árvore servida ao browser; dez dependências transitivas conferidas contra manifesto. SHA HTTP/disco/importNode do layout **9f6ebea2041910f829042ec14f177cfb26beee44ebcd9e5f5c11333d0c9c486c**,153descritores. Como diagnosticado abaixo, os arrays não são binariamente idênticos entre engines: sete coordenadas legadas variam1–2ULP/máx7.11e-15m. Cada array completo/hash foi exigido **exatamente** contra sua referência por engine; nenhum novo campo divergente ou tolerância genérica. Fontes/harness constantes durante a captura.

| Delta contra live preparado | Antes → candidato |
|---|---|
| src/render/environment-layout.js | 8e756fe4/143 →9f6ebea2/153 |
| src/render/asset-dressing.js | 947c7cd9 →92ef51b5 |
| src/render/environment-library.js | 779302e4 →7664174b |
| src/render/cemetery.js | ef17cfbe →bc6732ab |
| assets/environment/crypt-entrance-v1/crypt-root-arch.glb | novo,c3a2e6f7 |
| assets/environment/crypt-entrance-v1/crypt-flagstone.glb | novo,b692a2db |
| assets/environment/crypt-entrance-v1/provenance.json | novo,f6a2b988 |
| src/physics/navigation.mjs | 911e0ea2 →e46cc63f |
| src/main.js | afc7d5ac →c0fbc03b,apenas adapterBloodCow |

Os sete primeiros são byte-idênticos ao payload Environment; nav é o candidato já selecionado e adapter é o patch mínimo sobre main atual. Hashes completos em [manifesto](../../output/physics/combined-native-20260919/manifest.json). Preservados: contacts912c00fe,server29bbf681,políticas multiplayer,styles385f8f9a,arte restante. **Aldric5c1903a0 atual** já estava no baseline, não é mudança deste lote. Contra o snapshot nativo anterior são oito deltas (seteEnvironment+Aldric0e5d→5c19), explicitados em [comparação entre cópias](../../output/physics/combined-native-20260919/previous-native-deltas.json). Não entrou Lich/Brute/candidatoVFX.

## Liberação e integração pelos donos

Ordem respeitada: GUI liberou05:21(`msg_831ea272729f`), Combat Lich liberou05:22(`msg_9451bf1ee3ca`), depois Physics adquiriu atomicamente seu token. Browser e servidor próprios encerrados emfinally; replay rodou antes de liberar a reserva. **Nenhuma próxima GPU/escrita runtime Physics prevista.** Combat recebeu marco de liberação `msg_ec96f0195334`; recibo comprova PID58852 ausente.5173continuaPID75665,ledgerSHA7f58079816e9b7f6506c77b236def2044925811a97a8f30eb533d9d319f4d333 inalterado na conferência final.

Entrega a Root/Combat para o lote coordenado: sete arquivos do payload Environment + nav e46cc + patch mínimoBloodCow, conferindo baseline atual antes de aplicação pelos donos. Não copiar snapshot inteiro; servidor deve carregar a mesma fonte na futura janela de integração/restart controlada por Combat. Esta execução não promoveu nada. API e patches permanecem congelados em [contrato terminal](physics-pursuit-terminal.md); compatibilidade com contacts912c demonstrada nesta cópia.

Escopo limitado: fixtures identificadas no jogo real/render/input, não partida natural, multiplayer completo, toda arena/horda, desempenho, mobile,soak ou no-slide/AAA. Não repetidos4plans/matriz72/density/captura artística. ServerBloodCow mantém ranged e sua política melee distinta; o adapter validado éoffline. Provas9e45/a5f4 anteriores continuam históricas; esta prova usa somente layout9f6e153.

---

# Histórico de preparação e diagnóstico

Autorização Root após seleção `review/physics-pursuit-native-selection.json`. Propriedade confirmada: somente novos tools/physics-combined-*, output/physics/combined-native-20260919 e documentos próprios. Snapshot anterior pursuit-native-20260919 e falha histórica preservados. Nenhum live/restart/Lich.

Proposta antes de editar: copiar jogo atual (Aldric5c1903a0), aplicar EXATAMENTE sete arquivos `output/environment/crypt-maintenance-combined-v1/payload`, navigatione46cc e adapter mínimo BloodCow sobre main atual. Contacts912c e servidor/políticas multiplayer preservados. Manifestar todos os deltas; cliente e processo Node próprio usam a mesma árvore153/layout9f6e. Não copiar snapshots Environment/Lich nem promover módulos.

Focal GPU estimado1–2min: duas origens BloodCow fixas já conhecidas, mais alvo móvel WASD com harness/replay corrigidos; cripta fechada por input real — aproximação/soleira livres, porta bloqueia, saída e travessia frontal. Posicionamentos iniciais identificados como fixtures; nenhum teleporte/waypoint/dt injetado durante as rotas. Sem4plans/matriz72/density/captura artística. Os oito grupos Environment já publicados são base, não serão repetidos.

Coordenação GPU pendente: respeitar Simulator GUI já preparado e Lich Combat. Preparação/cópia é independente de GPU. Não adquirir lock antes da ordem combinada. Runner terá mkdir atômico/owner/token e finalmente encerra apenas seus browser/servidor/token. Próximo lote live exige seleção, aplicação pelos donos dos sete arquivos+nav/adapter e restart somente Combat para descartar imports antigosNode; esta etapa não autoriza isso.

Preparação concluída05:07: nova árvore229arquivos, baseline226 atual/Aldric5c. Nove deltas exatos (seteEnvironment+nav+adapter), source live estável durante cópia; manifesto em `output/physics/combined-native-20260919/manifest.json`. Runner/fixture/auditor próprios com sintaxe válida; custo4plans removido. GUI possui lock ativo `gui-ios-safari-v1` desde05:03, portanto nenhuma captura Physics foi iniciada. Node--import na árvore própria e hash completo dos descritores no browser provarão fonte comum153, sem alterar servidor.

Ordem confirmada por Combat `msg_094ef2b8dda5`: GUI Simulator atual → um cast Lich normal/dois clientes (aprox15s+load) → Physics combinado. Preparação pronta; aguardando os dois recortes. A fonte comum será comprovada por SHA HTTP/disco e hash dos153descritores no browser e no processoNode, todos importando a mesma árvore própria.

Preflight de proveniência05:13: dez dependências locais transitivas do servidor correspondem ao manifesto candidato, nenhum caminho sai da cópia. O preload de QA registra esse grafo no processoNode efetivo; o browser compara SHA HTTP e hash dos153descritores. Hashes do próprio runner/fixture/auditor/preload/helpers serão registrados antes/depois. Servidor5173 permanecePID75665; ledger7f580798 inalterado. [Preflight](../../output/physics/combined-native-20260919/preflight.json).

Contra a native anterior a5f4 existem **oito deltas**: quatro módulos Environment, três arquivos novos da cripta e Aldric0e5d→5c19. Nav/adapter/contacts/server são idênticos aos da cópia anterior. [Diff de hashes entre as cópias](../../output/physics/combined-native-20260919/previous-native-deltas.json). Contra o live atual, os **nove deltas** são os sete arquivos Environment mais nav e adapter; Aldric já é5c no live e não é modificado por esta frente. Esta distinção impede atribuir prova antiga à arte atual ou omitir um delta do lote futuro.

## Casos focais preparados (resultados ainda pendentes)

| Caso | Entrada identificada | Evidência exigida |
|---|---|---|
| Norte fixo | BloodCow16.56428861789936,8.359204549834535; player18.933,14.268 | Caminho real, boss renderizado, redução real deHP com alcance3.10/LOS.9 |
| Sul fixo | BloodCow16.847589032244333,18.323203398288207; mesmo player | Mesmas origens efetivas preservadas, sem relocação aceita no setup |
| Norte móvel | Norte original;W450ms,WA420ms,A300ms após500ms | Alvo muda, planner recebe nova posição e replana; replay separa velocidade voluntária da correção crowd |
| Cripta input | Player12.3,-12.4;W→landing/Wcontra porta/S/A/D | Entrada/soleira e travessia frontal livres, porta bloqueia corpo.64 eLOS.9; swept volume corporalY0/altura2 |

Os setups posicionam apenas no início e suspendem waves/traps incidentais para isolar o caso. Daí em diante a simulação/RAF/render/input/caller são reais. Velocidades, raios, dano, alcance, HP,dt e políticas de combate não são modificados. A ausência de horda é explícita; o campo gravidade não é usado e sua expiração não exige nova prova. Não é partida natural nem prova de rede.

## Tentativa inicial preservada — binding numérico

A native05:23:10 abortou todos os cenários antes dos starts: hashJSON dos descritores Node580c0f1a versusChrome030a26c8, embora SHAHTTP/disco9f6e,153IDs e dez dependênciasNode fossem iguais. [Reportfalse original](../../output/playwright/2026-09-19T05-23-10-408Z-physics-combined/report.json), runners/preload originais arquivados junto. Fonte229/live226 estáveis, nenhum resultado funcional dessa tentativa.

[Diagnóstico isolado dos dois engines](../../output/physics/combined-native-20260919/layout-engine-diagnostic.json) reproduziu os mesmos hashes com o mesmo textoJS: somente sete coordenadasX/Z calculadas de elementos legados (tree-trunk-5,headstone-7/12/32,cross-1/20,lantern-6),1–2ULP/máximo7.105427357601002e-15m. Todos os outros campos/IDs/dimensões/yaw/flags são bit-idênticos; nenhum novo collider da cripta diverge. Comparação entre engines não é igualdade binária integral.

Harness corrigido exige móduloSHA idêntico, todos os descritores de cada engine exatamente iguais ao diagnóstico e registra sete diferenças explicitamente. Não usa arredondamento nem tolerância geral; candidato/runtime/raios/geometry intocados. Nova captura ainda necessária, preservando reportfalse anterior.

Avisos finais aceitos no mailbox: Combat`msg_3c7711c614dd`,Environment`msg_502aa9a01b40`; leitura/aceite final não presumidos. Root recebe o resultado por este handoff durável e recibo. Combat havia pedido preservação dosrawSHA/diffULP em`msg_1ebb95c30cb4`; a entrega atende esse recorte sem fabricar igualdade binária.
