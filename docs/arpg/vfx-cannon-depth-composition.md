# Canhão/campo — protótipo de composição em cópia, congelado para revisão

## Integrado06:35; conferência independenteVFX06:36

Combat aplicou somente main`ebb8c9b2` e os9VFX autorizados. [ReciboCombat](../../output/warcry-moving-integration-v1/promotion.json) e [verificação independenteVFX](../../output/vfx-warcry-art-v1/art2-follow/integrated-verification.json):228 hashes em disco iguais ao recibo e10HTTP200 com SHA exato do manifesto final. GUIboss/server16ac/env153/GLBs/pipeline/contacts preservados nos228 arquivos. Ledger/PID semrestart atestados pelo reciboCombat; VFX não reiniciou5173 nem promoveu por conta própria.

**Fontes live e pacote congelados para checkpointJEF novo pelo Combat.** Nenhum cast/custo repetido. Limites de native/arte/rede/pausa-preparo e histórico de v2/v3 continuam explícitos abaixo. Critério globalAAA/no-slide não aprovado por esta entrega.


## Atual06:35 — v3 selecionada; pacote combinado congelado

[Root selecionou o peer corrigido](review/gravity-overlap-v2-selection.md). O manifesto final com grito está em [art2-follow/integration-manifest.json](../../output/vfx-warcry-art-v1/art2-follow/integration-manifest.json); pool9000f44f, visual058f7c8c, Horizonc1896cd2 preservados. Native do grito3/3 concluído em cópia, sem repetir composição1/8/custo/peer. Root autorizou Combat aplicar apenas9VFX + mainmínimo; VFX congela fontes e aguarda recibo para conferirHTTP. Limites anteriores de cobertura aproximada, ROI/custo v2 e ablação v3 continuam válidos. Nada promovido por VFX neste registro.


## Atual06:16 — seleçãoRoot incorporada; peer oculto corrigido, pacote congelado

[Seleção incremental](review/gravity-overlap-v2-selection.md) incorporada. Executados somente os dois recortes pendentes após GUI06:05:29. [Witness06:12](../../output/playwright/2026-09-19T06-12-42-239Z-cannon-depth-composition-vfx/report.json): peer Horizon sozinho atrás do sólido contribui0canaisRGBA, mas adicioná-lo altera28.485canais/287.953unidadesRGB(A) do campo visível. Falha local preservada com v2 intacta.

Nova cópia[composition-v3-occlusion](../../assets/vfx/source-history/cannon-concentric-staging-20260919/composition-v3-occlusion/freeze-manifest.json) envia profundidade projetada constante de cada billboard. No pixel, peers atrás do depth opaco compartilhado não contam na normalização. Tolerância1e-7 em depth normalizado; nenhuma nova amostra de textura/passe/RT, cores/raios/fogo/gás/partículas inalterados. Sem depth válido, normalização é omitida conservadoramente. V2 e seus PNGs/patches preservados.

[Dois originais corrigidos06:14 e review](../../output/playwright/2026-09-19T06-14-22-908Z-cannon-depth-composition-vfx/visual-review.json): peer oculto+campo visível versus visível somente tem **zero diferençaRGBA**; controle peer sozinho tambémzero. Par parcial mostra dois núcleos/halos legíveis; delta728canais vs v2 ocorre onde depth agora rejeita o peer, sem nova borda evidente nos stills. Sólido planar grande é probe causal sintético; não gameplay nem novo gatecorporal. Fontes estáveis/zeroGL/1prepass,28runtime intactos. Sem repetir1/8/custo; métricas anteriores continuam dos hashesv2, não benchmarkv3.

Pacote final permanece8arquivos vs live, somente3mudam do pai v2, todos no manifesto; API externa igual. **Congelado para integração coordenada**, não promovido por VFX. Direção incrementalRoot preservada, semAAA/global. Browser/HTTP/token próprios liberados, recibo consumido. Próximo trabalhoCPU é fixar acompanhamento root/emissor do grito selecionado, sem substituir este wrapper pelo históricoart2.


## Atual06:05 — overlap-v2 focal passou, cópia retida para review

[Três PNGs originais06:03/reporte](../../output/playwright/2026-09-19T06-03-50-695Z-cannon-depth-composition-vfx/report.json) e [revisão visual/custo derivado](../../output/playwright/2026-09-19T06-03-50-695Z-cannon-depth-composition-vfx/visual-review.json) concluídos. **Caso1: zero bytes diferentes no readbackRGBA** tanto gravidade quanto conjunto, v1→v2. Todos mesmos assets/câmera/poses/idade.1505; GLBDwarf exatodc0867 nos dois lados, filmic/bloomglobal inalterados.

| Cena | v1 gravidade ROIs0/1/2 | v2 gravidade | v1 fogo+campo | v2 fogo+campo |
| --- | --- | --- | --- | --- |
|1high|121/120/121|121/120/121|121/121/121|121/121/121|
|8high|121/63/75|121/119/121|121/68/75|121/121/121|
|8low/reduced|121/121/105|121/121/121|121/121/105|121/121/121|

Denominador121/limiarRGB65/gate65% originais, sem troca de alvo/máscara. Regressão focal dos monstros resolvida nesta cena. Imagens mostram menos lavagem branca no torso, preservando núcleo preto/gás roxo/fogo/partículas. Campo8 continua brilhante e bordas externas acumuladas espessas; não é aceite artístico global/AAA nem gameplay. Sobreposição parcial e transições permanecem limite da aproximação por aberturas projetadas.

CPU14 e lifecycle nativo8→pausa8→fora0→1→reset0→1→expiry0 passaram; fonte candidata estável,28módulos live iguais, zeroGL/erros, um prepass. Pool/contagens/raios5m e3.4m/durações/eventos intactos. Browser/HTTP/token próprios encerrados; GPU livre, GUI/Combat avisados. Nenhuma outra captura VFX planejada nesta entrega.

CustoGPU high1440×900,8warmups+24paresválidos/variante, zero disjoint: mediana pipeline1campo3.88852→3.82317ms,8campos5.61196→5.91096ms. Medianas das diferenças pareadas **+.04502ms/+.09579ms**, respectivamente. Intervalos1campo2.558–8.787/2.499–7.593;8campo4.974–6.760/5.097–22.359ms. Dispersão/outlier não sustentam FPS/custoigual/mobile. Comparação desta rodada é **composition-v1→overlap-v2**, não runtime→composição completa; não somar medianas de rodadas diferentes.

[Manifesto final proposto](../../assets/vfx/source-history/cannon-concentric-staging-20260919/composition-v2-overlap/integration-manifest.json):8arquivos em relação ao runtime, três diferentes de composition-v1. Deltas atuais: pool4c19662a, visualbf29f10d, shader9ea6675f. API externa inalterada; sem callback/RT/compositor/main/pipeline novos. **Sem promoção automática**; Root/Combat recebem evidência e hashes para decisão/janela. composition-v1/rodadas falhas originais preservadas.


## Cópia overlap-v2 preparada06:00 — CPU14PASS, native pendente GUI

[Design/limites](../../assets/vfx/source-history/cannon-concentric-staging-20260919/composition-v2-overlap/design.json), [freeze e patch de três arquivos](../../assets/vfx/source-history/cannon-concentric-staging-20260919/composition-v2-overlap/freeze-manifest.json). composition-v1 e sete hashes anteriores intactos. Somente gravity-horizon-source.js, gravity-field-pool.js e gravity-field-visual.js diferem do pai; não é lote autorizado para promoção.

Campos preparados/projetados fornecem até8aberturas de Horizon. Por pixel, só outros discos coincidentes e seu fade real contam para repartir cobertura `aNovo=1-(1-a)^(1/n)` e RGB premultiplicado pela mesma razão. Com1campo, retorno exato antes de operar; núcleoalpha1 mantido, cor/raio/timing/gás/partículas/fogo/globalbloom intactos. Sem RT/draw/prepass novo;8comparações por pixel coberto ainda têm custo a medir. Sobreposição de abertura aproxima sobreposição emissiva: não é integração volumétrica exata, precisa inspeção em interseções parciais.

CPU14verificações passaram: capacidade, índices/projeções finitos, identidade matemática de8camadas iguais, pausa, reduced, culling/retorno1, expiry/reset/dispose/textura emprestada. Isso não prova shader compilado ou arte. Próximo native focal compara pai composition-v1 com v2, mesmos frames/câmera/atores,1high/8high/8low-reduced, exige igualdade pixel-a-pixel no caso1 e gate65original; custo pareado8warmups24amostras1/8 e lifecycle. GUI recebeu GPU primeiro; reciboVFX desativado enquanto aguarda seu término. Nada live.


## Atual05:58 — diagnóstico8 corrigido; Horizon+bloom localizado, sem ajuste live

[Dois originais05:55](../../output/playwright/2026-09-19T05-55-23-161Z-cannon-depth-composition-vfx/report.json) e [revisão](../../output/playwright/2026-09-19T05-55-23-161Z-cannon-depth-composition-vfx/visual-review.json). Rodada05:48 preservada com limitação: paiClassSkillStates ocultava o pool ao isolar gás/Horizon; painéis vazios invalidavam essa atribuição. Harness corrigido oculta só irmãos e exige8draws gás/8Horizon/16partículas. Conjunto anterior pré/pósbloom continua válido.

Pixels preservados nos ROIs0Lyra/1monstro/2monstro, mesmos121/limiar65:

| Camada8 | Sem termo bloom (diagnóstico) | Bloom real.24 |
| --- | --- | --- |
| Gás |121/121/121|121/121/121|
| Horizon |121/121/82|121/55/67|
| Partículas+limite |121/121/121|121/121/121|
| Todas |121/121/82|121/63/75|

Horizon sozinho reproduz a falha; gás não é causa independente neste caso e sua composição até altera o resultado. Monstros carregados transparent:false/depthWrite:true/opacity1, cada um1draw no depth real, medianasY1.81654/1.80818m; Lyra2draws. Portanto não atribuir ao GLBDwarf ou falta de depth. Filmic/high/finish1 idênticos; ablação zera somente termo de bloom na fixture, não é solução final nem leituraHDRlinear bruta.

Próximo ajuste autorizado será **nova cópia**, preservando composition-v1: limitar emissão Horizon onde campos se sobrepõem, conservar caso1 byte-equivalente na imagem, núcleo/prepass/raio5m/duração5s, partículas/gás e bloomglobal. Nenhuma mudança de shader implementada nesta revisão. Art2 já capturado05:49; próximaGPUGUI boss liberada enquanto VFX prepara CPU. Ambas capturas próprias encerradas; sem promoção.


## Focal exato05:37 concluído — gate8campos falhou, sem promoção

[Report bruto](../../output/playwright/2026-09-19T05-37-28-168Z-cannon-depth-composition-vfx/report.json) · [revisão/estatísticas derivadas](../../output/playwright/2026-09-19T05-37-28-168Z-cannon-depth-composition-vfx/review.json). Executado após reconciliação dos avisos atuais Root05:36/Combat05:31; nenhum aguardo de mensagens04:xx. Dois PNGs2880×1800 inspecionados em resolução original, apenas1/8campos high na mesma fixture/câmera/idade. Não é gameplay do lote153 atual. Sete hashes candidatos e28VFX live estáveis, zero erros/GL; nenhum shader, GLB ou runtime alterado.

**Loader exato PASS:** uma requisição HTTP do GLBdc0867da, sem clone/mutação manual. DwarfBody material1 carregou transparent:false/depthWrite:true, rifle preservado; readback do shared depth no torso tem medianaY1.9256968m, equivalente à participação corporal observada no diagnóstico manual anterior. Um prepass,51draws opacos em ambas variantes. A medição de custo não inclui o RT temporário usado apenas para copiar/inspecionar a textura de depth.

**Lifecycle nativo PASS:** descritores8 visíveis→8pausa(dt0/time igual)→0fora da câmera→1retorno→0reset→1antes da expiração→0expiry. Nos estados vazios, zero prepasses; sem descritor antigo. Dispose executado pelo runner e recursos próprios encerrados; descarte da textura emprestada também coberto pelo CPU12 anterior, sem inferir novo teste de leak global.

| Campos | Variante | Lyra | Inimigo1 | Inimigo2 |
| --- | --- | --- | --- | --- |
| 1 | Composição candidata |121/121|121/121|121/121|
| 8 | Gravidade isolada, original/candidata iguais |121/121|63/121=52.066%|75/121=61.983%|
| 8 | Conjunto original |121/121|63/121=52.066%|75/121=61.983%|
| 8 | Conjunto candidato |121/121|68/121=56.198%|75/121=61.983%|

Gate65 preservado sem mudar máscara/alvos. **FocalSilhouetteGate:false é falha real**, apesar technicalPassed:true. Oito campos acumulam branco/violeta e engrossam bordas coincidentes; a chama fica pequena no centro. Um campo mantém a direção selecionada e corpos legíveis. A falha já aparece na gravidade isolada com oito campos; esta captura não separa quanto vem de gás, Horizon, partículas ou bloom. Não atribuir automaticamente tudo ao gás, não diminuir bloom global nem retirar campo para aprovar. Candidato retido em staging.

GPU timer EXT_disjoint_timer_query_webgl2:8warmups +24amostras válidas por variante/caso, ordem alternada, zero disjoint, pipeline completo1440×900/high, mesma cena. Valores em ms:

| Campos | Mediana original→candidato | Mediana da diferença pareada | Intervalo original / candidato |
| --- | --- | --- | --- |
| 1 |3.917500→3.636563|+0.109688|1.668083–9.568874 /1.804208–8.625166|
| 8 |6.023000→6.826541|+0.520458|4.796375–24.310041 /5.036833–7.982749|

Variação alta, especialmente outlier24.31ms no original8. Mediana das diferenças não é diferença das medianas;14/24pares com1campo e17/24com8 tiveram custo maior no candidato. Não concluir ganho pelo primeiro par de medianas nem equivalência de custo por zero draw adicional. Isto mede o recorte, sem aprovação de FPS/mobile/orçamento global.

**GPU/browser/HTTP/token VFX encerrados. Animationv11 liberada explicitamente** por queue01a0b82c-0fac-7110-b682-c5d2101864a2; Environment recebeu ordem depois dela em01a0b82c-0fac-7402-8467-604aa29312e2. Nenhuma GPU própria nova; recibo desativado. Art2 segue autorizado/preparado para etapa coordenada posterior. Histórico abaixo preserva o estado antes deste focal.

**Rodada encerrada05:00UTC. Nenhuma promoção solicitada.** Implementação bounded autorizada pelo Root após diagnóstico Aldric. Candidato em `assets/vfx/source-history/cannon-concentric-staging-20260919/composition-v1/`; [freeze/hashes](../../assets/vfx/source-history/cannon-concentric-staging-20260919/composition-v1/freeze-manifest.json), [revisão de todos os PNGs originais](../../assets/vfx/source-history/cannon-concentric-staging-20260919/composition-v1/review.json). Runtime VFX28arquivos, main, pipeline, shared depth, GLBs e5173 preservados por esta frente. Aldric5c foi promovido separadamente por Animation; snapshots VFX continuam vinculados ao original histórico.

[Root selecionou a direção para validação focal](review/cannon-depth-composition-selection.md) após os7PNGs originais04:57/04:58: fogo frontal pode cobrir o núcleo, traseiro fica oculto e low perde a lâmina. Esta seleção limitada substitui nossa retenção artística inicial; não é promoção/AAA/playback. O gate121/121 continua condicionado a OPAQUE em ambos os lados.

**Próxima prova preparada, ainda sem GPU:** GLB exato dc0867da por overrideHTTP, clone manual retirado; [preflight de equivalência](../../assets/vfx/source-history/cannon-concentric-staging-20260919/composition-v1/exact-dwarf-preflight.json). Fonte originale11e intacta, único alphaMode material1 diferente, demaisJSON/BIN exatos. API/loader native desse GLB ainda pendente. Não repetir4pares. Recorte focal fará1/8campos sobrepostos na mesma cena high,8warmups+24amostras GPU pareadas por variante; lifecycle/culling/reset/expiry. GUI Simulator tem a próxima janela, Physics/Lich coordenados; recibo GPU anterior desativado, nenhum lock novo.

Sete [patches mínimos](../../assets/vfx/source-history/cannon-concentric-staging-20260919/composition-v1/composition-v1.patch) aplicados apenas em cópia temporária produzem hashes selecionados exatos; [recibo](../../assets/vfx/source-history/cannon-concentric-staging-20260919/composition-v1/patch-preparation.json). Não aplicar runtime antes de concluir gates e receber janela dos donos. Art2 grito pode avançarCPU enquanto aguardamos.

## Causa independente da proteção de Lyra

A atribuição corpo/rifle no inventário textual anterior estava invertida. [Auditoria do GLB por node→mesh→material](../../assets/vfx/source-history/cannon-concentric-staging-20260919/composition-v1/dwarf-material-binding-audit.json): `DwarfBody`→mesh1/skin0/material1 `tripo_mat_2a1e3867` BLEND; `DwarfRifle`→mesh0/sem skin/material0 OPAQUE. Não é inferência pelo índice isolado: o loader real confirma body transparent:true/depthWrite:false e rifle false/true. Nenhuma mudança no GLB foi feita aqui.

[Ablação nativa04:51](../../output/playwright/2026-09-19T04-51-24-622Z-cannon-depth-composition-vfx/report.json): gás isolado preserva46/121pixels de Lyra, Horizon isolado121/121. Readback da textura compartilhada contém chão no centro do ROI, Y.0732; mediana.0732. O corpo ausente impede a máscara de protegê-lo.

[Controle independente04:54, high/low](../../output/playwright/2026-09-19T04-54-32-239Z-cannon-depth-composition-vfx/report.json) usa clone apenas do material corporal carregado, alternando transparent:false/depthWrite:true no mesmo mesh/pose/câmera. Com o corpo no depth, medianaY1.9257. Máscara e material foram alternados separadamente:

| Gás isolado, mesma referência original | Material BLEND | Corpo OPAQUE | Corpo OPAQUE + máscara reforçada |
| --- | --- | --- | --- |
| High |46/121=38.017%|110/121=90.909%|110/121=90.909%|
| Low/reduced |37/121=30.579%|107/121=88.430%|107/121=88.430%|

O reforço de máscara não acrescentou pixels preservados; foi retirado do candidato. **Shaders e máscaras originais do gás/Horizon estão byte-idênticos ao runtime.** A correção independente necessária nesta cena é a participação corporal no prepass, a ser aplicada pelo dono do asset com seus gates. Animation informado; Combat recebe este documento/handoff. Não extrapolar este resultado a todo ator/pose/material transparente.

## Contrato experimental para Combat

Nenhum callback, render target ou passe adicional. O wrapper mantém `prepareSceneDepth(camera)` / `setSceneDepth(frame|null)` e união de excludeRoots no único prepass RGBA-packed. API nova é interna à cópia:

```js
fields.getCompositionDescriptors(); // máximo8, elegíveis na câmera, próximos primeiro
// [{center:[x,y,z],radius,hole,time,fade,groundY,drain,opacity}]
cannon.setGravityComposition(descriptors);
```

O pool de gravidade fornece centro/raio reais do envelope, núcleo, tempo/fade/drain de seus uniforms. Campos expirados/fora da câmera desaparecem no próximo prepare; reset limpa descritores, sem liberar a textura emprestada. `class-skill-fields` apenas encaminha. Um campo não cria novo volume/mesh no canhão. Sem alteração de eventos, dano, cast, travel, contato, duração, raio5m/5s do campo ou3.4m autoritativos do canhão. Raio interno da massa de fogo continua cerca de1.3m no pico; não é campo de dano persistente.

O raymarch do fogo termina na primeira interseção com o núcleo ou cena opaca. A profundidade representativa da chama é ponderada pela extinção; o shader calcula o prefixo de gás entre a câmera e essa profundidade usando as funções de densidade/cores GH preservadas. Inserção premultiplicada `Cnovo=Tgas*Cfire+Cgas*alphaFire`, com alphaFire mantido. O fogo é submetido depois dos campos, porém a contribuição de gás à sua frente é reconstruída; atrás do núcleo permanece recortado. Não altera a cor/material do núcleo.

**Limite:** profundidade representativa aproxima a mistura; não é integração conjunta exata de vários volumes sobrepostos. Os controles frente/trás não garantem toda configuração de8campos/projéteis. Muzzle/travel em sobreposição, oito campos simultâneos, near plane e transições ainda não têm aceite nativo deste candidato. Esses gates dependem de seleção artística, não justificam suíte global agora.

## Evidência e decisão visual

[Quatro A/B finais04:57](../../output/playwright/2026-09-19T04-57-09-848Z-cannon-depth-composition-vfx/report.json): idades.1505/.30/.50high e.1505low/reduced, mesmos contatos, câmera, assets e poses do diagnóstico04:04. Fonte estável, zero erros/GL e um prepass. **Ambos os lados e a referência sem efeito usam o mesmo override corporal OPAQUE explicitado**; todos os três ROIs do candidato preservam121/121 nesses quatro frames. Isso não reclassifica o baselineBLEND reprovado, nem substitui65.289% da cena histórica diferente. O rótulo “proteção gás” nos PNGs04:57 é herdado; o shader nessa rodada já era o original, conforme hash.

A mudança libera a porção frontal de fogo, mas o contato concêntrico continua com parte laranja projetada sobre o núcleo. Esse resultado não equivale à antiga troca fixa de ordem, mas também não concede seleção artística. [Dois controles sintéticos04:58](../../output/playwright/2026-09-19T04-58-57-038Z-cannon-depth-composition-vfx/report.json) deslocam somente o contato visual±3m no eixo câmera: atrás fica ocluído; à frente cobre a região preta. São probes de profundidade, não contatos/dano novos no jogo. Câmera, poses e campo permanecem iguais. Não apagar o campo nem forçar núcleo acima de toda chama para ocultar esse compromisso de composição.

### Forma vermelha low: artefato identificado e corrigido em cópia

[Ablação04:49](../../output/playwright/2026-09-19T04-49-26-637Z-cannon-depth-composition-vfx/low-contribution-ablation.png) localiza a lâmina vermelha no volume: persiste sem brasas e com32passos. O modo low usa3oitavas, enquanto `flameFbm` só acumulava ridge com `i>=3`; portanto ridge ficava0 e adicionava densidade à franja, em vez de separá-la. A adaptação usa `i>=max(1,uOctaves-2)`: duas oitavas mais finas disponíveis, mantendo high5oitavas igual.

[Comparação isolada final04:58](../../output/playwright/2026-09-19T04-58-57-038Z-cannon-depth-composition-vfx/low-contribution-ablation.png) mostra original/candidato com16e32passos: a grande lâmina vermelha desaparece, a massa quente permanece. Não foi classificada como contribuição artística intencional. O ajuste não aumenta passos, contagens, bloom ou emissão. Não aprova todos os tempos/seeds de low.

**Limitação de harness preservada:** a ablação04:57 escondia o campo, mas ainda fornecia seus descritores ao shader candidato. Ela é inválida para atribuir ganho aos filamentos; [registro](../../output/playwright/2026-09-19T04-57-09-848Z-cannon-depth-composition-vfx/ablation-limitation.json).04:58 remove esses descritores somente no isolamento. Os quatro A/B de contato04:57 não são afetados. Os reports/PNGs anteriores não foram sobrescritos. Rótulos frente/trás herdados também foram corrigidos na rodada04:58, sem repetir a matriz de idades.

## Custo e entrega

[CPU9checks](../../assets/vfx/source-history/cannon-concentric-staging-20260919/composition-v1/cpu.json): vazio/1/cap8/culling/low-reduced/expiry/depth-null/reset/dispose. Sintaxe dos7arquivos alterados e runner passou. Não é benchmarkCPU, shader/art approval ou prova de8campos renderizados.

Custo focal GPU medido por `EXT_disjoint_timer_query_webgl2`, pipeline cinematic completo1440×900,1campo+1explosão,4warmups+12amostras válidas alternadas: mediana **4.955ms original→5.598ms candidato**. Intervalos3.133–8.650 e3.371–7.823ms; variação alta, não inferir FPS, teto universal ou custo móvel. Não há RT/draw/prepass novo; um prepass51draws opacos nos dois lados. Até16/24amostras adicionais por campo intersectado/pixel do fogo, limite8; custo de8campos ainda não medido. Nenhum benchmark pesado concorrente foi iniciado por VFX.

Sete arquivos candidatos, hashes completos no manifesto: `cannon-source-glsl.js`7662f0d6; `cannon-vfx.js`9b15e412; `class-skill-fields.js`7c9bc9eb; `class-skill-vfx.js`5f218c69; novo `gravity-composition-glsl.js`abcb7d83; `gravity-field-pool.js`2b1ff7ac; `gravity-field-visual.js`711e133c. **Não copiar a pasta inteira.** É freeze de protótipo para revisão, sem janela/pedido de promoção. Licenças e fontes GH pinadas preservadas. Cena histórica/primeira versão reprovada mantidas em baseline e iterations/first-0449.

GPU/browser/HTTP próprios encerrados em finally. Physics foi avisado da liberação para pursuit→Lich; nenhuma próxima captura VFX planejada. Combat recebe API/custo/dependênciaDwarf pelo handoff, sem fila/interrupt/retries. Não reiniciar5173.

## Plano focal congelado05:15

[Parâmetros, hashes das ferramentas e dependência de janela](../../assets/vfx/source-history/cannon-concentric-staging-20260919/composition-v1/validation-plan.json). LifecycleCPU12PASS e patches7 confirmados; candidato selecionado não mudou. No momento da preparação, GPU pertence GUI Simulator; não iniciar por simples ausência futura de lock. Native exato/custo1+8 ainda pendentes. Nenhum resultado desses gates foi inferido do código preparado.
