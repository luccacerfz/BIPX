# Ré v8 — continuidade geométrica diagnosticada, candidato retido

**Não promover `45588e13`.** A tentativa elimina o alcance adicional da v7 nos pivôs 53/106 e reduz a ruptura imediata 54/107, mas piora o apoio material a 60 Hz e a saída para swing a 30 Hz. Não houve expansão da matriz, GPU ou edição do runtime. `07952bfc` continua ativo; `9a530ce1` e todas as tentativas intermediárias estão preservadas.

Pedido [root v7](review/animation-backward-v7-followup.md) incorporado: cópia distinta, história completa antes dos witnesses, mesmos flags, velocidade, rig, quadril e auditor. O pacote Lich encerrou esta etapa no [handoff de staging](animation-lich-integration-plan.md); não há integração runtime nova. Brute v4 e pacote SFX de 40 grupos não foram tocados.

## Fonte e reprodução

- [Candidato](../../output/arpg-animation/backward-v8/candidate/src/assets/hero-locomotion.js): **45588e137ce116d391f9e8e30da54fe4714ca4e480a9f85ea56a54de91f61500**.
- [Antes preservado](../../output/arpg-animation/backward-v8/before/src/assets/hero-locomotion.js): **9a530ce1e9b45009f15410ffbbd7a47e1789650cd8ef186a07d12c23864890e9**.
- Runtime: **07952bfc2e36dfed257a9f6f27dd582981c89a8dd2c791a92c1c1724be65f2b5**.
- [Comparação, hashes, decomposição por etapa e ablações](../../output/arpg-animation/backward-v8/comparison.json). Só o controller difere entre os 19 arquivos das duas cópias. Takes, GLBs, probes, skill module e auditor são idênticos ao snapshot v7. Auditor **50294fbc**; donor staged **d3cd29b3**, sem promover take ao runtime.
- [Replay limitado](../../output/arpg-animation/backward-v8/witness-runner.mjs), derivado do tooling de contato existente; [gerador do relatório](../../output/arpg-animation/backward-v8/report.mjs). Não é um novo framework nem substituto da auditoria independente.

```sh
node output/arpg-animation/backward-v8/witness-runner.mjs output/arpg-animation/backward-v8/before /tmp/bipx-v8-before-new
node output/arpg-animation/backward-v8/witness-runner.mjs output/arpg-animation/backward-v8/candidate /tmp/bipx-v8-candidate-new
```

O destino deve ser novo. Replay CPU de curva 6.5 m/s, 57 frames a 30 Hz e 111 a 60 Hz, começando sempre no frame zero. Focos fixos 49–56 e 103–110, sem saltar a entrada, o pivô ou a liberação. Os JSONs [antes](../../output/arpg-animation/backward-v8/before-bound/summary.json) e [depois](../../output/arpg-animation/backward-v8/final-bound/summary.json) incluem toda a história, duas pernas e estágios layered/IK/landing/anchor/floor/final. Cada replay compara uma instância instrumentada com outra sem instrumentação: perturbação zero e fonte estável.

Estes focos de oito frames **não são ciclos completos**. Patches usam os mesmos critérios físicos: piso 8 mm, proximidade ao mínimo 3 mm, velocidade vertical 0.05 m/s; todos os vértices com peso Foot/Toe > .75. A velocidade do mesmo vértice é medida inclusive fora desse patch, para não esconder transientes pelo flag ou pela altura. `transition.count=0 / p90=null` nos dois focos significa ausência de amostra qualificada, não aprovação.

## Causa e implementação em cópia

1. **Pivô antes da troca:** na v7, conservar o yaw do antepé ao redor do anchor exige tornozelo fora da esfera de alcance. Frame 53: pedido 0.853153 m para alcance conservador 0.825093 m; com yaw zero, 0.822365 m. Frame 106: 0.833168 m versus 0.825093 m; zero yaw 0.804803 m. A primeira ablação conserva o ponto e cede apenas o yaw até a interseção, sem mudar comprimentos, flags ou solver `.998`; o limite conservador `.997` já existia. Remove reach, mas não resolve a troca seguinte.
2. **Troca ré→Strafe:** `clearContacts()` descarta yaw/apoio apesar de `contact=true` nos dois frames. O rótulo da ação também muda antes de sua pose completar o crossfade. A tentativa final usa a base direcional das ações efetivamente misturadas e transporta o apoio existente apenas nessa saída do donor. Não prolonga o contato: a máscara do take continua determinando a liberação e o envelope existente absorve o residual.
3. **Ordem vertical:** escolher o arco de yaw com a altura anterior ao ajuste de piso força rotação excessiva. A tentativa usa primeiro a altura de tornozelo exigida pelo piso durante esse handoff, depois resolve o arco. O ajuste ocorre nas pernas após o cálculo original de pelvis yield; não altera quadril/torso. A geometria deriva da distância entre hip, ankle, anchor e offset do vértice; nenhum erro reportado é truncado artificialmente.
4. **Mudança de patch:** quando o novo mínimo já estava apoiado no frame anterior, a tentativa usa aquela posição mundial medida para transferir o anchor antes do solve. Não o ancora só depois que já deslizou no frame atual. Exige o mesmo vértice mínimo anterior/atual, contato existente e ponto anterior junto ao piso; não muda os critérios do auditor.

O arco completo de yaw mostrou por que zerar reach é insuficiente. A interseção pode exigir giro rápido da bota e acelerar outros vértices da sola. A variante final reduz esse efeito, mas ainda falha. Campos diagnósticos `yawArc/yawReach` podem guardar a última avaliação quando não há nova restrição; o relatório causal usa poses e vértices atuais de cada etapa, não interpreta esses campos persistidos como uma nova resolução por frame.

## Antes/depois limitado

| Medida no foco | 30 Hz antes → v8 | 60 Hz antes → v8 |
|---|---:|---:|
| Reach máximo | 27.233 mm → 0 | 7.248 mm → 0 |
| Apoio material P90 | .396125 → .018182 m/s | **.179939 → .763592 m/s** |
| Amostras de apoio | 2 → 2 | 12 → 12 |
| Cobertura do foco | 6.25% → 6.25% | 18.75% → 18.75% |
| Sola mínima | ~2 mm → ~2 mm | ~2 mm → ~2 mm |
| Separação máxima dos tornozelos | 1.208624 → 1.208624 m | .708029 → .701448 m |

Apenas duas amostras a 30 Hz não sustentam conclusão global. Os picos de separação já existiam; sua igualdade não é aprovação visual da abertura das pernas.

Velocidade horizontal do **mesmo vértice 39** do pé direito, sem excluir frames elevados ou released:

| Frame | Antes | v8 | Leitura |
|---|---:|---:|---|
| 53 / 30 Hz | .463534 | 1.368307 | Pivô perde reach, mas acelera borda |
| 54 / 30 Hz | 19.344809 | .487037 | Ruptura imediata reduzida |
| 56 / 30 Hz | 2.892198 | **6.709820** | Liberação seguinte piora |
| 106 / 60 Hz | .204812 | .935464 | Mesmo compromisso do pivô |
| 107 / 60 Hz | 34.014032 | 4.452484 | Melhora insuficiente |
| 108 / 60 Hz | .881904 | **4.000138** | Transferência ainda perturba borda |

Unidade m/s. O vértice 39 não é apresentado como patch de chão nesses frames: a tabela é a continuidade material do witness histórico. Todos os patch samples físicos permanecem nos JSONs.

**Witness causal restante, frame 108 / 60 Hz:** após transferir ao vértice 99, sua velocidade horizontal é **.0000274 m/s**, mas vértices 94/95 têm **.778367 m/s** e 120/121 **.763592 m/s**, com os critérios de patch satisfeitos. O yaw aplicado passa de .220986 para .538002 rad entre 107–108 para manter o anchor alcançável. Logo, imobilizar um ponto não imobiliza a base da bota. O problema restante é rotação da região apoiada na pose misturada, não falta de flag ou só translação global do personagem.

## Ablações preservadas

Todas foram o mesmo replay estreito com história, não uma matriz global. Cópias em `output/arpg-animation/backward-v8/variants/`, instrumentos/traços separados e hashes completos na comparação.

| Variante | Hash | Resultado que impede aceite |
|---|---|---|
| Pivô isolado | 91ed4310 | Reach removido; reset da saída persiste |
| Base misturada de saída | 9d7446b7 | Nova penetração até 63.48 mm; patch vazio não é pass |
| Transporte só do residual | 4d5719fe | Novo reach 10.05 mm / 60 Hz |
| Continuidade do anchor, yaw limitado a zero | 98b321a1 | Reach até 100.76 mm / 60 Hz |
| Interseção do arco completo | f6ef44d6 | P90 7.474 m/s / 60 Hz apesar de reach zero |
| Altura de piso antes do arco | 96c7fd4e | P90 1.735 m/s / 60 Hz |
| Transferência material anterior, candidato final | 45588e13 | P90 .764 m/s / 60 Hz e liberação 30 Hz piores |

## Preservação, decisão e próxima causa

Nos **168 frames anteriores e de foco**, diferença máxima de matrizes mundiais dos ossos protegidos e objetos/props = **zero**; posições/escalas locais das pernas = **zero**; trajetória = **zero**; flags idênticos. Nenhum reach ou penetração adicional por frame na variante final versus v7. Não há salto comum do quadril nem abertura adicional máxima das pernas nesta prova. Isso não cobre movimentos fora dos dois replays.

**Gate limitado ainda falha. Não ampliar para 6.5/9.1/start-stop/cast nem GPU com este sinal.** A v7 permanece preservada, mas também retida. Seus ganhos .074/.088 e suas falhas globais continuam históricos; não foram revalidados nem herdados como aprovação da v8. `acceptedNoSliding:false`.

Próxima hipótese concreta para uma nova etapa limitada: estudar a compatibilidade da **orientação e altura do antepé da pose misturada antes da aquisição do novo patch**, confrontando o arco de yaw alcançável com a rotação material dos vértices 94–99–120. A solução precisa reduzir essa rotação e a liberação 56 sem transportar o erro ao quadril, sem conservar apoio além da máscara e sem trocar a métrica por apenas um anchor estável. Repetir o mesmo prefixo/witness primeiro; ainda não há justificativa para um novo take, retarget amplo, captura ou promoção.

**Readiness:** fonte e diagnóstico liberados para leitura/CPU root; runtime/API continuam congelados para Combat canhão+contacts. Nenhum arquivo main/server, auditor, GLB/take, GUI, Lich ou Brute/SFX editado. Sem GPU, fila/interrupt, restart ou operação do servidor5173 nesta etapa.
