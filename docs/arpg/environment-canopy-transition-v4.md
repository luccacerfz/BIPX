# Canopy v4 — união limitada por par, resultado nativo conservado

**2026-09-19T07:22:02.178Z — cópia congelada; não promovida.** O v4 resolve em CPU o crescimento por duplicação do v3 e foi escolhido para o par autorizado contra v2. O nativo terminou, porém **FAILED:1pixel color/depth da copa candidata**. Os73frames mantêm os dois corpos361/361RGBAexatos, painel fechado pelo fluxo normal e retículo/folhas normalizados. Isso não equivale a seleção artística.

V2 continua live `977548e0/1edbc66c`, com Lich239/main d9e/server eb80/layout153. V3 `04f3a377` e suas evidências permanecem intactos. Nova cópia: `output/environment/canopy-transition-v4`; [manifesto239 por lado](../../output/environment/canopy-transition-v4/source-manifest.json), [patch único](../../output/environment/canopy-transition-v4/v4-over-selected-v2.patch), [CPU13](../../output/environment/canopy-transition-v4/cpu.json), [comparação quantitativa](../../output/environment/canopy-transition-v4/comparison.json), [recibo final](../../output/environment/canopy-transition-v4/release.json).

## Decisão causal e fórmula

A união `a+b-ab` usa resultados já ampliados como entrada e cresce mesmo quando um raio é repetido. O v4 conserva cada máscara original e sua normal espacial, calcula pares independentes e toma o maior resultado, sem realimentar a suavização. Para cada par:

```glsl
separation = min(length(normalA - normalB) * .5, 1.);
k = .08 * separation;
h = max(k - abs(a - b), 0.) / max(k, .000001);
pair = max(a, b) + h * h * k * .25;
```

O resultado é o máximo entre máscaras originais e pares. Duplicatas exatas têm normal idêntica: não criam expansão entre si e só repetem pares já existentes. Ordem e multiplicidade não alteram a resposta. Raios quase coincidentes têm `k` pequeno; junções de direções distintas recebem transição. A maior máscara é sempre um piso, não se reduzem raios de corpo/área. A expansão máxima de máscara é `.02`, independentemente da quantidade. Acima de máscara `.18` o interior já está completamente aberto no maior limiar/feather; ali não se percorrem pares. Todos-zero/contato e `playing=false` continuam sólidos. `uCanopyCutaway` no caller atual é booleano0/1; não se propõe nova animação dessa intensidade.

A largura `.08` é uma escolha calibrada, não requisito externo: comparação `.04/.08/.12` dá expansão radial máxima de1.88/3.86/5.95cm no plano-alvo, para o maior ramp existente1.7m e limiares.095/.12/.145. Escolhi a intermediária para limitar a menos de4cm e manter alguma suavização de junção. Threat ramp.8m: máximo1.814cm; área ramp.65m:1.474cm. Em primeiro plano essas distâncias escalam pela fração de profundidade do cone. Gradiente analítico de `distância/t` evita derivadas de tela dentro dos loops; verificação por diferenças finitas concorda. Mantida do v3 a ondulação mais lenta/amplitude.025, em vez da.08live. Assim, mudanças visuais nativas não isolam apenas a fórmula de união da mudança de ondulação; a causalidade de contagem é isolada pelos witnesses abaixo.

O envelope de pares ainda pode apresentar junções de ordem superior, e trocar uma ameaça por outra posição legitimamente muda a abertura. Não se promete ausência global de popping.

## Witnesses iguais1/2/4/10

Máscara original`.1`, `max=.1`, corte nominal`.12`. Near: direções em um intervalo fixo1grau; crossing: duas direções90graus repetidas. Não são imagens.

| Quantidade | União v3 | V4 duplicado | V4 quase1grau | V4 par90graus repetido |
|---|---|---|---|---|
| 1 | 0.10000000 | 0.10000000 | 0.10000000 | 0.10000000 |
| 2 | 0.19000000 | 0.10000000 | 0.10017453 | 0.11414214 |
| 4 | 0.34390000 | 0.10000000 | 0.10017453 | 0.11414214 |
| 10 | 0.65132156 | 0.10000000 | 0.10017453 | 0.11414214 |

Com10duplicados, v3 ultrapassa o corte em.53132156, v4 mantém margem.02 abaixo dele. Near conserva margem.01982547; crossing.00585786. No círculo analítico2.5→4.2m, dez duplicados do v3 ampliam o raio de3.83248657 para4.08684331m (+25.4357cm), enquanto v4 conserva raio/área.

Área de corte em m² no mesmo plano/ramp/limiar.12. `near20mm` conserva extremos±1cm; `two-distinct` repete centros±1.1m. Integração4096faixas e36bisseções por fronteira; erro de quadratura não é uma margem de aceitação. A primeira grade25mm não resolvia as pequenas diferenças, por isso a integração mais fina foi preservada ao lado da versão inicial.

| Família | N | Max v2 | União v3 | V4 | V4−max |
|---|---|---|---|---|---|
| duplicate | 1 | 46.143662 | 46.143662 | 46.143662 | 0.00000000 |
| duplicate | 2 | 46.143662 | 48.828557 | 46.143662 | 0.00000000 |
| duplicate | 4 | 46.143662 | 50.754833 | 46.143662 | 0.00000000 |
| duplicate | 10 | 46.143662 | 52.471885 | 46.143662 | 0.00000000 |
| near20mm | 1 | 46.143662 | 46.143662 | 46.143662 | 0.00000000 |
| near20mm | 2 | 46.296834 | 48.830902 | 46.296841 | 0.00000778 |
| near20mm | 4 | 46.296834 | 50.756380 | 46.296841 | 0.00000765 |
| near20mm | 10 | 46.296834 | 52.473920 | 46.296841 | 0.00000764 |
| two-distinct | 1 | 46.143662 | 46.143662 | 46.143662 | 0.00000000 |
| two-distinct | 2 | 62.772123 | 62.883530 | 62.773041 | 0.00091794 |
| two-distinct | 4 | 62.772123 | 66.002975 | 62.773041 | 0.00091794 |
| two-distinct | 10 | 62.772123 | 68.818622 | 62.773041 | 0.00091794 |

Nenhuma área antes revelada pelo `max` é perdida pelo operador. Área quase coincidente adicional é aproximadamente.000008m² nessa integração, não “zero” por arredondamento. A área adicional do par distinto não cresce com sua duplicação. A fatia3D da câmera real `[18.933,17,34.268]` emZ19 também foi amostrada:1/2/4/10duplicados mantêm6589amostras abertas; v3 cresce6589→6834→6982→7114. Perturbação20mm tem boost máximo.0000397543, não enfraquece3006–3021amostras de núcleo; a resolução7cm não mede a pequena área marginal. Esses resultados pertencem à CPU, não à imagem renderizada nem à seleção de arte.

## Contrato e orçamento

Só `src/render/environment-cutaway.js` muda na cópia, hash**6a06342107820e146aaabc8f3b5eae778c037442c32dedb55715ac7993da5cdd**. `asset-dressing.js`1edbc6 permanece exato; não copiar00c3/92efhistorico. API `installEnvironmentCutaway`, `patchEnvironmentCutawayShader` e `shareEnvironmentCutawayDepth(colorMaterial, depthMaterial)` intacta, mesmos objetos-uniform e limites10ameaças/4áreas. Shader legado de cripta/parede é byte-idêntico ao v2, e depth conserva hook próprio, clipping/side/alpha/packing, instancing/transformed. Nenhum override global, ator transparente ou passagem extra.

Zero assets/texturas/uniforms/materiais/lotes/passes novos; geometria/layout153/nave46 unchanged. Máximo15amostrasvec4 locais e105pares apenas na faixa de borda, com normalização/registradores/ALU adicionais. Isso é custo real a avaliar, não “grátis” porque draws iguais. Nativo focal:179draws/520370triângulos/82programas em ambos; com depth258/757617/94,1prepass79draws. Memória104geometrias/46texturas,47comdepth. Não houve timerquery/benchmark novo ou prova de custo sob10ameaças/4áreas.

## Par nativo autorizado e limite

[Report original](../../output/playwright/2026-09-19T07-21-30Z-environment-canopy-v4/report.json) SHA`3bbb224cf4810974d2e7921d21681a08206e4d428614da72add2ea5c920727d9` e [revisão separada](../../output/playwright/2026-09-19T07-21-30Z-environment-canopy-v4/review.json). Janela coordenada após VFX`msg_ed12e0ba2b89` e Combat`msg_9cb54cc3cfd8`; aquisição atômica própria, encerrada**2026-09-19T07:22:02.178Z**. Dois servidores privados fechados;5173PID22588 e ledger preservados,239fontes live e1041arquivos históricos sem drift. Sem restart/promoção.

Cada lado usa Aldric real2.7, BloodCow opaco/pose fixa, mesmas folhas/seeds/tempo, câmera1440×900/48graus, luz e retículo real. Botão“Dispensar dica” fecha painel e grava preferência pelo fluxo normal. Translação controlada de câmera/foco60cm, ida/volta1.2s; não é input WASD, animação de caminhada, teste IA ou contagem variável de ameaças. Geometrias imutáveis são hashadas antes/depois, evitando rehash pesado a cada frame; poses/matrizes/folhas/ROIs continuam comparados por frame. Preroll dos vídeos originais preservado.

- Baseline1211.1ms, máximo atraso de amostra8.4ms; candidato1210.9ms/8.833ms.73amostras cada, sem afrouxar gate temporal.
- Todos73pares: câmera/luzes/atores/árvores/folhas/UI/retículo idênticos e1444bytes de cada ROI19×19 exatamente iguais. Não se excluiu pixel.
- Baseline9batchescedar:97535pixels color/depth, zero diferença. Candidato:97515color/97514depth, **1pixel diferente**.18meshesBloodCow:6981pixels ambos/zero mismatch/nenhuma adaptação.
- Zero erro shader/GL/HTTP. Programas delta0. Falha color/depth conserva `passed:false` no report; o gate agregado também falha por esse mesmo pixel, não por corpo/pacing.

A causa do pixel ainda não foi isolada. Precisão numérica/limiar com `fwidth` é hipótese, não diagnóstico confirmado; não se corrige tolerando pixel, aumentando overdraw ou mudando todos os materiais. Sem nova GPU reservada.

Quatro originais inspecionados: corpos/ameaça seguem legíveis; o ajuste de contorno é pequeno nessa câmera, e a silhueta cortada larga permanece perceptível. Diferenças PNG completas:2695pixels no início (bbox466,598–698,851) e818no meio (544,602–731,667), concentradas na copa/efeito de sua borda. Essas caixas não localizam o mismatch color/depth. Não afirmo ganho artístico decisivo nem julguei playback contínuo humano a partir de quatro stills. A prova temporal técnica e os WebMs ficam disponíveis paraRoot.

- [baseline-motion-midpoint.png](../../output/playwright/2026-09-19T07-21-30Z-environment-canopy-v4/baseline-motion-midpoint.png) — `2ee8750d7be2c642bfa3fd7f6de2712c967ff09880797f6881528e32e5a69d10`
- [baseline-motion-start.png](../../output/playwright/2026-09-19T07-21-30Z-environment-canopy-v4/baseline-motion-start.png) — `1681386fedd1d4862ca2f3ea8accb42fae36cff73c349ca4cb59e6942f1e3f99`
- [candidate-motion-midpoint.png](../../output/playwright/2026-09-19T07-21-30Z-environment-canopy-v4/candidate-motion-midpoint.png) — `0339deb029df26d491da1145e9004210b416df3007508031bd8e8146b6f06da2`
- [candidate-motion-start.png](../../output/playwright/2026-09-19T07-21-30Z-environment-canopy-v4/candidate-motion-start.png) — `c477a12f32245cabe8c91a01e1725357bfe38f247bcafdfbd65ef67d78e7746b`

- [baseline WebM original](../../output/playwright/2026-09-19T07-21-30Z-environment-canopy-v4/raw-video/page@9d1aabfee37718fb01081c7a5a2d6a94.webm) — `663c6134c77ae6795bb6319cc29e2a8487dbef025966a7cfaa52a399c06182c0`
- [candidate WebM original](../../output/playwright/2026-09-19T07-21-30Z-environment-canopy-v4/raw-video/page@ca676f9583946f46f1420915bd6348c0.webm) — `a33b6f2ef2e8cd326534edc42b1299d6402ffe509c7bea8d8a986a887cc49e09`

## Hashes e entrega

- `candidate/src/render/environment-cutaway.js`: `6a06342107820e146aaabc8f3b5eae778c037442c32dedb55715ac7993da5cdd`
- `v4-over-selected-v2.patch`: `86d661b024acc2664c0e977338c3730f3b75df2fe523ba90bb39328be43e2f47`
- `source-manifest.json`: `8367a304e71a2bbaca102aa589eacacec5fa5f6d0efdab3b68d46291fc6f7464`
- `comparison.json`: `77dde0f4d1951744d5d1ef8d1357a8e94ec351ff88cd57295a8342a46a2ad3b6`
- `cpu.json`: `7cc589ddccd945ebefa227a91d78347f6178d7a3d40d64a9573605ce6a7ca8b6`
- `motion-fixture.js`: `b2f9102d8ac4b6e5872554987c522ade4978062d47f485e4593b126e09b35bfe`
- `motion-driver.mjs`: `ce08905e9dc78b06b10b34820cff1d53434114587f7afec5431cd9f7f778006a`
- `strict-gates.mjs`: `bc3875e0430b84992b3e1c35e41ac5827a2a63b454df2a5c18bca4987e2599cd`
- `native.mjs`: `3fc3814281ddf01103fd908d75f4cbaf23cf690531a60944628dda3e22edad1f`

V3 preservado; v4 é a escolha causal para este experimento porque elimina a dependência de multiplicidade, mas fica **sem seleção artística e sem promoção** devido ao gate nativo e ganho visual limitado. Nenhum novo placement, asset, main, server, layout, Physics, pipeline ou depth global editado. Próxima investigação, se priorizada, deve localizar o pixel em cópia preservando as duas máscaras e tratar o limiar somente após separar a causa; não repetir matriz global.

Fechamento enviado a Combat por orquestração: `msg_a18b2f704898` às07:26:12UTC, sem interrupt/retry.
