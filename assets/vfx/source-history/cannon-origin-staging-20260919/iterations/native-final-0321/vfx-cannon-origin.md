# Canhão — origem core/socket, CPU aceita; native pendente

**Candidato isolado, sem promoção.** Root aceitou às03:03 a resolução CPU da travessia e do aprisionamento; isso não aprova a aparência. Runtime Horizon/main/renderers/5173 permanecem fora desta edição. Fontes em `assets/vfx/source-history/cannon-origin-staging-20260919/`, derivadas do wrapper/composição02:27 preservado. Direção canônica incorporada: [skill-direction-v2.md](skill-direction-v2.md).

## API aceita para staging

[Contrato Combat](combat-cannon-visual-contract.md): extensão opcional `createClassSkillVfx({..., sweepVisual})`, callback `sweepVisual(from,to,radius,{skillId,castId,authorityY,phase}) -> null | {t}`. `t` finito em0..1, menor contato no segmento original; **t0 válido**. `null` significa livre; retorno indefinido/inválido/exception causa fallback. Não modifica dano, timers, eventos ou rede. OriginY1.05, colisão.32, explosão3.4 e tempo do core permanecem intactos.

Combat fornecerá a consulta na construção do wrapper quando houver autorização para integrar: menor t entre `sweepStatic` visual3D, o mesmo XZ em Y1.05 e `segmentCircleContact` dos monstros vivos elegíveis, somando.32 ao raio físico real. Excluir jogador/aliados/cadáveres. A implementação de fixture está em `tools/cannon-origin-vfx-sweep.mjs`, usa os dois solvers reais; não é novo solver nem wiring runtime. `presentClassSkill` já fornece emitter em cast/release, sem necessidade de deslocar travel.

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

## Próximo gate native

Ferramentas preparadas: `tools/cannon-origin-vfx-native.mjs` + `cannon-origin-vfx-preview.html`, reutilizando snapshot estável, servidor efêmero, browser/telemetria e reserva GPU atômica existentes. Sintaxe e geração do módulo contendo adapter literal verificadas em CPU. **Ainda não executadas em GPU.** Aguardar **liberação explícita Physics density143 e hash final do main publicado por Combat em `combat-cannon-visual-contract.md`**, depois da ordem `role=status` antes de `textContent`. Só então conferir hash e reservar GPU; lock livre sozinho não autoriza iniciar. Sem filas/retries/pergunta ao usuário. Reserva VFX não está ativa; CPU leve encerrada. A proposta separada de normalização HUD não integra essa janela automaticamente.

A/B usa os mesmos eventos reais do core, Lyra/socket animado, monstros/cenário/câmera e pipeline HDR+bloom/packed depth atuais. Baseline é volume02:27 sem bridge; candidato usa callback. Capturar release/voo parado e movendo, contato perto do cano, ruína, cancelamento, quina10Hz antes/durante/depois da descontinuidade, high/low/reduced. A ferramenta exige que a quina realmente exerça abandono; caso contrário não aprova essa cobertura. Nenhuma mesh de projétil externa ao wrapper.

Reconfirmar silhueta com o mesmo limiar65%, ROIs11×11 e RGB L1<65, fogo+Horizon+gelo e um depth. Contato/pose da nova fixture vêm do core atual, portanto não são o frame artificial02:27; não reusar sua margem0.289pp como prova atual. Inspecionar originais/playback para decidir se40ms de ocultação são perceptualmente aceitáveis. Essas capturas serão fixtures core+adapter; gameplay por input e integração final pertencem à janela Combat.

## Arquivos para futura integração

[Manifesto de preparação CPU com hashes](../../output/qa/vfx-cannon-origin-prepared-20260919.json): **oito arquivos VFX**, substituindo o plano anterior de sete apenas quando aprovado este candidato: `class-skill-vfx.js`, `cannon-vfx.js`, novo `cannon-origin-bridge.js`, `cannon-source-glsl.js`, `cannon-defaults.js`, `fire-noise.glsl.js`, `fire-common.glsl.js`, `fire-blackbody.glsl.js`. Não copiar a pasta inteira, que contém snapshots dos módulos vizinhos.

Além desses arquivos, Combat mantém ownership do callback/main; não há patch aplicado por VFX nesses arquivos. Shaders/máscara de composição02:27, radius/timing e shared depth permanecem iguais. Promoção depende de native/arte, gate65 e janela explícita Combat; este manifesto **não** é autorização de promoção.
