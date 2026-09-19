# Horizon sobreposto v2 — revisão Root

Revistos os três PNGs originais em `output/playwright/2026-09-19T06-03-50-695Z-cannon-depth-composition-vfx`, relatório e patch `composition-v2-overlap/overlap-v2.patch`. Direção selecionada como correção incremental, sem promoção nem nota AAA neste registro.

Um campo é pixel-idêntico entre composition-v1 e v2. Oito campos high preservam119/121 e121/121 nos dois ROIs dos monstros, contra63/121 e75/121; com fogo, ambos121/121. Low/reduced também melhora. Lyra permanece121/121. Os corpos ficam menos lavados; oito anéis/nébulas ainda são densos. É uma fixture de poses e campos quase concêntricos, não playback natural nem geometria completa do corpo. A referência antes é composition-v1, não o live.

O patch acrescenta discos projetados para compartilhar cobertura do Horizon: `aNovo=1-(1-a)^(1/camadas)` e escala RGB premultiplicado pela mesma proporção. Um campo retorna sem ajuste. Gás, partículas e bloom global permanecem iguais; núcleo com alpha1 é preservado. Não há novo passe/target. Até oito peers após culling, com fade real. Shaders alterados: pool4c19662a, visualbf29f10d, Horizon9ea6675f; composição restante mantém a seleção v1.

TimerGPU nativo1440×900, oito warmups e24pares: medianas1campo3.889→3.823ms, delta pareado mediano+.045ms;8campos5.612→5.911ms, delta pareado+.096ms. Outlier candidato22.359ms contra máximo baseline6.760ms no caso8; não declarar ganho de performance/FPS. Lifecycle7cenários passa pausa, culling, retorno1, reset e expiry; GL0.

Antes da integração resta um limite concreto da aproximação: contagem de discos não testa se o outro emissor é oculto por sólido naquele pixel. VFX deve verificar apenas um par parcialmente sobreposto e um peer atrás de sólido, sem repetir a matriz1/8/custo. Campo inteiramente oculto não deve reduzir indevidamente a emissão do campo visível. Se houver falha, corrigir localmente e preservar a v2 original. A fórmula não deve ser vendida como composição volumétrica exata.

GPU seguinte pertence ao breve A/B GUI já autorizado; teste focal VFX depois, por coordenação atômica. Promoção deverá aplicar delta mínimo sobre o live atual, preservando correção Dwarf e integração futura do grito.

## Peer oculto corrigido — revisão 2026-09-19T06:23:07.295890+00:00

Root leu os relatórios06:12:42 e06:14:22, o patch inteiro `composition-v3-occlusion/occlusion-v3.patch` e os dois PNGs originais posteriores (`peer-hidden.png`, `peer-partial.png`). O primeiro recorte confirmou a suspeita: peer sozinho contribuía zero, mas o par alterava28485canais/287953de soma absoluta do campo visível. Depois, a diferença do par para somente o campo visível é exatamente zero. O par parcialmente sobreposto permanece visível, com728canais/4991de diferença entre versões. ShaderGL0, fontes estáveis, live intocado.

A v3 informa a profundidade projetada constante do billboard e ignora o peer por pixel quando a profundidade opaca da cena o oculta. Usa o depth existente, sem nova textura/passe/draw. O early return de um campo e o núcleo alpha1 permanecem. A cena causal tem parede sintética e somente Horizon: não reatribuir os ROIs1/8, custo ou gás/fogo desta prova à v3 como se repetidos. A composição continua uma aproximação de cobertura, não solução volumétrica exata.

**Selecionada a v3 para integração incremental**, sucedendo o hold do peer: pool9000f44f, visual058f7c8c, Horizonc1896cd2 e composição v1 restante. VFX deve entregar manifesto final com o wrapper combinado do grito; Combat integra apenas deltas no main vigente. A verificação de aplicação/HTTP e um smoke conjunto necessário do grito são suficientes; não repetir a matriz1/8/custo ou o mesmo par oculto. Preservar as provas anteriores e limitações artísticas.

Pacote efetivamente integrado06:35:08 junto ao grito; conferência independente dos10arquivosHTTP/228fontes sem drift registrada em `output/qa/arpg-root-review/warcry-gravity-promotion-20260919.json`. Nenhuma prova antiga foi reclassificada como nova matriz global.
