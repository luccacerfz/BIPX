# Dash art2 — revisão da medição entre pacotes

Root leu pool e API art2, contrato07:34 e o runner `tools/dash-art2-vfx-native.mjs` antes da próxima captura. O pool passa a atualizar arco e ponta aberta enquanto a vida original existir, mantendo começo/histórico fixos e encerrando a cauda terminal em.09s. A implementação Combat correspondente ainda estava em atualização nesta revisão; nenhum resultado nativo art2 é presumido.

**Corrigir o observador antes da captura:** `fresh: e.time === game.survivalTime` não identifica chegada de pacote. No online, o callback pode anexar evento com o tempo de simulação anterior; `animate` incrementa esse tempo antes do render. O frame com evento novo então pode ser classificado falsamente como intermediário. O gate `between > 0` sozinho aceitaria uma prova inexistente.

Usar identidade/revisão do último evento relevante observado no render anterior, sem mutar o histórico: frame fresh possui um evento novo; frame between preserva a mesma referência/revisão já observada em render anterior. Registrar castId/phase/revisão/endpoint para conferência, incluindo cauda terminal. A medida não exige timestamps iguais entre peers nem sincronização de relógios de rede. Mensagem enviada ao dono VFX para correção do runner; não solicitar matriz extra.

O observer lê o arco no slot0. Isso é coerente com este caso de um único cast em pool novo, mas exige uma asserção explícita dessa condição para não ser reutilizado silenciosamente com outro índice. A ponta usa `headSegment` do cast. Segmentar resultados entre preparo, travel fresh, travel sem evento e terminaltail, com buffers reais e socket pós-render, continua necessário; `pool.lastEmitter` isolado não prova a geometria desenhada.

## Negativo de integração07:40 — segmento remoto inexistente

`output/dash-post-mixer-integration-v1/remote-open-segment-negative.json` usa main45fe/pool e19/wrapper08d5 reais, mas agenda de transporte sintética. Cinco eventos travel produzem cinco segmentos locais e **zero remotos**. Isso muda a próxima ação: o alinhamento do arco não basta, e `maxTipError=0` sobre uma lista vazia não pode aprovar a esteira.

Hipótese de fonte a verificar/corrigir pelos donos: `lastEmitter` é atualizado para a pose desenhada no frame anterior; o novo evento lê essa mesma pose antes do mixer, então o gate `distance(lastEmitter, point)>1e-6` não reserva um segmento. A interpolação posterior move o ator sem que exista uma ponta aberta para atualizar. O próximo teste com pool real deve demonstrar essa sequência e o segmento corrigido antes da GPU.

Reservar um segmento inicialmente degenerado para travel válido e preenchê-lo no flush, ou diferir sua geometria até esse flush, são implementações de apresentação permitidas. Não gerar novos travel/hit/SFX, mover autoridade ou reescrever histórico; não prolongar a vida para esconder perda de pacotes. A restrição inicial de não criar geometria no callback era uma hipótese técnica, não um requisito do usuário que obrigue conservar o defeito. Exigir ponta/segmento presentes em amostras remotas apropriadas, além de erro de posição pequeno; miss terminal sem deslocamento conserva seu escopo próprio.
