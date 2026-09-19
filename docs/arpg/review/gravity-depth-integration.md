# Integração de depth: paridade com recorte do cenário

Achado estático Root, 19/09/2026: `tools/gravity-vfx-prototype.html:32` produz MeshDepthMaterial copiando side/map/alphaMap/alphaTest/clipping, sem copiar o cutaway. O recorte das copas/santuários/ruínas está exclusivamente em `asset-dressing.js:59-109`, por onBeforeCompile/discard e uniforms por jogador, ameaças e áreas. Não foi observado customDepthMaterial neste caminho.

Consequência inferida, ainda sem reprodução visual dedicada: o prepass pode gravar profundidade de uma copa que o passe de cor descartou; AstralNebula consulta esse depth e deixa de aparecer através da abertura. A fixture inicial com campo central não comprova paridade atrás de copas.

Integração precisa preservar o mesmo descarte e coordenadas de instâncias/skinning em ambos os passes. Não basta invocar cegamente o onBeforeCompile completo do material padrão: hooks de vertex/fragment do material depth não têm necessariamente os mesmos includes, e a pátina de cor não pertence a depth. Environment deve expor/reutilizar só o patch de cutaway/uniforms, e VFX/Combat respeitar o material de depth correspondente.

Dono Environment recebeu pedido isolado para preparar esse adaptador com fonte preservada. VFX e Combat devem coordenar a promoção antes de validar o efeito atrás de copas, paredes parcialmente recortadas e atores. Falta de uma reprodução visual específica permanece registrada; não chamar a hipótese de bug de gameplay confirmado.

## Confirmação nativa posterior

Root inspecionou os A/B originais de copa, parede e ator em `output/playwright/environment-depth-cutaway-v1/`; paths/hashes estão em `gravity-depth-followup.json`. A diferença da nebulosa através da abertura está visível em copa/parede, preservando a parte opaca das pedras. O ator diante do efeito permanece opaco e com a mesma silhueta nos dois painéis. O relatório declara colorWithoutEffectHash igual entre versões, depth alterado somente nos casos de recorte e GL limpo. A hipótese anterior foi reproduzida nessa fixture e corrigida pelo adaptador; não é prova exaustiva de gameplay/horda.

O adaptador já foi promovido pelo dono Environment e importado por Combat. Root também examinou a fixture integrada01:23:55 com1e8campos: núcleo/nebula permanecem reconhecíveis e os torsos visíveis nos recortes observados. A medição do dono registra mínimo87.6% de preservação nas regiões amostradas; esse limiar não aprova toda ameaça/pose nem desempenho físico. A correção de intensidade após a primeira rodada28.1% não relaxou o limiar. Os rótulos dos PNGs preservam sua natureza de comparação controlada; gameplay por input é a próxima prova.
