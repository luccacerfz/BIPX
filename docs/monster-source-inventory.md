# Inventário de monstros dos jogos locais

Inspeção em 2026-09-18, somente leitura nos projetos de origem. A primeira etapa foi o inventário abaixo, sem cópia/GPU. Em seguida, o usuário autorizou a reutilização local e foram preparados três monstros para BIPX, com originais preservados e revisão nativa isolada descrita na seção seguinte. Os projetos de origem continuam intactos.

**Estado posterior confirmado às 17:59 UTC:** o root já integrou a biblioteca ao [pool de inimigos animados](/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX/src/render/animated-enemies.js:6) e ao main. Routing atual: `zombie`/`runner` → Walker, `brute` → Brute, `caster`/`visor` → Lich; `orcPeon` usa a biblioteca Orc separada. A captura de 62 entidades mostrou 20 GLBs detalhados ativos. [Revisão visual e limites do candidato atual](/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX/docs/visual-review-characters.md) distingue o gameplay natural da fixture de densidade estática. A etapa somente leitura abaixo permanece como histórico de procedência, não como estado atual da integração.

**Recomendação técnica: `zombie-brute.glb` e `boss-lich.glb`, ambos de `quake/public/assets/models/zombies/`, acompanhados pelo básico `zombie-walker.glb`.** A dupla oferece papéis de brutamontes e chefe conjurador com arquivos autocontidos, um material por personagem e cinco animações embarcadas. A revisão isolada mostrou rostos e silhuetas distintos e animação sem explosão de vértices; falta aprová-los sob a câmera, iluminação e combate atuais do BIPX. Não há nota artística nesta entrega.

**Revisão posterior de movimento:** Walker agora usa Walk/Run/Attack específicos de zumbi; a tabela e o teste inicial abaixo são históricos do GLB anterior. Hash atual, reprodução, medidas de apoio/deslizamento e limites de sincronização estão em [monster-motion.md](monster-motion.md). Idle/malha/rig preservados; Brute/Lich mantêm os clips anteriores.

## Integração visual preparada após autorização

[monster-library.js](/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX/src/assets/monster-library.js) exporta `await loadMonsterLibrary({THREE})`, com `ready`, `ids`, `stats`, `create` e `dispose`. `create(id,{parent,height,yaw})` é **síncrono** após o carregamento. IDs: `zombie`, `brute`, `lich`.

Cada controller retorna `root`, `model`, `stats`, `update(dt,{speed,dead})`, `attack({duration})`, `hit()`, `reset()` e `dispose()`. O chamador controla movimento, colisão e limite do pool. A biblioteca só carrega três protótipos, sem pré-instanciar a horda. Recomenda-se o limite solicitado de 20 atores detalhados no desktop e dez no mobile, aplicado pelo pool do jogo; não é um resultado de desempenho medido.

- Geometria, texturas e clips normalizados são compartilhados. Esqueleto, mixer e materiais são exclusivos de cada ator; o flash não altera outros monstros. `dispose` do ator libera esses recursos exclusivos; `dispose` da biblioteca também libera os protótipos.
- A frente padrão é **-Z**. `yaw` é um deslocamento adicional da orientação da malha. `root` aceita a orientação/posição do jogo. Alturas padrão: zombie 2,1 m, brute 2,8 m, lich 3,0 m.
- Clips normalizados: `Idle`, `Walk`, `Run`, `Attack`, `Death`. `Attack` preserva a preparação e o primeiro ciclo até aproximadamente 2,15 s; a duração final respeita amostras reais do GLB. `attack({duration})` remapeia o tempo. Não há clip de hit/conjuração: `hit()` usa flash material e o Lich conserva o gesto de ataque genérico.
- O runtime mantém o XZ sob controle do jogo, estabiliza a rotação de `Root` nos clips vivos, preserva a articulação de `Pelvis` e retém a inclinação da morte. O primeiro render identificou corpos flutuando nos clips rotation-only. A correção usa **160/154/122 vértices de contato** pré-calculados para zombie/brute/lich e os avalia na pose atual, inclusive durante blends. Nenhuma varredura dos ~10 mil vértices ocorre por ator/frame. A biblioteca apoia a malha no Y local de `root`; terrenos inclinados/IK continuam fora deste contrato.

Arquivos em [assets/models/monsters](/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX/assets/models/monsters): `source/` preserva GLBs e sidecars sem modificação; `zombie.glb`, `brute.glb`, `lich.glb` são derivados com albedo reduzido de 2K para 1K. [provenance.json](/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX/assets/models/monsters/provenance.json) registra caminhos originais, hashes de origem/derivado, IDs e limites da evidência de licença. A redução não altera accessors de malha, rig ou animação. [monster-prepare.py](/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX/tools/monster-prepare.py) reproduz essa derivação; [monster-ground-probes.py](/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX/tools/monster-ground-probes.py) calcula os contatos a 20 Hz a partir dos clips, em CPU.

| ID | Vértices / triângulos | Bytes do runtime | SHA-256 runtime |
| --- | --- | ---: | --- |
| zombie | 10.694 / 6.893 | 1.391.360 | `af6a973701eacee171d58521108a4b1e324194442946585b4b41c03c96ba1dbf` |
| brute | 10.739 / 6.491 | 1.344.848 | `d1d58b1ae86045d9fa39dba9b4e87a0bd6d1a66b347d74624cf8095ce208c02a` |
| lich | 11.173 / 7.148 | 1.369.284 | `f6ddd47d97757b4acee76c056baa26c644ff19e2afa17fb5630b00108e832e44` |

As três texturas 1K custam aproximadamente 12 MiB RGBA8 antes dos mipmaps, compartilhadas entre atores, comparadas a 48 MiB para três texturas 2K. O download conjunto é 4.105.492 bytes. Não se trata de compressão de textura GPU.

**Verificação isolada:** [monster-verify.mjs](/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX/tools/monster-verify.mjs) passou no Chrome nativo com ANGLE/Metal. Foram verificadas 129 amostras temporais × três atores = **387 poses**, nos cinco estados, incluindo blends; coordenadas finitas, poses dinâmicas e erro máximo de apoio de **0,003398 m**. Passaram geometria/textura compartilhadas, material/esqueleto exclusivos, flash isolado, retorno do ataque a Idle, morte mantida, reset, dt=0, criação sob demanda de 20 atores e descarte idempotente. Nenhum erro de página, console, HTTP ou WebGL observado. A criação de 20 instâncias é teste de ciclo de vida, não benchmark de uma horda.

Evidência: [verification.json](/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX/output/playwright/monsters/verification.json), [Idle](/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX/output/playwright/monsters/idle-front.png), [ataque](/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX/output/playwright/monsters/attack-14.png), [morte](/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX/output/playwright/monsters/death-32.png). As imagens foram inspecionadas. São fixtures nativas de assets, **não gameplay**. Integração em main/server, dano sincronizado, desempenho, dispositivo mobile físico e nota artística ficam para gates independentes.

## Onde estão os assets

| Projeto procurado | Estado encontrado | Conteúdo útil |
| --- | --- | --- |
| `/Users/luccacerf/Projetos/Pessoal/Gaming/quake` | Existe; HEAD observado `39e9488665a9c941bc0ecfa74ce53c318257ffd3` | 59 GLBs de monstros em `public/assets/models/zombies/`; 55 com rig Tripo e cinco clips; quatro personagens Mixamo sem clips embarcados. |
| `DeadOrbit` | Não existe pasta separada com esse nome no diretório Gaming; é o produto do projeto `quake` | O [README de quake, linha 9](/Users/luccacerf/Projetos/Pessoal/Gaming/quake/README.md:9) identifica `deadorbit.app` como o jogo. Não contar a mesma biblioteca duas vezes. |
| `/Users/luccacerf/Projetos/Pessoal/Gaming/QuakeGrok` | Existe; HEAD observado `699f0f6a07c4d2c649c5a44f97a9a578db5677db` | Nenhum GLB/GLTF/FBX/OBJ/BLEND encontrado fora de `.git`/`node_modules`. QuakeGrok usa sprite procedural; Gravewake contém atores PNG 2D. Não fornece novos inimigos 3D prontos. |

O HEAD local situa a origem; os hashes individuais abaixo identificam os arquivos realmente lidos, inclusive se houver WIP fora do commit.

## Dois candidatos recomendados

| Medida verificada no GLB | Brute | Lich |
| --- | --- | --- |
| Arquivo | [zombie-brute.glb](/Users/luccacerf/Projetos/Pessoal/Gaming/quake/public/assets/models/zombies/zombie-brute.glb) | [boss-lich.glb](/Users/luccacerf/Projetos/Pessoal/Gaming/quake/public/assets/models/zombies/boss-lich.glb) |
| Bytes / MiB | 1.478.680 / 1,410 | 1.492.616 / 1,423 |
| Vértices / triângulos | 10.739 / 6.491 | 11.173 / 7.148 |
| Primitivas / materiais | 1 / 1 | 1 / 1 |
| Skin / joints | 1 / 41 | 1 / 41 |
| Hierarquia | 43 nodes; `Root`, `Hip`, `Pelvis`, membros e twist bones Tripo | Idem |
| Atributos | `POSITION`, `NORMAL`, `TEXCOORD_0`, `JOINTS_0`, `WEIGHTS_0` | Idem |
| Textura | JPEG 2.048×2.048 embutido, 384.556 bytes | JPEG 2.048×2.048 embutido, 372.202 bytes |
| Material | Albedo; metallic 0; roughness ~0,9; double-sided | Idem |
| Normal / metallic-roughness maps | Não presentes | Não presentes |
| Clips embarcados | 5, com canais de rotação animados | 5, com canais de rotação animados |
| Extensões/decoders obrigatórios | Nenhum | Nenhum |
| Exportador registrado | Khronos glTF Blender I/O v4.5.51 | Idem |
| Função sugerida no BIPX | Elite lento de contato, com preparação de golpe clara | Chefe/conjurador com selo, projétil ou invocação; precisa sincronizar o gesto ao gameplay |
| Altura usada no jogo de origem | 2,2 m; largura multiplicada por 1,3 | 3,9 m; largura multiplicada por 1,4 |

As alturas da última linha são configurações do jogo de origem, não dimensões imutáveis do GLB. Evidência: [Brute no game.js](/Users/luccacerf/Projetos/Pessoal/Gaming/quake/public/game.js:15564) e [Lich no game.js](/Users/luccacerf/Projetos/Pessoal/Gaming/quake/public/game.js:15747). O BIPX deve calibrar altura/colisão conforme seus próprios personagens.

Hashes SHA-256:

```text
zombie-brute.glb
14791fcb26046fd2ecc00d16b14df857e1992025a34670dad22a53578628aa2f

boss-lich.glb
8496c7b5e6642546d1f6603af50453a772ab4f67b29073329afb2996dfeea673
```

### Animações: o que está realmente nos dois arquivos

| Índice | Nome real no GLB | Duração | Papel documentado no gerador e jogo |
| --- | --- | ---: | --- |
| 0 | `NlaTrack` | 15,38 s | `IDLE` |
| 1 | `NlaTrack.001` | 2,38 s | `WALK` |
| 2 | `NlaTrack.002` | 1,29 s | `RUN` |
| 3 | `NlaTrack.003` | 6,62 s | `SLASH` |
| 4 | `NlaTrack.004` | 3,04 s | `FALL` |

Os nomes semânticos vêm dos sidecars e do código gerador; o arquivo usa nomes `NlaTrack`. O [mapeamento existente](/Users/luccacerf/Projetos/Pessoal/Gaming/quake/public/game.js:7146) confirma a ordem `[IDLE,WALK,RUN,SLASH,FALL]`. O export possui 39/40 canais por clip e amostras de rotação que variam: não são apenas cinco nomes vazios. Os alvos de animação existem na hierarquia; os índices de joint cabem nos 41 joints. A inspeção de buffers não substitui playback e contato dos pés.

Pontos de integração concretos:

- Usar `SkeletonUtils.clone` por inimigo para não compartilhar um esqueleto vivo; cachear geometria/textura e criar mixers independentes.
- O `SLASH` longo contém sequência de golpes. O [jogo de origem](/Users/luccacerf/Projetos/Pessoal/Gaming/quake/public/game.js:15901) separa a preparação até ~0,85 s e o golpe/recuperação entre ~0,85 e ~2,15 s. Esses números são uma referência a conferir no BIPX, não uma garantia de sincronização.
- Não há `HURT` nem `CAST` embarcado. Não chamar `SLASH` de animação de conjuração validada. O Lich pode exigir recorte/novo gesto para casar com selos/projéteis.
- Os dois arquivos só têm canais de rotação, sem translação animada. Ainda assim, [quake trava a rotação de ossos raiz e usa correção de facing de +π/2](/Users/luccacerf/Projetos/Pessoal/Gaming/quake/public/game.js:15854); verificar orientação, postura e giro antes de reutilizar seu resultado visual.
- Cada JPEG 2K vira aproximadamente 16 MiB de RGBA8 antes dos mipmaps, se não houver compressão GPU. O tamanho do download de 1,4 MiB não representa o custo da textura residente. Avaliar 1K para inimigos pequenos e manter a origem 2K intacta se uma versão otimizada for autorizada.
- O custo de ~6,5–7,1 mil triângulos é adequado para testar poucos inimigos detalhados; uma horda inteira com muitos mixers requer orçamento/LOD próprio. Nenhum resultado de FPS é presumido neste inventário.

## Procedência dos recomendados

Brute e Lich têm sidecars adjacentes com prompt, sequência de animações, `animate_in_place:true`, IDs de geração/rig/retarget e data. Os prompts pedem criaturas genéricas estilizadas, com referência textual de estilo a Quake/Diablo; isso não é licença de personagens dessas franquias.

| Candidato | Geração | Rig | Retarget | Data registrada |
| --- | --- | --- | --- | --- |
| Brute | `cb020753-b94b-45ac-98e9-184c3251d24d` | `6bf3344d-a7ba-4ba0-aea0-b90208c04fd4` | `6c4a06cc-1fd7-47ab-91cd-5a82ae947b25` | 2026-07-11 14:28:59 UTC |
| Lich | `de2d1293-ddd8-4e3c-a373-bcc443359e84` | `b60a3c29-12c3-494a-a938-4f6c9d502de3` | `8465d9fc-a2ab-4a8d-9474-ff51b873d453` | 2026-07-11 15:31:19 UTC |

Fontes locais: [Brute sidecar](/Users/luccacerf/Projetos/Pessoal/Gaming/quake/public/assets/models/zombies/zombie-brute.json:1), [Lich sidecar](/Users/luccacerf/Projetos/Pessoal/Gaming/quake/public/assets/models/zombies/boss-lich.json:1), [catálogo e prompts do gerador](/Users/luccacerf/Projetos/Pessoal/Gaming/quake/scripts/mega_loop_300.py:270), [geração/rig/retarget/exportação](/Users/luccacerf/Projetos/Pessoal/Gaming/quake/scripts/mega_loop_300.py:455). O script importa `tripo3d`, gera por texto, pede rig bípede Tripo e exporta animações com geometria. Os IDs de geração também aparecem nos nomes dos materiais dos respectivos binários.

**Estado da licença: procedência Tripo documentada; licença comercial específica da geração não comprovada pelos arquivos locais.** Os sidecars não contêm comprovante do plano vigente ou cópia dos termos aceitos em julho. A documentação oficial atual distingue direitos de usuários pagos e gratuitos; ela não comprova retroativamente a situação desta conta/geração. Não rotular esses GLBs como MIT, CC0 ou domínio público. A autorização do usuário para reutilizar seus assets está registrada na tarefa, mas é uma evidência diferente da licença do provedor. [Tripo: uso comercial](https://www.tripo3d.ai/help/privacy-policy/how-to-use-tripo-models-commercially), [termos da plataforma, seção 5.2](https://developers.tripo3d.com/en/terms).

## Alternativas Mixamo e terceiro candidato

O [README específico](/Users/luccacerf/Projetos/Pessoal/Gaming/quake/public/assets/anims/mixamo/README.md:27) identifica Warrok, Mutant, Skeleton Zombie e White Clown como personagens baixados com skin do Mixamo, depois convertidos com `fbx2gltf`/`gltf-transform`. Há oito FBXs de personagens no nível superior da pasta (`character*.fbx`, `Mutant Punch (n).fbx`) e um `Shooter Pack/Warrok W Kurniawan.fbx`; a correspondência exata de cada nome genérico com cada GLB não foi demonstrada por um manifesto de conversão de modelos.

| Alternativa | MiB | Vértices / triângulos | Joints | Texturas | Clips no modelo | Custo de integração |
| --- | ---: | ---: | ---: | --- | ---: | --- |
| `zombie-warrok.glb` | 0,773 | 7.867 / 12.626 | 81 | 1 JPEG 1K | 0 | Rig Mixamo; anexar/retargetear clips Mutant. Bom próximo teste para um bruto com origem Adobe documentada. |
| `zombie-mutant.glb` | 1,681 | 25.046 / 11.267 | 37 | 1 JPEG 1K | 0 | Rig Mixamo; clips Mutant externos; mais vértices que os indicados. |
| `zombie-skeletal.glb` | 1,330 | 7.446 / 12.486 | 73 | 2 PNG 1K; 2 materiais, um transparente | 0 | Anexar clips de zumbi; revisar transparência/emissão herdadas do FBX. |
| `zombie-clown.glb` | 0,519 | 6.083 / 9.714 | 67 | 1 JPEG 1K | 0 | Anexar clips de zumbi; estilo pode divergir do cemitério de fantasia. |
| `zombie-knight.glb` | 1,476 | 11.013 / 7.047 | 41 | 1 JPEG 2K | 5 | Alternativa Tripo autocontida para guarda morto-vivo; mesma ordem genérica de clips dos recomendados. |

Os quatro Mixamo preservam `mixamorig:*`; não se deve presumir que nomes iguais eliminam diferenças de bind/rest pose. O jogo de origem tem [seleção e retarget de clips por família](/Users/luccacerf/Projetos/Pessoal/Gaming/quake/public/game.js:16229). A FAQ oficial Adobe permite uso royalty-free de personagens e animações Mixamo em projetos pessoais/comerciais, inclusive jogos. Isso é licença de uso em projetos, não uma declaração de que o conteúdo é CC0 ou que o simples processamento por uma biblioteca MIT altera sua licença. [FAQ oficial Mixamo](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html).

### Biblioteca de animação disponível

`quake/public/assets/anims/mixamo/` contém **24 GLBs de animação de zumbis/mutantes**, todos sem mesh/skin/textura, e **nove GLBs no Shooter Pack**, total 33. Os arquivos carregam sua hierarquia de nodes e clips; não são personagens completos.

| Grupo | Arquivos e durações lidas do GLB |
| --- | --- |
| Idle | `Zombie Idle` 4,000 s; `zombie idle 2` 4,250 s |
| Walk | `Zombie Walk` 4,000 s; `zombie walk 2` 4,000 s; `injured walk` 1,000 s |
| Run | `Zombie Running` 0,792 s; `zombie run` 0,792 s |
| Ataques | `Zombie Attack` 2,625 s; `zombie attack 2` 2,500 s; `zombie biting` 6,583 s |
| Morte | `zombie death` 2,792 s; `zombie dying` 3,292 s |
| Reações | `zombie hit flinch` 2,000 s; `zombie hit stumble` 2,167 s; `zombie scream` 2,792 s |
| Levantar/rastejar | `zombie stand up` 6,000 s; `zombie crawl` 5,125 s; `running crawl` 0,625 s |
| Mutant | `mutant walk` 1,417 s; `mutant run` 0,833 s; `mutant swipe` 2,667 s; `mutant punch` 1,083 s; `mutant roar` 5,375 s; `mutant dying` 4,583 s |

O registro de uso atual está em [MIXAMO_FILES](/Users/luccacerf/Projetos/Pessoal/Gaming/quake/public/game.js:16031). Os clips individuais ocupam aproximadamente 24,5–157,9 KiB; combiná-los exige um contrato explícito de estados/nomes e revisão de loop, contato e root motion.

## Cobertura dos 59 GLBs de inimigos

55 modelos Tripo têm uma skin de 41 joints, cinco clips, uma imagem e um material. Os quatro Mixamo da tabela acima completam os 59. O inventário por nome, sem renomear a origem:

```text
Bosses (10):
boss-ash-titan, boss-blood-duke, boss-bone-colossus, boss-butcher-king,
boss-crypt-mother, boss-furnace-god, boss-iron-wraith, boss-lich,
boss-plague-queen, boss-void-herald

Elites (5):
elite-binder, elite-chanter, elite-howler, elite-reaver, elite-shard

Zumbis Tripo (40):
zombie-berserker, zombie-blind, zombie-bloater, zombie-brute,
zombie-butcher-v2, zombie-butcher, zombie-captain, zombie-choir,
zombie-crawler, zombie-exposed, zombie-flayer-v2, zombie-flayer,
zombie-grave, zombie-hexer-v2, zombie-hexer, zombie-hound,
zombie-inmate, zombie-jester, zombie-knight, zombie-martyr,
zombie-megaboss, zombie-monk, zombie-nurse, zombie-plague,
zombie-priest, zombie-pyre-v2, zombie-pyre, zombie-runner,
zombie-sniper, zombie-spitter, zombie-stalker, zombie-surgeon,
zombie-tank, zombie-twin, zombie-vomiter-v2, zombie-vomiter,
zombie-walker, zombie-warlock-v2, zombie-warlock, zombie-wraith

Mixamo (4):
zombie-clown, zombie-mutant, zombie-skeletal, zombie-warrok
```

Os `-v2` e os nomes curtos são arquivos distintos observados; não inferir duplicação ou melhoria visual só pelo sufixo. Os mesmos cinco tempos de animação se repetem no conjunto Tripo, portanto quantidade de arquivos não equivale a 55 conjuntos de movimento originais.

## QuakeGrok / Gravewake

`games/quakegrok/public/assets/actors/bot.png` é um billboard procedural 64×96, gerado pelo próprio [script local](/Users/luccacerf/Projetos/Pessoal/Gaming/QuakeGrok/games/quakegrok/scripts/gen-assets.mjs:78). Não serve como substituto de malha animada.

`games/gravewake/assets/actors/` tem PNGs de `bone_hound`, `bone_brute`, `bone_tyrant`, `death_knight`, `crypt_guard`, `crypt_archer`, `ash_ghoul`, `plague_scuttler`, `shade` e outros, com variantes direcionais. O [manifesto](/Users/luccacerf/Projetos/Pessoal/Gaming/QuakeGrok/games/gravewake/assets/manifest.yaml:1) os descreve como greybox/Imagine; não contém licença individual. A [lista de licenças do engine](/Users/luccacerf/Projetos/Pessoal/Gaming/QuakeGrok/anvil/assets/sprites/LICENSES.md:1) não enumera esses assets do jogo e não pode ser usada como autorização para eles. Podem servir como referência interna futura, mas não resolvem a demanda por monstros 3D nesta etapa.

## Limite da conclusão

Comprovado: arquivos existem; contagens de geometria/rig/clips/texturas foram lidas dos GLBs; os clips têm dados dinâmicos; scripts e sidecars documentam a geração/conversão; fontes oficiais de licença foram consultadas.

Pendente: rostos/silhuetas na câmera de gameplay do BIPX, deformação artística extrema, sincronização ataque/dano, orçamento de uma horda no dispositivo-alvo e prova histórica de termos/plano para os modelos Tripo. Playback, apoio e isolamento foram verificados na fixture acima, com limites explícitos. O campo `ready:true` dos sidecars é um checkpoint antigo do gerador, não aprovação visual atual. Somente arquivos autorizados de assets/biblioteca/ferramentas/inventário foram criados; main/server não foram alterados por esta entrega.
