# Revisão visual de personagens, animação e VFX

Revisão em 2026-09-18, com inspeção direta das imagens nativas listadas abaixo. Não atribui nota 10 nem transforma testes estruturais em aprovação artística. Nesta tarefa não houve edição de runtime. O parecer alimenta JEV/JEF com observações concretas; inclui uma captura adicional do candidato congelado às 17:59 UTC, após a correção do arco da espada pelo agente principal.

## Candidatos e cobertura

- **Personagens, 17:49:35 UTC:** `output/playwright/2026-09-18T17-49-35-464Z-verify-character-experience/`. Inspecionados menu, movimento/ataque natural, acerto de alvo e morte. Os relatórios passaram para warrior/dwarf e não registraram erros de página, console, HTTP ou requests. O alvo foi colocado por debug e a morte foi forçada; a fase inicial de movimento usa input real. O relatório geral é corretamente `syntheticFixture:true` por conter essas fases.
- **Limite do candidato histórico:** o relatório warrior informa `sourceChangedDuringRun:true`; dwarf informa `false`. Ambos registram `src/main.js=ba27c068cc8e2e45c4c4feefa8d521db4cfbf478261727408ebaa182d6f502e3`, anterior ao novo pool/ambiente. Portanto o conjunto 17:49 não valida o runtime final congelado. Os blocos claros de lápides e copas mais vivas nessas imagens são históricos; o root informou que foram corrigidos depois.
- **Retratos:** `output/playwright/character-portraits/390x844.png` e `874x402.png`, com layout e interação de teclado verificados pelo relatório adjacente. São viewports de navegador; não são aparelhos móveis físicos.
- **Monstros:** `output/playwright/monsters/`, fixture nativa Chrome/ANGLE Metal com três GLBs reais. O teste registra 129 amostras × três atores, cinco estados, apoio, animação e isolamento. Não é gameplay e não mede desempenho da horda.

## Observações das imagens

**Aldric:** o escudo azul/dourado e a espada longa tornam a classe reconhecível no retrato. A inclinação do tronco e a passada variam entre as capturas de movimento e ataque. No enquadramento de gameplay, cabeça/mãos ocupam poucos pixels; não há evidência visual suficiente para aprovar dedos, punho, contato dos pés ou deformação extrema. Não se vê uma separação grosseira entre arma e braço nos frames inspecionados.

**Lyra:** cabelo ruivo, proporção baixa e o cano largo distinguem a silhueta do guerreiro. Em `natural-move-attack`, o flash parte da ponta do rifle e os traçantes seguem a mesma região de mira; isso estabelece coerência espacial neste frame. O registro de estado confirma o clip `Shoot`. A imagem não estabelece sozinha recoil suave, contato constante das duas mãos ou cadência agradável. O material metálico e as roupas mantêm leitura sem virar uma mancha branca.

**Escolha de personagem:** em 390×844 os dois retratos, nomes, tipo de arma e indicação de seleção cabem simultaneamente; a borda dourada, radio e palavra “Selecionado” dão pistas redundantes. Os botões de entrar permanecem visíveis. Em 874×402, a composição em duas colunas preserva campos e ações, mas os retratos e textos de descrição ficam bastante menores; é um ponto de leitura a conferir em tela física, não um overflow observado. A preferência selecionada e navegação de teclado passaram no relatório.

**Monstros:** o Walker tem capuz/rosto pálido, o Brute tem massa corporal vermelha e ombreiras largas, e o Lich tem crânio claro com roupa violeta. A diferença é visível na fixture frontal. Os cinco clips alteram a pose, sem vértices divergentes nos frames medidos. O maior erro de apoio observado foi 3,4 mm; isso prova correção de flutuação naquele conjunto de amostras. O teste também confirmou que flash e esqueleto não vazam entre instâncias.

**Limite artístico dos monstros:** os três usam o mesmo conjunto Tripo de movimentos. No frame `attack-14`, todos têm inclinação lateral e perna recolhida semelhante; o Walker parece executar um golpe atlético e o Lich não apresenta gesto específico de conjuração. No fim de `Death`, os corpos terminam encolhidos/laterais; não há ragdoll nem resposta individual ao vetor do golpe. O apoio correto é um ganho técnico, sem equivaler a coreografia de alta qualidade.

**VFX de espada, candidato histórico:** em `warrior-natural-move-attack`, a faixa clara aparece abaixo/atrás do avatar que já avançou; em `warrior-actual-target-hit`, o arco ocupa a região dos pés. O código anterior enviava `player.position` para `emit('slash')`; o shader só elevava esse Y até 0,045 m, com raio 2,5 e tilt 0,25. Isso explicava a impressão de risco no chão. **O novo freeze corrige essa posição**, como registrado abaixo.

**Impactos e efeitos de chão:** faíscas pequenas e traçantes do rifle deixam a cena legível no frame de baixa densidade. O flash coral transforma o inimigo atingido em uma silhueta quase uniforme, apagando textura durante o pico. O selo azul de spawn é muito mais saturado que o piso e funciona como marco espacial, mas compete com personagens próximos quando permanece no campo visual. Ainda não há aqui cobertura temporal suficiente para concluir se flash/selos acumulados atrapalham combate denso.

**Morte do jogador:** o relatório mede transição ao clip Death e reinício, mas a imagem foi tirada cerca de 200 ms após dano forçado de 999999, com overlay. O número gigante é resultado da fixture, não evidência de dano normal. Não usar esse frame para aprovar a queda completa do personagem.

## Candidato atual: cinco novas capturas

[review-captures.json](/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX/output/playwright/visual-characters-current/review-captures.json) registra o Chrome isolado em 1440×900, hashes antes/depois, estado por captura e diagnóstico. Os 11 arquivos de runtime monitorados permaneceram estáveis (`sourceChangedDuringRun:false`); nenhum erro de página, console, HTTP ou request observado. O contexto foi fechado após a captura, sem fechar o Chrome do usuário.

Candidato: `src/main.js=aee5f57002acb3b8a57ba9eef8c37afdb616834e7a22c86312bf4be64010b897`; `animated-enemies.js=97157db3857b7c860e28283510365faed3be1259c4f07b7d57920a3517bdbf81`; `monster-library.js=077ac825fc18eb8e3df6c0da3cecf82cb1858d027b8d72f8af5f59f7adc3f117`. O relatório contém os demais hashes monitorados. Isso não declara equivalência com futuras alterações de fonte.

- [quiet-natural.png](/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX/output/playwright/visual-characters-current/quiet-natural.png): entrada pelo menu e início natural. Lápides agora têm topo arredondado e material escuro, e as copas usam verde oliva mais contido. Piso, pedra e vegetação compartilham melhor a iluminação noturna. O portal azul continua sendo o maior acento saturado no centro.
- [sword-current-impact.png](/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX/output/playwright/visual-characters-current/sword-current-impact.png): ataque por mouse, sem debug de combate. O arco está agora na altura da cintura/antebraço de Aldric, mais compacto, sem a faixa destacada no chão. A origem usa avanço de 0,35 m, altura de 1,296 m, raio 2,1 e tilt 0,35. O estado registra `Attack` e incremento de `slash`. O código mantém a aplicação de dano em 42% do swing; este frame sem alvo próximo não revalida dano.
- [sword-current-followthrough.png](/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX/output/playwright/visual-characters-current/sword-current-followthrough.png): outra pose do mesmo input contínuo. A lâmina/escudo continuam visualmente conectados ao corpo no enquadramento disponível. O efeito permanece um glyph estilizado; não é fita amostrada da trajetória real da espada.
- [dense-debug-fixture.png](/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX/output/playwright/visual-characters-current/dense-debug-fixture.png) e [followthrough](/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX/output/playwright/visual-characters-current/dense-debug-fixture-followthrough.png): **fixture de densidade renderizada**, com 62 entidades e 20 atores GLB detalhados ativos. Os GLBs próximos preservam as diferenças Walker/Brute/Lich. A fileira distante muda abruptamente para corpos geométricos pastel, com sombreamento muito mais plano; esse é o maior desnível artístico visível neste candidato. Duas copas grandes à direita encobrem partes de vários inimigos; o diamante de alvo ajuda um deles, mas não revela todos os perigos ocultos.

**Limite decisivo da fixture densa:** `stressLevel6` define `perfStressImmortal`, velocidade dos inimigos em zero e cooldown de ataque alto. O ramo de `animate()` ignora `updatePlayer`/`updateShooting` nessa condição. O script enviou teclas/mouse, mas os estados mostram posição do jogador inalterada, hero Idle e nenhuma nova emissão de slash nessa fase. Portanto não chamar essas imagens de combate denso real, nem usá-las para aprovar leitura temporal, dano, movimentação ou FPS sob combate. O vídeo gravado é material disponível, mas não recebeu revisão temporal neste parecer.

## Três melhorias prioritárias e verificáveis, após o ajuste do slash

1. **Aproximar os LODs dos modelos detalhados.** Substituir os proxies pastel por malhas reduzidas/instanciadas, impostores ou ao menos formas e cores derivadas dos GLBs; manter resposta de luz e tamanho compatíveis. A prioridade é a fileira claramente visível atrás das copas no cenário de 62 inimigos. Aumentar indiscriminadamente a quantidade de esqueletos não é a proposta: preservar o teto 20/10 e medir custo ao escolher a representação distante.
2. **Diferenciar a atuação dos monstros.** Trocar/retargetear o ataque e a locomoção do Walker por clips de zumbi, manter um golpe pesado para Brute e criar/selecionar um gesto de conjuração para Lich. A biblioteca Mixamo inventariada fornece candidatos de zumbi/mutante, mas o retarget e a licença precisam preservar sua procedência. Critério de revisão: windup identificável, pés plausíveis, direção de golpe clara e sincronismo com dano/projétil.
3. **Revelar ameaças ocultas pelas copas.** Testar dither/transparência controlada para a copa que fica entre câmera e jogador/inimigo próximo, ou rever posição/escala dessas árvores na área de combate. No candidato atual, as duas árvores à direita escondem trechos relevantes dos grupos. Critério: jogador, atacante e telegraph permanecem distinguíveis durante aproximação, preservando a composição do cemitério. O flash coral histórico permanece uma observação secundária a rever com o novo pool em combate ativo.

## Famílias VFX após a restrição Espada/Rifle

Mapeamento por leitura do candidato acima. “Gatilho natural” significa rota alcançável no jogo atual, **não** que todas essas rotas foram exercitadas nesta captura. Efeitos internos podem não incrementar o contador de `emit(type)`.

| Família/API | Estado atual e gatilho | Cobertura observada nesta revisão |
| --- | --- | --- |
| `slash` | Espada do guerreiro e golpes remotos correspondentes | Captura natural atual e histórica; novo posicionamento confirmado |
| `muzzle` | Rifle de Lyra; origem da boca da arma | Captura histórica de input real |
| `impact` | Acerto de espada/rifle | Alvo colocado por debug, atingido por input real, candidato histórico |
| `blood`, `death` | Morte de inimigos; `death` também na morte do jogador | Imagens/estados históricos; queda dos GLBs em fixture isolada |
| `dust` | Passos do jogador em movimento | Rota ativa; esta nova sequência não demonstra movimento |
| `ember` | `emitTrail` nos projéteis do rifle | Traçantes visíveis no candidato histórico; não exige `emit('ember')` |
| `heal` | Poção que de fato cura; perk Ashen Heart | Rota alcançável, sem captura específica nesta revisão |
| `levelUp` | XP suficiente/avanço de nível | Estados históricos registram emissão; sem revisão temporal dedicada |
| `teleport` | Entrada/reinício do jogador | Nova captura quiet e contador confirmam emissão |
| `shockwave`, `smoke` | Explosões de traps/projéteis/chefes, alguns perks e abertura/recompensa de baú via `spawnExplosion` | Rota natural ativa; sem sequência de chefes nesta revisão |
| `seal` | Buff temporário coletado e baú/recompensa | Rota ativa; `sealRitual` de arma automática foi retirado da oferta de upgrades |
| `shadow` + soul echo | Blade Echo em acertos com perk e Last Breath ao reviver | Rota condicional alcançável; fixture de pose skinned documentada separadamente, sem ocorrência nesta captura |
| `ambient` + folhas | Motes e folhas no `update` do módulo, reduzidos por qualidade/reduced-motion | Visíveis no cenário; `emit('ambient')` do antigo orbitOrb não é necessário/natural |
| Target markers | `setTargets` para o alvo próximo, com estado locked conforme tiro | Um marcador visível na fixture densa; `emit('target')` isolado não é chamado normalmente |
| Fire de superfície | Buff temporário da espada chama `attachWeapon` na geometria GLB real | Rota natural; sem captura do buff nesta revisão. O `emit('fire')` de flamethrower/burnTick não é alcançado pelo arsenal fixo |
| `frost`, `lightning` | Ainda implementados no módulo; rotas antigas frostNova/thunderstaff não são armas jogáveis atuais | Catálogo/fixture modular, sem gatilho natural confirmado atual |
| `judgement`, `bladeStorm` | Rotas antigas sealRain/guardianBlade evoluído foram retiradas da progressão ativa | Catálogo/fixture modular, sem gatilho natural confirmado atual |

Fire volume raymarched continua restrito a BoxGeometry na fixture/fallback; a espada GLB usa fogo de superfície. Atmosfera de altura/luz e bloom/grading são pipelines de mundo/pós-processo ativos, independentes da seleção de arma. Não contar raymarch Box como efeito naturalmente presente na espada de Aldric.

Usos futuros coerentes, **propostas sem implementação nesta rodada**:

- **Lich:** selo de antecipação no chão seguido de um único `lightning` dirigido ao alvo, no instante de dano, com direção/área explícitas. `judgement` pode representar uma coluna de perigo bem telegrafada, usada apenas num ataque específico do chefe. Manter o personagem jogador com sua espada/rifle.
- **Brute:** poeira e `shockwave` no impacto de uma pancada pesada; círculo de antecipação separado do pulso de impacto, limitado à área que realmente causa dano. Reaproveita famílias já naturais sem inventar projéteis do guerreiro.
- **Chefes de fogo/gelo ou perigos temáticos:** `fire`/smoke em um ponto de chão persistente e `frost` num hazard de congelamento somente se a mecânica correspondente existir; brilho inicial e duração devem comunicar risco real. Não anexar fogo/gelo decorativo a todos os golpes.
- **Chegada/morte de chefe:** uma combinação curta de `teleport`/seal na chegada e `death`/smoke na morte, ligada a um evento único. O soul echo pode servir de memória/ressurreição de um chefe específico, mantendo o limite de instâncias.
- **Recompensas:** seal e partículas ascendentes ao abrir baú; heal apenas quando HP aumentar. `bladeStorm` pode permanecer excluído enquanto nenhum chefe/hazard de lâminas justificar a forma; não há obrigação artística de colocar todas as famílias numa partida.

## Limites para a avaliação

Há evidência de personagens importados distintos, seleção funcional, clips ativos, arma e flash coerentes no frame do rifle, slash com posicionamento melhorado e três monstros com estados verificáveis. Não há base neste parecer para “todas as dimensões 10”: gameplay denso ativo, vídeo revisado temporalmente, colisão/contato detalhado, retarget específico por monstro, dispositivos físicos e comparação consistente de todas as condições continuam gates próprios. O inventário completo de VFX está em [vfx-reference.md](/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX/docs/vfx-reference.md); a seleção atual de espada/rifle não dispara automaticamente as 21 famílias da fixture modular.

## Hashes das evidências inspecionadas

SHA-256 dos arquivos efetivamente vistos. Prefixo **17-49/** corresponde à pasta completa de `verify-character-experience` acima; **portraits/** a `output/playwright/character-portraits/`; **monsters/** a `output/playwright/monsters/`.

| Arquivo | SHA-256 |
| --- | --- |
| portraits/390x844.png | `7a9d4852636c377d886aab59d52edbe161d430c05c32727b4e1e319e3a372f55` |
| portraits/874x402.png | `efd012c23ba1c79f7d2a9eefc7a9eea1632b08358a8a781fc5cb13b4d3343a7b` |
| 17-49/character-warrior-menu-selected.png | `9cb92d9a7aac6deb9c0c2a3468c1d3b533b1899678078d2018a544405654075c` |
| 17-49/character-warrior-natural-move-attack.png | `0fb3db44028db22c5ee1382a3f0230aac23e9558155efb7e1a554c3a613a6d91` |
| 17-49/character-warrior-actual-target-hit.png | `7cd5bc10974d8c30eae1a7bfb2c3634ba531a2e283563a82bdca7324ac3ec039` |
| 17-49/character-dwarf-natural-move-attack.png | `57cd5470950a34388028918f8498a7062f948d40cd7701be35c9528f11b8426a` |
| 17-49/character-dwarf-actual-target-hit.png | `721f1195b496f7fbb07cf81d5f5a0628700deab33eb07c28448da73cfae070f2` |
| 17-49/character-dwarf-death.png | `255718f2d79729a837eb730b4b5818cad89fc7471b06385c7477ae949dcad577` |
| monsters/idle-front.png | `9771e964a82571c2615d1e4f6b9a43244c9566ffb0269d5e258f2fb3a823c073` |
| monsters/attack-14.png | `792af9b7d85eaa365dfca347db31ff42734acdf2a05f7f30ad1a6e3f700d2ef2` |
| monsters/death-32.png | `12e9628363fb104bcb6e5eb4749a0864e5b9ba5dc910e177606b7c22f7bff496` |
| monsters/verification.json | `81de041e72b5f6dbce120ac3d039fa47c8690313f0abb31a76c69dddcd3a7a6b` |
| visual-characters-current/quiet-natural.png | `501e7364f11d2436bbdd430511719644359162f2937073d6496d69bc0902e1a5` |
| visual-characters-current/sword-current-impact.png | `8a537b0f42440ed856d794554df677326d32eac6338082ff4760e6c06b8bb742` |
| visual-characters-current/sword-current-followthrough.png | `fd0d26b5c865704edb03b82b4d06e134b802ccc37f3eda268bea4d8872cfaf58` |
| visual-characters-current/dense-debug-fixture.png | `c9f29234d30dcae3d20a703ff9a3346a753038c9c17240c480da4624df989f50` |
| visual-characters-current/dense-debug-fixture-followthrough.png | `a7f77a8971c29d2790ee800a430719942df8537d0fe5e5b72329a4591032b4cb` |
