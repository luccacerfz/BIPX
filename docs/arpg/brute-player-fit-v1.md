# Brute07 contra Aldric/Lyra — encaixe frontal CPU antes de v6

**07 não alcança a silhueta real frontal no marker.** A postura em pé continua primeira base preservada, não golpe pesado aprovado. Este estudo usa o mesmo GLB `0cf09802` e os heróis atuais, sem autorar v6, mudar pose/rig/fingers dos assets ou editar autoridade/dano/FSM. Nenhuma GPU/browser/servidor foi aberto; GUI mantém sua próxima janela. V5, v3/v4, triagem e Lich permanecem intactos.

Pacote novo: [`player-fit-v1`](../../output/brute-motion-v5/player-fit-v1/README.md), [dados geométricos](../../output/brute-motion-v5/player-fit-v1/measurements.json), [pontos/timing propostos](../../output/brute-motion-v5/player-fit-v1/artistic-proposal.json), [fontes congeladas](../../output/brute-motion-v5/player-fit-v1/source-manifest.json). As imagens são **projeções CPU de malhas realmente deformadas**, sem texturas, GPU, playback ou gameplay; as linhas propostas não são um rig v6 posado.

## Escala, orientação e distância dos callers

`src/assets/playable-characters.js:4–5` passa Aldric**2.70m** e Lyra**2.55m** aos loaders; não usar os defaults2.4/2.2. `src/main.js:112` passa Brute**3.30m**, não default2.8 da biblioteca. Normalização usa o bounds do Idle com os equipamentos, como os loaders. Consequência medida: o corpo de Aldric termina em2.5537m;2.70m é o conjunto com props. Lyra tem corpo/conjunto até2.55m. Isso não iguala suas proporções: Spine2 Aldric1.800m/Lyra1.601m; Neck2.030/1.792m.

Heróis em Idle0, armas/escudo originais presentes, com `createHeroLocomotion.update(0)` real e speed0. Correção de mira Lyra−.0653rad preservada. Corpo/equipamentos identificados pelo nó real: `HeroBody`, `HeroShield`, `HeroSword`; `DwarfBody` e `DwarfRifle`. Não inferir o corpo pelo número do material.

Referencial do Brute: centro(0,0,0), frente−Z, direita+X. Jogador em(0,0,−d), mirando o Brute. Dois valores fixados **antes** de medir contato: d**1.82m**, soma dos raios1.18+.64; d**1.89m**, dentro do alcance nominal estrito1.90m. Sem deslocamento lateral/vertical, reposicionamento ao punho ou novo ajuste de altura dos jogadores. Brute preserva normalização e probes de chão da prova07.

A projeção ARPG aplica a câmera desktop dos callers: FOV48°, altura17, profundidade20, lookAhead2.6, alvoY1.2, zoom1; par girado no mundo para inimigo diante do jogador. Não é a captura da câmera/sessão/configuração localStorage de um browser vivo. Poses paradas; corrida/skills e outros ângulos não foram simulados.

## O que a pose07 realmente faz

No marker**.633333s**, punho `R_Hand` em **direita.752 / altura2.467 / frente.581m**. Seu azimute posicional é52.30° à direita da linha central do alvo; isso é a posição relativa ao centro, não a orientação do osso. A trajetória quase frontal percorre uma faixa lateral que não coincide com o jogador.

| Envelope deformado no marker | Direita X | Altura Y | Frente F=−Z |
| --- | --- | --- | --- |
| Mão, pesoR_Hand>.45 | .546–1.142m | 2.172–2.646m | .521–.971m |
| Antebraço/twists, peso>.45 | .715–1.296m | 2.232–2.792m | −.155–.628m |

Mínimos entre triângulos reais das regiões (incluindo faces de fronteira da seleção por pesos) e cada mesh alvo, no marker:

| Herói/distância entre centros | Mão→corpo | Antebraço→corpo | Mão→equipamento mais próximo |
| --- | ---: | ---: | ---: |
| Aldric1.82m | **.639m** | .965m | escudo.418m |
| Aldric1.89m | **.691m** | 1.012m | escudo.469m |
| Lyra1.82m | **.810m** | 1.139m | rifle.861m |
| Lyra1.89m | **.843m** | 1.173m | rifle.861m |

Não há contato com corpo nem prop nesses quatro casos. Método: GLTFLoader emCPU, skinning real, BVH de triângulos e mínimos vértice/face, aresta/aresta e interseção aresta/face; testemunhas3D e índices de faces no JSON. Não usar essa rotina como autoridade ou novo volume de hit. Dois casos geométricos conhecidos (planos separados1m e aresta atravessando face) verificam o cálculo.

Velocidade no marker por diferença central±1/240s: punho**.234m/s**, vértice4337 que tocava o pad**.246m/s**. O perfil quintic já quase parou na extensão. Isso sustenta a leitura de toque/empurrão; retimar o mesmo frame não corrige seu deslocamento lateral/altura nem cria transferência de massa.

Provas comparáveis: [Aldric3/4](../../output/brute-motion-v5/player-fit-v1/warrior-1.82-threequarter.png), [Lyra3/4](../../output/brute-motion-v5/player-fit-v1/dwarf-1.82-threequarter.png), [AldricARPG](../../output/brute-motion-v5/player-fit-v1/warrior-1.82-arpg.png), [LyraARPG](../../output/brute-motion-v5/player-fit-v1/dwarf-1.82-arpg.png). Todos os dez PNGs finais e as duas hipóteses descartadas foram inspecionados. As silhuetas podem se sobrepor na projeção mesmo com distância3D; a linha laranja mostra o par geométrico mais próximo.

## Proposta concreta para a próxima autoria

**Pancada oblíqua descendente de direita na guarda frontal**, com a mão aberta/garra original. Ombro/peito e avanço de apoio conduzem o braço; sem prometer punho fechado ou articulação nova. Manter referênciaIdle0 e a silhueta alta do07. O pad lateral antigo sai da definição de contato.

Primeiro alvo artístico comum: linha centralX0, altura**1.70m**, nas silhuetas paradas medidas. Na distância1.89m, o torso de Aldric está à frente1.458m, mas o escudo intercepta a linha em**.878m**. Lyra tem torso à frente1.588m, mas a malha corporal dos braços da guarda aparece em**1.160m**. Não atravessar esses elementos para simular contato no peito. Mirar apenas o torso foi calculado e **descartado**: [hipótese preservada](../../output/brute-motion-v5/player-fit-v1/torso-only-rejected.json). Não atribuir semântica nova de block/stun/dano a esse encontro visual.

[Desenho proposto Aldric](../../output/brute-motion-v5/player-fit-v1/warrior-1.89-threequarter-proposal.png), [Lyra](../../output/brute-motion-v5/player-fit-v1/dwarf-1.89-threequarter-proposal.png). Verde marca ombro/punho/superfície planejados; rosa é deslocamento requerido do punho; malhas e centros são o07 e os jogadores originais, imóveis.

| Referência proposta no contato, coordenadas direita/altura/frente | Aldric1.89 | Lyra1.89 |
| --- | --- | --- |
| Ombro direito | .20 / 2.64 / .45m | .20 / 2.64 / .45m |
| Punho direito | 0 / 1.95 / .527m | 0 / 1.95 / .810m |
| Superfície encontrada | escudo:0 / 1.70 / .878m | corpo/guarda:0 / 1.70 / 1.160m |
| Distância ombro→punho / soma de segmentos | .723/.903m =80.1% | .803/.903m =89.0% |
| Cotovelo geométrico proposto | 106.3° | 125.7° |

Não encurtar/alongar ossos. O comprimento upperarm.4738+forearm.4287=.9025m é real. Usa-se como referência a distância preservada.4306m do punho ao vértice4337 da mão; orientar esse vetor com componente−.25m vertical/+ .3506m frontal aproxima uma pancada descendente. **É uma condição de alcance**, não solução IK, pose de dedos, aprovação de deformação ou garantia de que aquele vértice será a primeira superfície após reorientar toda a mão. O próximo pose gate deve medir a mão completa, ombreira e possíveis autointerseções.

Para chegar ao ombro planejado, a referência é **+.303m frontal,−.185m vertical,−.134m lateral** em relação ao marker07. Autorá-lo distribuindo aproximadamente15–20cm de avanço do quadril,12–15cm de carga vertical, inclinação de peito8–12° e escápula/rotação curta; valores são alvos artísticos, não transformações já resolvidas. Pé dianteiro avança25–35cm e pousa antes do drive; perna traseira estende e pivota, joelhos/pelve articulam. Validar sola/continuidade e largura da base, sem voltar ao agachamento do bind nem impor um pé fixo artificial para ocultar erro.

Timing proposto **1.30s**, novo storyboard, não retime do07:

| Tempo | Ação autorada a construir |
| --- | --- |
|0–.18s|Carga legível sobre apoio traseiro; mão direita afasta-se da linha do torso, peito alto.|
|.18–.40s|Passo curto dianteiro/plant, armação do ombro; leitor ARPG deve ver a mudança de base antes do braço.|
|.40–~.70s|Quadril e peito avançam antes da mão; arco direito entra na linha central e desce à guarda. Alvo de velocidade no encontro1.8–2.5m/s, sujeito à arte.|
|~.70–.82s|Contato/brake visível, pequeno recuo da mão, continuação controlada do torso; não atravessar escudo/braço nem segurar um plateau de extensão.|
|.82–1.30s|Recuperar guarda e apoio de forma contínua; o acréscimo.10s fica na recuperação do novo passo.|

**.70s é uma intenção narrativa, não marker selecionado.** As guardas variam28.2cm na profundidade mesmo com centros iguais. Recomendo preparar duas poses de encontro dentro dessa mesma atuação, para Aldric/Lyra parados, antes de escolher clip/perfil ou eventual ajuste visual por alvo. Um único endpoint/marker rígido não comprova encaixe nas duas poses. Alterar solver/runtime/adaptação por alvo está fora desta entrega; não prometer alcance universal por essa conta estática.

## Limite de contrato e próxima decisão

Atual continua.55s visual/dano imediato/cooldown.62s. Nenhuma mudança. Há ainda uma diferença estática nos callers: main usa distância<radius+.72=1.90m; o fallback servidor entra no ramo de dano somente quando distância≤meleeRange*.84=**1.596m**, enquanto a soma dos raios é1.82m. Os casos deste estudo estão dentro do alcance nominal1.90, mas **não passam essa condição de distância do fallback servidor**. Isso não foi reproduzido em rede; Combat deve revisar em sua futura janela. Não aproximar artificialmente os jogadores para esconder a discrepância nem alterar física aqui.

Próximo trabalho concreto é autorar apenas as poses-chave da pancada com os dois alvos reais fixos e testar braço/guarda, transferência de peso e recuperação emCPU. Só depois fechar marker e solicitar nova janela nativa coordenada. Esta tarefa termina na medição, desenho e direção de autoria; **v6 não foi criada**. Nenhum GPU reservado, nenhuma fila Combat/retry, servidor5173 preservado.

Reproduzir: `node tools/brute-motion-review-player-fit.mjs` e `python3 tools/brute-motion-review-player-fit-sheets.py`. Fontes atuais em cópia no pacote; JSON guarda SHA e261arquivos v5 congelados. CPU importa `createHeroLocomotion` real para Idle: verificar hash antes de repetir sob outro runtime. [Verificação final de preservação](../../output/brute-motion-v5/player-fit-v1/preservation-final.json).
