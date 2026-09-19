# V10 — continuidade Strafe→ré em cópia

**Candidato `ee6fe0e0` publicado e retido; não promover.** O salto de apoio nos frames 100/200 foi corrigido fisicamente na mesma trajetória, com piso e alcance preservados. A liberação seguinte ainda apresenta uma troca relevante de rotação por translação; não declaro a etapa livre de regressões nem solicito GPU neste momento. `acceptedNoSliding:false`.

[Candidato](../../output/arpg-animation/backward-v10/candidate/src/assets/hero-locomotion.js) · [diff](../../output/arpg-animation/backward-v10/candidate.diff) · [hashes/status](../../output/arpg-animation/backward-v10/status.json) · [comparação completa](../../output/arpg-animation/backward-v10/pose-carry-trace/comparison.json) · [witness selecionado, com antes/depois](../../output/arpg-animation/backward-v10/selected-witness.json).

## Escopo e causa

Parte da v9 `cae3cb8e`, preservada em `before/`; v8/v9 e evidências anteriores permanecem intactas. Só `hero-locomotion.js` muda entre os 19 arquivos da cópia. Take staged, rig, grip, probes, auditor, skills e GLBs não mudam. Aldric da comparação continua original `0e5da9d8`; promoção live `5c1903a0` pertence ao lote de metadados separado. Dwarf continua original `e11eadb8`, sem importar o candidato OPAQUE `dc0867da`.

Na troca Strafe→ré, `clearContacts()` descartava um apoio fisicamente existente e adquiria uma nova âncora depois do deslocamento. Preservar somente o estado expõe outra incompatibilidade: o novo Foot/Toe da pose misturada não tem a mesma orientação nem o mesmo ponto baixo do apoio anterior. Prender esse novo pé ao antigo anchor3D pode elevá-lo ou exceder alcance.

O candidato conserva o estado durante a troca inversa e, havendo região baixa real no frame anterior, conserva as orientações mundiais Foot/Toe. O witness passa de 217 para 120 usando **a posição anterior do próprio material 120**, nunca a posição já deslocada pela nova pose. O solver de roll/piso/alcance da v9 continua conciliando a perna com essa região. Nenhum novo take, busca angular ampliada, deslocamento de pelvis, comprimento/skin ou velocidade de gameplay foi introduzido.

As flags poderiam mudar numa solução física justificada conforme autorização Root, mas **nesta variante não mudaram**. Também ficaram exatamente iguais torso/objetos protegidos, posições/escalas locais das pernas e trajetória. Não são usados como argumento de qualidade artística global; são controles causais desta variante.

## CPU completa, mesmas amostras

Runner da extensão v9 byte-idêntico `d85c6c51`; velocidade 6.5 m/s, 151/301 frames, 0–5 s a 30/60 Hz. História anterior à troca é exatamente igual até 99/199, inclusive o ganho anterior da v9. Instância instrumentada versus sem instrumentação: perturbação zero. Toda a história e ambos os pés permanecem nos JSONs, inclusive liberação, recuperação e ciclos seguintes.

Critérios intactos: piso ±8 mm, patch até 3 mm do mínimo, velocidade vertical ≤.05 m/s, skin Foot/Toe >.75. Zero pares swing→swing continua count0/P90null, não PASS. [Comparador](../../output/arpg-animation/backward-v10/compare.py) só lê os patches produzidos pelo runner; não altera a seleção.

| Medição | 30 Hz: v9 → v10 | 60 Hz: v9 → v10 |
|---|---:|---:|
| Material99 no frame da troca, deslocamento XZ | 110.775 → .000277 mm | 44.364 → .000578 mm |
| Material99, velocidade horizontal | 3.32324 → .00000831 m/s | 2.66187 → .00003469 m/s |
| P90 dos **mesmos** patches direitos durante esse apoio | 3.21914 → .006383 m/s, 13 pares | 2.44140 → .006278 m/s, 28 pares |
| P90 apoio, janela 98–103 / 198–206, todos os patches | 3.21914 → .026262 m/s | 2.19057 → .027589 m/s |
| P90 apoio, história completa | .258166 → .145978 m/s | .155345 → .133031 m/s |
| Pares físicos perdidos / adicionados na história | 0 / 34 | 0 / 90 |
| Cobertura por foot-frame, história completa | 16.225% → 16.225% | 20.764% → 20.764% |
| Reach máximo, história completa | 0 → 0 | 0 → 0 |
| Sola mínima, história completa | 1.980 → 1.980 mm | 1.965 → 1.965 mm |

O ganho não depende da diluição por novos pares: a comparação por identidade também melhora. Pior aumento entre pares comuns é .000969 m/s nos materiais181/182 em201/60Hz, resultado .014158 m/s. Contagem de apoio declarado sem patch continua 72/114; não foi ocultada. Transições globais continuam P90 8.582/1.403 m/s, com piores amostras antigas de início/landing preservadas. Os ciclos posteriores são iguais: última diferença material em107/30 e216/60; poses resolvidas voltam a coincidir depois.

## Liberação ainda aberta

Manter a região realmente fixa deixa a perna mais estendida ao final do apoio. Na liberação103/206, o alvo que manteria esse ponto com a orientação retida exige .943739/.882014 m, contra .825092 m disponível no teste geométrico. O solver não estica a perna nem move o corpo: encontra uma posição alcançável, mas aumenta a translação inicial de swing.

| Liberação direita | 30 Hz, frame103 | 60 Hz, frame206 |
|---|---:|---:|
| Material99 XZ por frame, v9 → v10 | 21.466 → 158.070 mm | 12.665 → 83.088 mm |
| Material39 XZ por frame, v9 → v10 | 120.850 → 157.999 mm | 69.489 → 83.073 mm |
| Rotação Foot por frame, v9 → v10 | 25.292° → 1.689° | 16.700° → .343° |
| Sola v10 | 46.5 mm | 11.6 mm |

Estes são frames realmente liberados, fora do patch físico; velocidade de swing isolada não é slide. A diferença é maior que o pequeno delta analisado no A/B anterior e vem acompanhada de mudança de articulação, por isso permanece uma questão de continuidade/peso. Não há nova prova visual que autorize chamá-la de fluida ou de quebra visível.

[Decomposição da distância entre tornozelos](../../output/arpg-animation/backward-v10/leg-span-decomposition.json): no fim do apoio, span .580→.721 m / .609→.711 m. A separação transversal à direção aumenta .051/.028 m; a longitudinal .122/.082 m, e a vertical ~.09 m. Não existe offset lateral artificial no código, mas a postura resultante precisa avaliação artística. O máximo de span da história não aumentou; isso sozinho não aprova a largura desta pose.

Essa incompatibilidade é **condicional à orientação retida e ao instante de release**, não prova impossibilidade geral com pelvis fixa. Próxima causa delimitada: preparar toe-off/articulação compatível antes de esgotar o alcance, conservando as identidades do patch até a saída física. Não resolver movendo pelvis arbitrariamente, alterando flag sem levantar a sola ou repartindo o erro por teleporte.

## Ablações preservadas

1. `52d48c5f`, `contact-carry`: preserva apenas o estado nos dois sentidos. Frame100 melhora parcialmente, mas200 perde o patch e produz reach41.879 mm/sola33.722 mm. Rejeitada.
2. `ee6fe0e0`, `pose-carry`: estado + orientação da região + transferência ao witness anterior real. Candidato acima, retido pela liberação aberta.
3. `acbc5a4f`, `articulation-carry`: devolve o tornozelo à pose misturada pelo progresso do crossfade existente, mantendo antepé. Resolve o pedido de alcance na liberação, porém volta a deslizar durante apoio: P90 local .320/.625 m/s e P90 global60Hz .155→.267. Rejeitada; não escolhida por melhorar um único frame.

Fontes em `variants/`, cada traço/relatório separado. Não houve varredura de takes/parâmetros nem matriz ampla. O candidato final corresponde exatamente ao hash já ensaiado em `pose-carry-trace`; a variante rejeitada não ficou instalada por acidente.

```sh
node output/arpg-animation/backward-v10/witness-runner.mjs \
  output/arpg-animation/backward-v10/candidate /tmp/bipx-v10-replay-novo
python3 output/arpg-animation/backward-v10/compare.py pose-carry-trace
```

**Entrega e limite:** correção causal do apoio publicada, com história/falhas preservadas. Nenhuma janela nativa solicitada: ainda não satisfeito o requisito de ausência de regressão relevante. Se a liberação for julgada apta a diagnóstico, o recorte útil seria a mesma história a30/60Hz, com 98–109/198–219 expostos a1× nas câmeras ARPG/próxima, sem esconder o instante de toe-off; isso é apenas um recorte possível, não reserva ou autorização executada. Runtime07952/corte/API, servidor5173 e GPU preservados.
