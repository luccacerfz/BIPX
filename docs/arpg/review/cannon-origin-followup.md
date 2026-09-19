# Origem do canhão: diferença entre fixture e core

Diagnóstico CPU independente `node docs/arpg/review/cannon-origin-audit.mjs`; resultado `output/qa/arpg-root-review/2026-09-19T02-23-04-469Z-cannon-origin.json`, três taxas30/60/120Hz, fontes estáveis. Importa class-skills core real, sem alvos/parede; utiliza como referência fixa o socket capturado no native02:15:38. Não é playback nem nova amostragem do socket em cada taxa.

Na fixture preservada, herói em(-2,0,5), cano em(-1.762649,1.764134,3.602243). O trajeto artificial parte desse cano e percorre8.8m até target. No core real, release origina em(-2,1.05,5); o primeiro travel fica nesse ponto nas três taxas. Distância até o cano1.587465m, sendo.714134m abaixo e1.397757m atrás na direção deste exemplo. A origem X também difere. O core termina a22m do ator.

`presentClassSkill` fornece o socket somente a cast/release e encaminha travel sem offset visual. O canhão staged copia o target de travel para seu corpo. Portanto, a prova visual da fixture não prova continuidade de disparo usando o fluxo do jogo; ela elimina essa separação ao construir sua trajetória. Os dois fluxos mantêm autoridade diferente de apresentação, e não foi demonstrado que a descontinuidade seja invisível em playback.

VFX/Combat receberam o caso para reprodução com core+adapter literal e alvos/parede muito próximos antes da promoção. Uma solução de apresentação precisa explicitar a ligação cano/trajeto e terminar no contato real, sem deslocar silenciosamente origem/altura/dano, atravessar sólido perto do cano ou inventar impacto. Sem correção de runtime nesta auditoria.


## Bridge staged — falha independente às02:51

[Auditor de contato](cannon-bridge-contact-audit.mjs) usa core literal, bridge candidato e contacts290a, socket fixo extraído da captura nativa histórica, com uma quina sintética8×8cm em(-1.62,2). Report `output/qa/arpg-root-review/2026-09-19T02-51-12-406Z-cannon-bridge-contact.json`, fonte estável. Não é nova medição do socket nem defeito visto em gameplay.

Em10Hz, dt.1 permitido pelo core, a trajetória autoritativa x=-2 passa livre. O trecho visual de progress2.2→4.4 cruza a quina em t=.165019: origem(-1.9449503,1.2156316,2.4758133), destino(-2,1.05,.6). O bridge executou zero consultas nesse trecho porque testa apenas progress atual<=settleDistance; ele abandona a verificação no último trecho que ainda vinha deslocado.30/60/120Hz passam esse testemunho particular; isso não generaliza aprovação. VFX recebeu a reprodução para corrigir o fim da ponte em staging, preservando autoridade e o report falho. Promoção continua pendente.


### Repetição independente02:58 — colisão resolvida, atraso visual retido

O novo bridge mantém sweep enquanto `converging`, inclusive depois da distância de convergência. Auditor ampliado apenas com distância visual→autoridade e último segmento não terminal; o critério de travessia não foi afrouxado. Report `output/qa/arpg-root-review/2026-09-19T02-58-32-434Z-cannon-bridge-contact.json`, fonte estável, crossing0 em10/30/60/120Hz.

Em10Hz, o corpo fica bloqueado em(-1.954005,1.188387,2.167264) enquanto o core segue até(-2,1.05,-14.8) no último travel não terminal: **16.967891m de separação**. ResetTrail permanecefalse. É efeito colateral do recorte persistente, não prova de continuidade aprovada. VFX recebeu a necessidade de abandono explícito da ligação bloqueada, limpeza/ocultação do trecho impossível e retorno à trajetória autoritativa, sem fabricar contato nem alterar autoridade. Outros três Hz convergem corretamente nesse witness, com distância0 no último travel. Ainda CPU sintética com socket fixo histórico, sem playback real deste defeito.


### Resolução CPU confirmada por root03:03

Bridge passou a abandonar explicitamente o trecho visual bloqueado: desativa offset, reinicia rastro naquele evento e posiciona a apresentação no endpoint autoritativo, sem contato inventado. A consulta não fica tentando manter uma segunda bola parada na quina. Repetição root `output/qa/arpg-root-review/2026-09-19T03-03-25-075Z-cannon-bridge-contact.json`: fonte estável, zero crossings nos quatro Hz; separação máxima1.587465m corresponde somente ao socket inicial, e último travel não terminal tem separação0 em todos. Aceito os dois achados CPU como resolvidos no candidato. Aparência do abandono/limpeza no navegador, trajetória real com socket atual e coexistência ainda exigem prova; não há promoção automática.
