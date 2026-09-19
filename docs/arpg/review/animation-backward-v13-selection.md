# V13 — seleção para comparação perceptual delimitada

Root leu o relatório final `animation-backward-v13-staging.md`, diff e métricas por frame do candidato a7792f05. **Progresso CPU parcial retido; comparação nativa autorizada, sem promoção.** Base c402b5ac preservada.

A diferença de velocidade do tornozelo no pouso cai12.086→5.539m/s a30Hz e6.952→4.601 a60Hz. A entrada permanece exata, assim como os pares materiais qualificados, apoio direito, torso e props. Seis casos de refresh0 passaram. Isso sustenta comparar o resultado em movimento.

Os limites são relevantes: material14493 no frame seguinte piora6.741→8.980m/s e3.519→4.533; Foot30Hz tem passo máximo36.028→36.203graus e Toe angular piora localmente. O contato declarado103/207 ainda não tem patch qualificado. Nenhum desses números equivale a aceitação de ausência de deslizamento. A previsão de mistura pressupõe rate/heading/dt desta história e adiciona um driver; generalização e custo ainda não estão medidos.

Autorizado agora: mesmo histórico0–5s a6.5m/s,30/60Hz, base c402 versus a779, mesma câmera que permita ver bota e corpo, somente quatro playbacks1x. Julgar entrada, última aproximação, primeiro apoio e saída juntos, sem esconder o frame104/208 nem cortar a história. Reutilizar harness sem ampliar personagens/takes/matriz. Confirmar fonte e invariantes já medidas, não reapresentar toda a suíte. Preservar a linhagem histórica dos GLBs e não atribuir esse nativo aos assets live.

Aguardar encerramento Brute lateral e adquirir lock próprio; coordenar qualquer outra reserva real com Combat. Entregar originais e parecer perceptual honesto. Depois disso, a continuação CPU já está autorizada se persistir o defeito: melhorar continuidade do mesmo material/orientação sem perder a entrada e a redução linear, conservando apoio, comprimentos, torso/props e critérios. Usar nova cópia e não ajustar auditor/take para favorecer resultado. Nenhuma promoção automática; alvo é corrigir a bota visível, não otimizar somente o tornozelo.

## Recorte nativo executado, revisão Root limitada a oito originais

`output/playwright/arpg-animation-backward-v13-ab-1789801019464/report.json`: quatro playbacks A/B, vistas próxima e parâmetros de câmera ARPG,30/60Hz, história inteira. Report concluído, erros vazios,43fontes estáveis e zero drift runtime. `acceptedNoSliding=false`, `promoted=false`. A reserva da captura já foi encerrada; nenhum segundo nativo foi solicitado por este parecer.

Root viu individualmente os originais close101/102/104 a30Hz, close205/206/208 a60Hz e game102/206. A diferença está concentrada na aproximação da bota esquerda: no candidato ela permanece um pouco mais alta antes do contato, enquanto torso/rifle e apoio direito mantêm aparência correspondente. As imagens104/208 voltam à mesma pose, conforme o contrato. Na câmera ARPG o ator é pequeno e a diferença não sustenta sozinha um julgamento temporal. A base estreita e a proximidade entre as botas continuam visíveis; a transição de orientação merece a continuação já autorizada.

Não foi feita aqui revisão contínua dos vídeos. Oito poses não provam fluidez, peso ou eliminação de skating, e não anulam as regressões materiais/angulares do relatório CPU. Trata-se da fixture com GLBs históricos (incluindo material antigo), não dos assets opacos atuais nem gameplay. **Reter v13 como avanço parcial e seguir autoria CPU de material/orientação em nova cópia**, preservando a prova e sem nova busca de takes ou promoção automática.
