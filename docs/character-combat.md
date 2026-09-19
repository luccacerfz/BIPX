# Personagens e inimigos no localhost

Aldric Leonguard e Lyra Brasswarden são selecionáveis antes da partida. A escolha fica salva neste navegador. O seletor espera o modelo carregar; em caso de falha, permite tentar novamente. A escolha não muda durante uma partida ativa.

| Personagem | Ataque | Apresentação |
| --- | --- | --- |
| Aldric | Espada em cone, com preparação antes do dano. Não cria projéteis. | Modelo e animações do acervo Aldric, efeito de corte à altura do corpo. |
| Lyra | Rifle à distância; tiros partem do marcador de saída da arma. | Modelo da pasta Lyra_Brasswarden, animação Shoot, traçadores estreitos. |

Os antigos drops de armas agora reforçam a arma da classe por 15 segundos (+40% de dano). Upgrades incompatíveis com a classe e armas automáticas antigas não são oferecidos. No multiplayer, o servidor limita o tipo de ataque à classe, rejeita ataques excessivos e preserva a classe após morte e reentrada.

O Peão Orc usa o asset OrcPeasantMiner e entra ocasionalmente a partir da onda 2. Os papéis Zumbi/Corredor, Bruto e Invocador/Visor usam os modelos animados zombie, brute e lich derivados de DeadOrbit, encontrado no projeto local quake. Originais e hashes constam nos documentos dos assets.

## Orçamento dos inimigos animados

O jogo conserva a lógica de posição, vida, colisão e recompensas; a representação animada é atribuída aos inimigos próximos. Há no máximo 20 esqueletos no desktop ou 10 na configuração móvel, incluindo cadáveres. Geometria e texturas são compartilhadas; ossos, mixers e materiais de efeito são independentes. Os demais inimigos mantêm o sistema de LOD e instâncias.

A escolha dos atores detalhados possui margem de estabilidade para evitar reconstrução a cada pequena mudança de distância. Cadáveres terminam a queda e desaparecem antes de devolver o ator ao pool. Pausa congela a queda; reinício limpa atores ativos e efeitos.

## Validação e limites

- Testes focais de ambas as classes: seleção visível, persistência, movimento/ataque por entradas reais, dano após a preparação da espada, ausência de projéteis do guerreiro, reforços, upgrades, morte e reinício.
- Os testes de alvo colocado e horda de estresse são fixtures identificadas como tal, embora executem o renderizador e os caminhos de dano reais.
- O teste CPU de ciclo de vida reproduziu e corrigiu quatro falhas do pool; oito cenários passaram. Essa prova não substitui FPS ou inspeção da animação no navegador.
- Resultados anteriores à estabilização de todos os arquivos são históricos. O relatório de bateria registra hashes e invalida aprovação se as fontes mudarem durante a execução.
- Celular emulado não equivale a aparelho físico. Captura/medição de áudio não equivale a aprovação por escuta. A meta de todos os critérios JEF em 10 ainda depende do relatório de avaliação e de evidências completas.

Execução local: `http://localhost:5173/?offline=1`. A avaliação usa as credenciais somente no processo de execução; elas não fazem parte dos assets nem do código do navegador.

## Revisão em andamento: impacto dos zumbis

Walker e runner usam o contrato compartilhado `src/combat/melee-timing.mjs` nos caminhos solo e servidor. Duração visual: 0,88 s; impacto: 0,46 s; intervalo mínimo entre inícios: 1,05 s. O alcance frontal é 2,05 m para Walker e 1,85 m para runner, acrescido do bônus existente de alcance de elite. O dano por golpe permanece igual; a menor frequência e a possibilidade de esquiva mudam deliberadamente a dificuldade e exigem revisão de equilíbrio.

Durante preparação/recuperação, esses inimigos interrompem o avanço. No impacto, a autoridade confere se o alvo original ainda está vivo, dentro do alcance e do arco frontal; uma saída lateral, afastamento, morte do agressor ou congelamento pode cancelar o dano. A fase visual não aplica dano. A animação recebe um identificador de golpe e tempo decorrido, inclusive quando um ator volta ao grupo de modelos animados ou chega uma atualização da rede.

Os focais de integração passaram: 15 verificações solo em `output/playwright/2026-09-18T18-51-36-852Z-verify-melee-integration` e 13 de servidor isolado com WebSocket em `output/playwright/2026-09-18T18-55-33-730Z-verify-melee-server`. Incluem preparação, impacto único, passo de tempo grande, alcance/arco, congelamento, morte e entrada durante um golpe. São fixtures explícitas com alvos/estado controlados, não sessões naturais. A inspeção visual de cinco fases do controlador está em `output/playwright/monster-phase`, também isolada.

O servidor local precisa ser reiniciado após a integração de reconexão e a bateria precisa cobrir o candidato inteiro. Os focais históricos anteriores não validam automaticamente esse candidato. Orc, Brute e conjuradores ainda usam seus caminhos anteriores e precisam de calibração própria de contato. A primeira pausa inesperada durante a automação de Lyra continua sem causa confirmada, embora a repetição de 60 s tenha passado.

## Teclado e enquadramento

I/J/K/L controlam a mira; Espaço ataca; WASD/setas movem. Soltar uma diagonal conserva a direção, com uma tolerância de 60 ms entre solturas. O mouse retoma a mira ao se mover. Na evolução, 1/2/3 funcionam inclusive com uma carta focada; repetição da tecla não consome a próxima escolha. O foco segue para a próxima carta ou retorna ao campo após a última escolha. Os dois personagens passaram pelo cenário de teclado/evoluções em `output/playwright/2026-09-18T18-57-55-547Z-verify-keyboard-combat`.

O enquadramento móvel se aproxima gradualmente em proporções de tela largas, limitado a 64% da distância configurada. A inspeção visual dessa mudança e a regressão do candidato final ainda estão pendentes. O focal WebKit anterior à mudança passou em desktop/retrato/paisagem no Mac, sem erros de console ou shader; não constitui prova em Safari.app ou iPhone físico.
