# Brute v7 — encontro e recolhimento autorados, somente CPU/staging

**Entregue candidato revisável `candidate-04`, sem promoção ou GPU v7.** A instrução [Root de adaptação](review/brute-v6-contact-policy-review.md) foi executada em nova cópia:12GLBs reais, oito encontros e quatro ramos de recolhimento. Não é somente o helper diagnóstico v6. Duração1,45s a1× preservada; **contactAt=null**. .70 é intenção do storyboard, não marker escolhido.

Antes da autoria, o [parecer focal lateral v6](brute-v6-contact-followup.md) foi fechado: duas execuções nativas1,45s, fonte congelada, encerramento GPU06:50:34.092UTC. A mão ficou visível no encontro; peso/AAA/contato físico fino não foram aprovados. `contact-delivery-manifest.json` congela82arquivos do focal, além dos350anteriores. Os433arquivos reunidos permanecem iguais após v7. Novas folhas v7 são **projeções CPU de meshes posados**, sem texturas e sem playback nativo.

## Entrega concreta e leitura

[Galeria CPU com os12GLBs](../../output/brute-motion-v7/candidate-04/review.html), [clips/perfis/hashes completos](../../output/brute-motion-v7/candidate-04/clips.json), [seleção e negativos](../../output/brute-motion-v7/candidate-04/selection.json), [medidas do GLB recarregado](../../output/brute-motion-v7/candidate-04/verification.json), [preservação comparada](../../output/brute-motion-v7/candidate-04/preservation-comparison.json), [parecer das projeções](../../output/brute-motion-v7/candidate-04/visual-review.json).

O braço parte da preparação comum até.50s. A busca usa todos os triângulos da mão/região de fronteira contra **todos os meshes reais do alvo**, encontra a primeira superfície a.70 e conserva folga visual nominal2mm. Não usa o vértice4337 como único gate, nem desloca jogador/Brute ou alonga a cadeia. Essa folga protege o roundtrip e não representa raio de dano, profundidade física ou tolerância para aprovar cruzamentos.

Aldric mantém endpoint lateral/frontal(.18,.80); a altura do punho é2.614450/2.553450/2.460748m para distâncias1.82/1.855/1.89. Lyra mantém(.08,.95); alturas2.155505/2.131017/2.113431m. As superfícies são escudo real e região de mão/antebraço esquerdos do DwarfBody — incluindo pesos anatômicos no report, sem inventar dedos do Brute. Idle25 a1.89 usa alturas2.512013/2.106875m. Alvos Aldric2.70/Lyra2.55, Brute3.30; centros/raios da fixture intactos.

A aproximação e o recolhimento são curvas Hermite com posição/velocidade contínuas. A saída eleva/recua a mão antes de abrir lateralmente; evita dobrar o braço contra o peito. Idle25 de Aldric requer arco4cm mais alto entre.60–.70 para passar pela borda real. Esses pontos são autoria visual, não novos eventos de combate. O torso/carga/passo/recuperação-base continuam v6.

Os ramos `withdraw-away` e `withdraw-surface` desviam a mesma atuação em.55, preservam a velocidade de entrada, freiam/recolhem e reencontram a recuperação comum em1.05, terminando Idle em1.45. Away: alvo se afasta6.5m/s a partir do estado1.855m, condição derivada da trajetória CPU anterior; não é alvo movido para fabricar acerto. Surface: centro fixo1.855m, blend real dos clips Idle0→Run25 em.15s. É um contraexemplo de mudança da guarda, **não replay do controller de locomoção/rede**. A mão para de procurar encontro; nenhum ramo dispara dano/impacto.

## Envelope e negativos obrigatórios

| Clip | SHA256 prefixo | Resultado CPU amostrado |
| --- | --- | --- |
| warrior-1.820-idle0 | `2dc907744f8f` | braço/corpo amostrados sem cruzamento |
| warrior-1.855-idle0 | `9b9bd4f70c6a` | braço/corpo amostrados sem cruzamento |
| warrior-1.890-idle0 | `a77c3a28498c` | braço/corpo amostrados sem cruzamento |
| warrior-1.890-idle25 | `a7a718761d7e` | braço/corpo amostrados sem cruzamento |
| dwarf-1.820-idle0 | `beceaaa93e4b` | NEGATIVO corpo: 39 pares |
| dwarf-1.855-idle0 | `49a6f33be9d0` | NEGATIVO corpo: 16 pares |
| dwarf-1.890-idle0 | `9c69e4257c49` | braço/corpo amostrados sem cruzamento |
| dwarf-1.890-idle25 | `4a5c8cacd106` | braço/corpo amostrados sem cruzamento |
| warrior-withdraw-away | `e87f1475ae31` | braço/corpo amostrados sem cruzamento |
| warrior-withdraw-surface | `0c9fca0670a1` | NEGATIVO corpo: 79 pares |
| dwarf-withdraw-away | `5a8a1cb483fe` | braço/corpo amostrados sem cruzamento |
| dwarf-withdraw-surface | `a362b1dc6f4e` | NEGATIVO corpo: 213 pares |

**Os12 passam apenas o exame do braço; oito também não têm cruzamento torso/alvo nas amostras.** Isso não é aprovação artística/contato físico.

- AldricIdle0: os três pontos1.82/1.855/1.89; Idle25: somente1.89. LyraIdle0/Idle25: corpo completo somente1.89. Não certificar todos os valores intermediários, yaw, blend/IK vivo ou outras fases com base nessas amostras. Uma interpolação simples de endpoints não foi aprovada.
- Lyra1.82/1.855: mão adaptada sem atravessar, **torso/alvo39/16pares**. Os mesmos máximos existem na base v6 nos mesmos estados; não desaparecem ao corrigir braço. EssesGLBs ficam como negativos revisáveis, nunca clips de acerto selecionados.
- Mudança paraRun: braço recolhe sem cruzar alvo, mas corpo continua inválido. Aldric79pares versus72da base; sete adicionais na região de pesos mistos braço/torso. Lyra213 versus213. Não chamar o defeito inteiro de herdado nem usar recolhimento para esconder acerto autoritativo.
- Carga/passo preservados significam que o corpo ainda ocupa o volume herdado mesmo no miss. Resolver esses negativos de corpo completo exigiria outra decisão de autoria/contrato; nenhuma translação, inflação de alcance ou alteração de pelvis/pernas foi feita nesta tarefa.
- O API oferece recolhimento na janela autorada.50–.70; mudança depois de.70 fica `late-change-unresolved`, sem salto de pose. Interseção já existente/teleporte para dentro da mão não pode ser desfeita retroativamente. A prova geométrica de cancelamento exportada é.55, não todas as idades dessa janela.
- Negativos v6 a1.82/1.855/Run/yaw±15 continuam intactos. As outras poses são fora do envelope; não foram convertidas em casos positivos por omissão.

## Preservação e provas CPU

CadaGLB tem somente **R_Upperarm, R_Forearm e R_Hand.quaternion** substituídos no Attack. **39/42trilhas locais exatas**, incluindo raiz/pelvis/pernas/clavícula/braço esquerdo e twists locais; nenhum scale ou translation acrescentado ao braço. Twist descendente acompanha o pai pela hierarquia original. Nodes, skin/binds, mesh, materiais, imagens/texturas e os outros4clips permanecem iguais. Prefixo binário original da base v6 preservado.

179poses por clip (120Hz+story poses),2148poses de GLBs efetivamente recarregados, usando os probes de chão reais. Mão inteira, antebraço e ombreira contra todos os meshes: **zero pares de cruzamento amostrados nos12**, folga mínima da mão1.997766mm nos encontros. Ombreira/peito, ombreira/cabeça e mão/torso: zero nas amostras;27pares antebraço/peito do bind/entrada/saída persistem, com **zero pares novos** na comparação por identidade dos triângulos. Esses diagnósticos não cobrem colisão contínua entre amostras, coplanaridade ou malha watertight.

Pés deformados, Hip/Head e juntas fixas: delta0 contra v6 nos mesmos tempos. Os1313vértices do torso sem peso no braço/twists: delta0. Os21vértices da região do torso com influência do braço mudam até53.626mm no recolhimento; reportados separadamente, não mascarados como corpo totalmente imóvel. Comprimentos da cadeia~.473798/.428747m: variação máxima89.586nanômetros após chaves Float32, abaixo do gate1µm; nenhuma extensão da cadeia. Velocidade máxima amostrada do punho8.104m/s — medida cinemática, não prova de peso.

[24checks do API visual](../../output/brute-motion-v7/presentation-checks.json): sair, aproximar, trocar primeira superfície/pose/ator, remover, pausa, idade antiga, replanejamento tardio e replanejamento na preparação comum. Curva autorada C1; comparação numérica de velocidades nos nós até0.000348m/s com passo1µs. A exportação é LINEAR/slerp a240Hz; não alegar C1 analítico do GLB discreto ou ausência perceptual de jerk. [Reprodução](../../output/brute-motion-v7/reproduction-01/reproduction.json): **12/12GLBs byte-idênticos**, nova pasta, sem sobrescrever candidatos.

Histórico preservado: candidate-01 foi exploração;02 revelou8pares de mão em.675 de Idle25 e3pares da ombreira no recolhimento;03 demonstrou que seguir cegamente a normal lateral podia dobrar a mão para dentro do torso.04 corrige esses defeitos locais. Relatórios/logs/GLBs anteriores não foram apagados. Duas hipóteses erradas no primeiro check de preservação (torso incluía pesos mistos e twists descendentes) e gate inicial demasiado estrito de comprimento Float32 estão preservados nos logs/source; o check final mede essas diferenças explicitamente.

## API visual em cópia e reprodução

`tools/brute-motion-review-v7-presentation.mjs` exporta `createArmPresentation({base,plan,targetKey})`, devolvendo `observe(age,state)`, `sample(age)` e `replacePreparedPlan(plan)`.

`base(age)` é a trajetória v6 do punho; `plan` contém endpoint, normal da superfície, approachLift, distance, surfaceKey e poseKey. `targetKey` identifica o ator do mundo, não sequência de jogador. `state` contém present/targetKey/distance/surfaceKey/poseKey/paused. `surfaceKey` deve representar a primeira superfície do **encontro projetado** sob a pose atual, incluindo região anatômica quando o mesh contém várias partes; não é simplesmente o mesh mais próximo da mão ainda levantada. Pose/superfície desatualizada exige recolhimento. Replanejar endpoint só antes de.50, onde as curvas compartilham a preparação; após isso, não perseguir alvo com a raiz ou saltar a mão para um novo endpoint.

Retorno: `{age, mode, reason, cancelAt, rightWrist, contactAt:null, appliesDamage:false}`. É componente de apresentação **do braço em staging**, não aprovação do corpo, FSM, hit-test ou import proposto no runtime. Planos/atores de entrada não são mutados. O caller futuro ainda deve avaliar envelope corporal, idade real da pose, LOS, autoridade e estado de cancelamento. Não ligar esse API ao core neste lote.

Para repetir em pasta nova, a partir da raiz do checkout:

```sh
node tools/brute-motion-review-v7-reproduce.mjs reproducao-nova
node tools/brute-motion-review-v7-verify.mjs reproducao-nova
python3 tools/brute-motion-review-v7-sheets.py reproducao-nova
node tools/brute-motion-review-v7-presentation-test.mjs
```

O comando inicial recusa pasta existente. `reproduction-01` já foi executado. Ferramentas/source snapshots e manifestos acompanham o pacote; não instalar framework ou provider. O fit do candidate-04 reutiliza os endpoints geometrizados de02; a varredura final do04 é o `verification.json`, não os frames preliminares dentro de fit.json.

## Proveniência, dono e próxima integração

Base v6 guerreiro`6ee3788bcc15…`/dwarf`6feed18b7612…`, Brute runtime original`d1d58b1ae860…`;07 em pé e v3/v4/v5/v6 continuam preservados. Aldric`5c1903a064de…`; Lyra históricoCPU`e11eadb8…` versus cópiaOPAQUE atual`dc0867da…`, mesmoBIN e apenas metadata de material conforme v6. Não reatribuir o nativo histórico ao GLB atual. [Fontes completas](../../output/brute-motion-v7/source-manifest.json).

Ownership: só `output/brute-motion-v7/`, `tools/brute-motion-review-v7-*` e estehandoff. Nenhuma edição em runtime, main/server, rigs/fontes, áudio, heróis/Walker/Lich, nem arquivos de Animation. Animation foi informada do escopo; Combat recebe este documento durável, sem retry na fila cheia e sem interrupt.

O Brute atual ainda retorna null em `getMeleeTiming`; fallback tem dano imediato, visual.55s e cooldown.62s. Faixa efetiva atual1.90m, sem antigo multiplicador.84 para o fallback. Duração1.45/contato futuro/cadência precisam ser acordados por Combat; **não comprimir este candidato, não escolher marker aqui, não trocar GLB isoladamente**. Falha de apresentação não deve esconder dano já confirmado.

Sem GPU v7, browser ou servidor próprios pendentes.5173 não foi tocado por SFX; PID5973 era o observado no focal. Durante este CPU, Combat publicou promoçãoLich07:13 e PID22588, confirmado ao encerrar. Não congelar/runtime-reverter trabalho alheio. Esta entrega conclui a autoriaCPU bounded e deixa peso/contato nativo/aceite artístico/contrato de combate em aberto.

**Fechamento:** manifesto `output/brute-motion-v7/delivery-manifest.json`; fontes desta autoria liberadas/congeladas para revisão. Próximas escritas previstas: nenhuma em runtime ou novaGPU. Animation recebeu recibo `01a0b887-9962-7003-b752-d48e0df685f7`; Combat via estehandoff. Folhas lateraisCPU finais usam mesmo ângulo com FOV48 para incluir a mão levantada; derivadas iniciaisFOV40 preservadas em `projection-initial-fov40/`. ARPG conserva os parâmetros do caller, com limitação real de legibilidade nessa escala.
