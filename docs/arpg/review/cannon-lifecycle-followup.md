# Canhão — morte, reinício e recursos gráficos

A falha03:44 era real: `endGame()` zerava os casts antes de emitir cancelamento e deixava a apresentação de explosões já concluídas no core. Root conferiu a correção: cancelar enquanto o estado existe e resetar o wrapper visual ao encerrar a partida. Fonte atual da correção: mainafc7d5ac, sem mudança de dano ou timers.

O teste03:47 confirmou a limpeza, mas comparou o primeiro uso de preparação, voo e explosão:89/43→91/43→93/44 geometrias/texturas. Root levantou a hipótese de registro tardio de objetos pré-alocados. O resultado posterior03:53 confirma o escopo necessário: instrumentação de UUID nos incrementos/descartes reais do Three, aquecimento de todas as três fases, seguido da mesma sequência mais uma vez. Contagens93/44 estáveis e nenhuma identidade nova após aquecimento; efeitos vazios em todas as seis mortes/reinícios.

Aceita esta prova curta de cleanup e estabilidade, com fonte estável e zero erros de browser. A instrumentação usa cópia servida da biblioteca, sem alterar o vendor no produto. Não é benchmark, teste de sessão prolongada, rede adversa ou prova global de ausência de vazamento. A falha e o diagnóstico anteriores permanecem arquivados.

Reports, hashes, fases e identidades agregadas estão em `cannon-lifecycle-followup.json`. A rodada natural anterior pertence ao main7bde570f e não recebe retroativamente a correçãoafc7d5ac.
