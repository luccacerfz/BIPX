# Canhão — origem core/socket, native aceito para integração experimental

**Atualização Combat03:33:** callback conectado pelo dono no main `7bde570f`, contacts912c e oito VFX em222fontes; [recibo integrado](../../output/qa/arpg-cannon-density-integrated-20260919/integration-receipt.json). Fonte conferida e congelada para QA integrada. Referências abaixo a callback pendente descrevem a promoção VFX03:31; input/rede/JEF atuais seguem pendentes de evidência própria.


**Oito arquivos promovidos sob autorização Root/Combat; fonte congelada, callback pendente Combat.** [Recibo da promoção](../../output/qa/vfx-cannon-origin-promoted-20260919.json), concluído2026-09-19T03:31:48.987Z. Baseline preservado, oito hashes/sintaxe conferidos, somente os oito destinos previstos mudaram, lock próprio liberado. Main/renderers/Horizon vizinhos/5173 fora desta edição. Root aceitou às03:03 a resolução CPU da travessia e do aprisionamento; native03:21 e revisão local posterior aprovam apenas o escopo descrito abaixo. Fontes em `assets/vfx/source-history/cannon-origin-staging-20260919/`, derivadas do wrapper/composição02:27 preservado. Direção canônica incorporada: [skill-direction-v2.md](skill-direction-v2.md).

## API aceita para staging

[Contrato Combat](combat-cannon-visual-contract.md): extensão opcional `createClassSkillVfx({..., sweepVisual})`, callback `sweepVisual(from,to,radius,{skillId,castId,authorityY,phase}) -> null | {t}`. `t` finito em0..1, menor contato no segmento original; **t0 válido**. `null` significa livre; retorno indefinido/inválido/exception causa fallback. Não modifica dano, timers, eventos ou rede. OriginY1.05, colisão.32, explosão3.4 e tempo do core permanecem intactos.

Combat fornecerá a consulta na construção do wrapper após os recibos VFX/Physics: menor t entre `sweepStatic` visual3D, o mesmo XZ em Y1.05 e `segmentCircleContact` dos monstros vivos elegíveis, somando.32 ao raio físico real. Excluir jogador/aliados/cadáveres. A implementação de fixture está em `tools/cannon-origin-vfx-sweep.mjs`, usa os dois solvers reais; não é novo solver nem wiring runtime. `presentClassSkill` já fornece emitter em cast/release, sem necessidade de deslocar travel.

## Comportamento implementado

- Preflight no cast usa origem na altura canônica para suprimir preparo/flare quando o cano está obstruído. Release captura novamente origem e socket atuais; não reutiliza pose do aceite.
- Trecho core→socket livre permite iniciar corpo no cano e convergir ao caminho autoritativo nos primeiros `max(3.2,2*offset)` metros. Socket distante>3m ou payload antigo>250ms não autorizam offset.
- Consultar deslocamento lateral e ligação entre posições visuais, incluindo o último segmento de convergência quando um passo salta além de3.2m. Segmento terminal encerra no contato real.
- **Primeiro bloqueio abandona a ponte**, em vez de manter um corpo preso: `enabled=false`, `abandoned=true`, fallback `blocked-offset`, `blocked-segment` ou `blocked-terminal-link`. O segmento retornado é degenerado no endpoint autoritativo, `resetTrail=true`; todos os próximos travels usam autoridade sem offset. Gap>8m também abandona.
- O pool limpa histórico/resíduo do rastro, posiciona o corpo imediatamente na autoridade, interrompe flare remanescente e oculta corpo/chama de voo por **40ms de simulação**. Depois reaparece no trajeto real, sem desenhar ligação desconectada. Pausa congela o prazo. Não há explosão de fallback, dano ou contato inventado. Impacto continua exclusivamente no evento real, sem atraso.
- Stats por cast: `authorityPosition`, `originBridge.{enabled,launchBlocked,converging,abandoned,fallback,queries,errors,clipped,progress,settleDistance,source,socket,offset}`, `trailReset`, `bodyResumeIn`. `progress` registra o progresso da ponte enquanto ativa. Sem callback/socket: `missing-sweep`/`missing-socket`; consulta inválida: `invalid-sweep`. Wrapper não substitui silenciosamente um socket ausente antes dessa validação.

## Prova CPU atual

`node tools/cannon-origin-vfx-cpu.mjs`: **52 casos PASS**,13cenários×10/30/60/120Hz, [report03:04](../../output/qa/cannon-origin-vfx-2026-09-19T03-04-34-489Z-cpu.json), fonte estável. Usa core real e função literal `presentClassSkill` extraída do main; socket anteriormente capturado, com offset fixo aplicado ao ator. Não mede pose atual nem render.

Parado, movimento no preparo, alvo próximo, overlap t0, parede no cano/adiante, viga baixa, quina fina, cancelamento sem impacto, callback ausente/NaN/undefined e socket ausente. Eventos/dano/estado/alvos iguais ao baseline sem VFX; terminal no contato real, body não ocupa sólido, cleanup/reset/dispose. Na quina, exige ausência de travessia, desvio sem acúmulo, `resetTrail`, ocultação breve e endpoint igual à autoridade após abandono.

Auditor independente Root `node docs/arpg/review/cannon-bridge-contact-audit.mjs`: [confirmação Root03:03](../../output/qa/arpg-root-review/2026-09-19T03-03-25-075Z-cannon-bridge-contact.json) e [reexecução03:04](../../output/qa/arpg-root-review/2026-09-19T03-04-34-556Z-cannon-bridge-contact.json). **10/30/60/120Hz: crossing0, máximo1.587465m apenas no socket inicial, último travel não terminal com distância0.** Em10Hz o abandono ocorre no segmento problemático progress2.2→4.4. Autoridade continua livre e detona no mesmo contato final.

Histórico preservado: [02:51 travessia](../../output/qa/arpg-root-review/2026-09-19T02-51-12-406Z-cannon-bridge-contact.json); [02:58 sem travessia, mas16.96789m de aprisionamento](../../output/qa/arpg-root-review/2026-09-19T02-58-32-434Z-cannon-bridge-contact.json). Fontes anteriores em `iterations/pre-contact-fix-0251/` e `iterations/pre-abandon-fix-0258/`. A aprovação CPU inicial da primeira correção não cobre a regressão descoberta depois.

## Native03:21 concluído e revisado

[Report nativo](../../output/playwright/2026-09-19T03-21-25-047Z-cannon-origin-vfx-native/cannon-origin-report.json): **21capturas e dois playbacks RAF instrumentados**, contrato/gate65 PASS,215fontes e staging estáveis. Main congelado `f4dfc154d09ec8b0e8b8b3d78ea402037713d081f7d92575cc92988942ef72c2`; adapter literal `cd0b42e4186fc2200106a8ce1057c8e5f82941bc6a139fc5a6c8fe7dca3a3ec7`. Snapshot completo persistido em `assets/vfx/source-history/cannon-origin-staging-20260919/iterations/native-final-0321/snapshot/`; nenhum dado da prova passa a representar contacts posteriormente promovido. GPU/browser/servidor isolado encerrados.5173 preservado.

A/B com mesmo core/adapter literal, socket Lyra animado, câmera/assets/HDR+bloom atuais. Corpo e volume pertencem ao wrapper; nenhuma mesh auxiliar de projétil. No release parado, origem física(-2,1.05,5) e socket≈(-1.76134,1.76413,3.60247); corpo inicia exatamente no socket e converge à autoridade. Em movimento, release usa a posição atual do ator, sem arrastar o tiro depois. Near target e ruína próxima suprimem muzzle bloqueado e mantêm um único impacto real. Ruína adiante abandona offset. Cancelamento não fabrica impacto; reset/dispose encerram casts e depth.

Quina real do auditor com core10Hz: em.4 ponte ativa; em.5 `blocked-segment`, `resetTrail=true`, corpo oculto e endpoint igual à autoridade; em.55/.6 corpo visível no caminho autoritativo. Nenhum rastro longo ligado ao trecho abandonado. **Os40ms são prazo de simulação validado em CPU; os frames não cronometraram o conforto perceptual da transição em playback contínuo.** Os dois playbacks RAF da captura são parado/movendo,98samples/~1.617s cada; não cobrem a quina continuamente.

Coexistência fogo+Horizon+quatro congelados, um packed-depth: high e low/reduced têm frações de torso `[1,110/121,115/121,108/121]`, mínimo **89.256%**, limiar65/ROI11×11/RGB L1<65 preservados. Os statuses/field dessa cena são controlados pela fixture; não é trio de casts por input. Novo contato/poses/cena: esse resultado **não substitui65.289% da fixture02:27**, nem demonstra margem global.

[Revisão VFX e hashes](../../output/qa/vfx-cannon-native-review-20260919/review.json):13PNGs originais e seis frames selecionados decodificados do WebM existente, sem render adicional. Saída junto ao rifle, corpo low/reduced legível, silhuetas reconhecíveis; amostras pós-impacto mostram pluma irregular seguida de brasas. [Root](review/cannon-origin-native-followup.md) e [Combat](combat-cannon-native-review.md) aceitaram direção local para integração experimental. Nenhum aceite AAA, input/rede, escuta ou playback contínuo. Nenhuma nova medição de custoGPU; custo02:15 é histórico.

Tentativa03:19 preservada:404 do helper sob `/tools`, sem capturas; correção apenas no harness isolado copiou o helper para `/src`, sem abrir rota no servidor. Harness também usa castId único por setup para rearmar o gesto. Oito fontes candidatas seguem os mesmos hashes CPU03:04. Não repetir matriz staging sem mudança nova.

## Arquivos promovidos e ligação restante

[Manifesto de preparação native com hashes](../../output/qa/vfx-cannon-origin-prepared-20260919.json): **oito arquivos VFX**, substituindo o plano anterior de sete apenas quando aprovado este candidato: `class-skill-vfx.js`, `cannon-vfx.js`, novo `cannon-origin-bridge.js`, `cannon-source-glsl.js`, `cannon-defaults.js`, `fire-noise.glsl.js`, `fire-common.glsl.js`, `fire-blackbody.glsl.js`. Não copiar a pasta inteira, que contém snapshots dos módulos vizinhos.

Além desses arquivos, Combat mantém ownership do callback/main; não há patch aplicado por VFX nesses arquivos. Shaders/máscara de composição02:27, radius/timing e shared depth permanecem iguais. Native/arte/gate65 aceitos no escopo acima. Root e Combat abriram a janela coordenada para promover somente estes oito arquivos, serializando a escrita com Physics pelo lock. Callback/main continua exclusivamente Combat. Recibo/freeze publicados acima; callback/main sob Combat, input/rede/JEF permanecem gates posteriores.
