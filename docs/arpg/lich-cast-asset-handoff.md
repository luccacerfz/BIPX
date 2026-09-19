# Lich cast — apoio SFX, somente staging

2026-09-19, revisão encerrada após captura02:28UTC. **Staging preparado; nenhuma promoção runtime.** Perfil, marcador e socket conferidos por CPU, poses renderizadas e quadros de playback real da fixture. Isso não é gameplay, aceite AAA nem revisão perceptual contínua do vídeo. GPU própria liberada. SFX não operou o servidor5173; checagem final encontrou PID66986, atualização publicada pelo Combat no fechamento02:27UTC.

Ownership confirmado em `main`/base9124df5: SFX escreveu somente `output/lich-cast-v1`, `tools/lich-cast-review*` e este handoff. Animation mantém controller/assets runtime e heróis; Combat mantém autoridade/projétil. Nenhum arquivo de Animation, main, server, core, asset runtime ou áudio gerado foi modificado nesta tarefa. Sem novos agentes/interrupt/commit/merge/push/deploy.

## Entrega e procedência

[Staging](../../output/lich-cast-v1/) contém cópias byte-idênticas do candidato e Walker/Brute, loader próprio, perfil, patch revisável contra o loader runtime, fontes/procedência e históricos. [Preservação inicial](../../output/lich-cast-v1/preservation.json), [verificação final](../../output/lich-cast-v1/verification.json) e [hashes de entrega](../../output/lich-cast-v1/delivery-hashes.json) distinguem a versão inicial da correção final.

| Arquivo | SHA256 |
| --- | --- |
| Candidato original `/tmp/bipx-caster-motion/lich/artifacts/monster-gesture.glb` e cópia `assets/lich.glb` | `d47d9a13ab7d3df9b1df1018735d56075fdedeb32b266c3ffcb9d3ca3a576599` |
| Lich runtime preservado | `f6ddd47d97757b4acee76c056baa26c644ff19e2afa17fb5630b00108e832e44` |
| Walker runtime e cópia | `91c975ebfef06f38239a7e5f3258c8ac545340dc217b625f6488fe01cc745b2c` |
| Brute runtime e cópia | `d1d58b1ae86045d9fa39dba9b4e87a0bd6d1a66b347d74624cf8095ce208c02a` |
| Loader runtime original | `e9aba8f36516d25e3e527b226b585803f66adcb8bd41ccf259bc16bbe9822ae7` |
| Loader final **staged** | `0896ad9c5f80bfabcff6e2c0c004e8d838a43e85dd80c7ea01ed17c2f442579f` |
| Perfil staged | `4c21be8e7f9d50b9ec1677bb82eada81c5748edbbacc6b0ce67c729ccea4c820` |
| Patch staged | `c60d1a27f327ee7bd3593cb5ee831575b8fbe4667e7caf910c4c00b2604f3cda` |

Origem local Mixamo: `/Users/luccacerf/Projetos/Assets/Characters/Arthas/Animations/Mixamo_GreatSword/spell cast.fbx`, SHA `8a2f28f2911f60b8456cbbc2bf2f572e091b932b9d01cf13d799f87a9b734090`. Conversão GLB histórica SHA `5854815eae340b321516b073b0f5179de8157cb2d50d3c16b06022508c31bf58`, relatório Blender5.2 e retarget preservados em `provenance/`. Não houve nova geração/download nem reexport do GLB. A procedência remota/licença não foi auditada novamente.

Comparação nova confirmou nodes/skins/meshes/materials/images/textures/samplers iguais, prefixo binário original de1.312.604bytes intacto e outros quatro clips idênticos. Candidato tem24canais Attack. Isso complementa, sem substituir, [a auditoria Root](review/lich-integration-findings.md).

## Perfil/timing/socket

[Perfil concreto](../../output/lich-cast-v1/lich-cast-profile.js), ID `lich-mixamo-cast-v1`, somente Lich. `Attack` índice3 inteiro, **1.1666666269302368s**, sem slice. Walker continua1/3→5/3s; Brute não recebe este perfil. `bipxPrototypeMotion` continua intocado; não foi renomeado para ativar a ramificação Walker.

| Parâmetro | Valor |
| --- | --- |
| Duração visual | 1.10s |
| Fase release | 19/35 = 0.5428571428571428 |
| Release retimado | **0.5971428571428572s** |
| Instante no clip fonte | 0.6333333117621286s |
| Razão fonte/retimado | 1.0606060244820334 |
| Socket | bone real `L_Hand`, sem offset adicional |
| Blend de entrada / retorno | 0.065s / 0.10s para Idle ou locomotion |

Marcador **coerente com a extensão da mão esquerda**, confirmado nas poses e no quadro próximo ao release do playback. Pico de avanço amostrado a120Hz:0.600s; não é uma otimização subframe independente. Em ator de3m, origem0/yaw0/facing-Z, socket no release `[0.3033525304, 2.0094830799, -1.1178119949]`m; em yawπ, X/Z invertem. Estes números são medição da fixture, **não origem de colisão fixa**. Consultar a matriz mundial atual do bone a cada release. Esfera verde é marcador de debug, não prop/VFX final.

O campo `status` do perfil preserva o texto inicial `staging; visual review pending` para manter o hash efetivamente capturado. O resultado de revisão vigente está em `verification.json`/neste handoff: marcador conferido, promoção runtime e aceite artístico pendentes.

## API da cópia e cancelamento visual

```js
const library = await loadMonsterLibrary({ THREE });
const actor = library.create('lich', { parent: scene });
actor.cast({ castId, sequence, elapsed, duration: 1.10 });
// Alternativa inicial: ageMs; elapsed tem precedência.
actor.update(dt, { attack: { id: castId, sequence, elapsed, active: true } });
actor.root.updateMatrixWorld(true);
actor.castSocket.getWorldPosition(worldPosition);
actor.cancelCast('freeze');
actor.update(dt, { freezeTimer: remaining });
// stunTimer/dead também cancelam; paused:true só segura a pose.
actor.reset(); // nova vida/identidade, limpa dedup visual
actor.dispose(); // remove actor e recursos próprios
```

`cast` retorna aceitação visual; `syncAttack` recebe id/sequence/elapsed/duration/active. Updates posteriores do mesmo cast usam idade crescente; antigos não rebobinam, cancelados/concluídos não reiniciam. `stats.attack` expõe elapsed/normalizedTime/clipTime/impactReached/cancelReason/startCount. **impactReached é apenas marcador visual**, sem callback, disparo, dano ou som. Perfil não emite projétil.

Freeze/stun cancelam o cast e seguram a pose durante controle; ao sair, mistura para Idle sem retomar o cast cancelado. Morte cancela; `cancelCast('removal')` encerra explicitamente antes da remoção. Pausa geral preserva idade. Previsão local limita dt a0.1s; após atraso longo o integrador deve fornecer elapsed autoritativo, inclusive fim/cancelamento. Não usar essa previsão como relógio do servidor.

Antes do release, o futuro Combat precisa cancelar também o projétil pendente. Depois do release, este controller pode encerrar somente o gesto; um projétil já emitido continua sob simulação Combat. A fixture não contém projéteis, portanto não prova emissão única, dano, LOS ou preservação de projétil após morte. O [contrato Combat](lich-cast-contract.md) segue pendente de implementação/teste de autoridade, snapshots, dois clientes, latejoin e reconnect.

## QA e defeito corrigido

[CPU final02:27:46](../../output/lich-cast-v1/cpu-2026-09-19T02-27-46-139Z/report.json): **215asserções**, sendo34de comportamento/perfil e181amostras de geometria skinned; não são215cenários independentes. Full clip/socket, limites exatos do marcador, duplicatas, fases de freeze/stun, morte/removal, pausa, idade remota, snapshots obsoletos, dt longo/resync e regressão de reutilização.11.173vértices,7.148triângulos,41bones/1skinned mesh. Todos finitos.

[Native final02:28:07](../../output/lich-cast-v1/native-2026-09-19T02-28-07-583Z/report.json): Chrome headless/WebGL real, ANGLE Metal AppleM5Pro,1280×800. **8playbacks/945frames de telemetria,16poses amostradas**, sem erro de página/WebGL; fontes estáveis. Close: full/cancel-before/cancel-after/freeze-before/stun-after; ARPG: full/cancel-before/cancel-after. Cada playback terminou em Idle, startCount1, sem retomada. O release das poses close/ARPG coincide com o socket CPU (erro<1e-6m).

Defeito preservado na captura02:26:37: o harness marcou execução técnica PASS, mas as poses close posteriores a stun/reset exibiram T-pose. **Essa captura não foi aceita visualmente.** Fade de duração0 ao aplicar idade remota podia deixar peso nulo até o mixer avançar. Correção só na cópia Lich: `stopFading().setEffectiveWeight(1)` para transição imediata. Regressão CPU e nova captura confirmam mão/pose restauradas. Loader/ferramentas anteriores estão em `source-history/`; não sobrescrever provas históricas.

## Revisão visual e limites

Vídeo contínuo real da fixture: [WebM17.76s](../../output/lich-cast-v1/native-2026-09-19T02-28-07-583Z/video/page@e09b493609aa6934decddb79c61dec8c.webm). Inspeção nesta sessão foi de poses independentes e **quadros extraídos desse playback**, não escuta nem visualização perceptual contínua do vídeo. [Sequência close](../../output/lich-cast-v1/native-2026-09-19T02-28-07-583Z/playback-close-contact-sheet.png), [controles](../../output/lich-cast-v1/native-2026-09-19T02-28-07-583Z/playback-controls-contact-sheet.png), [ARPG](../../output/lich-cast-v1/native-2026-09-19T02-28-07-583Z/playback-arpg-contact-sheet.png), [pose release](../../output/lich-cast-v1/native-2026-09-19T02-28-07-583Z/close-0.597143.png).

- Close: preparo com braços recolhidos, abertura de base, mão esquerda avançando e direita apoiando a silhueta; palma corresponde ao socket. Chifres/crânio/ombros/ornamentos e tecido mantêm-se ligados nas imagens revistas; não observei vértices explodidos ou partes destacadas. Não existe cajado/arma separada nesta cópia; nenhuma prop foi adicionada. Isso não certifica todas as interpenetrações ou grip.
- Recovery: clip recua a mão e retorna à pose original; blend para Idle completa rapidamente após1.10s. A mudança de base dos pés é visível. **Não declarar peso/foot-plant/no-slide aprovados.** Geometria inteira atingiu Y=-0.0057794m aos0.225s; correção vertical máxima do loader0.0594972m. Não alterei GLB/ground probes para esconder esse limite.
- ARPG: FOV48°, câmera(0,17,20), ator yawπ; dimensões derivadas da configuração desktop, alvo central simplificado, sem look-ahead/crowd/ambiente. A silhueta muda, mas mão/dedos ficam pequenos; alcance do gesto não equivale à legibilidade de um disparo em partida. Nenhuma conclusão de telegraph/feel/AAA10.
- Freeze antes do marcador mantém pose de preparo e depois retorna; stun após marcador mantém pose avançada e depois retorna. Cancelamento explícito antes/depois também retorna; vídeos não provam autoridade nem a sobrevivência de projétil emitido.

## Reprodução/liberação

`node tools/lich-cast-review-run.mjs` executa CPU sem WebGL. `node tools/lich-cast-review-run.mjs --gpu` exige e reserva atomicamente `/tmp/bipx-arpg-gpu.lock`; se ocupado, retorna GPU_BUSY, sem tocar o dono. Usa servidor HTTP próprio efêmero e fecha somente seus processos. `python3 tools/lich-cast-review-report.py` verifica os relatórios selecionados, hashes/bytes/poses/lifecycle e gera manifesto. O preparador recusa sobrescrever staging existente.

**Fontes de staging liberadas para revisão**, próximas escritas SFX previstas: nenhuma. Combat/Animation devem consumir o perfil/patch explicitamente em futura janela autorizada, sem copiar o loader inteiro sobre runtime concorrente. Autoridade/protocolo/gameplay e revisão humana contínua continuam gates separados.5173 foi observado inicialmente em PID97873 e, no fechamento, em PID66986 após atualização documentada pelo Combat; nenhuma operação SFX sobre esse servidor. Lock SFX removido após cada captura somente por token próprio.
