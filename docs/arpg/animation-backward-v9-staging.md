# Ré v9 — antepé/roll melhora apoio, liberação ainda reprova

**Candidato `cae3cb8e` retido. Não promover, não iniciar GPU nem matriz ampla.** A hipótese de pose foi implementada em cópia separada: apoio material P90 a60Hz passou de.763592 para.053884m/s, sem reach adicional ou perda de cobertura do foco. Porém a liberação112/60Hz piorou8.829→8.977m/s e a56/30Hz ainda mede5.828m/s. A região apoiada também não ficou integralmente estável em todos os frames. `acceptedNoSliding:false`.

[Revisão root v8](review/animation-backward-v8-followup.json) e clarificação de suporte corporal incorporadas. **Paridade exata do torso é controle causal desta ablação, não objetivo artístico final.** Não foi aplicada correção de pelvis. A análise separa incompatibilidade de uma pose específica de impossibilidade geral com pelvis fixa; esta última não foi demonstrada.

## Fonte, escopo e reprodução

- [Candidato isolado](../../output/arpg-animation/backward-v9/candidate/src/assets/hero-locomotion.js): **cae3cb8edcff73c2774f36f3ad4cd4c3066f3c0bb96d2c0392429db96eeeebf4**.
- [Antes v8 preservado](../../output/arpg-animation/backward-v9/before/src/assets/hero-locomotion.js): **45588e137ce116d391f9e8e30da54fe4714ca4e480a9f85ea56a54de91f61500**.
- Runtime: **07952bfc2e36dfed257a9f6f27dd582981c89a8dd2c791a92c1c1724be65f2b5**, inalterado.
- [Comparação causal e hashes](../../output/arpg-animation/backward-v9/comparison.json), [diff](../../output/arpg-animation/backward-v9/candidate.diff), [runner](../../output/arpg-animation/backward-v9/witness-runner.mjs). Mesmos19arquivos da cópia v8; só controller difere. GLBs, rig, takes, props, skill module, probes e auditor preservados. Auditor50294fbc, donor staged d3cd29b3, sem promoção.

Replay de curva6.5m/s a30/60Hz desde o frame zero, mesma trajetória. Foram mantidos os focos originais49–56/103–110 e acrescentados **apenas os frames imediatamente seguintes da mesma execução**, até60/120, para observar release56/112 e continuidade. Total182frames; não é nova matriz, nem um ciclo completo.

```sh
node output/arpg-animation/backward-v9/witness-runner.mjs output/arpg-animation/backward-v9/before /tmp/bipx-v9-before-new
node output/arpg-animation/backward-v9/witness-runner.mjs output/arpg-animation/backward-v9/candidate /tmp/bipx-v9-candidate-new
```

Destinos novos. [Antes final](../../output/arpg-animation/backward-v9/before-final/summary.json) e [candidato final](../../output/arpg-animation/backward-v9/candidate-final/summary.json) incluem história, duas pernas, poses do driver e mesh por estágio, velocidades dos mesmos vértices e todos os patches físicos qualificados. Instâncias instrumentadas e sem instrumentação coincidem, perturbação zero, fonte estável.

Critérios físicos intactos: piso8mm, patch a3mm do mínimo, velocidade vertical.05m/s, skin Foot/Toe>.75. Flags e entradas idênticos em todos os182frames. Nenhum frame foi removido quando ficou elevado/released. No foco, `transition.count=0 / p90=null` permanece **ausência de amostra qualificada**, não aprovação. As velocidades fora do patch estão registradas separadamente, sem chamar swing de apoio.

## Hipótese isolada e ablações

1. **Diagnóstico de região rígida:** alinhar o triângulo94–99–120 ao apoio anterior, mantendo a articulação original entre pé e dedos, produz uma posição de tornozelo exigida antes do clamp. [Script/dados](../../output/arpg-animation/backward-v9/region-feasibility.mjs), [resultado](../../output/arpg-animation/backward-v9/region-feasibility.json). Em108/60Hz exige37.095mm além do alcance `.998`; uma correção exclusivamente vertical, com esse mesmo alvo, precisaria48.005mm. Em111/60Hz a distância horizontal já excede o alcance, logo descida vertical sozinha não serve. Essa conclusão é **condicional à pose e ao alvo**, não prova sobre todas as articulações possíveis. Os frames released nesse contrafactual ilustram por que não se deve continuar prendendo a região após a máscara liberar.
2. **ToeBase mundial estável, tornozelo livre** (`6568393a`): preservar a orientação do antepé a partir do patch material realmente apoiado no frame anterior, antes da nova aquisição, reduz rotação da região. O osso ToeBase controla a orientação, mas a avaliação continua nos vértices deformados. Preservar apenas essa orientação introduziu reach15.737mm e sola14.37mm em108/60Hz, perdendo cobertura; variante rejeitada.
3. **Roll do calcanhar** (`3a4ee898`): permite rotação de Foot ao redor do eixo transversal do antepé, enquanto ToeBase conserva a orientação apoiada. Procura a menor correção que satisfaz simultaneamente o piso real e a esfera de alcance `.997`. O solver físico `.998`, os comprimentos e a máscara não mudam. Em108/60Hz uma correção de−2.651° torna o pedido0.841657m alcançável em0.825092m. Isso demonstra que o primeiro conflito podia ser resolvido por pose, sem mover a pelvis.
4. **Release da pose** (`14f1a214`; final `cae3cb8e` acrescenta diagnóstico por frame): mantém orientação no instante de release, conserva a clearance original e dissipa a diferença de Foot/ToeBase pelo envelope de swing existente, normalizado no instante da liberação. Não prolonga o contato. A continuidade melhora parcialmente a30Hz, mas falha a60Hz e desloca erros para amostras seguintes. Retido.

Ablações em `output/arpg-animation/backward-v9/variants/`, com traços próprios `toe-pose-trace`, `heel-roll-trace`, `pose-release-trace`. O candidato final só acrescenta detalhes diagnósticos e limpa `regionFit` a cada frame; não usa resultados antigos como se fossem avaliação atual.

A busca de roll é diagnóstica e localizada: até±60°, passos3° e refinamento da primeira solução. Um insucesso nessa busca **não prova impossibilidade para toda orientação ou suporte corporal**. Nenhuma performance/runtime-readiness é alegada para esse solver experimental. A tolerância numérica de10µm na procura não altera o auditor; a correção de piso original continua aplicada ao resultado.

## Medições sem trocar a amostra

| Foco original | v8 | v9 |
|---|---:|---:|
| ApoioP90 /30Hz | .018182 | .034482m/s |
| Amostras/30Hz | 2 | 4 |
| Cobertura/30Hz | 6.25% | 6.25% |
| ApoioP90 /60Hz | .763592 | .053884m/s |
| Amostras/60Hz | 12 | 20 |
| Cobertura/60Hz | 18.75% | 18.75% |
| Reach máximo /ambos | 0 | 0 |
| Sola mínima /ambos | ~2mm | ~2mm |

A30Hz os **mesmos vértices2/3**, em55, pioram.018182→.034482m/s; não é só efeito da adição de94/95 ao patch. A amostra é pequena e o resultado não vira aprovação.

Região original,108/60Hz:

| Vértice | XZ v8→v9 | Y v8→v9 | Situação física |
|---|---:|---:|---|
| 94/95 | .778367→.029288m/s | .008673→−.026093m/s | Patch permanece qualificado |
| 99/100 | .0000274→.0000108m/s | aproximadamente0 | Anchor continua quase imóvel |
| 120/121 | .763592→.039606m/s | .029675→**.051358m/s** | Sai do patch pela velocidade vertical>.05 |

O120 melhora horizontalmente mesmo fora do patch, mas **não satisfaz o critério completo nesse par**. O limite não foi relaxado. Em109 ele volta a qualificar; em110 sua velocidade vertical volta a.069793m/s. A30Hz/55,120 continua elevado a12.11mm (antes24.86mm), portanto a região inteira não ficou plantada.

[Pesos extraídos do GLB original](../../output/arpg-animation/backward-v9/skin-region.json), [extrator](../../output/arpg-animation/backward-v9/skin-region.mjs):94/95 usam72.30%ToeBase+27.70%Foot;99/100,67.39%+32.61%;120/121,59.30%+40.70%. Logo, preservar um osso não torna a região material rígida. Sua orientação/altura ainda depende das duas articulações e do skinning; nenhum peso foi editado.

## Liberação e incompatibilidade restante

Mesmo vértice39, velocidade horizontal sem filtro de contato:

| Frame | v8 | v9 |
|---|---:|---:|
| 54/30Hz | .487037 | .487037m/s |
| 56/30Hz, release | 6.709820 | **5.827654m/s** |
| 58/30Hz | 16.992214 | **17.562428m/s** |
| 59/30Hz | 20.461695 | **20.898619m/s** |
| 107/60Hz, entrada do patch | 4.452484 | 4.452484m/s |
| 108/60Hz | 4.000138 | .131622m/s |
| 111/60Hz, último apoio | .056387 | .154529m/s |
| 112/60Hz, release | 8.829193 | **8.976903m/s** |
| 113/60Hz | 19.865495 | 17.229691m/s |
| 116/60Hz | 14.416464 | **16.076323m/s** |

Entrada54/107 permaneceu idêntica: a orientação é adquirida do primeiro patch material efetivamente apoiado, não de um frame anterior elevado. A hipótese resolve parte da aquisição seguinte, não toda a entrada do crossfade. Velocidades grandes durante swing não são classificadas automaticamente como slide, mas as novas pioras temporais e os saltos de release impedem ampliar o teste ou alegar fluidez.

`regionFit` registra alvos, hip/ankle/anchor, eixo, ângulos, piso previsto e distância **antes do clamp**. Em111/60Hz o pedido sem roll é.828788m para limite.825093m e viola o piso. Nos ângulos amostrados que respeitam piso, o menor pedido é.933335m. Em56/30Hz e112/60Hz nenhum ângulo testado preservou simultaneamente o ponto anterior, clearance e alcance; os menores pedidos amostrados compatíveis com piso foram1.050538m e1.088226m. O fallback conserva o comprimento físico e permite deslocamento, por isso reach final zero não apaga a inviabilidade do pedido nem o salto material.

Esses números não justificam adicionar um deslocamento arbitrário de pelvis. [Proposta separada de próximo diagnóstico de suporte corporal](animation-backward-v9-body-support-proposal.md) preserva o controle causal atual e explicita o que ainda falta demonstrar antes de implementar outra variante.

## Preservação e decisão

Nos182frames: trajeto/velocidade e flags idênticos; posições/escalas locais das pernas iguais; diferença máxima de torso/objetos/props6.66e−16, compatível com arredondamento; nenhum reach/penetração adicional na variante final. A separação máxima dos tornozelos permaneceu1.208624m/30Hz e.701448m/60Hz, sem aumento frente à v8. Isso é controle CPU, não inspeção visual nem objetivo de congelar artisticamente o torso.

**Ganho causal de apoio, gate completo ainda falho.** Não ampliar6.5/9.1/start-stop/cast, não GPU e não promover. V8 intacta; runtime07952/API/corte e37398db continuam congelados. Nenhum main/server, auditor, arquivo Lich/Brute/SFX/GUI ou processo5173 alterado. Fonte e evidência liberadas para leitura root; no-slide/AAA seguem falsos.
