# Recuperação de entrada — revisão integrada root

Correção localizada aceita. Report `output/playwright/2026-09-19T03-06-52-504Z-verify-player-spawn-browser/spawn-rejected.json` passou, fonte estável. Root leu o handler e os estados de recuperação, e inspecionou cinco PNGs originais listados em [registro com hashes](gui-recovery-integrated.json).

É browser/servidor real com um bloqueador sintético de spawn, não uma partida natural. Duas rejeições e nova entrada aceita exercitam tentativa novamente, voltar e reabrir. Nas quatro resoluções, o motivo tem display:block e retry permanece focado/alcançável, com fundo opaco normal/hover. O texto de marca conserva BIPX; atributos temporários role/status/description/marker são removidos ao sair da rejeição. Mesma identidade do span do rótulo, ícone e nome/classe preservados.

Desktop1280×800 e portrait393×852 mostram motivo e botão legíveis. Em320×568, rolagem intencional traz retry para a tela; título/motivo não ficam simultaneamente visíveis nessa captura, e o controle global de som fica sobre a parte superior dos cards. Landscape852×393 mantém aviso local visível. A imagem de retry confirma estado de partida com Aldric e HUD, não apenas sucesso de requisição.

A causa da transparência instantânea tem diagnóstico temporal anterior e CSS atual sem transição de background no estado de rejeição. Este report integrado confere aparência normal/hover e fluxo; não foi apresentado como nova medição de todos os primeiros frames. Não atribuir aprovação global da interface, leitor de tela ou dispositivo físico. Não é necessário repetir a suíte inteira para esta alteração localizada.


## Ordem da mensagem de estado — revisão posterior

Root confirmou no main atual que `role=status` agora é aplicado antes da alteração de `messageCopy.textContent`; a captura e restauração dos atributos anteriores permanecem presentes. Recibo do proprietário: `output/qa/arpg-spawn-ui-role-order-20260919/receipt.json`. É uma correção focal de contrato, sem nova alegação de teste com leitor de tela ou atualização retroativa da captura03:06.
