# Horizon e nebula original — protótipo isolado

Candidato de 19/09/2026, sem import em runtime. Atende ao [follow-up da referência](../../../../docs/arpg/review/gravity-reference-followup.md). O primeiro estudo permanece integral em `../gravity-accretion-prototype-20260919/`, inclusive fixture/runner anteriores (`final-*`). Não houve alteração de `src/vfx/`, `src/main.js`, servidor ou pipeline durante este estudo.

`reference-shaders.js` extrai **literalmente** BILLBOARD_VERTEX/HORIZON_FRAGMENT de `SingularityMaterial.js` e NEBULA_VERTEX/NEBULA_FRAGMENT de `AstralNebulaMaterial.js`. Os quatro arquivos originais integrais, noise/common e licença MIT estão preservados; [provenance.json](provenance.json) registra os hashes do commit `8c377c886ac2c68b26bc65c8f3507905818b974a` do [LinearAbiltyCastingExtendedThreeJS](https://github.com/achrefelouafi/LinearAbiltyCastingExtendedThreeJS/tree/8c377c886ac2c68b26bc65c8f3507905818b974a). `astral.jpg` original foi inspecionada. A lente/refração não foi incluída.

A adaptação ocorre no controlador/uniforms: sombra billboard com raio nominal .82m/centro .73m, photon ring com AA por derivada e conservação de energia, beam .75 e halo diferencial. Nebula raymarched com três braços, cavidade esférica, shear `wind/(.45+r*1.2)`, ruído original e spears quentes. Campo achatado `.22`; alcance de gás4.8m, limite autoritativo5m. O núcleo tem presença maior que a esfera pequena anterior; o contorno do chão fica subordinado. Crescimento .42s (.50 reduced), drenagem/colapso nos últimos .70s, nenhuma draw após5s. Fragmentos24/14/8 e sparks64/32/16 por high/medium/low convergem analiticamente; reduced congela circulação/ruído, mantendo centro, área e envelope suave. Nebula usa34/24/16 passos. Nenhuma decisão de dano, pull ou duração foi adicionada.

## API e depth para integração futura

```js
const effect = createGravityHorizonNebulaPrototype(THREE, scene);
effect.set({position, radius:5, remaining:5, duration:5,
  quality:'high', reducedMotion:false});
effect.setSceneDepth({texture, width, height, near, far});
effect.update(dt); // dt=0 pausa
// effect.group, getStats(), reset(), dispose()
```

`texture` precisa ser **RGBADepthPacking**, a resolução/near/far da mesma câmera e frame. O original converte `unpackRGBAToDepth` → viewZ → distância no raio antes de limitar a integração volumétrica. Não basta depthTest no proxy. Sem textura a camada de nebula fica escondida, e `depthReady:false` deixa a falta explícita. Horizon usa depthTest normal e não grava depth; nebula encerra também no núcleo analítico.

A fixture fornece um prepass próprio com materiais de profundidade dos mesmos meshes/skinned rigs/instâncias, preservando maps/alphaTest/side e clipping. Materiais sem depthWrite e translúcidos com opacity<.99 são excluídos; transparências parciais não são oclusores volumétricos. O compositor `createCinematicPipeline` é importado **sem modificação**. Um único WebGLRenderer renderiza cada alternativa a1280×720; dois canvas2D apenas exibem cópias dos frames completos lado a lado. Assim o bloom não é calculado num render target com UVs incorretos por scissor. Câmera48°, altura17/depth20, aspecto16:9; Lyra,4Walker e cemitério reais, poses/estados controlados. Luzes/fog base e sombras ligadas. Não é uma partida.

O pipeline de produção ainda não expõe scene depth. Handoff registra para Combat a necessidade de escolher prepass compartilhado ou exposição/encoding de depth; nenhum patch em módulo alheio foi feito. Uma depth texture nativa `.r` exigiria adaptar o decode e validar novamente. O passe deve ser compartilhado por todos os campos, nunca duplicado por instância. Este controlador ainda cria5draws por campo e não é um pool de produção.

## Comparação e custo medido

[Report completo](../../../../output/playwright/2026-09-19T01-00-39-181Z-gravity-vfx-prototype/prototype-report.json), [high1.8s](../../../../output/playwright/2026-09-19T01-00-39-181Z-gravity-vfx-prototype/gravity-vfx-prototype-high-1.8.png), [low/reduced1.8s](../../../../output/playwright/2026-09-19T01-00-39-181Z-gravity-vfx-prototype/gravity-vfx-prototype-low-reduced-1.8.png), [vídeo A/B](../../../../output/playwright/2026-09-19T01-00-39-181Z-gravity-vfx-prototype/gravity-ab-playback.webm). Baseline à esquerda é o runtime congelado, candidato à direita. O estudo anterior usava ACES direto; seus PNGs históricos não são uma comparação de intensidade equivalente a esta.

| Qualidade / GPU ms | Runtime mediana / p95 | Candidato com depth mediana / p95 | Só depth mediana / p95 |
| --- | --- | --- | --- |
| high HDR+bloom | 4.03 / 4.73 | 5.38 / 6.22 | .67 / .77 |
| low/reduced HDR | 2.83 / 3.31 | 3.82 / 4.84 | .68 / .79 |

Chrome/ANGLE Metal local, EXT_disjoint_timer_query_webgl2 disponível, zero disjoint.42renders/caso,6warmups descartados,36amostras úteis, cópias de canvas fora da medição. Diferença das medianas: +1.35ms high/+0.99ms low incluindo profundidade. É custo do cenário controlado, **não FPS de gameplay/horda/mobile nem custo marginal garantido para múltiplos campos**. Query é aguardada; os intervalos rAF do relatório incluem essa espera e não são benchmark de FPS. O prepass soma148draws de cena à fixture; runtime/candidato no passe principal high158/161 (incluindo compositor), low155/158.

Dez capturas high/low em.35/1.8/3.6/4.8/5.3s; dois playbacks de319amostras;7.603pares não reiniciados convergentes em high e2.544estáticos em reduced. CPU602frames confirmou limites/expiração, dt0 e dispose idempotente. Zero erros de console/HTTP/GL; fonte copiada e checkout iguais ao final. Occlusion gate original não mudou: pelo menos65% dos pixels11×11 de torso com deltaRGB<65. Pior ator central76.86% em high; demais100%, low/reduced100%. Isso mede regiões de4atores, não legibilidade universal de uma horda.

Inspeção individual dos PNGs high.35/1.8/3.6/4.8 e low1.8 confirma núcleo/anel reconhecíveis, gás violeta e colapso; frames decodificados do playback em3/6/9s também inspecionados. A frente de gás pode velar parcialmente pernas/torso central; a silhueta superior permanece distinguível nestas posições. O gás recorta o piso/placas pela depth real e ainda precisa avaliação artística em movimento natural. Sem nota AAA ou promoção. GPU própria liberada; servidor5173 preservado.

Reproduzir com `node tools/gravity-vfx-prototype.mjs` a partir da raiz, após coordenar janela GPU. O runner adquire lock atômico, copia aplicação/fixtures, sobe servidor efêmero e fecha somente seus recursos.
