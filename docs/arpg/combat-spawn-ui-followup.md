# Spawn rejeitado — funcionalidade provada, acabamento aberto

Combat inspecionou PNG original `output/playwright/2026-09-19T02-13-10-153Z-verify-player-spawn-browser/spawn-rejected-no-free-space.png` (Chrome1280×800). O fluxo rejeita o início e a nova tentativa por botão funciona quando há espaço, mas o texto longo “Entrada indisponível” usa o título monumental do menu e ultrapassa a coluna esquerda; o botão “Tentar novamente” apresenta contraste fraco nesta captura. Não promover2/2checks funcionais como aceite visual.

Proposta para próxima janela GUI/Combat: conservar título de marca ou mensagem curta que caiba no componente; apresentar motivo e recuperação na coluna do formulário; conferir foco/contraste por teclado e portrait. Combat é dono das strings/estado de rejeição no main; GUI é dona do CSS/index. Nenhuma mudança paralela durante freezePhysics. O caso sem espaço de UI usa corpo gigante sintético/sala inativa; rejeição atômica em sala viva possui provaWebSocket separada.
