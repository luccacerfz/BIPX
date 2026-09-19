# Corte v3: queda melhor, fragmento desconectado ainda suspenso

Root inspecionou dez imagens originais de `output/playwright/arpg-animation-cut-v3`, fixture nativa Chrome/Metal com os assets reais e substituição explícita de módulo, sem gameplay. O report do dono registra `sourceStable:true`, `nativeRenderPassed:true`, zero erros. Isso não equivale a aprovação visual.

Comparação do Orc em 0.9 s: baseline mantém o torso vertical suspenso; candidato termina caído junto ao chão, com as duas metades próximas. Também foram inspecionados candidatos finais do zumbi, Lich e Brute, e intermediários de Orc/Lich. A queda e a orientação final corrigem a suspensão principal do baseline. O Brute nesta fixture é o asset de runtime; esta revisão não instala nem aprova a locomoção Brute v3 rejeitada.

Defeito visível no zumbi: em `zombie-candidate-0.38.png` e `zombie-candidate-0.9.png`, uma mão separada permanece acima do corpo/piso. `zombie-before-0.9.png` mostra que a divisão horizontal já cortava os antebraços no baseline; a queda torna evidente que os pedaços desconectados compartilham a transformação rígida de uma metade. `zombie-candidate-0.12.png` conserva a silhueta inicial, mas os frames posteriores não simulam queda independente da mão. Portanto não é correto dizer que todos os fragmentos descansam no chão.

O cálculo de `minimumY`/support hull garante apenas que o menor ponto de cada um dos dois grupos toca o chão sem penetrá-lo. Não garante apoio dos componentes desconectados dentro desses grupos. Fonte inspecionada: `output/arpg-animation/death-cut-v3/candidate/src/assets/enemy-death-cut.js`, `cutSurface` intersecta todos os triângulos/props com o mesmo plano e agrega suporte por sinal.

Próxima correção para Animation: preservar braços/mãos coerentes com o torso na apresentação de duas metades ou dar queda própria aos fragmentos de fato separados. Manter custo limitado, fonte/rig intactos e descarte completo. Validar o caso do zumbi mostrado antes de chamar v3 de acabamento final. É possível manter a melhoria de queda como candidato com defeito explícito, mas não ocultar o achado na aprovação global/JEF.

Lista/hash das imagens efetivamente vistas: `v3-cut-followup.json`. Nenhum vídeo foi denominado revisado por estes frames; playback, death-only real e orçamento da horda continuam separados.
