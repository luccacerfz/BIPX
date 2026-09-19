# Canhão volumétrico — oito arquivos origin, native concluído

**Atualização Combat03:33:** callback conectado pelo dono no main `7bde570f`, contacts912c e oito VFX em222fontes; [recibo integrado](../../output/qa/arpg-cannon-density-integrated-20260919/integration-receipt.json). Fonte conferida e congelada para QA integrada. Referências abaixo a callback pendente descrevem a promoção VFX03:31; input/rede/JEF atuais seguem pendentes de evidência própria.


Direção v2 incorporada: esta entrega refina `dwarf_explosive_cannon`. Native03:21 e revisão local Root/Combat/VFX concluídos; [contrato/evidência/limites](vfx-cannon-origin.md). **Oito arquivos promovidos/fonte congelada; callback main pendente Combat.** [Recibo da promoção](../../output/qa/vfx-cannon-origin-promoted-20260919.json), 2026-09-19T03:31:48.987Z. Baseline preservado, hashes/sintaxe8PASS, lock próprio liberado. Nenhuma GPU/captura/restart/teste global no micro-lote. Arte local aceita para integração experimental, sem AAA/gameplay. Fonte final em `assets/vfx/source-history/cannon-origin-staging-20260919/`; plano anterior de sete arquivos ficou histórico e foi arquivado em `iterations/native-final-0321/vfx-cannon-integration.md`.

## Plano exato de oito arquivos

Destino `src/vfx/<nome>`. [Manifesto com hashes completos/baseline](../../output/qa/vfx-cannon-origin-prepared-20260919.json). Wrapper anterior `400afd2637bc1f3e74c6b83854dc6693d7c94aea856933160712c1e88d12cdda`; sete módulos novos. Somente estes arquivos, nunca a pasta staging inteira. Horizon/materials vizinhos/main/pipeline/Physics/Animation não pertencem à promoção VFX.

| Arquivo | Operação | SHA-256 candidato |
| --- | --- | --- |
| `cannon-defaults.js` | novo | `010fbff04a43c19c2ec172c8d5bf0f35f13c6e5d816b4534202b521fd0f5187a` |
| `cannon-origin-bridge.js` | novo | `a71d583140ebb1fb70ace60ced2bd1cd6dd253901a97a92a519b1148fcd6c2ed` |
| `cannon-source-glsl.js` | novo | `5bd8cbcf8442e5fda9215ea3b2a18712dbb1e2bbdae0c717e4c130fb9fdc6d9d` |
| `cannon-vfx.js` | novo | `a95365067dd5dfa35c479a4ffe1c613878970134d3b08b2e87477e5afce40087` |
| `class-skill-vfx.js` | substituir | `d7a22587826b5d8e8ff9a37ce757c55199e1395a2b9f77af27de0272f9dafd55` |
| `fire-blackbody.glsl.js` | novo | `6570394ae1e8d0099af2924f46336341be990e7b35baf262c978a25f44b0e8ca` |
| `fire-common.glsl.js` | novo | `21dfd8ba599787bebedd856bc9dff368c493e71a7ad3b1ec23ad258d432c418b` |
| `fire-noise.glsl.js` | novo | `5c2c7c2f25f05b9a3d877efd12a39e7ab8a0f59dab54e22f09323a811989f3c2` |

Wrapper possui o pool e une as raízes de exclusão/depth com Horizon. `cannon-origin-bridge.js` liga socket ao trajeto somente quando livre; bloqueio abandona, limpa rastro e oculta corpo40ms, sem impacto sintético. `cannon-vfx.js` mantém núcleo, volumes turbulentos e brasas. Shader/composição02:27 e originais GH/MIT permanecem preservados. Autoridade/altura1.05/raio físico.32/raio de impacto3.4/timings inalterados.

Combat conecta `createClassSkillVfx({...,sweepVisual})` com o [callback aceito](combat-cannon-visual-contract.md). Ausência/invalidez retorna ao caminho autoritativo com stats explícitos, não desloca o core. Patch main preparado em cópia pelo dono, aplicado somente depois dos recibos VFX/Physics. Não copiar main de snapshot. Pipeline segue o atual, um prepass.

## API do Combat — sem novo renderer ou prepass

A interface externa permanece `createClassSkillVfx`, `emit`, `syncState`, `update`, `reset`, `dispose`, setters quality/reduced. Não é necessário modificar o chamador atual de `pipeline.render(scene,camera,dt,classSkillVfx)`.

```js
const request = classSkillVfx.prepareSceneDepth(camera);
// { required, visibleFields, gravityFields, fireCasts, excludeRoots }
// required = Horizon visível OU fogo visível
// visibleFields = gravityFields + fireCasts (contagem de consumidores, não campos de dano)
// excludeRoots = união sem duplicatas das raízes Horizon e canhão

// Pipeline atual produz UMA textura e a publica no mesmo frame:
classSkillVfx.setSceneDepth({
  texture, encoding: 'rgba-packed', width, height, near, far,
  viewport: { x, y, width, height },
});
// setSceneDepth(null) invalida ambos. Cada prepare também invalida ambos.
```

O pool não possui/dispose a textura emprestada. Frame inválido, câmera fora, reset e dispose não reutilizam depth antigo. Pausa congela idade/simulação; renderer ainda chama prepare/prepass/setDepth, pois câmera pode mover. Sem consumidores visíveis, zero prepasses. Brasas finais ainda visíveis podem pedir depth para proteção de atores; elas não representam campo persistente. Cutaway/alpha/clipping e restauração de estado permanecem sob a implementação atual Combat/Environment, sem novo adaptador.

`getStats()` mantém `states.gravity` e acrescenta `cannon`, `sceneDepth:{required,gravityFields,fireCasts}`. `bodies.active/drawCalls` inclui o corpo do canhão; `bodies.cannonBodies` explicita sua parcela. `fireTrailSamples` histórico dos puffs antigos passa a zero para esse tiro; `pathDistance` continua telemetria acumulada. `cannon.casts` fornece castId, endpoint, hit, radius, impactAge, volume/core/brasas, quality/reduced; isso não expõe dano.

## Eventos, limites e cleanup

- CastId numérico ou string mantém identidade; cast/release deduplicados pelo wrapper. `cast` recebe emitter real e impactAt.30; `release` captura emitter atualizado; `travel` recebe segmento real; corpo usa bridge seguro do socket e converge ao target autoritativo, com rastro contínuo reamostrado a cada.18m. Janela visual~4.8m, igual a30/60/144Hz. Saltos>8m/gaps não são conectados artificialmente.
- `terminal:true` encerra voo sem fabricar explosão. `impact` único produz detonação no target recebido, inclusive se a autoridade decidir detonar no alcance máximo sem vítima. Miss sem evento impact não explode. Impact remoto isolado não cria muzzle/preparo fantasma. `end` cancela transiente; reset/dispose limpam tudo, sem recurso/dano/status sintético.
- Raio recebido3.4m recorta volume/brasas; default corrigido de3.2 para3.4 conforme core já vigente. Cast.30/voo22m/s/dano14/CD5 e alcance22 continuam exclusivamente Combat. Nenhum campo é criado; rastro termina.26s após voo, corpo sem travel expira.3s, slot sem tráfego.55s. Dissipação até2.2s é decorativa, com núcleo breve e pluma quebrando após expansão.
- Pool8casts pré-alocados; três materiais de volume/slot, corpo compartilhado e um batch de brasas/slot. Não existe teto artificial4draws. Se exceder8casts, slot mais antigo é reciclado e `overwritten` incrementa; não prometer carga ilimitada. High/medium/low32/24/16 passos e5/4/3oitavas; reduced preserva corpo/volume/raio e remove flicker/advecção rápida. Dados do emitter são capturados nos eventos; não reivindicar tracking por osso contínuo no preparo.

## Histórico de validação composição02:27 e custo02:15

**Evidência histórica anterior à origem core/socket; fonte final e status estão no manifesto origin acima.** [Confirmação normal02:27](../../output/playwright/2026-09-19T02-27-19-472Z-cannon-wrapper-vfx-native/cannon-wrapper-report.json) passou11capturas/mesmos alvos e câmera/high/low-reduced: mínimo combinado high1 **65.289%**, high4 **76.860%**, low1/4 **90.083%**. Gate65 inalterado, margem high1 só0.289p.p.; não prova robustez ampla ou gameplay. [Fatorial02:26](../../output/playwright/2026-09-19T02-26-01-042Z-cannon-wrapper-vfx-native/cannon-wrapper-report.json)16variantes PASS, mesma fonte de apresentação. GPU VFX liberada; nenhuma medição pesada própria ativa. O gate core→cano desta etapa foi atendido depois pelo native03:21, no escopo documentado.

CPU final02:27 wrapper18/18 + shared-depth7/7 PASS: seis IDs, pools emprestados, reutilização2000casts, corpo low/reduced, duas raízes/mesma textura/invalidate, pausa/offscreen/retorno, contato fornecido, terminal/miss/end, cleanup e cadence30/60/144.

[Native completo02:15:38](../../output/playwright/2026-09-19T02-15-38-208Z-cannon-wrapper-vfx-native/cannon-wrapper-report.json): contrato/parede/miss/lifecycle/memória PASS,12capturas e fonte estável;71geometrias/49texturas antes/depois20restarts; parede real modifica2761pixels quando retirada apenas do depth. High conjunto1fogo+gravidade+gelo reprovou:46.281% contra76.860% contexto, gate65% mantido. `passed:true` desse report é técnico; `artGate.allCombinedPassed:false` bloqueia promoção. Próximos reports fazem passed depender também desse gate.

[Diagnóstico02:21](../../output/playwright/2026-09-19T02-21-31-378Z-cannon-wrapper-vfx-native/cannon-wrapper-report.json) reproduziu a ROI original exatamente com sequência/câmera/alvos iguais; porém depois desativar brasas o controle da fixture não as reativava. Variantes subsequentes não são aprovação fatorial completa; erro de cleanup da própria instrumentação ao final também preservado. [Confirmação02:22](../../output/playwright/2026-09-19T02-22-58-095Z-cannon-wrapper-vfx-native/cannon-wrapper-report.json) reprovou61.157%, revelando o problema do toggle. Não atribuir a falha somente ao contexto herdado. Instrumentação corrigida para restaurar visibilidade por fator e shader original de volume/brasas. Nova candidata protege somente pixels de silhuetas, sem alterar emissão global/contagem/timing/raio. **Fatorial corrigido02:26 e confirmação normal02:27 PASS**, conforme [diagnóstico e limites](vfx-cannon-composition.md).

Custo do predecessor02:15, frame inteiro1280×720/HDR/depth/atores,18queries após6warmups: high1P957.224ms/high4P958.391ms; low/reduced1P954.254ms/4P955.254ms; os números de custo não são FPS/mobile/marginais. Não repetir suíte inteira por ajuste constante de máscara; medir custo novamente se mudar trabalho do shader/pipeline.

Ferramentas: `tools/cannon-wrapper-vfx-{cpu,native}.mjs`, `tools/cannon-depth-vfx-cpu.mjs`, `tools/cannon-wrapper-vfx-preview.html`. `BIPX_CANNON_FOCUS=diagnosis` congela o mesmo frame.86,16combinações original/candidato×bloom×volume×brasas, com alvo/câmera/ROI originais. Bloom é multiplicado por0/1 somente numa cópia temporária do pipeline usada pela fixture, preservando HDR/MSAA/exposição/passos; não há alteração shared/runtime ou proposta de desligar bloom no jogo. `BIPX_CANNON_FOCUS=silhouette` confirma fases e1/4bursts high/low, sem repetir custo/ciclo. Nenhuma fixture prova partida/input/colisão autoritativa.

## Native final e sequência autorizada

[Native03:21](../../output/playwright/2026-09-19T03-21-25-047Z-cannon-origin-vfx-native/cannon-origin-report.json) concluiu21capturas, dois playbacks RAF instrumentados, core+adapter literal+socket animado, parado/movendo/quina10Hz/near target/parede/high/low-reduced/reset/dispose, sem erros e com215fontes estáveis. Coexistência fogo/gelo/Horizon com um depth: mínimo108/121=89.256%, gate65; nova cena não substitui79/121=65.289% antiga. [Revisão VFX](../../output/qa/vfx-cannon-native-review-20260919/review.json) e [aceite Root](review/cannon-origin-native-followup.md). Quina tem frames antes/oculto/retomado, não revisão contínua do intervalo40ms. CustoGPU não foi medido novamente.

1. **Concluído VFX:** oito hashes conferidos e destinos promovidos sob lock, baseline e recibo preservados; fonte congelada. Nenhum teste global durante escritas. Physics publica seu recibo independente de contacts.
2. Combat aplica apenas seu callback no main corrente após ambos os recibos. Não modificar pipeline/Horizon ou copiar snapshots. Servidor5173 permanece sob Combat.
3. Combat valida backend isolado e canhão por input parado/movendo, alvos/parede/miss, coexistência, um depth atual, high/low-reduced, pause/reset e remoto/reconnect. Fixar novo manifesto de aplicação antes da captura integrada.
4. Revisar fases breves e descontinuidade em playback real com animação/SFX; JEF recebe observações honestas. AAA, rede e gameplay não são aceitos pela fixture.
