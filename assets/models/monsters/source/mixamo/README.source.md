# Animações Mixamo (zumbis + jogadores)

Clips baixados de https://www.mixamo.com como FBX e convertidos para **GLB
anim-only** (sem mesh/skin/textura, keyframes resampleados) — 33MB de FBX
viram ~1.7MB, o jogo carrega tudo com o GLTFLoader (o FBXLoader saiu do
bundle) e cada GLB carrega a própria hierarquia de nós, então o retarget usa
a rest pose correta por arquivo. Só os `.glb` entram no git/deploy; os `.fbx`
fonte ficam locais (ignorados pelo .gitignore).

Conversão: `node scripts/convert_mixamo_glb.mjs (deps: tmp-preview/playwright/node_modules)`
(fbx2gltf + gltf-transform; registre arquivos novos na lista do script).

O jogo detecta os arquivos no boot, faz o retarget Mixamo → rig alvo em
runtime e troca os clips — sem build. A lista de arquivos usados fica em
`MIXAMO_FILES` no `game.js` (slots com mais de um arquivo viram variantes
sorteadas por zumbi no spawn).

## Shooter Pack (jogadores)

A subpasta `Shooter Pack/` alimenta os slots `p*` (locomoção dos personagens
no pvp/coop): idle de rifle, walk, run, run backwards, 2 strafes (strafe =
direita, strafe (2) = esquerda), firing rifle (só tronco — as pernas
continuam no blend de locomoção), jump forward (pose de ar) e walking to
dying. Os remotos usam blend tree 6-direções com pés sincronizados à
velocidade real.

## Monstros Mixamo (modelos com skin)

Os FBX grandes desta pasta (`character*.fbx`, `Mutant Punch (n).fbx`) são
PERSONAGENS baixados com skin — Warrok, Mutant, Skeleton Zombie e White Clown.
Eles viram kinds de zumbi: convertidos/otimizados para
`public/assets/models/zombies/zombie-{warrok,mutant,skeletal,clown}.glb`
(fbx2gltf + gltf-transform: sem anims, sem normal maps, diffuse 1024). O rig
deles é mixamorig nativo, então o retarget de zumbi aplica os clips desta pasta
direto (warrok/mutantx usam o set Mutant pesado; skeletal/clown o set zumbi).

Slots atuais (todos `.glb`):

| Slot        | Arquivos |
|-------------|----------|
| idle        | `Zombie Idle`, `zombie idle 2` |
| walk        | `Zombie Walk`, `zombie walk 2`, `injured walk` |
| run         | `Zombie Running`, `zombie run` |
| attack      | `Zombie Attack`, `zombie attack 2`, `zombie biting` |
| death       | `zombie death`, `zombie dying` |
| flinch      | `zombie hit flinch`, `zombie hit stumble`, `zombie scream` |
| rise (spawn)| `zombie stand up` (55% dos spawns bípedes levantam do chão) |
| crawl       | `zombie crawl`, `running crawl` (só o kind crawler) |
| heavy*      | `mutant walk/run/swipe/punch/roar/dying` — kinds pesados (tank, boss, bloater, brute, butcher, knight, warrok, mutantx); o roar é o telegraph de ataque |

Para adicionar animação nova: baixe o FBX (FBX Binary, 30fps, com ou sem
skin), jogue nesta pasta, rode o `convert-mixamo-glb.mjs` e registre o `.glb`
no slot desejado em `MIXAMO_FILES` no `game.js`.
