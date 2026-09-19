# Canhão volumétrico — preparação de integração, sem promoção

Direção v2 incorporada integralmente; esta entrega refina apenas `dwarf_explosive_cannon`. Arte selecionada pelo Root em [cannon-volume-v2-followup.md](review/cannon-volume-v2-followup.md). **Runtime congelado e intacto; janela Combat após Physics obrigatória.** Fontes preparadas em `assets/vfx/source-history/cannon-wrapper-integration-20260919/`; cópia de contexto não autoriza promover a pasta inteira. Os seis módulos novos e o wrapper abaixo são a única proposta. Nenhuma edição em main, pipeline, renderer, física, animação, dano/timings ou Horizon. Sem promoção automática.

## Plano exato de arquivos

Destino de cada nome: `src/vfx/<nome>`. [Manifesto completo com hashes anteriores/destinos](../../output/qa/vfx-cannon-wrapper-prepared-20260919.json). Confirmar o hash anterior do wrapper antes de promover; havendo drift, reaplicar somente o diff do canhão sobre a versão do dono, não restaurar snapshot.

| Arquivo | Operação | SHA-256 candidato |
| --- | --- | --- |
| `cannon-defaults.js` | novo | `010fbff04a43c19c2ec172c8d5bf0f35f13c6e5d816b4534202b521fd0f5187a` |
| `cannon-source-glsl.js` | novo | `5bd8cbcf8442e5fda9215ea3b2a18712dbb1e2bbdae0c717e4c130fb9fdc6d9d` |
| `cannon-vfx.js` | novo | `5158ae2641d2789b103c22d46270318555beb794bc8719ee83f918ab72e85286` |
| `class-skill-vfx.js` | substituir | `65f971506dade0a90e6d300b613e3a2aa7416beb06ecfc97b9e2b72beebe5ae5` |
| `fire-blackbody.glsl.js` | novo | `6570394ae1e8d0099af2924f46336341be990e7b35baf262c978a25f44b0e8ca` |
| `fire-common.glsl.js` | novo | `21dfd8ba599787bebedd856bc9dff368c493e71a7ad3b1ec23ad258d432c418b` |
| `fire-noise.glsl.js` | novo | `5c2c7c2f25f05b9a3d877efd12a39e7ab8a0f59dab54e22f09323a811989f3c2` |

`class-skill-vfx.js` importa e possui o pool novo; roteia somente fogo, remove duplicação de puffs/anel/muzzle antigos e agrega depth. `cannon-vfx.js` possui corpo térmico, três volumes reutilizáveis e brasas por slot. Shader/defaults/noise/common/blackbody são os cinco módulos de material. Forma/emissão/tempos continuam os selecionados01:53; máscaras localizadas de silhueta foram refinadas após diagnóstico de composição. Alterações do controlador são integração, amostragem por distância, cancelamento e lifecycle.

Original selecionado preservado em `assets/vfx/source-history/cannon-volumetric-staging-20260919/`, incluindo `iterations/`, fontes pinadas completas e MIT/provenance. Runtime Horizon final preservado em `assets/vfx/source-history/gravity-horizon-runtime-final-20260919/`. Não restaurar arquivos de main/renderers de nenhum arquivo histórico.

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

- CastId numérico ou string mantém identidade; cast/release deduplicados pelo wrapper. `cast` recebe emitter real e impactAt.30; `release` captura emitter atualizado; `travel` recebe segmento real, corpo no target e rastro contínuo reamostrado a cada.18m. Janela visual~4.8m, igual a30/60/144Hz. Saltos>8m/gaps não são conectados artificialmente.
- `terminal:true` encerra voo sem fabricar explosão. `impact` único produz detonação no target recebido, inclusive se a autoridade decidir detonar no alcance máximo sem vítima. Miss sem evento impact não explode. Impact remoto isolado não cria muzzle/preparo fantasma. `end` cancela transiente; reset/dispose limpam tudo, sem recurso/dano/status sintético.
- Raio recebido3.4m recorta volume/brasas; default corrigido de3.2 para3.4 conforme core já vigente. Cast.30/voo22m/s/dano14/CD5 e alcance22 continuam exclusivamente Combat. Nenhum campo é criado; rastro termina.26s após voo, corpo sem travel expira.3s, slot sem tráfego.55s. Dissipação até2.2s é decorativa, com núcleo breve e pluma quebrando após expansão.
- Pool8casts pré-alocados; três materiais de volume/slot, corpo compartilhado e um batch de brasas/slot. Não existe teto artificial4draws. Se exceder8casts, slot mais antigo é reciclado e `overwritten` incrementa; não prometer carga ilimitada. High/medium/low32/24/16 passos e5/4/3oitavas; reduced preserva corpo/volume/raio e remove flicker/advecção rápida. Dados do emitter são capturados nos eventos; não reivindicar tracking por osso contínuo no preparo.

## Validação e pendências atuais

**Fonte final preparada, ainda sem promoção.** [Confirmação normal02:27](../../output/playwright/2026-09-19T02-27-19-472Z-cannon-wrapper-vfx-native/cannon-wrapper-report.json) passou11capturas/mesmos alvos e câmera/high/low-reduced: mínimo combinado high1 **65.289%**, high4 **76.860%**, low1/4 **90.083%**. Gate65 inalterado, margem high1 só0.289p.p.; não prova robustez ampla ou gameplay. [Fatorial02:26](../../output/playwright/2026-09-19T02-26-01-042Z-cannon-wrapper-vfx-native/cannon-wrapper-report.json)16variantes PASS, mesma fonte de apresentação. GPU VFX liberada; nenhuma medição pesada própria ativa. Continuam gate de continuidade core→cano e janela Combat.

CPU final02:27 wrapper18/18 + shared-depth7/7 PASS: seis IDs, pools emprestados, reutilização2000casts, corpo low/reduced, duas raízes/mesma textura/invalidate, pausa/offscreen/retorno, contato fornecido, terminal/miss/end, cleanup e cadence30/60/144.

[Native completo02:15:38](../../output/playwright/2026-09-19T02-15-38-208Z-cannon-wrapper-vfx-native/cannon-wrapper-report.json): contrato/parede/miss/lifecycle/memória PASS,12capturas e fonte estável;71geometrias/49texturas antes/depois20restarts; parede real modifica2761pixels quando retirada apenas do depth. High conjunto1fogo+gravidade+gelo reprovou:46.281% contra76.860% contexto, gate65% mantido. `passed:true` desse report é técnico; `artGate.allCombinedPassed:false` bloqueia promoção. Próximos reports fazem passed depender também desse gate.

[Diagnóstico02:21](../../output/playwright/2026-09-19T02-21-31-378Z-cannon-wrapper-vfx-native/cannon-wrapper-report.json) reproduziu a ROI original exatamente com sequência/câmera/alvos iguais; porém depois desativar brasas o controle da fixture não as reativava. Variantes subsequentes não são aprovação fatorial completa; erro de cleanup da própria instrumentação ao final também preservado. [Confirmação02:22](../../output/playwright/2026-09-19T02-22-58-095Z-cannon-wrapper-vfx-native/cannon-wrapper-report.json) reprovou61.157%, revelando o problema do toggle. Não atribuir a falha somente ao contexto herdado. Instrumentação corrigida para restaurar visibilidade por fator e shader original de volume/brasas. Nova candidata protege somente pixels de silhuetas, sem alterar emissão global/contagem/timing/raio. **Fatorial corrigido02:26 e confirmação normal02:27 PASS**, conforme [diagnóstico e limites](vfx-cannon-composition.md).

Custo do predecessor02:15, frame inteiro1280×720/HDR/depth/atores,18queries após6warmups: high1P957.224ms/high4P958.391ms; low/reduced1P954.254ms/4P955.254ms; os números de custo não são FPS/mobile/marginais. Não repetir suíte inteira por ajuste constante de máscara; medir custo novamente se mudar trabalho do shader/pipeline.

Ferramentas: `tools/cannon-wrapper-vfx-{cpu,native}.mjs`, `tools/cannon-depth-vfx-cpu.mjs`, `tools/cannon-wrapper-vfx-preview.html`. `BIPX_CANNON_FOCUS=diagnosis` congela o mesmo frame.86,16combinações original/candidato×bloom×volume×brasas, com alvo/câmera/ROI originais. Bloom é multiplicado por0/1 somente numa cópia temporária do pipeline usada pela fixture, preservando HDR/MSAA/exposição/passos; não há alteração shared/runtime ou proposta de desligar bloom no jogo. `BIPX_CANNON_FOCUS=silhouette` confirma fases e1/4bursts high/low, sem repetir custo/ciclo. Nenhuma fixture prova partida/input/colisão autoritativa.

## Novo gate de continuidade core→apresentação

[Achado Root](review/cannon-origin-followup.md) incorporado: core release/primeirotravel(-2,1.05,5), socket capturado(-1.762649,1.764134,3.602243), distância1.587465m. A fixture artística parte do socket e portanto não prova esse fluxo real. **Promoção depende também de teste bounded com core+adapter literal, parado/em movimento e alvo/parede muito próximos.** A ligação visual deve partir do cano e terminar no contato verdadeiro; não deslocar origem/altura1.05/dano/alcance autoritativos nem atravessar parede junto ao emissor. Ainda não há correção ou prova perceptual de gameplay deste gate. Composição vem primeiro, conforme Root; contrato de solução será coordenado com Combat sem editar main alheio.

## Sequência de integração proposta

1. Combat fecha Physics/spawn/rede e confirma janela; VFX confirma os sete hashes e guarda baseline. Resolver/revisar gates de coexistência e continuidade cano→trajeto antes de considerar fonte pronta para promoção.
2. VFX promove somente sete arquivos listados. Combat mantém seu pipeline/main atuais: chamada de render e eventos já são compatíveis. Nenhuma promoção silenciosa de Environment/Animation.
3. Validar no jogo canhão por input contra alvos vivos, parede/miss e gravidade+gelo, high/low-reduced, pausa/restart/remoto/reconnect. Verificar `depth.passes===1` e ambos consumidores atuais quando coexistirem. Atualizar manifesto de gameplay antes de capturas integradas; staging não substitui essa prova.
4. Root revê fases breves.74→.86 com animação/SFX, alcance3.4 e desaparecimento. Só então próxima decisão de integração/arte. AAA/JEF continuam pendentes.
