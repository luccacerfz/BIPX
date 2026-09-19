# V11 / V12 — recorte nativo diagnóstico concluído

**V12 c402b5ac congelada em cópia; sem promoção/no-slide.** A correção [dt zero](animation-backward-v12-dt-zero.md) passou quatro casos e preservou exatamente os452frames positivos de5e93437e. Baseline v11 **4ad67bcf** e ambos os originais permanecem preservados.

[Índice de quatro vídeos e72poses](../../output/playwright/arpg-animation-backward-v12-ab-1789798650919/index.html), [report original](../../output/playwright/arpg-animation-backward-v12-ab-1789798650919/report.json), [revisão e hashes dos17PNGs inspecionados](../../output/playwright/arpg-animation-backward-v12-ab-1789798650919/review.json).

## Execução e fidelidade

Janela coordenada após VFX peer-oculto06:14/liberação06:16 e Combat `msg_e63232ca2109`; lock próprio adquirido atomicamente06:17:30. Browser/HTTP/token encerrados antes da comunicação06:20:13. Combat e SFX avisados (`msg_625a4685978c`, `msg_e3b4ef62b193`); nenhuma próxima GPU Animation.

Mesma trajetória6.5m/s desde0 até3.666667s, duas frequências e duas câmeras. Foco97–109/197–219 capturado integralmente, sem selecionar somente a troca. Plain-floor fixture com câmera/follow desktop do jogo, **não gameplay integrado**. Cada painel tem1440×900, corpo inteiro dentro do viewport em todas as72poses. GLBs históricos Dwarf e11/Aldric0e5, rig, takes, material, luz e velocidade iguais; nenhum material live dc/5c incorporado silenciosamente.

| Playback1× | Passos simulados | Tempo real | Diferença real−simulação |
|---|---:|---:|---:|
|30Hz próxima|110|3.6734s|6.733ms|
|30Hz ARPG|110|3.6718s|5.133ms|
|60Hz próxima|220|3.6723s|5.633ms|
|60Hz ARPG|220|3.6803s|13.633ms|

Todos os estados simulados apareceram no render; maior intervalo entre renders **durante playback ativo16.8ms**. O report bruto inclui também renders após parar (máximo50ms); a revisão separa explicitamente esses períodos. VídeosVP8 são codificados a25fps e incluem preparo/pausa: não representam uma gravação60fps nem provam cada estado por vídeo.

Fonte estável, zeroerros de browser/GL, runtimeDrift vazio. Paridade CPU/browser: posição/reach0, material máximo **1.3856e−13m**, incluindo o vértice esquerdo14493. Reach0 em ambos os lados; flags iguais e diferença de torso/props normalizados0 em todo trace. O preflight reutilizou os904frames CPU dos dois candidatos, sem matriz adicional.

## Julgamento limitado às imagens realmente vistas

Inspecionados17originais: próxima30Hz99–103; próxima60Hz200/201/204–207; ARPG30Hz100/103 e60Hz200/205/207/219. Não houve revisão subjetiva contínua dos quatro vídeos; playback real e tempos são comprovados pela telemetria, e os clipes completos ficam disponíveis.

- [Troca100/30Hz](../../output/playwright/arpg-animation-backward-v12-ab-1789798650919/turn-6.5-30hz-close-frame100.png) e [200/60Hz](../../output/playwright/arpg-animation-backward-v12-ab-1789798650919/turn-6.5-60hz-close-frame200.png): a bota aérea mantém uma posição mais externa e muda a inclinação; o apoio direito e a parte superior coincidem. Isso é compatível com o ganho causal de continuidade inicial medido no CPU, sem inferir fluidez apenas do still.
- [101/30Hz](../../output/playwright/arpg-animation-backward-v12-ab-1789798650919/turn-6.5-30hz-close-frame101.png) e [201/60Hz](../../output/playwright/arpg-animation-backward-v12-ab-1789798650919/turn-6.5-60hz-close-frame201.png): pé esquerdo visivelmente mais alto; o arco maior não equivale automaticamente a mais peso. A orientação do antepé continua exigindo julgamento.
- [102/30Hz](../../output/playwright/arpg-animation-backward-v12-ab-1789798650919/turn-6.5-30hz-close-frame102.png) e204–206/60Hz: a base ainda se estreita muito, com joelhos/botas próximos em projeção. Não aparece nova quebra grosseira de torso/arma nos originais vistos. Não é prova exaustiva de autointerseção ou deformação.
- [Pouso103/30Hz](../../output/playwright/arpg-animation-backward-v12-ab-1789798650919/turn-6.5-30hz-close-frame103.png) e [207/60Hz](../../output/playwright/arpg-animation-backward-v12-ab-1789798650919/turn-6.5-60hz-close-frame207.png): pose coincide com a v11, mas a velocidade de chegada depende do quadro corrigido anterior. Mantém-se a ressalva CPU30Hz5.519→12.086m/s de mudança vetorial de velocidade. Flag de apoio com zero patch qualificado continua **zero cobertura**, não PASS.
- [ARPG200](../../output/playwright/arpg-animation-backward-v12-ab-1789798650919/turn-6.5-60hz-game-frame200.png): diferenças pequenas na escala real do desktop; os stills não justificam declarar resolução global ou rejeitar somente pela velocidade aérea.

## Entrega e próxima causa

Reter **c402b5ac** como v12 corrigida para revisão;5e93437e segue histórico com falha dt0 demonstrada. Patches160/583, roll direito, limites de piso/reach e métricas anteriores preservados. P90global.225024/.140175m/s e cobertura48/302,124/602 continuam pendentes; nenhum zero patch foi reclassificado.

Se houver continuação selecionada, o recorte útil é a **junção de velocidade/orientação ao pouso103/207**, preservando o ganho da entrada aérea e o roll de apoio. Não iniciar outra busca de takes, matriz ou deslocamento de pelvis por esta entrega. Runtime07952/GLBs/auditor e servidor5173 permanecem intactos; PID5973 observado antes/depois, sem restart desta frente.
