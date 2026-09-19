# Environment composição v2 — quatro módulos promovidos, congelados para QA

## Estado atual — promoção autorizada às02:30 UTC

Adendo02:43: CPU própria21, verificador integrado Combat7/7 e QA nativa focal8/8 passaram. O boss travado na manutenção foi diagnosticado como falta de conector inicial da grade; Physics promoveu navigation911e0ea2, sem alterar composição, corpo ou gates. Auditoria independente confirmou chegada5.85s/31nós. [Detalhes atuais e evidências](environment-handoff.md). Captura focal depth/custo concluída abaixo; fontes liberadas/congeladas, sem próximas escritas runtime previstas. Nenhum aceite global de horda ou AAA.

Root/Combat abriram a janela após Physics/JEF02:26. Baseline exato confirmado, três módulos anteriores arquivados; **somente os quatro arquivos selecionados abaixo foram promovidos juntos**, hashes do candidato confirmados no runtime. [Recibo e hashes completos](../../output/environment/composition-v2-promotion/promotion.json). Layout143/arena55 importado por Node; API update/skillAreas intacta. Fonte congelada para gates integrados; sem escrita adicional runtime planejada. Main/server/Physics/cutaway/atmosphere/pipeline não foram alterados pela promoção. Servidor5173PID66986 e ledger byte a byte preservados; eventual restart pertence exclusivamente a Combat. QA própria pós-promoção em preparação. Seleção/A/B não conferem aprovação global.

## QA focal integrada —02:43 UTC

[Resumo/hashes/fontes](../../output/playwright/environment-composition-integrated-v1/environment-integrated-summary.json) e [telemetria completa](../../output/playwright/environment-composition-integrated-v1/environment-integrated-depth-cost.json): **8/8**, Chrome153 visível/WebGL2/ANGLE Metal AppleM5Pro,1280×720,DPR1; zero page/console/HTTP/request errors/warnings, GL0. Snapshot estável durante captura e checkout ainda idêntico ao término. Módulos reais atuais de Environment, atmosfera, pipeline/depth, atores e Horizon; **fixture sintética com atores parados/campo controlado, não main/gameplay/input**. Não reproduz os headstones adicionais de main, HUD, simulação de horda ou rede.

Capturas examinadas: [centro](../../output/playwright/environment-composition-integrated-v1/environment-integrated-depth-cost-center.png), [jardim](../../output/playwright/environment-composition-integrated-v1/environment-integrated-depth-cost-garden.png), [cripta](../../output/playwright/environment-composition-integrated-v1/environment-integrated-depth-cost-crypt.png), [manutenção](../../output/playwright/environment-composition-integrated-v1/environment-integrated-depth-cost-maintenance.png), [ator opaco](../../output/playwright/environment-composition-integrated-v1/environment-integrated-depth-cost-actor.png), [cripta low/reduced](../../output/playwright/environment-composition-integrated-v1/environment-integrated-depth-cost-crypt-low-reduced.png). Nenhum runtime foi alterado para a fixture.

No mesmo frame/câmera/campo, comparação numérica do pipeline real com adaptador versus controle sem adaptador mudou5512pixelsRGB no jardim e7195na cripta, recuperando a nebulosa pelas partes recortadas. Centro e manutenção: zero diferença nessa câmera específica; não são casos adicionais de recuperação de depth. Ator opaco: zero diferença entre pipelines e121/121pixels do torso abaixo do limiarRGB65 contra imagem sem campo. Todo caso manteve um prepass, depth válido e um foco de skill. Cor/depth em instância controlada, combinando clipping e cutaway ligados/desligados: quatro máscaras256×256 sem nenhum pixel divergente. A cripta continua fachada fechada; sua base sólida pode e deve ocluir.

### Custo medido, sem aprovação de FPS

`EXT_disjoint_timer_query_webgl2` nativo;30queries por caso/material, seis aquecimentos descartados,24amostras válidas, zero disjoint. A/B alternado a cada amostra com mesma geometria/câmera/tempo, sombras, atmosfera e HDR. Controle mantém mapas/propriedades do chão, retirando só o patch de composição; manchas de contato continuam nos dois. Portanto esta comparação **não** é138→143 nem mede economia dos lotes. CPU de submissão também consta no JSON, separada do timerGPU. Não há orçamento de FPS global aprovado por esta medição curta.

| Câmera / passes | Controle P50/P95 ms | Composição P50/P95 ms |
| --- | ---: | ---: |
| Centro, cena+HDR, zero campo |4.075 /4.261|4.262 /5.174|
| Centro, cena+HDR+depth+1campo |5.180 /5.518|5.263 /6.555|
| Jardim, cena+HDR, zero campo |3.801 /4.011|4.001 /4.291|
| Jardim, cena+HDR+depth+1campo |4.866 /5.022|4.991 /5.857|
| Cripta, cena+HDR, zero campo |3.754 /4.050|3.902 /4.336|
| Cripta, cena+HDR+depth+1campo |4.650 /4.874|4.975 /5.944|
| Manutenção, cena+HDR, zero campo |4.209 /4.277|3.142 /5.019|
| Manutenção, cena+HDR+depth+1campo |2.019 /5.561|2.292 /6.081|
| Piso isolado+HDR |1.348 /1.504|1.475 /1.609|
| Cripta, somente prepass depth |.464 /.526|.461 /.550|

Piso isolado: acréscimo mediano observado.126ms. Nos três primeiros pontos, mediana da cena aumenta.084–.325ms conforme campo/câmera. Manutenção apresenta variação acentuada entre mediana eP95 e entre materiais; **não inferir ganho ou FPS da mediana menor**. Limites adicionais:24amostras por condição, uma máquina/resolução, sem soak, mobile ou horda; esta janela encerra a coleta focal, não uma certificação de performance. Orçamento de assets/lotes abaixo permanece igual.

Runner próprio: `output/environment/composition-v2-promotion/native.mjs` e `native-preview.html`. Lock adquirido por mkdir atômico com token próprio, liberado em finally; Chrome e servidor efêmeros próprios encerrados. **GPU e fontes Environment liberadas, sem próximas escritas/capturas previstas.** Combat pode prosseguir com IA/caso exato/seis skills por teclado, rede e restart controlado5173. Servidor5173 não foi reiniciado por Environment.

## Histórico da seleção e do candidato isolado

**Root selecionou a direção às02:01 UTC; nenhuma promoção.** [Revisão independente](review/environment-composition-followup.md) e [hashes dos oito PNGs revisados](review/environment-composition-followup.json) incorporados. Implementado e validado em cópia isolada; runtime Environment, assets originais/exports e servidor5173 preservados. Trabalho em `output/environment/composition-v2/`; quatro módulos candidatos, baseline congelado, ferramentas e tentativas históricas incluídos. GPU própria liberada em finally. **Não promover durante Physics; aguardar a próxima janela explícita Combat/Root.** Seleção artística não é aceite AAA, navegação de horda ou liberação de runtime.

[Comparador A/B com slider](../../output/environment/composition-v2/review.html) · [CPU](../../output/environment/composition-v2/cpu.json) · [resumo nativo](../../output/environment/composition-v2/native-summary.json) · [patch para revisão, não aplicado](../../output/environment/composition-v2/composition-v2.patch) · [manifesto](../../output/environment/composition-v2/manifest.json).

## Referência e escolha artística

Revisadas as seis imagens reais01:35/01:39 listadas em [integrated-art-followup.json](review/integrated-art-followup.json), com hashes reconferidos. Observação: dois santuários espelhados e copas grandes semelhantes dominam o cruzamento; detalhes pequenos ficam dispersos, com pouca diferença entre usos do chão. Não houve revisão contínua dos vídeos ou nova nota AAA.

O candidato concentra peças existentes em três locais. Nenhum novo GLB ou textura; não foi aberto Blender nem modificado original. A câmera/iluminação da fixture permanecem idênticas entre A/B, inclusive sombra e luz do ator. As peças menores recebem escala/rotação e cor distintas; o recorte de copas continua ativo.

| Conjunto | Composição e posição XZ | Origem reutilizada |
| --- | --- | --- |
| Entrada da cripta | Porta fechada em (12.3,−15.7), parede baixa atrás, rochas de tamanhos diferentes, flores laterais e soleira. Retira o santuário leste duplicado; fica fora do eixo norte. **Cenário fechado, sem interior, interação ou acesso prometido.** | Porta House, parede Harbor, rochas/raízes Tunnel; doze peças do mesmo pavimento procedural para a soleira. |
| Jardim funerário | Três sarcófagos distintos ao redor de (−13.4,−11), cerca em L, flores e oferendas baixas. Um único santuário menor ao fundo. | Santuário/roseiras Harbor, cogumelos/raízes Tunnel, stonework procedural existente. |
| Manutenção / ruína | Três barris e quatro vigas junto às pedras/cerca, perto de (19.3,12.8), com a ruína existente como contexto. Solo mais seco e pequenas marcas sob os volumes. | Barris Harbor, vigas House, rochas Tunnel. |

Onze árvores mantêm suas posições, com alturas3.4–6.2m e três tintas por instância. As duas copas próximas a leste e a copa do jardim ficam menores, abrindo visada. Sarcófagos variam proporções/altura/yaw; o material muda por instanceColor, sem texturas adicionais. O piso recebe variação procedural suave de escala ampla e três áreas de musgo/terra/poeira; eixos e centro preservam contraste. São mudanças moderadas de superfície, não terreno novo ou uma reconstrução completa da arena.

Trinta e três manchas de contato com borda suave, em uma malha plana de528triângulos, ficam a1.3cm do chão para evitar z-fighting. Não têm volume físico. Objetos sólidos novos ficam apoiados em y0; raízes/cogumelos/plantas baixas são decoração atravessável declarada, e o pavimento fino continua superfície caminhável. Não foram acrescentadas luzes, transparência global, passes de pós ou alterações de VFX.

## A/B nativo final

Chrome visível153/WebGL2/ANGLE Metal Apple M5 Pro,1440×900,DPR1,high. FOV48°, altura17m/profundidade20m, lookahead2.6m; mesmos atores, poses, tempo, câmera e luz por par. Hero e três zombies são **atores estáticos de fixture**, colocados em pontos livres comuns aos dois layouts; não são input/gameplay. Posições em [composition-actors.json](../../output/environment/composition-v2/composition-actors.json). Sem HUD/VFX/transientes de partida. APIs reais de import, instancing, materiais, atmosfera, cutaway e pipeline foram usadas.

| Vista | Baseline | Candidato |
| --- | --- | --- |
| Centro / spawn | [PNG](../../output/playwright/environment-composition-v2-v3/composition-baseline-center.png) | [PNG](../../output/playwright/environment-composition-v2-v3/composition-candidate-center.png) |
| Jardim | [PNG](../../output/playwright/environment-composition-v2-v3/composition-baseline-garden.png) | [PNG](../../output/playwright/environment-composition-v2-v3/composition-candidate-garden.png) |
| Cripta | [PNG](../../output/playwright/environment-composition-v2-v3/composition-baseline-crypt.png) | [PNG](../../output/playwright/environment-composition-v2-v3/composition-candidate-crypt.png) |
| Manutenção | [PNG](../../output/playwright/environment-composition-v2-v3/composition-baseline-maintenance.png) | [PNG](../../output/playwright/environment-composition-v2-v3/composition-candidate-maintenance.png) |

**4/4 pares passaram**, todos vistos individualmente. [Baseline JSON](../../output/playwright/environment-composition-v2-v3/composition-baseline.json) e [candidato JSON](../../output/playwright/environment-composition-v2-v3/composition-candidate.json): zero page/console/HTTP/request errors, GL0 e `sourceChangedDuringRun:false` em ambos. Contatos sólidos conferidos por bounds y0/altura e pelas capturas de [cripta](../../output/playwright/environment-composition-v2-v3/composition-candidate-crypt-colliders.png) e [manutenção](../../output/playwright/environment-composition-v2-v3/composition-candidate-maintenance-colliders.png). Nova parede tem collider abaixo do topo visível2.7547m.

Leitura observada: cripta substitui a duplicação cerimonial por uma fachada reconhecível; jardim concentra flores/sepulturas; manutenção reúne materiais de reparo. O portal e três ameaças do centro permanecem visíveis. A melhora do chão é sutil sob esta iluminação. Persistem repetição das cruzes/headstones legadas e ausência de muitos tipos de vegetação; não foram alterados os objetos que pertencem a main. O ator da vista da cripta pode se sobrepor visualmente à travessa de uma cruz legada, cujo collider simplifica a haste; isso também existe no baseline. Não declarar cobertura de todas as oclusões ou de horda.

## Orçamento medido e limites

| Recurso | Baseline | Candidato | Limite deste candidato |
| --- | ---: | ---: | ---: |
| Props importados |68|66|≤68|
| Lotes de dressing, antes de culling |62|46|≤72|
| Geometrias de dressing |12|12|12|
| Materiais de dressing |12|15|≤16|
| Texturas únicas de dressing |30|30|30; zero novas|
| Estimativa RGBA+mips dressing |93.323.264B|93.323.264B|sem aumento, ~89MiB|
| Triângulos instanciados máximos do dressing |248.981|249.683|≤250.000|
| Contatos de superfície extras |0|1lote/1material/1geometria/528triângulos|zero texturas|

Os oito GLBs derivados em `assets/environment/cemetery-v1` mantêm1.052.264bytes combinados. Outros quatro GLBs Harbor já existentes também estão intactos; o download incremental de assets é zero. Maior concentração espacial reduz fragmentação dos lotes; tintas de instância preservam compartilhamento. A estimativa de memória não é leitura real de VRAM. A cena inteira atingiu47texturas em ambos e45→46geometrias após as quatro vistas; contagem parcial menor antes de visitar a manutenção não é economia de assets.

Chamadas de desenho da fixture completa, incluindo sombras/pós: centro158→137, jardim156→137, cripta149→132, manutenção166→144. Triângulos efetivamente enviados aumentam ~1.1–3.1% nestas vistas devido ao conteúdo/culling, embora os lotes diminuam. **Sem GPU timer, benchmark prolongado, FPS comparável ou mobile físico nesta prova.** O shader de solo acrescenta cálculo por fragmento; menos draws não garante menor custo total.

## Layout candidato e Physics

[Layout puro candidato](../../output/environment/composition-v2/candidate/src/render/environment-layout.js), mesma API `getEnvironmentLayout/getEnvironmentColliders/ENVIRONMENT_GROUND`, sem Three/DOM. Acrescenta `trees` e `grounds` para orientar render/material; arena circular55m, chão y0, spawn/portal e posições de headstones/cruzes legadas preservados. Instalação futura precisa levar **layout e visual juntos**.

**138→143 colisores:** remove `shrine-east`; adiciona `crypt-entry-wall`, `crypt-entry-door` e `fallen-beam-0..3`. Vigas antes decorativas agora têm box de contato de16cm de altura, inclusive para atores. Os28 registros alterados são11 troncos (raio/altura proporcional ao novo tamanho, posição igual),4 sarcófagos,3 cercas, santuário oeste,6 rochas e3 barris. Detalhamento integral antes/depois em `cpu.json`. São volumes simplificados, não colisão triangular.

**21 checks CPU passaram.** Incluem integridade/IDs, collider para cada prop sólido, spawn4m livre, preservação das fontes e8/8 sweeps+moveActor desde(0,0),14m, raios.64/1.3 e ângulos135/210/270/345 (`x=sin(a),z=-cos(a)`), com endpoint exato/zero unresolved. Os mesmos oito casos passam no Physics congelado e no Physics atual `290a3f35…`, conferido estável durante o teste. Não é prova de horda, pathfinding de todo o mapa, outras origens ou colisão em partida. Novas áreas podem exigir ajuste após seleção e prova dinâmica do dono Physics/Combat.

## Fontes, isolamento e reprodução

[Preservação inicial](../../output/environment/composition-v2/preservation-before.json), [verificação posterior](../../output/environment/composition-v2/preservation-after.json), [origens GLB](../../assets/environment/cemetery-v1/provenance.json), [Harbor já integrado](../../assets/models/environment.provenance.json). Hashes das oito fontes Harbor/Tunnel/House e dos oito derivados reconferidos; os quatro Harbor anteriores também coincidem com sua proveniência. Originais Blender/GLB/ZIP não foram escritos.

| Arquivo dentro de `candidate/src/render/` | SHA-256 |
| --- | --- |
| `asset-dressing.js` | `ec488addd691267e58b996da767a1e7a0428f666e6af1b2fa81cea289237c6e9` |
| `cemetery.js` | `2d512097dbd1c05b4d0c8225a51aaea54789f899e4d60e6a160b083dd9fbe9da` |
| `environment-layout.js` | `8e756fe4022c7916074220d44c0ff605aa8fdc9d80fdf6c61d8a03fb475fc8a7` |
| `environment-composition-ground.js` | `d9335c238efdacce7aa27c8e93541210d282d95fb6bea0dca66241d249c9f001` |

Snapshots completos `baseline/` e `candidate/` independem das escritas simultâneas dos pares. Environment de produção continua byte a byte igual; mudanças concorrentes de main/server/Physics e staging VFX estão listadas na verificação posterior e não entraram na captura congelada. Não copiar essas cópias completas de volta ao checkout. O adaptador depth/cutaway liberado anteriormente foi preservado sem refazer export.

CPU: `node output/environment/composition-v2/cpu.mjs`. Nativo já executado: `BIPX_HEADLESS=0 BIPX_BROWSER_CHANNEL=chrome BIPX_EVIDENCE_DIR=<absoluto> node output/environment/composition-v2/native.mjs`. Reserva GPU por mkdir atômico, owner/token, liberação só da reserva própria em finally; Chrome e servidores efêmeros próprios encerrados. Porta5173/PID97873 reconferida ativa. Não houve fila, interrupt ou agentes novos.

Histórico preservado: v1 nativa detectou identificador GLSL reservado no shader isolado; v2 corrigiu compilação e detectou collider da parede6cm alto demais. Ambos corrigidos somente no candidato antes de v3. Cenário foi refinado para diminuir duas copas, separar o solo e colocar atores em posições livres comuns; por isso o A/B final foi refeito. CPU inicial incluiu indevidamente staging VFX na asserção de preservação, detectou edição concorrente daquele dono e teve o escopo corrigido; log preservado.

## Plano de promoção coordenada — ainda não executado

1. Aguardar encerramento da janela Physics e autorização explícita da próxima janela Combat/Root. Não interpretar ausência do lock como autorização para promoção. GPU somente após reserva atômica própria.
2. Conferir hashes das três fontes Environment de produção contra o baseline do manifesto: dressing `3677c14a…`, cemetery `39e45227…`, layout `987487e1…`; o novo módulo de chão ainda não existe em produção. Se houver drift, reconciliar somente o diff selecionado. Arquivar essas versões antes da alteração, mantendo as evidências históricas.
3. Aplicar **juntos** `asset-dressing.js`, `cemetery.js`, `environment-layout.js` e novo `environment-composition-ground.js` pelos hashes da tabela, em lote coordenado sem captura durante o estado intermediário. Preservar `environment-cutaway.js`, atmosphere, bibliotecas, exports e pipeline/HDR. Não copiar pastas completas; **nunca sobrescrever main/server/Physics com snapshots Environment**. API de update/skillAreas continua igual. Layout143 deve chegar ao consumidor browser e Node; qualquer recarga do servidor5173 pertence a Combat, mantendo o serviço.
4. Antes de liberar, rodar QA limitada na fonte integrada: spawn/findFreePosition junto de cada conjunto; perseguição/horda passando dos dois lados das novas quinas; dash8m/charge7m em direções livres e contra parede/porta/vigas/cercas; campo/pull junto dos cantos, projéteis cortando/cercando os sólidos; ator/ameaça/campo atrás de copa e ruína para cutaway/depth. Medir custo GPU do chão e cenário no pipeline corrente. Repetir casos por impacto concreto, sem presumir que oito sweeps da origem cobrem toda a navegação.
5. Congelar hashes integrados após esses gates, documentar resultados/limites e coordenar a próxima captura de gameplay com Combat. Só então declarar fontes integradas liberadas. A escolha Root permanece **direção artística selecionada**, com piso/material ainda limitados e sem aceite AAA/JEF.

[Layout exportado para revisão](../../output/environment/composition-v2/layout.json) e [delta de colisores](../../output/environment/composition-v2/collider-delta.json) acompanham o módulo puro. Nada desse plano foi promovido durante Physics. Não há nova prova de gameplay/rede neste handoff.
