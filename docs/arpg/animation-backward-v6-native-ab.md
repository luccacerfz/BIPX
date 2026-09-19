# Ré v6 versus 07952 — revisão nativa final, candidato retido

**Seis clipes completos e18poses concluídos; GPU própria liberada. Nenhuma promoção.** [Report fonte estável](../../output/playwright/arpg-animation-backward-v6-ab-1789786338180/report.json), [registro exato da revisão](../../output/playwright/arpg-animation-backward-v6-ab-1789786338180/visual-review.json). Runtime07952 e auditor intactos. Lock adquirido atomicamente após liberação Combat; navegador/servidor efêmeros próprios encerrados,5173 preservado.

Inspecionei oito PNGs originais e12folhas com66amostras pareadas uniformes (1fps dos três vídeos próximos completos). **Não declaro revisão perceptual contínua dos vídeos.** As folhas usam recorte igual de botas/cabeçalho; extremos de passada às vezes saem desse recorte. Originais e vídeos abaixo preservam quadro inteiro. A revisão independente root está em [followup](review/animation-backward-v6-followup.md).

## Achados visuais

Ré6.5 frame433 e9.1 frames359/360 mostram contato da nova perna mais plausível, com bota próxima ao piso. Fases/poses entre takes diferem; isso não mede velocidade material nem compensa P90/cobertura falhos. As sequências próximas mostram extremos de passada mais amplos e cruzamento compacto entre apoios: roll do forefoot precisa de traço material, não de alargar a base.

Na curva, [frame204](../../output/playwright/arpg-animation-backward-v6-ab-1789786338180/turn-9.1-close-frame204.png), [205](../../output/playwright/arpg-animation-backward-v6-ab-1789786338180/turn-9.1-close-frame205.png) e [206](../../output/playwright/arpg-animation-backward-v6-ab-1789786338180/turn-9.1-close-frame206.png) expõem elevação da base e retorno abrupto do apoio direito. Frame205: entrada3.416667s, pose3.433333s, sola direita.189368m, reach.420730m. O alcance cai para.1676m no206, mas não é transferência de peso resolvida. A [vista ARPG205](../../output/playwright/arpg-animation-backward-v6-ab-1789786338180/turn-9.1-game-frame205.png) torna o problema menos legível pela escala; não é critério de aprovação.

Torso/arma permanecem visualmente coerentes nas poses originais examinadas; não atribuo a essas imagens equivalência absoluta dos ossos. A hipótese causal prioritária é a captura de apoio com pose misturada Strafe→ré, seguida pelo roll do forefoot. A v7 autorizada ficará apenas em staging: witness204–206 e um ciclo6.5/9.1 primeiro; sem alterar flags, comprimentos, velocidade, métricas ou quadril comum para esconder erro.

## Vídeos e timestamps preservados

| Caso | Próxima3/4 | ARPG | Landmarks (tempo da pose) |
|---|---|---|---|
| Ré6.5 | [22.12s](../../output/playwright/arpg-animation-backward-v6-ab-1789786338180/backward-6.5-close.webm) | [22.08s](../../output/playwright/arpg-animation-backward-v6-ab-1789786338180/backward-6.5-game.webm) |432/433/434:3.608333/3.616667/3.625s|
| Ré9.1 | [22.08s](../../output/playwright/arpg-animation-backward-v6-ab-1789786338180/backward-9.1-close.webm) | [22.12s](../../output/playwright/arpg-animation-backward-v6-ab-1789786338180/backward-9.1-game.webm) |359/360/361:3.0/3.008333/3.016667s|
| Curva9.1 | [21.8s](../../output/playwright/arpg-animation-backward-v6-ab-1789786338180/turn-9.1-close.webm) | [22s](../../output/playwright/arpg-animation-backward-v6-ab-1789786338180/turn-9.1-game.webm) |204/205/206:3.416667/3.433333/3.45s|

Chrome/WebGL Metal,2880×900, duas variantes1440×900, mesma entrada/luz/material por par. Curva nativa reproduz CPU em1e−14m; trajetória igual por frame. Reach máximo nativo inclui startup: ré6.5 antes.10436/v6zero; ré9.1 antes.25144/v6zero; curva antes.28682/v6.42073. Esses números não são o gate independente de apoio. **P90 apoio6.5 .676 versus07952 .137,9.1 .297 versus.259; cobertura19.44/17.50% versus31.53/23.89%; reach curva.421 permanecem reprovados.** Nenhum no-slide/AAA/global aceito.

## Preparação histórica (captura já concluída acima)

# Ré v6 versus 07952 — A/B nativo diagnóstico, preparado

Pedido explícito Root: inspecionar roll/base/peso antes de outra otimização, mesmo com candidato retido. **Preparação CPU concluída; captura GPU ainda não executada.** Aguarda término da rodada Combat e prioridade Environment. Lock momentaneamente ausente não significa janela liberada. Runtime/hero-foot-probes/auditor/Lich/GUI/5173 preservados.

## Fonte e método

[Snapshots isolados](../../output/arpg-animation/backward-v6/native-ab-staging/manifest.json), arquivos copiados sem links para runtime. Diferenças por par exclusivamente:

| Fonte | 07952 ativo | v6 retida |
|---|---|---|
| hero-locomotion.js | 07952bfc2e36dfed257a9f6f27dd582981c89a8dd2c791a92c1c1724be65f2b5 | 66ed1484f070212c92792b886de89008da16cc4702148825ca03fdd9d5a65d67 |
| dwarf-locomotion-clips.json | 6cb29422e554807b21b5ae8eefa71eb454972f2fc60d0b6eb54cb69ab87e5acf | d3cd29b3a56dedece8a96462ad32f10105de914fc1a0a7faeb69a54bbcc58861 |

17 arquivos por variante, mesmo GLB/rig/materiais/skills/probes/Three. [Runner](../../tools/animation-backward-contact-native.mjs) adapta o `animation-contact-native.mjs` existente e sua fixture de dois painéis; originais preservados em `references/`. HTML adaptado só em `native-ab-staging/tools/`. Sem novo framework, feature ou alteração do candidato.

Cada painel1440×900; saída2880×900 lado a lado. Próxima3/4 usa FOV38°, offset(3.6,1.65,-3.6), alvoY1.1. Câmera ARPG reproduz desktop atual: FOV48°, altura17, profundidade20, lookAhead2.6, alvoY1.2, suavização `1 - .001^dt`; mira constante-Z, zoomScale1. `main.js`/defaults de referência estão congelados no snapshot. Piso/luz controlados e idênticos por par, sem cenário/colisões/HUD: **câmera do jogo em fixture, não gameplay**.

## Clipes e instantes obrigatórios

| Caso | Simulação completa | Playback gravado | Poses estáticas (frame de entrada) |
|---|---|---|---|
| Ré6.5 | 4 s / 480 frames120Hz | .2x, cerca20 s por câmera |432/433/434, em torno do witness de aterrissagem14493 |
| Ré9.1 | 4 s / 480 frames120Hz | .2x, cerca20 s por câmera |359/360/361, em torno do mesmo witness |
| Curva9.1 | 5 s / 300 frames60Hz | .25x, cerca20 s por câmera |204/205/206, incluindo o maior reach |

São seis clipes completos e18PNGs planejados. Entrada da curva idêntica à matriz anterior: ré até1.5 s, transição para lateral1.5–2.1, lateral até3.0, volta à ré3.0–3.6, mantém até5.0. Não há warmup descartado, seleção de apenas apoios favoráveis ou exclusão de touchdown/curva. As duas variantes recebem o mesmo deslocamento por frame. Poses estáticas usam outro contexto após salvar o vídeo contínuo, sem pausar/rebobinar o clipe.

Trace preserva todos os frames, posições/velocidades reais, flags (não precisam coincidir entre takes diferentes), witnesses, matrizes de câmera e ossos de quadril/perna/pé/toe. Timestamps de entrada e pose renderizada são separados: frame205 tem entrada3.416667 s e pose após passo3.433333 s. O overlay exibe tempo/frame durante todo o playback. Métricas do controlador são diagnósticos; não substituem o auditor independente da sola.

## Preflight e limites

[CPU do harness](../../output/arpg-animation/backward-v6/native-ab-staging/preflight.json): único replay do witness de curva existente,300frames; trajetória e reach iguais por quadro, diferença máxima **zero**. Pico **.4207303672870667 m**, frame205/pé direito, preservado deliberadamente. Imports relativos e sintaxe do runner/HTML válidos. Primeira tentativa usava `frame/hz` em vez de `frame*(1/hz)` e falhou igualdade estrita da velocidade em5e−15; artefatos em `harness-history/initial-preflight`. Expressão igualada à matriz, sem mudança de tolerância/animador.

Captura técnica completa exigirá seis vídeos,18poses, todos os frames e o mesmo pico falho da curva. **Não exige aprovação física nem converte essas falhas em pass:** apoio6.5 .676 versus original.137 m/s; apoio9.1 .297 versus .259; cobertura19.44/17.50% versus31.53/23.89%; curva reach.421 m continuam abertos. A melhoria de aterrissagem v5/v6 permanece preservada e limitada ao seu escopo.

Após janela explicitamente liberada por Combat/Environment:

```sh
node tools/animation-with-gpu.mjs node tools/animation-backward-contact-native.mjs --capture
```

O wrapper reserva atomicamente e libera só o próprio token; runner serve apenas arquivos do manifesto por porta efêmera. Sem operação de5173. Captura/revisão ainda pendentes; este documento não é handoff visual concluído. Próxima causa será proposta após observar roll do forefoot, comprimento/base da passada e captura de apoio durante blend, com timestamps e comparação de ambas variantes.
