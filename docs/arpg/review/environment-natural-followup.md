# Environment — rodada natural dwarf retida

Root leu `output/playwright/2026-09-19T02-49-37-647Z-verify-natural-runs/natural-dwarf.json` e inspecionou os dois PNGs originais30s/final. [Registro com hashes](environment-natural-followup.json). Fonte estável, zero erros de página/console. Warrior da mesma execução passou; dwarf não.

Dwarf não registrou kills nem XP durante60s, embora as três skills tenham sido acionadas. Player passa de(0,0) para(18.933,14.268) e permanece praticamente imóvel entre20s e60s, com35zombies e saúde200. A captura mostra Lyra junto aos barris/vigas/rochas da manutenção, alvo atrás de obstáculos e campo gravitacional. O harness escolhe alvo mais próximo, mira em oito direções e recua quando distância<4.5; não tem escape por estagnação nesse ponto. É hipótese de cobertura de input presa, ainda não causa provada de defeito do produto.

Há também falha de orçamento:6257frames,103.963fps médios, P9520.9ms frente a limite20, P9934.3ms, pior55.8ms, três frames>50ms e zero longtasks. O assert de kills abortou antes de executar os asserts de performance; isso não transforma o valor de P95 em aprovado. Estatística final da janela interna do jogo não substitui a medição integral.

Combat foi informado para explicar a causa e repetir somente o escopo necessário. Se precisar de escape no piloto do teste, deve usar teclas reais e registrar a mudança; sem teleporte, HP artificial, redução de duração, gates ou deslocamento do cenário para forçar aprovação. Falha e imagens preservadas. A integração Environment ainda não recebeu aceite global/JEF atual.


## Repetição bounded02:57–02:58

Dono Combat alterou somente o piloto de QA: após1.8s de avanço quase zero, retorna por posições recentes usando WASD real. Um solver local no processo Node avalia oito direções para esse escape; nenhuma posição calculada é aplicada ao jogo. A fonte do harness foi lida pela root. Não confundir assistência do teste com decisão humana natural ou correção do planner do jogo.

Reteste só dwarf em `output/playwright/2026-09-19T02-57-00-638Z-verify-natural-runs/natural-dwarf.json`: fonte estável, assertions passed,60s, três skills,78kills, nível7/onda2 e upgrades observados.138.855fps médios, P957.7ms, P9913.9ms, pior69.4ms, um frame>50ms e um longtask70ms. O reteste satisfaz seu gate de combate/desempenho; não apaga a rodada original nem prova custo do mesmo estado estacionado.

Physics comprovou saída contínua para o player no gargalo, com folga4.38cm para raio.64, sem caminho na grade até.5m. Corpos.78/1.72 não passam por esse mesmo gargalo; existência de outras entradas/alcance de ataque ainda deve ser considerada. Root pediu diagnóstico inverso de ameaças ao player antes de investir num planner mais complexo ou chamar o lugar de abrigo invulnerável. Nenhum prop/corpo foi alterado para fazer o teste passar.


Precisão adicional03:06: o report02:57 contém `escapes:[]` (**zero ativações**). A rotina nova estava disponível, mas esta partida não reproduziu o bloqueio. Assim, o reteste não demonstra reparo causal do caso anterior; apenas uma nova partida aprovada com a fonte/harness declarados. Não atribuir o ganho de desempenho ao escape nem dizer que ele retirou a personagem daquele ponto nesta execução.


## Diagnóstico inverso e decisão de desenho —03:12

Root leu `output/physics/navigation-pocket-143-20260919/2026-09-19T03-07-29-945Z-inverse.json` e os callers atuais.72cenários CPU, fonte estável, um walker/Blood Cow por cenário, player estacionado; não é horda/native. Em18origens por caller/tipo, walker cliente/servidor e Blood Cow solo tiveram zero movimento e zero hit. Servidor Blood Cow também não moveu, mas uma origem oeste produziu dano por projétil em.30s.13/18 starts walker e12/18 boss eram válidos como pedidos; correções dos demais ocorreram somente na criação da fixture e foram registradas. Não chamar o recanto universalmente invulnerável.

Essas buscas esgotam768nós e são repetidas sem aproximação; nenhum tempo de frame foi medido nesse diagnóstico. A grade atual não conseguir uma rota não prova inexistência topológica de todos os percursos. A descoberta justifica examinar qualidade de circulação/ameaça do conjunto, não aumentar budget ou diminuir corpos.

Autorizei Environment a preparar composição local separada de surface-life-v1 para dar uma passagem confortável ao player e aproximação/LOS real de walkers, conservando assets e movendo visual+collider juntos. Comparação causal deve usar os mesmos pontos e callers143, sem mudar ataque/IA/raios/gates. Boss precisa de ameaça real por alguma abordagem, não obrigatoriamente atravessar toda passagem. Primeiro finalizar o A/B artístico já preparado; nova proposta fica em output/environment/maintenance-access-v1, sem promoção automática. Physics conserva a prioridade de density nativo antes de apoiar essa comparação. Essa decisão aborda o recanto demonstrado, não tenta forçar aprovação do piloto natural.
