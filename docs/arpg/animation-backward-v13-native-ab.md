# V13 — A/B nativo encerrado, ganho perceptual ainda limitado

**Quatro playbacks1× completos,80PNGs, fontes estáveis; sem promoção/no-slide.** C402 à esquerda, a779 à direita, Lyra histórica e11 com o mesmo rig/rifle/take/luz/piso. [Galeria com vídeos e todos os originais](../../output/playwright/arpg-animation-backward-v13-ab-1789801019464/index.html), [report original](../../output/playwright/arpg-animation-backward-v13-ab-1789801019464/report.json), [parecer e amostragem](../../output/playwright/arpg-animation-backward-v13-ab-1789801019464/review.json).

Executado conforme [seleção Root](review/animation-backward-v13-selection.md): mesma história0–5s6.5m/s,30/60Hz, próxima3/4 e câmera ARPG desktop/follow. Fixture de piso simples, não gameplay live. Cada painel tem1440×900; o corpo cabe inteiro nos80PNG. Sem nova matriz/take, alterações em runtime ou restart5173.

## Execução e preservação

Preflight904frames: duas fontes sobre as referências CPU integrais151+301, trajetória/reach exatos. Playback:150/300passos até5s; duração real5.0161/5.0029/5.0041/5.0041s. Todos os estados simulados foram renderizados; gap máximo durante playback16.8ms. O report bruto também inclui preparação/cauda, onde aparecem33.3/50ms; a seleção temporal e os dados originais estão preservados no parecer.

WebM VP8 codificado a25fps,2880×900, com espera inicial/final além dos5s de movimento. Isso não representa cada amostra60Hz. Os PNGs exatos incluem104/208 e continuam até116/230 para mostrar liberação/aterrissagem seguinte. Erro CPU/browser: posição/reach0, material≤1.883e−13m. Flags idênticos, torso/props comparados com delta0; alcance excedido0. Zero erros browser/HTTP/GL, hashes antes/depois iguais e runtimeDrift vazio.

Base **c402b5ac**, candidato **a7792f05**; [manifesto completo](../../output/arpg-animation/backward-v13/native-ab-staging/manifest.json). A prova usa Dwarfe11/Aldric0e5 preservados, sem incorporar dc/5c live. As capturas anteriores continuam com seus próprios hashes e pareceres.

## Julgamento perceptual e limites

Inspecionei **17PNGs originais**, listados no parecer:30Hz próxima100–104/106/116;60Hz próxima201/205/207/208/213; ARPG30Hz102/104 e60Hz205/208/230. Examinei também duas sequências densas de12quadros consecutivos dos WebM próximos: [30Hz](../../output/playwright/arpg-animation-backward-v13-ab-1789801019464/video-review/close30-dense-sheet.png), [60Hz](../../output/playwright/arpg-animation-backward-v13-ab-1789801019464/video-review/close60-dense-sheet.png). Os quadros originais2880×900 e PTS aproximados estão em `video-review/extraction.json`. A primeira prancha cortava a extensão lateral; ficou como `cropped-preview`, substituída na revisão pela prancha com corpo/rifle completos. Não alego inspeção perceptual contínua dos quatro vídeos inteiros.

Na vista próxima30Hz, a posição aérea muda em101/102, mas a base continua estreita, com as botas se aproximando/cruzando em projeção. A pose de apoio103/104 volta à mesma solução; não há uma nova ruptura grosseira de torso ou rifle nos originais examinados. A60Hz, o pico anterior do arco é menor, mas em205 a sola candidata está mais alta:47.0mm contra40.4mm; o trajeto difere discretamente antes da pose comum207/208. O apoio direito e seu roll permanecem coerentes entre os lados.

**Na escala ARPG, a diferença é pequena; não há prova visual suficiente para chamar a v13 de melhoria forte de peso/fluidez.** As sequências deixam visível a passagem rápida da base aberta para estreita, a rotação do antepé e a saída seguinte. O ganho CPU do tornozelo é real, porém não torna a bota materialmente suave por si. Também não aparece, nas amostras vistas, uma quebra grosseira nova que justifique rejeitar só pela magnitude da velocidade aérea.

Mantêm-se os limites [CPU v13](animation-backward-v13-staging.md): material14493 no frame104 piora6.741→8.980m/s de mudança de velocidade,208 piora3.519→4.533; Toe angular30Hz piora localmente. Contatos declarados103/207 ainda têm zero patch qualificado; ausência de apoio físico não vira PASS porque a bota parece perto do piso. P90/cobertura/defeitos fora desta ligação não foram aprovados.

**Veredito: reter a779 como progresso parcial; continuar a junção material/orientação em nova cópia CPU, conforme autorização vigente.** Conservar entrada, redução linear, apoio direito, rig/props e auditor. Nenhuma nova GPU está solicitada por esta continuação.

## Janela encerrada

Brute lateral encerrou browser/HTTP/token às06:50:34 conforme seu report real. Handoffs Combat/VFX/GUI/Environment conferidos; Combat avisado antes da aquisição atômica `msg_1a7efbe57595`. [Coordenação](../../output/arpg-animation/backward-v13/gpu-window.json). Reserva AnimationPID2825 iniciou06:56:59 e terminou antes da conferência07:00:06; browser/HTTP/token próprios encerrados, [recibo](../../output/arpg-animation/backward-v13/gpu-release.json). Combat recebeu liberação `msg_f834415d24af`. Nenhum lock alheio foi operado.
