# V9 — proposta separada de diagnóstico de suporte corporal

**Proposta, sem implementação ou autorização de promoção.** A v9 `cae3cb8e` permanece uma ablação com corpo preservado. Não alterar a v8 nem acrescentar offset de pelvis ao candidato atual. [Witness e limites](animation-backward-v9-staging.md), [dados geométricos](../../output/arpg-animation/backward-v9/region-feasibility.json).

## O que foi e não foi demonstrado

O alvo de região rígida com articulação original do pé fica fora do alcance em108/60Hz; porém outra pose, com ToeBase apoiado e pequeno roll do calcanhar, resolve esse frame mantendo a pelvis. Portanto, **não foi demonstrada necessidade geral de mover o corpo**. Paridade do torso continua útil como controle dessa causa, sem se tornar exigência artística final.

No último apoio111 e no release56/112, o conjunto restrito de orientações testadas não satisfaz simultaneamente região anterior, piso e alcance. As coordenadas e pedidos estão no `regionFit` do traço final. Manter uma região absolutamente imóvel depois do release é apenas contrafactual: o pé deve sair do chão, respeitando os flags existentes. Uma correção corporal não pode servir para prolongar esse contato.

## Próximo experimento limitado proposto

Antes de mover qualquer osso do corpo, comparar a região **deformada**, não apenas ToeBase, como função conjunta de Foot/ToeBase. Os pesos distintos dos vértices94/99/120 explicam por que fixar um osso ainda deixa deformação residual. Manter o mesmo prefixo, os mesmos critérios e o release completo; registrar a menor alteração de pose que atende ao piso e alcance. A busca atual de um único eixo±60° não esgota essa possibilidade.

Somente se esse conjunto continuar incompatível, preparar **outro candidato/variante**, com um traço de suporte corporal previsto e nenhum deslocamento instantâneo aplicado ao witness:

1. Usar os dois apoios físicos efetivos e a fase anterior ao release para calcular uma trajetória de suporte, desde os frames anteriores ao conflito. Preservar root/gameplay/velocidade, comprimentos, rig e conexões de arma/mão. Medir o movimento do corpo e dos props, em vez de exigir matriz mundial idêntica.
2. Resolver corpo e pernas conjuntamente. A menor translação instantânea que faria um tornozelo caber na esfera é apenas um limite geométrico inferior; não é uma trajetória aceitável. Registrar também velocidade/aceleração e esforço requerido para chegar a esse alvo ao longo da história. Não transferir uma correção comum às duas pernas só para zerar um número.
3. Não usar uma queda vertical tardia como atalho. No contrafactual111, distância horizontal já inviabiliza esse recurso; corrigir dezenas de centímetros em um frame produziria outro defeito. A antecipação, inclinação e transferência de peso precisam de relação causal com os apoios e de continuidade temporal demonstrada.
4. Comparar região material, altura, alcance, limites das articulações, release e movimento de cintura/torso/grip na mesma execução. Recusar ganhos de P90 obtidos por perda de cobertura, troca de flags, sustentação artificial ou ruptura da silhueta. Só depois de melhora conjunta pedir a etapa de evidência apropriada, sem tratar CPU como aceite artístico.

Nenhuma massa corporal, limite anatômico ou parâmetro de dinâmica foi inventado nesta proposta. Esses parâmetros precisariam ser explicitados na variante e separados das medições. Nenhuma GPU, matriz ampla, retarget, runtime ou recurso de Combat está reservado para ela.
