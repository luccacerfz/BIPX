# VFX v2 — seis refinos e freeze para Combat

Atual06:05: [overlap-v2](vfx-cannon-depth-composition.md) passou gate focal65 original1/8high+8low/reduced; caso1exato,8conjunto121/121nos3ROIs. CPU14/1depth/lifecycle/custo pareado concluídos em cópia. [Warcryart2](vfx-warcry-art-v1.md) quatrooriginais revisados/preparo-release maispresentes, sustain/poeira discretos; entregue para seleção. RuntimeVFX28 permanece congelado; nenhuma promoçãoAAA/global inferida. GPU própria livre.


**Atualização05:37:** focal composição exato executado. Dwarfloader/depth e lifecyclePASS;1campo gate121/121,8campos falha65 (68/121e75/121nosinimigos). Custo GPU1/8 medido com8warmups/24pares; candidato retido. [Resultado completo](vfx-cannon-depth-composition.md). GPU VFX encerrada; Animationv11 explicitamente liberada, depois Environmentcanopy. A espera pela janela Combat citada no histórico05:28 abaixo foi encerrada pelo smoke05:31. Nenhum runtime promovido, art2 continua separado.

Conferido em2026-09-19T05:28:38Z. [Recibo de fontes e preparo](../../output/qa/vfx-refinement-freeze-2026-09-19T05-28-38Z.json):28módulos runtime iguais ao freeze, wrapper servido5173 exato. Nenhuma escrita runtime/GLB/pipeline/main, GPU, restart ou promoção. Combat pode concluir combos, rede e natural60s/classes com a fonte congelada. Próxima GPU VFX somente após encerramento comunicado.

## Estado perante a direção Root

[Direção inicial](review/v2-vfx-art-direction.md) e reviews posteriores reconciliados; nenhuma correção antiga reaplicada.

| Habilidade | Implementado no runtime | Evidência e pendência |
| --- | --- | --- |
| Grito | Faixas/motes no torso, pulso de release e buff seguindo snapshot/posição real | Root00:29/00:30 viu melhoria, ainda discreta. Art1 não selecionado. Art2 somente staging: concentração corporal, pressão/poeira sincronizadas, arcos radiais e sustain contido; CPU7gruposPASS, sem seleção nativa. |
| Dash | Arco/trilha pela execução real; impacto não inventa morte | Corte e37398db é de Animation/Combat, somente morte confirmada, clipping local. VFX não duplica rigs/corpses. Limites do corte no handoff Animation; nenhum novo aceite de playback. |
| Escudo | Frente vertical com borda/brasão acompanha direção/deslocamento; poeira e impactos reais | Root00:29/00:30 reconheceu escudo junto do guerreiro/vítima. Nenhum candidato VFX adicional; status/combos finais aguardam captura integrada atual. |
| Canhão | Chama volumétrica GH, núcleo térmico breve, pluma/dissipação e bridge cano→trajeto com abandono explícito | Oito arquivos promovidos03:31 após native03:21. Combo concêntrico fogo/gravidade permanece problema live; correção por profundidade selecionada para focal, não promovida. |
| Gelo | Crosta parcial até torso, cristais/névoa por vítima, corpo de projétil low/reduced | Root00:29/00:30 reconheceu cobertura e rig legível. Freeze segue remaining real; nenhum controle inventado em cadáver. Nenhum candidato VFX adicional. |
| Gravidade | Horizon/núcleo preto, photon ring/halo e gás/filamentos GH; campo real5m/5s e um shared depth | Integrada experimentalmente. Corpo LyraBLEND prejudica proteção no depth; GLB OPAQUEdc0867da é dependência separada. Composição e custo8campos aguardam focal. |

[Review de volume00:29/00:30](review/v2-volume-followup.md) preservado. Canhão/Horizon posteriores não se resumem às falhas iniciais de anéis ocos/espiral plana; tampouco estão aprovadosAAA. Combo, grito, playback integrado e custo dos novos candidatos continuam abertos.

## Hashes e gates separados

- Runtime wrapper: `d7a22587826b5d8e8ff9a37ce757c55199e1395a2b9f77af27de0272f9dafd55`.28hashes completos no recibo; fonte inalterada.
- Composição: sete hashes selecionados intactos; [patch mínimo](../../assets/vfx/source-history/cannon-concentric-staging-20260919/composition-v1/composition-v1.patch) SHA`51014afb429702e49dec6bd8d95881ab88225b40cb79ea5b97cd905e4d9e6651`. CPU lifecycle12PASS já publicado, não repetido. Falta loader exato Dwarfdc0867da, lifecycle nativo e custo pareado1/8campos. Gate121/121 anterior depende OPAQUE em ambos os lados e não representa liveBLEND.
- Gritoart2: pool `111e989bfc793fe392ae263a812b2a43e639e4f39bdd49364a99e8f97779e7c8`, wrapper staged `e0675bb091e00008f9eb4e554e01197efcb45a8c7a428c83c30f9dc1e5eefd76`. CPU7gruposPASS já publicado; shader/pool não mudaram.

## Preparo CPU encerrado

Somente runner/fixture grito alterados; originais em `output/vfx-warcry-art-v1/art2/iterations/pre-exact-aldric-harness/`. Art2 carregará Aldric OPAQUE5c exato via overrideHTTP do GLB em ambos os painéis, sem clone/mutação manual de material. Registrará transparent/depthWrite reais, draw corporal no depth e um único prepass. PNGs históricos mantêm sua proveniência.

Recorte preparado: high.22/.48/1.8 (preparo/release/buff), low-reduced.48 e trecho curto1x já existente. Máscara65, poses/câmera/assets controlados; sem suíte global nem repetição dos cinco pares Aldric. Sintaxe2PASS; **nenhum native desta versão do harness**, sem inferência de custo/arte. Runner `9b676d74804db56d78ddd493947d159b30768cc06eb29b225d61ff5416eb8d5e`, preview `c6ffda1cac106540a6b4d5411d7ea780b4508e5abe773407c092158b401390f7`.

Composição focal precede gritoart2 após Combat. Recibos de janela dos candidatos continuam desativados; nenhum lock reservado. Dano, tempo, raio, cooldown, estados, animação e SFX intactos.
