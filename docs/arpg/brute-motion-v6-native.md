# Brute v6 — revisão nativa de handoff-01

**Concluída e congelada.** Quatro playbacks nativos completos1,45s a1×, duas variantes×duas câmeras, alvos fixos1,89m;28poses separadas e32quadros extraídos dos vídeos. Zeroerros,379fontes estáveis. **GPU/browser/HTTP próprios encerrados06:20:55Z; nenhuma próxima captura planejada.** Direção de carga/silhueta mais legível, mas peso/impacto ainda não aprovados; sem seleção de marker ou promoção.5173 PID5973 preservado. [Vídeos para revisão](../../output/brute-motion-v6/native-2026-09-19T06-20-35-020Z/review.html).

Preparação em 2026-09-19T06:20Z. Autorização Root: somente os dois GLBs congelados de [handoff-01](../../output/brute-motion-v6/handoff-01/attack-profiles.json), clips completos de 1,45 s a 1×, alvos imóveis a 1,89 m, câmera próxima 3/4 e ARPG. Sem alteração de poses, rig, alvo, range, marker, runtime ou autoridade. A entrega [CPU v6](brute-motion-v6.md) e seus 267 arquivos continuam congelados; esta prova usa arquivos novos.

Ordem autorizada: VFX peer-oculto → Animation v12 após correção dt0 → Brute v6. VFX publicou encerramento06:16. Animation começou06:17:46, PID42219. Nesse checkpoint esta frente preparava somente CPU e aguardava encerramento real; o runner exige evidências de ambas as liberações e usa mkdir atômico sem remover lock alheio. Combat recebe este handoff; sua fila cheia não será usada.

## Fixture e proveniência

| Variante | Brute SHA-256 | Alvo nativo |
|---|---|---|
| Aldric | `6ee3788bcc15a77b8742e394d755e9e0722e274dccdc016450e7e406650a28d1` | `5c1903a064decbcee1d018df4f6ee595e826640a0ccb9b40538efe5aef70f996` |
| Lyra | `6feed18b7612c642f4862a9b006ed577139327d2e13f475046d8843e9f8628ac` | `dc0867dacd22b04e42475a686fffe808ad8c7e66e9889b2a182eb4393eb5378e` |

CPU histórico de Lyra: `e11eadb8b428ad46332b0f70bc2db3459628775b65cbb101886cd46fdcd643b0`. O novo nativo usa a cópia dc de material OPAQUE. [Linhagem verificada](../../output/brute-motion-v6/dwarf-current-lineage.json): BIN idêntico, única diferença JSON no alphaMode de um material. Nenhuma prova histórica é reatribuída.

GLTFLoader real, texturas/materiais originais; `Attack` inteiro por nome, sem slice Walker. Idle0 dos heróis com createHeroLocomotion runtime07952 e probes reais; normalização Brute3,30m, Aldric2,70m, Lyra2,55m. Não há atualização temporal dos alvos. Transformação rígida comum coloca jogador no centro e Brute à frente; distância canônica permanece1,89m. Próxima: câmera(5,3.7,5), mira(0,1.45,-.945), FOV40. ARPG: câmera(0,17,20), mira(0,1.2,-2.6), FOV48, viewport1440×900. Iluminação de fixture, sem pós-processamento/gameplay.

[Preflight CPU](../../output/brute-motion-v6/native-preparation/cpu-preflight.json) PASS: 267 arquivos congelados íntegros; alvos desvio máximo9.16e−8m; Brute nos11tempos/variante≤.46184mm (interpolação+probes); reprodução incremental60Hz alcança o mesmo quadro terminal. Nenhuma GPU nesta prova CPU.

Harness novo: `tools/brute-motion-review-v6-native{,-scene,-preflight}.mjs` e `tools/brute-motion-review-v6-native.html`. Cada captura inclui .35s de entrada em Idle0, Attack inteiro1,45s a1× e .35s de pose terminal. MediaRecorder do canvas grava os frames do navegador. As sete poses buscadas separadamente por câmera serão rotuladas como amostras, não playback. Servidor HTTP efêmero próprio e Chrome/Metal próprios, encerrados com token próprio em finally.5173 não será operado.

## Limites preservados

`contactAt:null`; .70s continua somente intenção do storyboard, não marker selecionado nem evento de dano. Negativo1,82m continua demonstrando interpenetração da guarda com os mesmos clips. O dano imediato e duração legada.55s exigem futura decisão de Combat, não retiming aqui. A CPU ainda registra folga curta da alça Lyra, interseções herdadas antebraço/peito e novos pares no início/fim, além de proxy de equilíbrio sem validação física. A captura julgará guarda/ombreira/passo/carga/recuperação, sem promoção ou notaAAA por estrutura.

Estado06:20:55Z: captura encerrada, quatro playbacks e28poses; zeroerros/sourceStable. Browser, HTTP efêmero e token próprios encerrados. Nenhuma próxima GPU desta frente. Inspeção posterior somente CPU concluída, conforme parecer abaixo. [Sinal e checagem](../../output/brute-motion-v6/gpu-native-window.json); [report original](../../output/brute-motion-v6/native-2026-09-19T06-20-35-020Z/report.json).

## Resultado nativo e materiais de revisão

Chrome/ANGLE Metal, AppleM5Pro, WebGLerror0. Cada vídeo VP9 contém129quadros1440×900; cada ataque registrou87framesRAF, intervalo máximo16,8ms, idade final1,45s e correspondência1× com relógio real. Sem slice/slowmotion/retiming. [Dados de extração e timing](../../output/brute-motion-v6/native-2026-09-19T06-20-35-020Z/playback-extraction.json). Os arquivos WebM são gravações reais do canvas; as folhas derivam desses arquivos, não de seeks sintéticos.

| Variante/câmera | Playback integral1× | Quadros extraídos |
|---|---|---|
| Aldric3/4 | [WebM](../../output/brute-motion-v6/native-2026-09-19T06-20-35-020Z/warrior-threequarter-playback-1x.webm) | [Folha](../../output/brute-motion-v6/native-2026-09-19T06-20-35-020Z/warrior-threequarter-recorded-playback-sheet.png) |
| AldricARPG | [WebM](../../output/brute-motion-v6/native-2026-09-19T06-20-35-020Z/warrior-arpg-playback-1x.webm) | [Folha](../../output/brute-motion-v6/native-2026-09-19T06-20-35-020Z/warrior-arpg-recorded-playback-sheet.png) |
| Lyra3/4 | [WebM](../../output/brute-motion-v6/native-2026-09-19T06-20-35-020Z/dwarf-threequarter-playback-1x.webm) | [Folha](../../output/brute-motion-v6/native-2026-09-19T06-20-35-020Z/dwarf-threequarter-recorded-playback-sheet.png) |
| LyraARPG | [WebM](../../output/brute-motion-v6/native-2026-09-19T06-20-35-020Z/dwarf-arpg-playback-1x.webm) | [Folha](../../output/brute-motion-v6/native-2026-09-19T06-20-35-020Z/dwarf-arpg-recorded-playback-sheet.png) |

Folhas usam recortes diagnósticos da mesma câmera; ARPG conserva os pixels originais sem ampliação. Tempo dos quadros = PTS do vídeo menos.35s de entrada, aproximação sujeita ao alinhamento encoder/RAF; não é testemunha precisa de marker. Os28PNGs `sample-*` são poses buscadas separadamente e estão explicitamente rotulados; não confundir com os32quadros extraídos dos WebM. Nenhuma mudança de câmera/GLB/rig/alvo foi feita durante cada playback.

Paridade browser/CPU no quadro.70: Brute≤2,814e−6m após probes; todos os meshes dos heróis≤9,43e−16m. As requisições dos quatro GLBs, bytes/SHA e fonte dos probes estão no report. Targets ficaram a1,89m em todos os frames; nenhuma correção para aproximá-los à mão. Diferença máxima dos joints monitorados entre primeiro e último quadro≤1,679e−7m.

## Parecer artístico delimitado

[Registro de inspeção](../../output/brute-motion-v6/native-2026-09-19T06-20-35-020Z/visual-review.json): nove imagens originais abertas em resolução nativa e quatro folhas com32quadros gravados. Os quatro vídeos1× estão entregues; esta inspeção de quadros/telemetria não é alegação de avaliação perceptual contínua completa do vídeo.

| Aspecto | Observação nas provas | Decisão desta frente |
|---|---|---|
| Guarda/encontro | Aldric: escudo/cabeça escondem parte da mão. Lyra: cabeça/rifle ocultam o encontro na mão/antebraço. O arco termina no conjunto correto segundo a paridade, porém a câmera não evidencia a primeira superfície. | Encaixe geométrico mantido; contato visual não aprovado. Nenhum marker escolhido. |
| Ombreiras/torso | Silhueta alta e volumes das placas se mantêm nas imagens, sem o colapso agachado v4. Região antebraço/peito e bordas ocultas continuam limitadas pelos crossings CPU conhecidos. | Melhora de postura; não declarar malha sem interseção. |
| Passo/carga | Inclinação lateral e mão elevada distinguem o preparo. O passo existe, mas base compacta e alvo sobreposto tornam a transferência discreta. A descida.58→.70 continua curta e dominada pelo braço na silhueta. | Peso de pancada pesada ainda não aprovado; não resolver com compressão temporal. |
| Recuperação | Sequência.82→1.05→fim retorna ereta, sem o retorno contorcido evidente da v4 nos quadros inspecionados; joints fecham no Idle0. | Continuidade estrutural demonstrada; fluidez perceptual/balanço físico não aprovados por isso. |
| CâmeraARPG | A armação lateral é identificável; encontro e pernas ficam pequenos/ocultos atrás do jogador no enquadramento real. | Leitura do preparo melhor que a do impacto; não ampliar imagens para declarar legibilidade no tamanho de jogo. |

Fixture mantém alvos em Idle0, sem reação, sombra de contato, autoridade ou efeitos. Não demonstra impacto físico, dano sincronizado, funcionamento em rede ou encaixe com alvos móveis. O negativo1,82m, folga estreita Lyra, equilíbrio proxy e crossings da CPU continuam válidos. Esta entrega **não seleciona endpoint universal, marker, variante final ou timing de autoridade**. Root pode revisar a atuação1×; qualquer integração posterior continua com Combat. Nenhuma autoria adicional foi executada.

## Preservação e liberação

[Verificação final](../../output/brute-motion-v6/native-2026-09-19T06-20-35-020Z/preservation.json):267arquivos da entregaCPU,590históricos e17snapshots iniciais byte-idênticos.379fontes observadas iguais antes/depois da captura, incluindo runtime/src, callers, GLBs e ferramentas. Brute runtime`d1d58b1a…`,07`0cf09802…` e provas antigas intactos; todos os hashes completos estão no report. Nenhuma escrita main/server/core/áudio/heróis/Walker/Lich; sem restart5173.

[Recibo de encerramento GPU](../../output/brute-motion-v6/gpu-native-closure.json): token próprio removido após fechar browser e HTTP efêmero. Animation, VFX e GUI avisados via `codex queue` (recibos no JSON); Combat informado por este handoff, sem retry na fila cheia e sem interrupt. Ordem VFX peer-oculto→Animationv12/dt0→Brute cumprida. Fontes desta revisão liberadas/congeladas; próximas escritas/GPU desta frente: nenhuma planejada.

Reprodução separa etapas: `node tools/brute-motion-review-v6-native-preflight.mjs` (CPU); o runner nativo exige nova janela coordenada e aquisição atômica, não deve ser repetido usando o recibo histórico como reserva. Extração dos vídeos existentes sem GPU: `python3 tools/brute-motion-review-v6-native-sheets.py output/brute-motion-v6/native-2026-09-19T06-20-35-020Z`.
