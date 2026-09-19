# Astra5 — revisão CPU independente do temporal Grok6

**Decisão: não integrar o temporal no snapshot `8d1c7263…`.** A direção no endpoint e a trilha em burst reto/terminal passam; a preservação geométrica do caminho sob backlog e da trilha em curvas falha. A revisão foi concluída sem GPU, servidor, navegador, alteração de runtime vivo ou integração, commit, merge, push, deploy ou JEF.

Run `run_f726ad723cdd`; task `task_0d1c3f93918a`; dispatch `ctx_49a610d66b45`. A mensagem do coordenador `msg_40ab7bde7c08` separou a futura correção de timestamp/TTL da interpolação e informou congelamento do temporal para esta revisão. O delta order-only ainda não existia no caminho indicado quando inspecionado; **não é aprovado por este relatório**.

## Proveniência e reprodução

- Origem: `output/qa/aaa-20260919/grok-projectile-temporal-v1/candidate/`.
- Cópia própria: `output/qa/aaa-20260919/astra-projectile-review-v1/snapshot/`.
- SHA-256 de `src/vfx/class-skill-vfx.js` testado: **`8d1c72632549023c9f42159a281167de1db720d21f127da9ee972d17befe3cf8`**. Já contém `visualHeading`, `pendingTo` e emissão de trilha em `stepVisual`; não é a implementação inicial descrita pelo hash `5577a1f5…` do relatório Grok lido no início.
- Os **242 arquivos** foram copiados com igualdade de hashes antes/depois da cópia e novamente verificados pelo harness. Manifesto: `output/qa/aaa-20260919/astra-projectile-review-v1/snapshot-manifest.json`.
- Executar da raiz: `node output/qa/aaa-20260919/astra-projectile-review-v1/verify-geometric.mjs`.
- Resultados detalhados: `output/qa/aaa-20260919/astra-projectile-review-v1/evidence/geometric-results.json`.

O harness instancia o wrapper e os pools reais, incluindo `ClassSkillProjectileBodies` e `ElementalHelicalRibbons`, sem substituir `emit`/`emitTrail` por spies. Lê os atributos reais `aOrigin`, `aQuaternion`, `aStyle`, `aEnd` e `aParams`; reconstrói a orientação do corpo com o mesmo eixo local −X usado pela geometria. O gate de endpoint usa release/travel produzidos por `createSkillState`, `beginSkill` e `advanceSkills` reais.

As curvas e o overflow são **fixtures geométricas CPU de contrato, não gameplay nativo**: injetam segmentos contíguos, demonstram que cada segmento evita uma `THREE.Box3`, e verificam os dados que a apresentação realmente escreve. Não afirmo que o core de tiro reto produza a curva de 90° durante uma partida. A ponte de origem também pode produzir caminhos não colineares, mas a frequência e magnitude destes casos no runtime não foram medidas nesta tarefa.

## Os três gates

| Gate | Gelo | Gravidade | Evidência |
| --- | --- | --- | --- |
| Direção preservada após chegar ao endpoint | Passa | Passa | Oito updates de 1/60 s após um pulso real do core; direção Z < −0,9999, inclusive enquanto parado |
| Não perder vértices/cortar caminho sob backlog | Falha | Falha | Fila cheia perde dois vértices; evento posterior contíguo gera posição fora do caminho confirmado e cruza a caixa |
| Trilha acompanha o caminho mostrado, incluindo burst/terminal | Parcial, gate falha | Parcial, gate falha | Burst reto não antecipa trilha e terminal cancela corpo/emissão; curva em um update escreve quatro ribbons cruzando a caixa |

São oito casos concretos, quatro positivos e quatro negativos esperados de revisão. O processo termina normalmente para gravar todos os testemunhos; **exit 0 não significa aprovação**. Consultar `results[].passed`.

### P1 — overflow perde continuidade autoritativa

No arquivo do snapshot, `enqueueConfirmed` retorna silenciosamente quando `pendingTo.length >= 8` (linhas 59–64), enquanto `travel` continua avançando `record.last` (linha 212). Assim, a validação de continuidade do próximo evento observa o último destino recebido, mas a apresentação ainda está num destino anterior cuja fila descartou a curva.

Testemunho X/Z, Y=1,05: de `(0,0)` a `(2,25,0)` em passos de 0,25; depois `(2,25,−1)`, `(3,25,−1)`, `(3,25,−2)`. Os dois primeiros destinos da curva são descartados. Após drenar 0,12 s, o corpo está em `(2,25,0)`; receber o último segmento e atualizar 0,05 s o coloca em:

- Gelo: `(2,786656, −1,073313)`.
- Gravidade: `(2,697214, −0,894427)`.

Esses pontos saem da polilinha recebida. A ligação atravessa a caixa X=[2,50;2,80], Z=[−0,95;−0,40], evitada por todos os trechos confirmados. **Não basta aumentar o limite**: ao saturar, deve haver uma política explícita de invalidação/ocultação e reinício sem ponte inventada, ou preservação comprovada dos trechos.

### P1 — trilha transforma uma curva percorrida internamente em corda

`stepVisual` pode consumir vários destinos no `while` (linhas 330–352), mas o snapshot chama `elemental.emitTrail` uma única vez do ponto inicial do frame ao final (linhas 355–357).

Testemunho X/Z: `(0,0) → (2,0) → (2,−2)`, dois eventos entregues antes de um update de 0,15 s. O corpo sai de `(0,0)` e termina em `(2,−1,6)` no gelo ou `(2,−1)` na gravidade. O vértice intermediário é visitado internamente, mas não apresentado em um frame separado; a corda entre os frames cruza a caixa X=[0,90;1,45], Z=[−0,85;−0,35]. **A prova visual CPU inequívoca é a trilha: quatro instâncias reais de ribbon por skill cruzam essa caixa**, embora os dois segmentos confirmados sejam livres.

Não afirmo que a GPU interpole o corpo entre frames: os buffers só mostram as posições extremas. Para o contrato de preservar cada vértice apresentado, é necessário parar no vértice por frame ou estabelecer outro critério seguro de apresentação. Para a trilha, emitir por trecho é necessário, mas também deve preservar o vértice entre amostras: `elemental-vfx.js` mantém o último ponto amostrado por chave e pode ligar esse ponto ao trecho seguinte se a cadência não cair exatamente na curva.

### Positivos mantidos

`rememberHeading` ignora vetores quase nulos e `stepVisual` reutiliza o último heading; o antigo fallback para +Z não ocorre nos eventos reais testados. Em quatro pulsos retos acumulados, nenhuma ribbon é escrita antes de um update, e suas pontas nunca ficam à frente da posição do corpo. Um evento terminal com segmento ainda não mostrado oculta o corpo, não aumenta a quantidade de ribbons e não o ressuscita no update seguinte.

## Combinação com Fable final

Li o patch e o relatório `fable-pointblank-v2.md`. Hashes conferidos do candidato Fable:

- `class-skill-vfx.js`: `05e4c4f522fa3a402dd8b4283b01485fbe43f0a1090e5f8c1b4e2a26435916c2`.
- `projectile-origin-bridge.js`: `81fcaca6f9d293f6c7c085e173d7c2a162f70b852459398c3aa9e7e44425ad19`.

O patch final ativa `clampMuzzleLead` em gelo/gravidade, oculta no release com avanço frontal e usa `mapped.hideBody` antes da boca. Esse contrato é separado e não está presente no snapshot temporal testado.

**Risco de integração:** copiar apenas os hunks `bodies.hide`/`bodyUntil=0` não cancela `visualActive`. No temporal, um registro ativo com `bodyUntil=0` cai em `stepVisual` no update e pode redesenhar o corpo. Ao esconder/abandonar/terminar, limpar ou invalidar também destinos pendentes e continuidade da trilha; a retomada deve partir do primeiro trecho visível confirmado, sem drenar uma fila da fase oculta. Preservar a guarda de distância completa >3 m e o opt-out do canhão.

Verificações mínimas para a combinação futura, sem abrir matriz nativa nesta tarefa:

1. Release com boca a 1,4 m e contato autoritativo a 0,99 m: nenhum corpo/ribbon no release, entre eventos e após terminal.
2. Boca a 1,4 m com voo além dela: primeiro corpo só após cruzar a boca; nenhum destino/trilha guardado da fase oculta é reproduzido.
3. Repetir os negativos de curva e overflow desta revisão na combinação, incluindo terminal durante backlog, e manter o positivo de direção no endpoint.

Nenhuma combinação foi aplicada à integração ou ao candidato do proprietário. Nenhuma aprovação nativa de Fable foi ampliada por esta revisão CPU.

## Handoff e estado da fonte

Grok recebeu o pedido de revisão/congelamento (`msg_f57bed14798c`), hash copiado e suspeitas (`msg_2a888670c910`), e os negativos reproduzidos (`msg_67593772a79a`). O coordenador recebeu a reprovação focal (`msg_1ddf169f3b48`).

Na conferência final, o arquivo temporal **mudou após a cópia**. A diferença observada deslocava a emissão para cada trecho interno e acrescentava diagnósticos; essa edição não pertence ao hash testado. Solicitei um novo freeze/hash ao Grok (`msg_71c503584011`) e informei a coordenação (`msg_489246e6128e`). `evidence/final-integrity.json` registra a divergência; o snapshot próprio continua íntegro. **Os negativos deste documento não são atribuídos a uma versão nova não testada, e a versão nova não está aprovada.**

Recomendação de fechamento: manter a interpolação fora da promoção; revisar separadamente o pequeno delta de ordenação/TTL quando Grok entregá-lo. Para liberar temporal, Grok deve apresentar snapshot final congelado e os mesmos testemunhos devem passar, principalmente saturação da fila e preservação das curvas na trilha. Não é necessário repetir uma matriz GPU para resolver estes defeitos CPU.
