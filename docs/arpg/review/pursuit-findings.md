# Perseguição e alcance através de sólidos — revisão independente

Reprodução CPU em `pursuit-audit.mjs`, extraindo **literalmente** `updateServerMonsters`, `getServerMonsterTarget`, `updateServerMonsterStatus` e os profiles do `server.mjs` atual. Usa módulos reais de colisão, melee e layout. Callbacks observam dano e omitem transporte/serialização de rede; não é sessão multiplayer nem captura de gameplay. Fonte estável nos cinco arquivos registrados.

Evidência final: `output/qa/arpg-root-review/2026-09-18T23-50-39-854Z-pursuit.json`.

## Perseguição para em sólidos mesmo com rota disponível

Simulação20s, tick50ms, um Walker raio.78/speed3.3 perseguindo jogador imóvel. Todas as posições iniciais são válidas (correção de overlap <.001m). Controle sem obstáculo chega ao alcance e registra18 impactos.

| Caso no mapa real | Início do inimigo XZ | Jogador XZ | Distância final | Movimento no último segundo | Rota alternativa testada |
| --- | --- | --- | ---: | ---: | --- |
| rocks-0 | (-19,-20) | (-19,-12) | 5.76001m | 0m | Completa contornando por X=-22.2 com o mesmo solver |
| burial-rail-2 | (-14,22) | (-14,17.1) | 2.77001m | 0m | Completa contornando por X=-18.2 com o mesmo solver |

O core só pede velocidade na direção direta do alvo, e o contato elimina o componente contra a parede. É correto o solver bloquear, mas não há escolha de rota. As rotas manuais da reprodução são apenas testemunhas de espaço disponível, não uma implementação de IA. Em `getZombieCrowdAwareMoveDirection` offline, grupos menores que8 também recebem a direção direta; a separação de vizinhos em grupos maiores não substitui navegação estática.

Correção solicitada a Physics/Combat: steering/waypoint determinístico e limitado, com memória do lado escolhido, recuperação quando travado e saída quando a linha fica livre. Avaliar raios distintos, bosses, passagens reais, alvos móveis e eventos de atração/dash. Não resolver removendo os colisores, empurrando pela parede ou teletransportando o inimigo. Fonte comum cliente/servidor evita divergência.

## Ataque através de parede sólida

Parede isolada fechada com altura3m, meia largura3m e meia espessura.1m em(0,0); inimigo em(0,-1), jogador em(0,1). Ambos livres de overlap e separados por sólido. O core registra **19 eventos de dano em20s**, sem movimento, porque `isWithinMeleeArc` consulta distância/dot mas o impacto não consulta bloqueio estático. Ray emY1 confirma o sólido entre ambos.

Na grade real burial-rail-2 também há19 eventos de dano entre(-14,20) e(-14,18). A grade tem altura1.05m: decidir explicitamente se um golpe autorizado passa por cima com volume/altura corretos. Esse caso não deve ser tratado automaticamente como equivalente à parede de3m. A parede alta reproduz o defeito inequívoco.

Correção solicitada: validar caminho/volume da arma ao impacto, incluindo altura, e interromper ataque impossível ou navegar até alcance desobstruído. Aplicar a mesma política ao melee offline e demais ataques que exigem contato. Buff/nova podem ter políticas próprias; o novo dash/charge deve acertar somente no caminho realmente percorrido. Incluir vítimas atrás de parede e empates no mesmo tick nas provas.

Nenhum runtime do dono foi alterado por root. O auditor conserva `accepted:false`; não é aprovação global ou prova visual. Enviado aos donos Combat/Physics.

## Atualização — correção integrada reproduzida

`output/qa/arpg-root-review/2026-09-19T00-17-43-776Z-pursuit.json`: mesmos cinco cenários, extração literal atual do servidor, imports reais de navigation/skills/physics, sourceStable=true. Rocha e grade antes paradas20s agora contornam e chegam ao primeiro impacto em2.90/2.95s. Parede alta antes permitia19hits pelo sólido; agora o primeiro ocorre2.75s após desvio. Consulta independente no callback de cada impacto registrou **0 golpes ocluídos em todos os cinco cenários**. Cenário aberto permaneceu18hits/20s. Isso resolve a reprodução CPU específica; horda natural, perf e rede ainda exigem suas provas. `accepted:false` global mantido.
