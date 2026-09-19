# Canhão + gravidade + gelo: coexistência ainda retida

Root inspecionou cinco PNGs originais do native02:15:38: high1/high4/low4 em coexistência e high.74/1.25. Hashes e limites em `cannon-coexistence-followup.json`. São quadros amostrados de fixture nativa controlada; não gameplay ou playback contínuo.

A direção v2 continua selecionada: pluma sobe e se desfaz, sem a cúpula regular da primeira tentativa. Em.74s,40ms após contato, o volume ainda é estreito; sensação de impacto e sincronização com gesto/SFX precisam ser revistas no jogo. Quatro explosões juntas produzem núcleos intensos, embora as silhuetas permaneçam reconhecíveis no quadro visto.

A rodada é tecnicamente PASS/sourceStable, mas `artGate.allCombinedPassed=false`: high1 preserva46.281% da região central versus76.860% só com contexto, abaixo de65%. A contribuição do fogo comparada ao contexto preserva96.694%; isso não permite atribuir a falha apenas a gelo/gravidade. Mistura de brilho/transparência e bloom pode ser não linear; é hipótese de diagnóstico, não causa provada. O VFX recebeu revisão para isolar as contribuições no mesmo quadro, sem mover alvos/câmera ou baixar o gate.

A integração mantém uma textura e um prepass para ambos os consumidores, com lifecycle validado. Esses resultados não aprovam visualmente o conjunto. Fogo e wrapper continuam em staging, sem autorização técnica para promover este candidato enquanto o gate falhar.


## Atualização posterior — composição corrigida em staging

A rodada nativa02:27:19.472 passou o gate original65% após proteção conjunta de volume e brasas no depth: high1 reteve79/121pixels (65.289%), high4=76.860%, low1/4=90.083%. Root revisou os dois originais high1/high4. Há somente1pixel de margem no caso mínimo; isso não prova robustez em outras câmeras, movimento ou horda. O fatorial02:26 isolou também a contribuição do bloom sem alterar seu pipeline runtime. A tabela do dono foi solicitada para refletir os valores JSON exatos.

A direção artística continua selecionada. O custo GPU citado da rodada02:15 é histórico, anterior à troca de constantes da máscara, e não foi promovido a medição dos bytes finais. Origem cano/core e nova ponte visual têm gate separado em [origem](cannon-origin-followup.md), incluindo falha posterior independente02:51. Coexistência local corrigida não libera promoção do canhão completo.
