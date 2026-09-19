# V14 — quatro ablações CPU; nenhuma substitui a779

**Rodada delimitada encerrada em cópias. Nenhum candidato selecionado, nenhuma GPU ou promoção.** A v13 **a7792f05** continua como base retida, com seus limites; runtime heróis **07952bfc** permanece intacto. A/B nativo v13 está entregue em [parecer e originais](animation-backward-v13-native-ab.md).

[Status completo, hashes e cinemática por frame](../../output/arpg-animation/backward-v14/status.json), [decomposição causal](../../output/arpg-animation/backward-v14/material-decomposition.json), [gerador de análise](../../output/arpg-animation/backward-v14/finalize.py). Mesma história integral0–5s,6.5m/s,151/301frames a30/60Hz. Não houve busca de takes, matriz ampla, alteração de velocidade, corpo, flags ou auditor. Estas são ablações CPU, sem julgamento visual novo.

## Causa investigada

No material14493, velocidade mundial = translação do tornozelo + variação do vetor tornozelo→material. Esta segunda parcela inclui orientação e deformação Foot/Toe. Na frenagem104/30Hz, ΔvZ total−8.520751m/s decompõe-se em−4.003126 de translação e−4.517625 de offset. Em208/60Hz,−4.155424 =−2.437715−1.717709. Portanto reduzir só a aceleração do tornozelo não resolve a bota.

A hipótese de witness incorreto **não se confirmou**:14497 é o ponto mais baixo no próprio pouso103/207;14493 está apenas1.407/1.198mm acima dele. No104/30Hz a região baixa passa por14493; no208/60Hz permanece14497. Ambos são dominados por LeftToeBase, com restante LeftFoot. Não trocamos o witness para favorecer o vértice medido. Os IDs, mínimo, altura14493 e patches de cada frame estão no status.

Também conferimos a orientação futura, além da posição já validada na v13. Erro de previsão do incremento Foot/Toe efetivamente aplicado no frame seguinte é menor que0.000060° nos doisHz. Não há erro grosseiro na previsão do próximo apoio que explique o pico. Há um conflito entre a curta aproximação, a curva de orientação e a frenagem do material; estes testes **não provam impossibilidade física do take ou de uma solução com o corpo atual**.

## Implementações preservadas

| Variante | Hash | Alteração causal |
|---|---|---|
| materialBoundary |65df9b0c| Hermite do próprio witness14497; corrige alvo XZ do tornozelo pela diferença material após orientação. Usa histórico positivo real; não cria anchor no ar. |
| relativeToe |6a0f2752| Mantém tornozelo/Foot v13; interpola Toe em relação a Foot, preservando a articulação em vez de duas curvas mundiais independentes. |
| materialOrientation |6305b5bd| Mantém tornozelo XZ v13; gira rigidamente Foot+Toe pela menor rotação que leva o offset do witness ao alvo material. Registra raio/solicitação, sem alongar ossos. |
| secantOrientation |bdb0ac99| Mantém tornozelo v13; curva angular passa pelas poses anterior/entrada/destino/seguinte. Distingue incremento finito de velocidade instantânea; sem parâmetros varridos. |

Cada variante altera **somente hero-locomotion.js** entre os19arquivos históricos. [Diff material](../../output/arpg-animation/backward-v14/materialBoundary.diff), [Toe local](../../output/arpg-animation/backward-v14/relativeToe.diff), [orientação material](../../output/arpg-animation/backward-v14/materialOrientation.diff), [secantes](../../output/arpg-animation/backward-v14/secantOrientation.diff). `candidate/` contém a última **ablação diagnóstica bdb0**, não uma seleção para promoção; `selectedCandidate:null` é explícito.

A curva de secantes é cúbica no mesmo chart de rotação, com os quatro pontos de contorno em−dt,0,T,T+dt. Para dt constante minimiza a soma dos quadrados das segundas diferenças **nesse chart**. Isso não equivale a minimizar aceleração do material deformado, nem garante menor pico mundial; justamente por isso verificamos aproximação e saída juntas.

## Resultado — pouso e primeiro frame seguinte

Valores abaixo são norma da **mudança de velocidade entre amostras (Δv), em m/s**, não velocidade de sliding ou aceleração em m/s². `pouso / seguinte` =103/104 a30Hz e207/208 a60Hz.

| Fonte | Tornozelo30 | Material14493 30 | Tornozelo60 | Material14493 60 |
|---|---:|---:|---:|---:|
| v13 a779 |5.539 /4.512|8.794 /8.980|4.601 /2.737|7.287 /4.533|
| materialBoundary |6.057 /4.333|9.107 /8.749|4.635 /2.739|7.275 /4.464|
| relativeToe |5.534 /4.622|9.053 /8.736|4.679 /2.823|7.152 /4.372|
| materialOrientation |5.545 /4.420|9.079 /8.716|4.558 /2.676|7.234 /4.451|
| secantOrientation |5.547 /4.496|6.774 /9.643|4.564 /2.750|6.228 /5.357|

A correção material por translação piora claramente a chegada30Hz. Toe relativo tem efeito pequeno e misto. Resolver orientação a partir do ponto melhora parcialmente60Hz, mas aumenta giro Foot30Hz36.203→37.781° e material na chegada. As secantes reduzem Foot máximo30Hz36.203→28.759° e60Hz15.449→13.703°, porém pioram o material seguinte8.980→9.643 /4.533→5.357; Toe Δω30Hz máximo15.080→16.207rad/s. **Reduzir um pico angular ou a chegada e deslocar a frenagem para104/208 não satisfaz a correção.** Todas as tentativas ficam preservadas e rejeitadas como substitutas de a779.

O status inclui97–116/197–230 e toda cinemática2–150/2–300, com máximos e frames, para mostrar entrada, aproximação, saída e pouso seguinte. Nenhum frame desfavorável foi retirado. Os resumos antigos `focus` do runner referem-se à primeira troca49–56/103–110; **não são o gate desta rodada**. A comparação usa a história completa e a janela correta, explicitamente no status.

## Invariantes e limites

Para as quatro variantes: entrada100/200 exata; só poses esquerdas101–102/201–206 mudam; pose final é exata a partir103/207. Todos160/583pares qualificados, flags, apoio/roll direito, corpo/root/props, posições locais e escalas dos ossos são exatamente iguais à v13. Reach máximo0, piso preservado. Paridade instrumentado versus fonte não instrumentada0. O primeiro contato declarado103/207 continua **sem patch qualificado**, não PASS.

A última ablação bdb0 passou [seis casos dt0](../../output/arpg-animation/backward-v14/secant-dt-zero/report.json): refresh duplo após24/48,99/199 e101/201; histórico positivo preservado, solver reaplicado e pose finita. Este teste não aprova sua continuidade material. Os quatro históricos positivos completos têm fontes estáveis.

Original `before/` a779 e GLBs históricos Dwarfe11/Aldric0e5 preservados; live dc/5c não foi incorporado nem usado para reatribuir prova. Auditor50294fbc e runtime heróis07952 não mudaram.

Durante esta rodada Combat promoveu o Lich: monster-library **e9aba8→de4376**, pool **e73ad4→f11e52**. A proteção detectou e registrou essa mudança externa, sem reescrever silenciosamente os hashes anteriores; aviso msg_b2b3111b971b e [recibo do dono](../../output/lich-cast-launch-bridge-v3/promotion.json). O servidor atual5173 é PID22588, atualizado por Combat, não por Animation. Portanto não declaramos o checkout inteiro imutável durante CPU; as cópias e o ownership de heróis estão protegidos.

## Limite desta entrega e próximo foco causal

O A/B autorizado está concluído; a continuação implementou e mediu quatro mecanismos locais, sem selecionar uma regressão. Não solicito nova GPU para estas ablações. Nenhuma delas justifica alterar runtime ou declarar no-slide.

O próximo foco útil é a **trajetória conjunta da região de antepé durante a última aproximação e a preparação do roll de apoio**, incluindo vários pontos materiais, sem impor separadamente uma curva de tornozelo e uma curva angular que se contradizem. O witness vigente e a previsão do apoio são válidos neste recorte; trocar IDs ou ajustar outra curva escalar sem essa verificação não é a causa demonstrada. Uma eventual necessidade de articulação corporal deve ser provada geometricamente, não inferida destas quatro falhas. Entrada, ganho linear, apoio físico e histórico permanecem os limites da continuação já autorizada.
