> **Atualização posterior:** [refresh dt0 corrigido em cópia c402b5ac](animation-backward-v12-dt-zero.md) e [A/B nativo v11/v12 concluído](animation-backward-v12-native-ab.md). O relatório abaixo descreve5e93437e e permanece como histórico; não reatribuir seus hashes.

# V12 — continuidade do pé aéreo esquerdo, CPU concluída em cópia

**Candidato5e93437e retido, sem promoção/GPU.** Implementado após a promoção separada do Dwarfmetadata dc0867da. Baseline v11 **4ad67bcf** preservado; as cópias v12 continuam com GLBs históricos Dwarf e11/Aldric0e5. Runtime07952/5173 e fontes dos outros donos intactos.

[Status/hashes](../../output/arpg-animation/backward-v12/status.json), [diff](../../output/arpg-animation/backward-v12/candidate.diff), [comparação completa](../../output/arpg-animation/backward-v12/candidate-final/comparison.json), [decomposição e continuidade por frame](../../output/arpg-animation/backward-v12/air-continuity-final.json). Mesma história0–5s6.5m/s30/60Hz,151+301frames por variante, auditor/predicados intactos. Nenhuma busca de take/retarget/varredura de parâmetros.

## Hipótese confirmada parcialmente e separada das demais causas

A revisão [Root v11](review/animation-backward-v11-cpu-review.md) apontou o descarte de estado aéreo. A instrumentação local registra `beforeReset`, `afterPhase`, `afterClear`, `afterRestore`, `afterDriver`, alvos antes/depois do residual e cada etapa IK/landing/anchor/floor/final. Ela só existe nas cópias instrumentadas; um segundo ator sem hooks verifica perturbação zero.

Em100/200, o pé esquerdo está no ar. `clearContacts()` zera o residual de **139.8/140.3mm**, e `supports` não o restaura. `poseRelease` e `landingPlan` já eram nulos; não se pode atribuir esse caso à perda desses dois objetos. A referência física anterior correta é `lastSolvedAnkle`, não o bone lido após o caller restaurar a pose para o novo frame.

Além do reset, o swingCarry muda.883→.242 a30Hz e.893→.362 a60Hz ao entrar no novo perfil. O driver/basis muda o alvo, e um plano novo de aterrissagem começa a atuar. Em100, esse plano adiciona aproximadamente64.3mm X/174.1mm Z à solução IK; em200,14.7/32.4mm. O piso depois adiciona158.5/194.3mm Y àquela pose ainda sem clearance. Os vetores completos e estados anteriores estão no JSON; não são contribuições escalares independentes que possam ser simplesmente somadas.

Três ablações isoladas separam os fatores, mantendo o mesmo histórico:

| Variante diagnóstica | Velocidade3D do tornozelo em100 | Em200 |
|---|---:|---:|
| V11 atual |20.3437m/s|23.5789m/s|
| Restaurar somente estado aéreo perdido |19.4826m/s|20.6883m/s|
| Retirar sincronização física da fase |29.2140m/s|35.7267m/s|
| Usar somente base direcional antiga no primeiro frame |22.8627m/s|25.3981m/s|

Preservar o residual ajuda, mas é insuficiente. As outras duas ablações pioram; não foram incorporadas. A fase/base da v11 permanece. Todos os fontes/traces das ablações estão em `backward-v12/ablations/` e diretórios `*-trace`, com hashes no resultado.

## Correção implementada

Na troca Strafe→ré, somente para uma perna realmente aérea, capturar a última posição resolvida, velocidade linear, orientações Foot/Toe e incrementos angulares. A trajetória começa pela continuação dessa pose com sua velocidade observada e converge para a solução móvel do novo driver/landing. A mistura quintic tem derivada zero nas pontas. Sua duração deriva do tempo restante até a próxima aterrissagem no perfil — **.1260/.1280s**, não de uma duração ajustada por busca.

Não é anchor aéreo: a posição continuada avança com a velocidade anterior; nenhum contato é criado ou ocultado. Ao chegar à aterrissagem, a correção termina e a solução original retorna exatamente. A fase, o plano de aterrissagem destino e o pé apoiado não são alterados. Não há deslocamento do quadril, extensão de membros ou mudança da velocidade do gameplay.

A folga procedural do swing também converge da altura/velocidade da sola resolvida para a nova curva. Copiar instantaneamente o mínimo de clearance do perfil novo reintroduziria o salto vertical depois de suavizar o alvo. **O piso físico de2mm, o auditor de8/3mm/.05m/s e todas as amostras continuam intactos.** Essa mudança da curva de folga está explícita no trace `airRaccord`, não é relaxamento do gate de contato.

Orientações são compostas por vetores de rotação relativos à pose inicial, incluindo o incremento angular observado e o destino atual. A tentativa inicial68ebbab3 extrapolava uma quaternion e fazia slerp: a rotação rápida do Toe atravessava a volta do arco, causando46.54° no frame205. Essa tentativa foi preservada em `ablations/unbounded-angular` e `candidate-trace`; a correção local de representação reduz205 a20.15°, sem mudar fase/posição/apoios. Não houve busca angular.

## Resultado causal e limites até a aterrissagem

| Medida no frame da troca | V11→V12 a30Hz | V11→V12 a60Hz |
|---|---:|---:|
| Velocidade3D tornozelo esquerdo |20.3437→13.9472m/s|23.5789→14.7355m/s|
| Mudança vetorial de velocidade entre frames |10.0619→1.4668m/s|11.5287→.2876m/s|
| Passo angular Foot |34.545→16.054°|19.256→9.543°|
| Material esquerdo14493, velocidade3D |19.8029→12.1015m/s|22.7299→10.7329m/s|
| Material14493, aceleração3D |332.957→76.567m/s²|932.538→218.108m/s²|

O pé já vinha com13.42/14.66m/s antes da troca. A redução da **mudança de velocidade**, e não só do pico, é a evidência principal de continuidade. Trata-se de pé aéreo; não chamar essas velocidades de sliding.

Da troca até a aterrissagem103/207, o pico3D do tornozelo cai20.344→19.673 e23.579→21.566m/s. O pico de aceleração cai408.039→362.589 e691.722→420.429m/s². Porém o esforço se redistribui: no touchdown30Hz, a mudança vetorial de velocidade sobe5.519→12.086m/s; a60Hz sobe6.137→6.952. A posição final já coincide com a v11, mas a diferença finita de velocidade inclui o último frame corrigido. **Não declarar aterrissagem resolvida.**

O Foot30Hz tem passo máximo34.545→36.028° em102, embora a troca inicial melhore. O Toe conserva a rotação rápida já observada antes da troca:42.7° em99 e37.8° em199; os primeiros passos corrigidos são39.22°/37.27°. Isso prolonga parte da rotação aérea anterior e precisa julgamento de pose/deformação/peso. A falha nova46.54° foi corrigida; não se infere daí que toda rotação do antepé esteja artisticamente aprovada.

A sola esquerda sobe até aproximadamente.158m a30Hz e.186m a60 durante a ligação. Não há penetração nem alcance excedido, mas a trajetória é mais alta em parte do swing. Base estreita, leitura de peso e o pouso seguinte continuam questões visuais. O relatório guarda todos os frames97–111/197–223, além da história inteira, sem selecionar só100/200.

## Preservação forte da v11

- Somente poses finais aéreas **100–102** e **200–206** diferem. A partir da primeira aterrissagem, posições/orientações retornam à v11; derivadas finitas levam os frames anteriores em conta.
- Pé direito: diferença máxima de posição/orientação **zero em toda a história**. Roll, pivôs120→7→34/120→2→7→34 e sua saída ficam exatos.
- Todos os **160/583 pares materiais qualificados**, suas identidades, posições e velocidades são **exatamente iguais** à v11. Zero pares adicionados/perdidos, flags idênticos. Prefixo até99/199 exato. Nada foi retirado do gate.
- P90/cobertura completos permanecem.225024/.140175m/s e48/302,124/602. Reach0; mínimas1.97983/1.96492mm. Ausência de patch continua `count0/null`, sem PASS.
- Torso/props/root e posições/escalas locais dos membros: diferença zero. Trajetória, GLBs, takes, rig, grip e auditor originais preservados.

## Decisão e reprodução

**Reter5e93437e para revisão.** A causa do salto aéreo na troca foi reduzida sem prejudicar os apoios da v11, mas a chegada a30Hz e a articulação do Toe ainda pedem julgamento. `acceptedNoSliding:false`; nenhum runtime/asset adicional promovido, nenhuma GPU reservada. Não expandir matriz9.1/start-stop/casts por este resultado.

```sh
node output/arpg-animation/backward-v12/witness-runner.mjs \
  output/arpg-animation/backward-v12/candidate /tmp/bipx-v12-new-trace
python3 output/arpg-animation/backward-v12/compare.py /tmp/bipx-v12-new-trace
python3 output/arpg-animation/backward-v12/analyze.py
```

O destino do runner deve ser novo; ele não sobrescreve evidência. `analyze.py` só decompõe traces existentes. Comparador mantém os critérios do auditor, fonte/proteção e história completa.

Recorte nativo proposto, **não iniciado**: mesma história desde0, foco97–109/197–219, próxima3/4 e ARPG, mostrando corpo inteiro, rotação do antepé, voo e pouso. Exige a coordenação da fila vigente; não repetir a v11 inalterada nem alegar aprovação visual por CPU.
