# Brute v6 — duas variantes autoradas, somente staging CPU

**Autoria entregue em cópia, sem promoção e sem aprovação de peso/AAA.** Pacote final desta etapa: [`output/brute-motion-v6/handoff-01`](../../output/brute-motion-v6/README.md). Há dois GLBs completos da mesma pancada oblíqua descendente, com mão aberta, preparação, carga lateral, passo, encontro e recuperação. Não são linhas de intenção sobre o07: as poses são skinning dos novos clips. O candidato07 da v5 continua intacto como primeira base em pé.

O único clip substituído nas cópias é `Attack`, índice3. Rig/hierarquia, binds, malha, skin, materiais, texturas e os outros quatro clips permanecem iguais à fonte Brute `d1d58b1a…`. Nenhum asset de runtime, main/server, autoridade, dano, FSM, áudio, herói, Walker ou Lich foi editado. Nenhuma GPU, browser ou servidor foi aberto. Combat continua dono de qualquer integração futura.

## Candidatos concretos e leitura

- [Aldric: GLB](../../output/brute-motion-v6/handoff-01/brute-warrior.glb), [poses3/4](../../output/brute-motion-v6/handoff-01/warrior-threequarter-sheet.png), [posesARPG](../../output/brute-motion-v6/handoff-01/warrior-arpg-sheet.png), [encontro lateral](../../output/brute-motion-v6/handoff-01/warrior-side-contact.png).
- [Lyra: GLB](../../output/brute-motion-v6/handoff-01/brute-dwarf.glb), [poses3/4](../../output/brute-motion-v6/handoff-01/dwarf-threequarter-sheet.png), [posesARPG](../../output/brute-motion-v6/handoff-01/dwarf-arpg-sheet.png), [encontro lateral](../../output/brute-motion-v6/handoff-01/dwarf-side-contact.png).
- [Perfil, hashes e fixture](../../output/brute-motion-v6/handoff-01/attack-profiles.json), [medições](../../output/brute-motion-v6/handoff-01/review-metrics.json), [recarregamento dos GLBs](../../output/brute-motion-v6/handoff-01/roundtrip.json).

As imagens são **projeções CPU de malhas deformadas, sem texturas, GPU ou playback**. A vista ARPG usa os parâmetros desktop dos callers, não uma câmera de sessão viva. A folha estática deixa visíveis a armação lateral alta, a passagem à frente do peito e o retorno à guarda; não prova fluidez, sensação de massa ou contato em movimento real. A vista lateral resolve melhor o encontro que a3/4, onde escudo/rifle o ocultam parcialmente.

A preparação, o corpo, as pernas e o braço esquerdo são compartilhados. A variante Aldric encontra o escudo mais alto; Lyra desce mais para a mão/antebraço de apoio do rifle. Não foi inventada arma para Brute, nem fechada a mão por novos dedos. Não há novo take Mixamo ou retarget nominal: são curvas autoradas a partir de Idle0 e da calibração em pé já estabelecida, com arco adaptado ao volume do Brute.

## Fixture real e primeira superfície

Brute3.30m, Aldric2.70m e Lyra2.55m, com os mesmos GLBs do estudo anterior. Jogadores em Idle0 com props e correções dos loaders, centros fixos em(0,0,−1.89), diante do Brute em(0,0,0), frente−Z. Raios1.18+.64=1.82m;1.89m está dentro do alcance nominal1.90m. Não mover alvo ao punho. Cópias, SHA completos e caller snapshots estão no [manifesto inicial](../../output/brute-motion-v6/source-manifest.json).

Durante esta autoria, Animation promoveu Lyra e11→dc0867da somente por `materials[1].alphaMode:BLEND→OPAQUE`. Conferi BIN idêntico e todo o restante do JSON igual: [linhagem atual](../../output/brute-motion-v6/dwarf-current-lineage.json). As medições continuam atribuídas à cópia iniciale11; a geometria é equivalente à atualdc, sem relabeling de prova nativa. A cópia dc também foi preservada para a futura fixture. Combat alterou servidor/processo na sua própria frente; nenhum desses processos ou arquivos foi restaurado por SFX.

O encontro foi construído pela **primeira superfície da região inteira da mão**, selecionada por pesosR_Hand>.45 e faces de fronteira, contra corpo e todos os props. Foram usados mínimos triângulo/triângulo e testes de interseção; não apenas o vértice4337 ou comprimento de osso. A mão passa fora e à frente do próprio peito antes de descer. O raio central anterior era insuficiente: a primeira construção interceptava o rifle, e foi descartada.

| Quadro de referência.700s, centros1.89m | Aldric | Lyra |
| --- | --- | --- |
| Punho: direita / altura / frente | .180 / 2.4553 / .800m | .080 / 2.1109 / .950m |
| Primeira superfície: direita / altura / frente | escudo:.0947 / 2.1519 / 1.0465m | guarda corporal:−.0236 / 1.7343 / 1.1716m |
| Separação de projeto | ~.500mm | ~.500mm |
| Velocidade do punho imediatamente antes | ~2.02m/s | ~2.28m/s |

Lyra: triângulo20602 de `DwarfBody`; seus vértices têm pesos de `LeftHand`, `LeftForeArm` e polegar. A testemunha anatômica completa está no `roundtrip.json`. Não é contato no torso escondido atrás do rifle. A separação de0.5mm é uma tolerância de aproximação geométrica; não é evento físico nem dano.

**Caso negativo incluído:** com os mesmos clips e centros1.82m, o recarregamento encontra interseção com escudo/corpo, já nos samples.675s/.690s respectivamente. Portanto estas duas poses demonstram encaixe na fixture1.89m; **não são endpoints universais**. Um clip rígido não pode ser promovido para todo o intervalo1.82–1.90m com esse resultado. A futura decisão visual precisa tratar distância/pose do alvo ou escolher outro contrato de encontro, sem deslocar jogadores para esconder o problema. Nenhum adaptador foi implementado aqui.

## Curvas, carga e recuperação

O storyboard começou em1.30s e foi estendido a **1.45s** para transferir apoio antes de recolher o passo. Não houve compressão para.55s. Perfil completo0..1.45, speed1, sem slice Walker. `contactAt:null` nos GLBs e no perfil: **.70s continua quadro de intenção/encontro posado, não marker de integração selecionado**.

| Fase | Construção autorada |
| --- | --- |
|0–.18s|Carga à direita/trás, elevação do braço atacante, peito alto; apoio do pé direito calibrado.|
|.18–.40s|Pé esquerdo avança28cm, com elevação de7cm e velocidade vertical zero nas extremidades da curva.|
|.40–.70s|Quadril e peito conduzem o avanço; mão contorna o torso e desce para cada guarda.|
|.70–.82s|Recuo curto da mão após aproximação, corpo mantém carga; sem plateau longo de extensão.|
|.82–1.05s|Transferência de volta ao apoio direito antes de recolher o pé esquerdo.|
|1.05–1.30s|Recolhimento do passo com elevação suave; braço retorna pela lateral.|
|1.30–1.45s|Retorno ao Idle0 original, sem alteração do rig ou pose-base.|

Deslocamento autorado do quadril:27cm para a direita durante a carga,14cm para a frente entre carga e encontro,15cm para baixo no encontro. Altura total permanece aproximadamente3.14–3.30m. Joelhos e pelve articulam; as posições dos ossos não são alongadas, exceto a translação autorada de `Hip`. O suporte usa IK de duas juntas com comprimento original. Não se congelou a perna inteira.

Calibração de sola: zonas geométricas separadas de calcanhar/antepé, com mínimos de altura equiparados por rotação do pé — sem achatar malha. [Dados da calibração](../../output/brute-motion-v6/foot-calibration.json). O giro adicional traseiro foi reduzido para preservar apoio durante a pancada. [Folha de apoio](../../output/brute-motion-v6/handoff-01/warrior-support-sheet.png) e JSONs registram vertices próximos do chão, drift, quadril e proxy de centro de massa.

**Limite de peso:** o proxy usa pesos anatômicos arbitrários, não massas físicas/forças. Não prova equilíbrio dinâmico; parte da trajetória fica fora do polígono estático de vértices a≤12mm do chão. O próprio Idle original já falha nesse proxy. Não ocultar isso com nota alta, nem tratar apoio de chão como aprovação de peso. A leitura pesada permanece pendente de revisão de playback1×.

Na versão entregue, o proxy está dentro desse polígono em36.4% do intervalo.18–1.30s, com afastamento máximo20.8cm; o Idle original acusa26.9cm. Esse resultado **não libera equilíbrio físico**. O drift XZ máximo das mesmas amostras de sola esquerda, durante apoio.40–1.05s, é4.18mm. Picos de velocidade do punho6.67/8.06m/s precedem o encontro; o playback deverá julgar se a aceleração ainda lê rápida demais.

## Validação e limites de deformação

Cada variante foi medida em349quadros a240Hz, total698; recortes de autointerseção a60Hz,88poses por variante. Não é prova contínua analítica entre todos os instantes.

- Nenhum alongamento solicitado das cadeias IK; posições locais dos ossos preservadas, exceto `Hip`. Primeiro e último quadros retornam ao Idle0.
- Mão direita/torso, mão esquerda/torso, recorte da ombreira/peito e ombreira/cabeça: sem cruzamentos próprios detectados no recorte medido. O volume da mão e antebraço no encontro consta no relatório.
- Antebraço/peito no Idle original já apresenta27pares cruzados. O máximo não aumenta, mas há até6pares diferentes nos primeiros/últimos~33ms de transição. Isso permanece explícito; não declarar a malha inteira livre de autointerseção. Os testes excluem adjacências geométricas e não cobrem todos os casos coplanares.
- Folga mínima antebraço/alvo fica próxima de20cm Aldric/19cm Lyra. A folga do torso para props de Lyra é pequena, poucos milímetros, registrada no JSON; não extrapolar para outros ângulos/poses.
- GLTFLoader recarrega os arquivos exportados e reaplica probes reais de chão. Preserva1.287.948bytes originais do BIN e os dados de rig/skin/mesh/material/texturas/quatro clips. Os erros de interpolação e do quadro de encontro estão no `roundtrip.json`, sem confundir amostragem CPU com playback nativo.

As tentativas intermediárias ficam preservadas: primeiro encaixe com mão atravessando torso, tentativa que atingia rifle, apoio nas pontas, mão esquerda no peito, strap/cinturão e pico de velocidade. `handoff-01` é a única pasta apontada para revisão atual; nenhuma das outras foi promovida.

## Entrega, reprodução e próxima janela

Ferramentas exclusivas `tools/brute-motion-review-v6-*`: rig/curvas, busca do encontro, exportação/CPU, projeções, recarregamento e relatório. Sem novo framework ou agente. O [README do pacote](../../output/brute-motion-v6/README.md) lista comandos; [preservação final](../../output/brute-motion-v6/preservation-final.json) e [manifesto](../../output/brute-motion-v6/delivery-manifest.json) fixam fontes/artefatos.

`docs/arpg/review/server-fallback-melee-unreachable.md` foi lido: o defeito.84 foi reproduzido por Root e segue separado com Combat. Essa correção não aprova07/v6 nem muda o contrato visual aqui. Fontes runtime e servidor5173 foram preservados nesta frente.

**Etapa CPU liberada para revisão dos artefatos, não para promoção.** Nenhum lock GPU adquirido; fila nativa continua coordenada por Root/Combat/GUI/VFX/Animation. A próxima captura, se o candidato for levado adiante, deve comparar apenas estas duas variantes a1×/1.45s com os alvos reais fixos,3/4+ARPG, e inspecionar guarda, ombreira, carga e recuperação. Não há aceite de gameplay, rede, áudio, contato físico ou qualidade AAA nesta entrega.
