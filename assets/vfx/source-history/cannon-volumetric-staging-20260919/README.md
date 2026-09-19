# Canhão — staging volumétrico isolado

Pedido root posterior à promoção Horizon: muito fogo, massa turbulenta, núcleo térmico, muzzle, expansão rápida, dissipação/brasas. **Arte selecionada01:53 preservada, não importada pelo runtime.** CPU9 e native18fases/2playbacks/4bursts passaram no candidato selecionado; [manifesto](../../../../output/qa/vfx-cannon-volumetric-staging-20260919.json). Antes rejeitado por cúpula e iterações preservados. Preparação do wrapper separada em `../cannon-wrapper-integration-20260919/`, com contrato/lifecycle e correção localizada de composição; ver [handoff atual](../../../../docs/arpg/vfx-cannon-integration.md). Isso não promove a arte nem prova continuidade de origem/gameplay.

## Origem e adaptação

-HandCast `3431252f7ad88059681d4b9b6484cb7483f7d0d6` e Linear `8c377c886ac2c68b26bc65c8f3507905818b974a`: `src/archive/materials/VolumetricFireMaterial.js`, `src/archive/abilities/FireAbility.js`, noise/common originais preservados em `originals/`, com MIT e hashes em `provenance.json`.
-Samurai `496862cda55bfba3be6d02eec5aee3ca808a31a3`: blackbody/radiance original usado pelo volume, corpo e brasas. Material Samurai completo também preservado como referência.
-`cannon-source-glsl.js` exporta shaders originais `FIRE_VERTEX/FIRE_FRAGMENT` e derivação explícita `CANNON_FRAGMENT`: recorte radial de impacto3.4m, proteção de silhueta alta por depth e função térmica Samurai. O campo original de densidade, lobos grandes, vortex roll-up, turbulence/shear, shred, emissão e absorção permanecem.
-`cannon-prototype.js` adapta o perfil/padding/hull de FireAbility em controlador de eventos. Não usa trajetória desenhada/dano/scene manager/flash de tela/shake do demo. O proxy billboard só limita o march; não é a forma visível do projétil.

## API e limites

```js
createCannonPrototype({THREE,scene,quality,reducedMotion,capacity:8})
// emit/update/reset/dispose/getStats/setQuality/setReducedMotion
// prepareSceneDepth(camera)/setSceneDepth(frameOrNull), mesmo contrato packed do Horizon
```

Somente `dwarf_explosive_cannon`: cast=preparo; release=muzzle real; travel=segmentos recebidos e corpo no endpoint; terminal/end limpa sem fabricar impacto; impact=detonação no target confirmado. CastId obrigatório, release/impact deduplicados. TTL.3s de corpo/.55s limpeza quando travel deixa de chegar. Nenhuma atualização de dano/cooldown/recurso. Campos não são criados. Raio autoritativo padrão3.4 e fornecido por evento; duração artística pós-impacto2.2s, sem prolongar gameplay. Muzzle/emitter capturado nos eventos; não reivindica acompanhamento por osso durante preparo sem novos dados de emissor.

Pool staging8casts, três volumes reutilizáveis por cast (muzzle, rastro, explosão), corpo esférico térmico e batch de brasas. Sem cap artificial4draws; nenhum renderer adicional. Corpo pertence ao controlador, não à fixture, inclusive sem depth. Volume requer depth packed fresco e usa o mesmo prepass compartilhado/cutaway existente.32/24/16 passos e5/4/3oitavas high/medium/low. Reduced mantém volume/core, congela turbulência e circulação das brasas, remove flicker; crescimento/cooling continuam para comunicar fases. Geometrias/materiais pré-alocados; CPU não afirma zero alocações JS.

## Comparação preparada

`tools/cannon-vfx-prototype.{html,mjs}` reutiliza helpers existentes de snapshot/browser/servidor/reservaGPU. Um renderer, duas cópias canvas A/B; câmera/asset Lyra+4Walker/cemitério e pipeline HDR+bloom reais. Antes=wrapper runtime congelado; depois=controlador isolado. Eventos controlados: cast0, release.30,8.8m a22m/s, impacto.70, raio3.4. Animação existente da Lyra e muzzle real amostrados; sem setters de gameplay nem afirmação de partida.18capturas cobrindo cast/travel/impact/decay high+low-reduced, dois playbacks, quatro impactos sobrepostos, lifecycle e timerGPU. Gate de torso65% mantido nas quatro regiões11×11px; não prova toda horda.

Integração depende de comparação artística/custo e nova janela Combat. Preservar esse candidato antes de refinos.
