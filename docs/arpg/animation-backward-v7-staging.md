# Ré v7 — captura de apoio e direção do forefoot, somente staging

**Candidato `9a530ce1e9b45009f15410ffbbd7a47e1789650cd8ef186a07d12c23864890e9` retido. Não promover.** O witness Strafe→ré204–206 foi corrigido em CPU, e o apoio em ré melhorou causalmente. A matriz ampliada encontrou regressão na saída oposta ré→Strafe6.5: reach adicional de27.23mm a30Hz e7.25mm a60Hz. `acceptedNoSliding:false`; nenhuma captura GPU v7, nenhuma aprovação visual/AAA/global.

[Manifesto e integridade](../../output/arpg-animation/backward-v7/comparison.json), [fonte candidata](../../output/arpg-animation/backward-v7/candidate/src/assets/hero-locomotion.js), [antes v6 preservado](../../output/arpg-animation/backward-v7/before/src/assets/hero-locomotion.js). Runtime continua **07952bfc**, sidecar ativo6cb29422, takes/GLBs/rig/arma/auditor preservados. Candidato usa o mesmo sidecar retido d3cd29b3 da v6; só o controlador mudou. Não reutiliza RunBackwardFast nem target-foot rejeitados. Nenhuma edição de main/server/Lich/GUI/Physics/VFX/SFX, fila ou interrupt.5173 observado ligado em PID18430, sem operação por Animation.

## Sequência autorizada e evidência

A [revisão nativa final da v6](animation-backward-v6-native-ab.md) foi publicada antes da alteração. O [followup root](review/animation-backward-v6-followup.md) foi incorporado: base elevada204–205, recuperação abrupta206, aterrissagem mais plausível apenas nos frames examinados; cobertura/P90 não aprovados. Seis clipes e18poses v6 preservados, sem chamar fixture de gameplay.

Primeiro foi executado apenas o replay limitado: curva9.1 até frame217, um ciclo completo de ré6.5 (406–449) e9.1 (343–376), com toda a história anterior preservada no JSON. [Traço comparado](../../output/arpg-animation/backward-v7/bounded-comparison.json). Não descartei frames da simulação; os ciclos são janelas diagnósticas explícitas, não substituem os três segundos do auditor. A instrumentação vive em outras cópias; cada pose foi comparada com ator sem hooks, perturbação **zero**. O [runner](../../tools/animation-backward-v7-witness.mjs) deriva das ferramentas de contato existentes.

Somente após a melhora nesses witnesses foram executados os dois casos120Hz do auditor intacto e os20casos existentes a30/60Hz (start-stop, turn, três casts,6.5/9.1). Auditor continua hash50294fbc, banda8mm, patch3mm e velocidade vertical.05m/s; mesmos vértices/flags, sem exclusões novas. Cópias e hashes estão no manifesto. Captura GPU não foi solicitada.

## Causas e alterações

**1. Referência da pose misturada.** Na v6, ao entrar no take de ré no frame200, o controlador mantém140ms de crossfade, mas aplica imediatamente a direção pura do novo take ao deslocamento da pose ainda dominada por Strafe. Vértice217 direito chega a50.16m/s total entre199/200 (aproximadamente83.6cm). O salto aparece no estágio IK/remapeamento: componenteZ−49.92m/s, contra+21.90m/s no estágio layered. O anchor é capturado em `[14.6477,.002,18.4208]`; reach sobe202→205 até.420730m. No205 troca217→99 já a.189368m do piso;206 recupera abruptamente.

A v7 calcula a direção usando os pesos reais **somente das ações ativas** durante a entrada no donor. A API Three mantém effectiveWeight em ações paradas usadas para medir perfis: a primeira variante que não filtrava `isRunning()` foi rejeitada, nunca promovida. O perfil/flags não mudam.

**2. Previsão de aterrissagem usa outra referência.** As amostras futuras de landing vêm do take puro. Aplicar a direção misturada a essas amostras abriu a passada no frame213 (1.501m entre tornozelos versus máximo anterior1.426m). Variante preservada/rejeitada. A previsão agora usa a direção pura do próprio perfil; só a pose atual usa a direção misturada. Isso preserva a desaceleração da aterrissagem e remove a abertura adicional máxima desse replay.

**3. Deriva do forefoot em apoio.** [Decomposição material](../../output/arpg-animation/backward-v7/forefoot-cause.json): vértice39,82.62% ToeBase/17.38% Foot, desliza2.044/2.665m/s em6.5/9.1 enquanto anchor2 não muda. ToeBase gira em torno do eixo vertical a12.483/16.268rad/s; parte adicional vem da deformação entre Foot/Toe (resíduo3.79/5.01mm frente à previsão rigidamente ligada ao Foot). Portanto não é só troca de witness ou clamp vertical.

A v7 conserva a direção horizontal do forefoot durante apoio declarado, mantendo pitch e articulação local do toe. A correção de yaw é devolvida pelo envelope existente do swing, sem trocar flags ou ampliar comprimentos. Isso reduz a rotação tangencial da sola. Ainda é uma correção de apresentação retida: sua interação com curvas/saída de gait falha abaixo.

**4. Referência vertical após limite do IK.** A primeira variante de heading criou penetração−.016306m no206: o IK tinha resolvido tornozelo acima do alvo inalcançável; a correção de piso somava a folga ao alvo antigo, perdendo18.3mm ao resolver de novo. A v7 parte do tornozelo efetivamente resolvido quando esse clamp ocorreu no donor. Não move o quadril. Variante anterior está em `variants/heading-only`; não enfraqueceu auditor nem encobriu a falha.

## Resultados limitados e auditor independente

Nos frames204/205/206, sola direita agora~.002m e reach **zero**, contra.1697/.1894/.0316m e reach.3016/.4207/.1683m. Máximo reach da janela195–217 cai.420730→.003099m; resíduo.003099/sola−.004907 pertence ao strafe esquerdo199, anterior à entrada do donor e idêntico ao antes. O intervalo todo permanece no report.

Distância máxima entre tornozelos nessa janela não cresce:1.425800m antes/depois. Nos frames204–206 a base fica menor, não se resolve por abertura máxima maior. No200 ela é maior que o colapso antigo (.713→1.102m), porém menor que o1.426m do199; aceitação da silhueta exige próxima inspeção nativa, ainda pendente. Nos ciclos retos a distância máxima cai1.134→1.092 e1.194→1.155m. Não houve salto comum do quadril.

| Auditor completo120Hz | v6 | v7 | Original07952 (histórico) |
|---|---:|---:|---:|
| ApoioP90 ré6.5 | .676366 | **.073688m/s** | .137075 |
| ApoioP90 ré9.1 | .296830 | **.088466m/s** | .259328 |
| TransiçãoP90 ré6.5 | .372532 | .373935m/s | 1.946317 |
| TransiçãoP90 ré9.1 | .489240 | .491315m/s | 3.882069 |
| Cobertura6.5 |19.444%|19.444%|31.528%|
| Cobertura9.1 |17.500%|17.500%|23.889%|

Apoio mantém376/303amostras, transição30/33; alcance máximozero e mínimo de sola~.002m nas duas ré constantes. Released-release continua **count0/null, não pass**. A cobertura permanece menor que07952. O witness de aterrissagem14493 fica.397136/.496816m/s, versus v6.397000/.496655: ganho grande da v5 preservado, pequena diferença numérica registrada, não alegada igualdade exata.

## Expansão e falhas que impedem promoção

[20casos comparados](../../output/arpg-animation/backward-v7/matrix-comparison.json), [paridade de corpo/props/rig](../../output/arpg-animation/backward-v7/pose-parity.json). Todos os frames, trajetórias e flags iguais. Sem penetração adicional em nenhum frame. Ossos/objetos protegidos no mundo diferem no máximo8.88e−16, relativo ao quadril5.68e−14; posições locais/comprimentos e escalas dos ossos têm diferença zero. Fonte estável.

**Gate de reach adicional FALHA** em ré6.5→Strafe, direita: frame53/30Hz+.027233m e106/60Hz+.007248m. Esses frames não viram pass por terem patch countzero. [Replay estreito antes](../../output/arpg-animation/backward-v7/outgoing-before/summary.json) e [depois](../../output/arpg-animation/backward-v7/outgoing-candidate/summary.json) preservam oito frames em torno de cada ocorrência e todos os passos anteriores. Mesmo controle sem hooks, perturbaçãozero.

No pior30Hz, anchor permanece `[.4921,.0103,11.3831]`, yaw retido chega−11.91°;60Hz chega−13.18°. A conservação dessa direção exige um tornozelo mais afastado enquanto o quadril percorre a curva. No frame seguinte, `clearContacts()` ao trocar para Strafe zera yaw e anchor: máximo material sobe21.91→23.79m/s (30Hz) e34.58→39.53m/s (60Hz), mesmo com contact=true em ambos os frames. **Transição de gait precisa ser examinada mesmo quando o flag não muda.** Não excluir do gate.

Outros casos continuam ruins: start-stop6.5/30Hz apoioP903.615m/s e9.1/60Hz6.249m/s; curva6.5/30Hz transiçãoP906.322m/s. Curva9.1/60Hz máxima reach global cai.420730→.112453m, mas transiçãoP90 vai2.256859→2.337894m/s;9.1/30Hz reach ainda.148279m. Melhora do witness local não resolve essas falhas.

**Próxima causa observada:** continuidade da compensação de yaw/anchor ao sair ré→Strafe e restrição geométrica do pivô antes dessa saída. Investigar o alvo/material da mesma ocorrência53/106 e54/107, sem saltar anchor, alterar flags, reduzir velocidade ou baixar quadril. Não simplesmente abrandar o gate nem cancelar o yaw abruptamente. Este é o próximo trabalho limitado; candidato atual fica congelado para auditoria CPU, sem nova matriz/GPU até haver alteração causal justificada.

## Reproduzir / fontes liberadas

```sh
node tools/animation-backward-v7-witness.mjs output/arpg-animation/backward-v7/candidate /tmp/bipx-v7-witness-new
node output/arpg-animation/backward-v7/candidate/docs/arpg/review/sole-contact-audit.mjs --case=dwarf:backward --transition-detail
node output/arpg-animation/backward-v7/candidate/docs/arpg/review/sole-contact-audit.mjs --case=dwarf:upgraded-backward --transition-detail
```

Escolher outputnovo para o witness; ferramenta recusa sobrescrever. Runner da matriz, paridade e replay estreito estão arquivados no staging. Variantes intermediárias preservadas em `variants/`; somente9a530ce1 é o checkpointv7, ainda **reprovado para promoção**. Não reinterpretar a autorização diagnóstica GPUv6 como autorização GPUv7. APIs/skills/corte runtime v2 continuam liberadas e congeladas no handoff anterior; esta revisão não modifica sua integração nem seus timings.
