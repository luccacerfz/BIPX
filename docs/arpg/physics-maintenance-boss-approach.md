# Physics — aproximação BloodCow offline na manutenção9e45

**Conclusão: existem poses válidas de melee, mas não há ligação corporal contínua desde as duas origens efetivas capturadas.** Um anel de sólidos, expandido pelo raio real1.72, fecha a região que contém todas as posições livres dentro do alcance de ataque. Aumentar busca ou reduzir grade não abre esse corredor. Há também limitação de objetivo/amostragem, separada abaixo; não foi implementado planner, modificado Environment ou alterado runtime.

[Recibo e hashes completos](../../output/physics/maintenance-boss-approach-20260919/receipt.json) · [poses e consultas](../../output/physics/maintenance-boss-approach-20260919/probe.json) · [certificado geométrico](../../output/physics/maintenance-boss-approach-20260919/barrier.json) · [caller offline na pose](../../output/physics/maintenance-boss-approach-20260919/2026-09-19T03-57-01-016Z-pose-witness-one-client-bloodCow-inverse.json).

## Fonte, recorte e ordem de execução

Layout **9e45b0c2ddb41e125c225e35083d7ed308fc8151357f8b7fbf845196b6371d40**, main455addd3/server29bb, contacts290a/navigation911e0 e helpers transitivos congelados, iguais à comparação causal Environment. Cópias próprias em `output/physics/maintenance-boss-approach-20260919/`; manifesto inicial rechecado byte a byte ao terminar. Runtime contacts912c permanece intacto. Esta é análise da geometria candidata9e45 com snapshot declarado, não prova integrada do main atual.

Natural CombatPID96790 já encerrado, com [relatório final das duas classes](../../output/playwright/2026-09-19T03-44-45-312Z-verify-natural-runs/natural-runs.json) gravado antes da execução. Primeira tentativa de reserva encontrou lock ocupado e não executou diagnóstico. Consultas03:50:54, certificado03:54:37 e caller03:57:01 executados sob reservas atômicas curtas próprias, liberadas em finally. Sem GPU, benchmark, repetição72 ou operação5173. Fila Combat cheia; nenhuma insistência/reenvio. Environment recebeu escopo e resultado via mensagens `01a0b7c7-777e-79e1-804e-44b46c9b08c9` e `01a0b7d0-0e7f-78e2-95bb-3695b76207c3`.

## Condições reais e testemunho de melee

Player parado `(18.933,14.268)`, raio.64; BloodCow raio1.72, altura corporal default2m, groundY0, velocidade2.55m/s, reachBonus0. `updateBossBehavior` permite melee a **1.72+.64+.74 =3.10m**, com `clearEnemyMelee` varrendo linha aY.9. O planner usa corpo inteiro e LOS terminal aY1.0, arrivalRadius **1.72+.72 =2.44m**, maxVisited768. Nenhum desses valores foi alterado. Vigas de.16m bloqueiam o corpo deY0–2 mesmo quando a linha de melee passa acima; o barrel-1 de.896m também bloqueia o corpo, mas não a linha a.9.

| Origem | Posição efetiva usada | Validade original |
|---|---|---|
|Norte|(16.56428861789936,8.359204549834535)|Livre para1.72|
|Sul|(16.847589032244333,18.323203398288207)|Pedido(16.941432443892353,17.38789948292686) inválido; correção de spawn.94m já arquivada no original|

Não reapliquei spawn nem chamei essa correção de caminhada. Ambas as posições efetivas ficam fora da barreira descrita abaixo.

Uma amostragem de5050 pontos em passo.05m no anel entre o contato dos corpos2.36m e o alcance3.10m encontra100 poses estaticamente livres, sem overlap com o player e com LOS real. É prova de existência, não de completude. Pose escolhida **(16.183,14.418000000000001)**, distância2.754087870784082m; folga estática mínima.19706658355253537m até barrel-0, seguida de.19933545 até a grade e.21214481 até barrel-2.

Uma fixture de **um tick.05s**, usando `updateZombies` e helpers literais do snapshot, posiciona o boss inicialmente nessa pose livre: dano melee real confirmado em.05s, sem tiro, sem relocação ou deslocamento. Demonstra que a pose satisfaz o caller; **não representa chegada desde as origens nem teleporte implementado no jogo**. O caller não precisa receber ranged para atacar dali.

## Certificado da barreira física

Para um disco de raio1.72, o centro não pode entrar nos sólidos expandidos por1.72. Os seguintes centros formam um polígono convexo fechado:

`barrel-2 → barrel-0 → barrel-1 → fallen-beam-3 → burial-rail-3 → headstone-3 → cross-37 → barrel-2`.

Cada aresta está integralmente coberta pela união dos dois volumes expandidos adjacentes. O certificado registra um ponto interior comum com margens estritamente positivas para cada par; a menor margem observada é.18737384595067375m na ligação cross-37/barrel-2. Como cada volume é convexo, os segmentos entre centro/ponto comum/centro permanecem bloqueados. Nenhuma passagem pela altura é permitida no solver XZ deste corpo.

Uma cobertura adaptativa de **19 quadrados**, profundidade máxima3, certifica todo o disco de alcance: cada quadrado está integralmente dentro desse polígono ou dentro de um sólido expandido. Para os16 quadrados bloqueados, a distância assinada no centro mais a semidiagonal é estritamente menor que1.72; a propriedade1-Lipschitz garante o quadrado inteiro bloqueado. Os outros3 estão dentro do polígono convexo. **Zero células indeterminadas.** O arquivo guarda todos os quadrados, sólidos responsáveis, arestas e margens; não depende de inferir topologia a partir de amostragem ou de falha A*.

Consequência: toda pose corporal livre capaz de satisfazer o alcance3.10 fica dentro do anel; ambos os starts ficam fora. Qualquer curva contínua entre eles cruza uma aresta bloqueada. Portanto **não existe witness corporal livre para essas origens no9e45**, mesmo com um planner completo. A ausência não é atribuída apenas ao budget768.

## Objetivo, arrivalRadius e grades existentes

Consultas somente diagnósticas da API existente, sempre768nós, sem mudar runtime:

| Grade | Nós estáticos livres com LOS dentro de3.10m | Dentro do arrival2.44 |
|---|---|---|
|1.25|Nenhum|Nenhum|
|.625|(16.25,14.375), distância2.685133m|Não|
|.5|(16,14.5), distância2.942161m; (16.5,14.5), distância2.444036m|Nenhum; o segundo excede por.004036m|

Das duas origens, as12 combinações grade1.25/.625/.5 × arrival2.44/alcance3.10 esgotam768. Consultar a pose melee exata como objetivo, na grade1.25 e arrival0, também esgota768 em ambos os starts. São14 consultas, não novos planners. A barreira física explica a falta de ligação mesmo quando uma grade mais fina contém uma pose terminal. A grade atual também não amostra nenhuma pose de melee: **abrir um gargalo não será, por si só, prova de aproximação do caller atual**. Não proponho afrouxar corpo/ataque/budget nem diminuir globalmente a grade.

## Proposta mínima de abertura para Environment

Abertura oeste atual, medida entre superfícies:

| Par | Vão físico | Diâmetro necessário |
|---|---:|---:|
|cross-37 / barrel-2|3.0631174874691567m|3.44m|
|headstone-3 / barrel-2|3.2855120296309774m|3.44m|
|headstone-11 / barrel-2|3.5515437759465582m|3.44m|

**Proposta analítica de um único placement:** deslocar somente barrel-2 para leste, mantendo Z12, escala/yaw/collider. Para romper as duas ligações limitantes, o deslocamento deve ser **maior que.4289531684082473m**; esse limiar é tangência, não conforto. Como exemplo para seleção do dono, **+0.60m →(16.4,12)** daria3.5931322087774964m junto à cross-37 e3.678420898971038m junto à headstone-3, folgas totais sobre o diâmetro de.153132m/.238421m.

Esse é o menor limiar **nessa direção e nesse único prop**, não uma otimização global do cenário. Calculei as distâncias sem editar módulo/transform/collider Environment e sem declarar um novo layout aprovado. Outras ligações, leitura visual, conforto e sobretudo um objetivo alcançável pelo caller atual precisam ser escolhidos/verificados pelo dono. Environment recebeu os sólidos e as restrições; não remover cruz/lápide, reduzir boss ou habilitar tiro offline para esconder o problema. Depois de selecionar uma abertura, basta reteste causal das duas origens/poses/LOS e do tiro oeste; não repetir72 automaticamente.

## Limites preservados

Final9e45 continua com36walkers melee e o tiro serverBloodCow oeste em.30s, conforme [relatório Environment preservado](environment-maintenance-access.md); não repeti nem apaguei esse contraexemplo. Esta análise explica a falta de ameaça **melee offline** nas duas origens para o player fixo e perfil real declarado. Não prova horda, jogador em movimento, outros bosses/alcances, mobile, native ou custo. Nenhuma promoção Environment, nova implementação de navegação, mudança de ataque ou restart foi feita por Physics. Fonte Physics912c e janela GPU estão liberadas.
