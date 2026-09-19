# Cripta enraizada — candidato isolado para seleção

**Pronto em staging, sem promoção.** Um conjunto mudou: entrada fechada em(12.3,−18.1). CPU local5/5 e comparação nativa focal concluídas, originais examinados; fonte congelada e GPU própria liberada04:45:03UTC. [Manifesto final/hashes](../../output/environment/crypt-entrance-v1/selection-manifest.json), [CPU](../../output/environment/crypt-entrance-v1/cpu.json), [A/B inicial](../../output/environment/crypt-entrance-v1/native-summary.json), [confirmação do candidato final](../../output/environment/crypt-entrance-v1/native-final-summary.json).

Runtime permanece layout143/Surface-life947c/ef17/3a8;222fontes sem drift. Manutenção9e45/a5f4 e snapshotsPhysics não foram editados.5173/PID75665 e ledger7f580798 preservados, sem restart. Proposta não altera gameplay/spawn/planner/raios/ataques.

## Seleção Root e pacote combinado separado

[Seleção Root](review/crypt-entrance-v1-selection.json) confirma os três originais e o proxy10partes. Este candidato b3ed6566 permanece intacto. Novo [pacote combinado](environment-combined-v1.md) adiciona apenas barrel-2/fallen-beam-3 de manutençãoa5f4, mantendo153colisores; fontes/evidências isoladas não foram sobrescritas. Ainda sem promoção.

## Proposta visual e originais

A pequena parede reta foi substituída por um arco de rocha e raízes com4.61m de altura, porta House maior encaixada no vão e um flanco curto de alvenaria Harbor. Duas rochas existentes foram reposicionadas ao pé do volume. Três lajes irregulares substituem os12cubos regulares da soleira, com topo35mm e leitura atravessável. Rosas existentes mantêm caráter funerário. **Cripta fechada: não promete interior, interação ou nova área acessível.** Nenhuma árvore/cruz/santuário/luz/passe novo.

| Baseline atual | Candidato final |
|---|---|
|[Original1440×900](../../output/playwright/environment-crypt-entrance-v1/crypt-baseline-entrance.png)|[Original1440×900](../../output/playwright/environment-crypt-entrance-v1-final/crypt-candidate-entrance.png)|

[Overlay físico final](../../output/playwright/environment-crypt-entrance-v1-final/crypt-candidate-colliders.png). Mesmo enquadramento ARPG, iluminação, atores estáticos e tempo; Chrome visível153/Metal. **Fixture sintética, não partida.** A forma alta/assimétrica e a porta enquadrada são perceptíveis nessa câmera, enquanto as três ameaças continuam visíveis à frente. O arco escuro, com raízes, muda a identidade do conjunto sem espalhar microprops pela arena. A nova soleira ainda é estilizada/plana; o lintel da porta continua simples. É proposta de ganho local, não aprovaçãoAAA. A repetição externa de cruzes/pavimento e o pontilhado das copas permanecem; não houve patch para mascará-los.

O primeiro proxy de4partes cabia no bounds geral, mas ocupava cantos vazios da coroa. Foi preservado em `iteration-1-four-part-proxy/`, junto ao A/B inicial. Apenas os colisores foram refinados; confirmação04:45 capturou somente o candidato e seu overlay, reutilizando o baseline congelado. **PNG de cor inicial/final byte-idêntico** `73217bedba5000368759819e64f9de7bcdf595d4f00da89349251f6cb453ea44`; não houve segunda rodada de direção artística equivalente.

## Assets, procedência e orçamento

Duas famílias já inventariadas, sem novo inventário completo. [Proveniência e hashes antes/depois](../../output/environment/crypt-entrance-v1/candidate/assets/environment/crypt-entrance-v1/provenance.json). Fontes em `/Users/luccacerf/Projetos/Assets/Environment/Tunnel_Map/Exports/Game/Families/`; renders de catálogo e módulos House foram inspecionados antes da proposta/export. A proposta/budget anterior ao render está preservada no [manifesto preparado](../../output/environment/crypt-entrance-v1/iteration-1-four-part-proxy/prepared-manifest.json).

| Derivado somente na cópia | Fonte local | Triângulos | Textura | Bytes |
|---|---|---:|---|---:|
|crypt-root-arch|09_green_cave/09_green_cave_LOD1.glb|4800|768², uma cor|332136|
|crypt-flagstone|02_flagstone_module/02_flagstone_module_LOD1.glb|899×3instâncias|512², uma cor|87952|

Total420088bytes. Fontes originais7669/3463triângulos e2048² preservadas; derivados versionados separados. Porta House, parede Harbor, rochas/raízes Tunnel e roseiras Harbor reutilizam exports existentes. Texturas fonte não foram recoloridas; materiais usam a pátina local já disponível. Sem novo normal/emissivo.

| Medida observada | Baseline | Candidato |
|---|---:|---:|
|Props dressing|66|70|
|Lotes dressing|46|48|
|Geometrias/materiais dressing|12/15|14/17|
|Texturas dressing|30|32|
|Triângulos instanciados dressing|249683|257180|
|Memória estimada texturas RGBA+mips|93323264bytes|97867093bytes|
|Contato chão, um lote/zero textura|528triângulos|544triângulos|
|Draws cena nessa vista|132|136|
|Triângulos cena nessa vista|490867|505733|

Dentro do teto proposto70props/50lotes/18materiais/32texturas/258miltriângulos. Incremento estimado de textura4.33MiB. Contagens da fixture não são benchmarkGPU/FPS nem custo sustentado em horda. Zero page/console/HTTP/request/GL errors/warnings; snapshots e runtime estáveis durante as capturas.

## Geometria e escopo físico

Layout candidato **b3ed6566eb9176a0450a4c484888f71e62286edb9e14f862c04987ad091e1fb1**,153colisores, arena55/chão0. Relativo ao runtime143: remove1parede antiga, adiciona10partes do arco e1flanco; altera3descritores existentes (porta e2rochas). Todos os outros sólidos iguais. As raízes/cogumelos acompanhantes das duas rochas movem-se somente no mesmo conjunto; jardim/manutenção e seus overrides Surface-life permanecem iguais.

Arco6.4m/vertical1.22 em(12.3,−18.1); porta3.25m em(12.3,−16.8); flanco3.4m/yaw1.35 em(8.8,−18.5). Rochas0/1 passam a(16.1,−18.4)/(8.7,−17.0). Lajes em(12.4,−14.6),(11.4,−12.65),(13.65,−12.65), não sólidas≤35mm. Solo físico continua0.

Dez boxes estreitos por altura acompanham os apoios, fundo e coroa do arco. [Amostragem da malha exportada](../../output/environment/crypt-entrance-v1/arch-core-fit.json):121raiosZ por retânguloXY, sem amostra ausente, interseção dos extremos frente/fundo com15mm de recuo de cada faceZ. Isso evita a caixa larga no ar acima do vão. **É aproximação de contato por amostras e envolvente externa; não certifica volume watertight nem toda irregularidade/raiz/cavidade.** Collider minY/maxY explícitos, mesmas transformações/yaw do render e contrato Node/cliente.

CPU local mantém quatro poses originais da fixture livres, aproximação da soleira e passagem frontal abertas; porta fechada bloqueia corpo.64 e projétil.25 aY1. Não houve relocação de atores para obter o gate. Não valida navegação de horda/boss, perseguição por todas as origens, spawn ou seis casts; isso permanece gate de integração futura caso Root selecione a arte.

## Arquivos e disponibilidade

Somente quatro módulos Environment na cópia: `environment-layout.js`, `asset-dressing.js`, `environment-library.js`, `cemetery.js`. Adicionados dois GLBs e sua proveniência, sete arquivos declarados no manifesto. Layout dirige render/colisão; lista local carrega os dois derivados; dressing inclui o arco no mesmo cutaway; cemetery retira só os12cubos da soleira. Nenhuma edição de main/server/Physics/atmosphere/pipeline/shareddepth/skillAreas/canopyshader. Cortes e cores usam as APIs existentes.

Quatro patches individuais no staging. **Nunca promover os snapshots completos** de222arquivos: contêm cópias de outros donos apenas para fixture congelada. Este lote não inclui manutenção9e45/a5f4 e não substitui seu diagnóstico residual. Se selecionado, visuais, exports e layout devem entrar juntos numa janela futura com gates físicos atuais; não há promoção automática.

Coordenação Combat `msg_ad179009916a` e VFX `msg_e5126cfd5f66`; [recibo da janela](../../output/environment/crypt-entrance-v1/gpu-window.json) registra liberação Animation04:33:25 e diagnósticoVFX04:34. Duas reservas próprias atômicas curtas (A/B e correção exclusiva de proxy), browser/HTTP efêmeros encerrados em finally. Nenhuma próxima captura ou escrita runtime Environment prevista; aguarda seleção Root desta proposta.

### Confirmação da última direção Root e liberação

A nova autorização de janela curta chegou após o A/B04:41 e confirmação exclusiva de proxy04:45 já encerrarem. Não repetir. Conferência final: lock ausente,5173PID75665 vivo. Avisos de fechamento únicos VFX `msg_698134bdf894`, Physics `msg_56fa30d23e94`, Animation `msg_3f028dcb7d85`; aceitos pelo mailbox, sem presumir leitura. [Revisão própria dos originais](../../output/environment/crypt-entrance-v1/visual-review.json).

Aldric utilizado é o original runtime **0e5da9d8a667fa44dbccf6c5ae9141f6f3183df555c2ed6781bc87d632327a32**, sem metadataOPAQUE5c. Layout de manutençãoa5f4/9e45 não aparece na fixture; baseline8e756fe4 e variante exclusiva de cripta b3ed6566. A referência147 da proposta anterior é histórica:153 é o candidato físico final declarado, com pixels de cor idênticos e orçamento visual igual. Sem nova espera por art2, captura, pergunta ou promoção prevista nesta entrega.
