# Movimento do Walker — candidato Mixamo

**Atualização posterior:** o controller já recebeu recorte e API de fase descritos em [monster-phase.md](monster-phase.md). O GLB completo e as provas de locomação abaixo permanecem; o timing4,77× documentado abaixo é histórico da captura anterior. Main/servidor estão sob integração separada do root.

O Walker (`zombie` e `runner` no pool) recebeu `Zombie Walk`, `Zombie Running` e `Zombie Attack` retargeteados para seu rig Tripo. O GLB mantém os clips Idle/Death, malha, textura, pesos, inverse binds, nomes/hierarquia e frente -Z anteriores. Brute, Lich, velocidades de gameplay e limites do pool não foram alterados por esta entrega.

Runtime: `assets/models/monsters/zombie.glb`, 1.512.864 bytes, SHA-256 `91c975ebfef06f38239a7e5f3258c8ac545340dc217b625f6488fe01cc745b2c`. A versão anterior 1K foi preservada em `source/zombie-pre-mixamo.glb` (`af6a973701eacee171d58521108a4b1e324194442946585b4b41c03c96ba1dbf`); a origem 2K e os sidecars continuam intactos.

## Origem e método

Fontes copiadas sem alteração de `quake/public/assets/anims/mixamo/`, preservadas em `assets/models/monsters/source/mixamo/`, junto ao README do projeto de origem:

| Clip | Duração | SHA-256 |
| --- | ---: | --- |
| Zombie Walk | 4 s | `7078293a2985686f7af287730874d8d0534c717fcf69a229c2172cdba99e4e29` |
| Zombie Running | 0,7916667 s | `705901030da4e8c091f0552d2d85139c282c710880985d6f2884c7adb3c5730c` |
| Zombie Attack | 2,625 s | `be7b3a6319e7b736595dddb7ce552211cfaf9ae48a222f468d88db3903d4c1f5` |

São animações Adobe Mixamo utilizadas sob autorização do usuário para reutilizar seu acervo local; não são CC0/MIT. O retarget não altera nem comprova a licença comercial histórica da malha Tripo. A procedência e os limites permanecem no [inventário](monster-source-inventory.md) e no manifesto `provenance.json`.

O script [monster-retarget.mjs](../tools/monster-retarget.mjs) transfere deltas de rotação em espaço mundial em relação ao repouso, alinha as frentes em +π/2 e reconstrói a rotação local usando o parent **já animado**. Mapeia 22 ossos, conserva offsets/scales e os twist bones não mapeados. O movimento vertical do quadril passa pela base inversa do parent; translação XZ mundial fica sob controle do jogo. A animação vertical não pode ser removida zerando XZ local de `Hip`: neste rig a altura usa também Z local.

Cada clip recebe uma pista `Armature.position` com apoio amostrado em todos os vértices. Walk fecha o loop nos últimos 280 ms; Run nos últimos 80 ms. O runtime avalia 175 vértices de contato do Walker, inclusive nos blends, sem varrer a malha inteira por ator/frame. São contatos de piso plano; não há IK de pés nem aderência a inclinações.

Reproduzir: `node tools/monster-retarget.mjs` gera artefato e relatório sem substituir o runtime; `--install` instala também o GLB, contatos e manifesto. `node tools/monster-motion-cpu.mjs` verifica o controller real. O script antigo de texturas agora recusa sobrescrever um Walker que já tenha motion metadata.

## Ritmo e contato medidos

`Zombie Running` foi escolhido entre três clips rápidos disponíveis: possui deslocamento fonte de 2,4522 m em 0,7917 s. `zombie run` é uma variante de duração/stride quase iguais; `mutant run` é in-place e não oferece esse deslocamento de referência. A marcha lenta não é acelerada até 7–15×.

O controller usa stride e escala real do ator para definir o ritmo. Walk máximo 1,8×; Run máximo 2×. O campo `stats.gaitSpeedMismatch` registra eventual diferença entre velocidade pedida e stride reproduzido; **não é medida de foot sliding**. Em velocidades altas além do teto, haverá mismatch explícito.

| Cenário CPU do controller | Clip / ritmo | Maior erro de piso | Deslizamento horizontal mediano do dedo baixo |
| --- | --- | ---: | ---: |
| Walker 2,55 m, 0,5 m/s | Walk / 1,083× | <0,001 mm | 0,297 m/s |
| Zombie 2,55 m, 3,3 m/s | Run / 0,787× | 0,306 mm | 0,563 m/s |
| Runner 2,3 m, 6,1 m/s | Run / 1,614× | 0,061 mm | 0,931 m/s |

O proxy de deslizamento usa `L/R_ToeBase` abaixo de 7,5 cm, em pares de amostras com velocidade vertical <0,35 m/s, e desloca o root à velocidade indicada. Não identifica contato mecânico verdadeiro. Percentis90 foram 3,302 / 2,029 / 3,854 m/s, respectivamente, incluindo transições de apoio e fechamento do loop. **Não há aprovação de foot lock:** sobra deslizamento visível possível, especialmente em mudanças de passada; IK/ajuste de passada permanece melhoria separada.

CPU: 22 ossos mapeados, erro máximo rest→rest 2,30e-6 rad, dados finitos, offsets preservados, binário original de geometria/skin/textura preservado como prefixo, reimportação/interpolação a120Hz. O controller real testou 1.247 amostras de locomação e 1.080 de Idle→Walk→Attack→Run, Run→Attack→Run e Run→Death→Reset. Máximo erro do piso em blends/morte/reset: 4,653 mm. Attack manteve 2,625 s no arquivo e no clip normalizado; descarte zerou atores. Relatórios: [retarget](../output/monster-motion/artifacts/cpu-report.json) e [controller](../output/monster-motion/artifacts/controller-cpu.json). CPU não substitui revisão artística/nativa.

## Tempo de combate

No main observado, melee chama `attack({duration:.55})` e aplica dano imediatamente. Portanto o clip de 2,625 s toca a **4,77×** nesse contexto. O pico de alcance da mão direita perto de1,0s fonte chega cerca de0,21s após o dano. Essa diferença não é resolvida apenas por conservar a duração original do arquivo. Alterar o instante do dano ou recortar o gesto exige decisão explícita de integração; esta tarefa não alterou main nem regras de combate.

## Revisão nativa e jogo

O comparativo de Run foi renderizado em Chrome nativo com ANGLE/Metal: seis fases (0/20/40/60/80/98%) inspecionadas e playback contínuo gravado. [Relatório/PNGs](../output/playwright/monster-motion-comparison/verification.json): nenhum erro de página, HTTP ou WebGL, poses finitas e apoio corrigido. O retarget mantém tronco curvado e braços à frente; o Run anterior exibia mais inclinação lateral, braços altos e gestos que pareciam saltos. É **fixture de assets**, sem nota artística nem aprovação de contato só por CPU. Reproduzir: `node tools/monster-motion-compare.mjs` com servidor5173 disponível.

O [focal no jogo](../output/playwright/monster-motion-game/verification.json) também passou: alvos zombie/runner inseridos explicitamente, depois movidos pela simulação real até ataque e dano reais. Oito capturas e vídeo; nenhuma alteração dos quatro arquivos monitorados durante o teste, nenhum erro de console/página/HTTP. Não é teste de spawn natural, multiplayer, mobile físico ou benchmark. As imagens foram inspecionadas.

- [Abordagem zombie](../output/playwright/monster-motion-game/zombie-approach.png): Run0,949× observado; [runner](../output/playwright/monster-motion-game/runner-approach.png): Run1,739×. Variação da velocidade real do jogo é absorvida dentro do teto2×.
- Ataques observados a4,773×, com vida já reduzida na primeira amostra. Nos primeiros PNGs, `animationTime` já estava perto de1,035s fonte por latência de screenshot; nomes `attack-start/swipe/recover` são pedidos de captura, **não prova de fases exatas**. O relatório contém tempo real de cada captura e série viaRAF.
- O inimigo se sobrepõe ao herói e fica parcialmente oculto na câmera atual durante o melee. Isso limita a leitura do contato; as fotos não bastam para aprovar artisticamente o timing0,55s. A postura de aproximação é legível, mas gesto+impacto ainda precisam da próxima correção coordenada de gameplay.

Hashes do focal: main `83adc3dd0cae235fa96a816be20c331600f29dbc3012a4449afe75312179325b`; controller `16d4ebcf86cf3f46dd4f293954742fcb46571c03e524902331ec83b87a074216`; pool `82c3c1cdcc8b831b03261556eb684f94b7530386f22ab78e026ac0bbeeffda0a`; GLB conforme topo. Os relatórios anteriores de três monstros continuam evidência histórica de outro hash.

### Próxima janela de ataque proposta, ainda não implementada

Pico frontal medido da mão direita: **t=1,030063s fonte**, fase39,24% do take inteiro, aproximadamente frame31 a30Hz. A mão cruza a região frontal entre0,997 e1,063s; a posição máxima é1,293m à frente do root no fixture de2,1m de altura. Isso é trajetória de osso, não colisão comprovada com um alvo.

Proposta para teste coordenado: recortar **0,333–1,667s fonte**, tocar em **0,85–0,9s**, marcar o impacto na fase **52,25%** do recorte (0,444–0,470s após iniciar). Resulta em1,48–1,57×, conserva preparação/gesto/recuperação e remove a cauda quase neutra. Exige alinhar dano, alcance revalidado, cancelamento e cooldown no solo e servidor; só alongar a animação manteria a falha de sincronização. Preservar o take completo no GLB para edição e rastreabilidade.
