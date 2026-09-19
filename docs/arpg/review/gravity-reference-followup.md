# Gravidade: comparação com a referência original

Em 2026-09-19, root inspecionou quatro PNGs do protótipo `output/playwright/2026-09-19T00-45-58-667Z-gravity-vfx-prototype`: high em .35/1.8/3.6 s e low/reduced em1.8 s. São fixtures controladas com assets/câmera base do jogo, não casts naturais. Também inspecionou `/tmp/bipx-linear-reference/docs/screenshots/astral.jpg` e o código do clone, HEAD confirmado `8c377c886ac2c68b26bc65c8f3507905818b974a`.

O protótipo reduziu a competição das bordas no chão e preservou corpos legíveis. Porém núcleo/disco ainda ocupam poucos pixels e o campo continua visualmente leve. Isso melhora hierarquia, mas não satisfaz sozinho o pedido de VFX muito expressivos usando a referência. Não promover como acabamento final apenas porque a fixture passa.

A referência original apresenta hierarquia concreta: sombra central quase preta, borda de fótons mais brilhante que todo o resto e assimétrica, halo/névoa violeta com rotação diferencial, fragmentos com trajetória de convergência e envelope de crescimento/colapso. A imagem do autor não é prova do nosso runtime nem impõe igual escala de câmera; é a direção artística pedida pelo usuário.

Reaproveitamento recomendado ao VFX, ainda em candidato isolado:

1. Adaptar de fato `src/materials/SingularityMaterial.js`: billboard circular com `fwidth`, borda que conserva energia em poucos pixels, brilho assimétrico e halo com rotação diferencial. O protótipo atual usa uma esfera com rim simples. Calibrar tamanho/presença na câmera real sem transformar o campo em área de dano maior.
2. Recuperar a aparência de volume/shear de `src/materials/AstralNebulaMaterial.js`, com campo achatado e cavidade legível. A versão original faz raymarch e depende de scene depth; essa dependência deve ser integrada explicitamente ou prototipada com limites honestos. Não alegar depth clipping quando houver apenas `depthTest` de uma casca.
3. Manter fragmentos convergentes e revelar o crescimento/colapso do campo dentro dos 5 s autoritativos. Câmera/horda não devem desaparecer sob o efeito. Reduced conserva forma/alcance/centro, reduzindo animação e flashes.

Diferença de pipeline importante: `tools/gravity-vfx-prototype.html` usa ACES direto; `src/main.js` usa `createCinematicPipeline`, render HDR seguido de bloom/composite próprio. A próxima comparação deve usar o pipeline real ou declarar a diferença. A energia do shader e o halo não podem ser aprovados a partir de outra transformação de cor.

`src/render/cinematic-pipeline.js` pertence à integração. Atualmente o alvo HDR não expõe uma depth texture de cena para os volumes. Coordenar com Combat se necessário; não duplicar renderizador nem inserir refração global silenciosamente. O usuário pediu o padrão visual da referência: um limite arbitrário de poucos traços não substitui esse objetivo. Medir custo da alternativa real e então ajustar qualidade/densidade, mantendo as camadas essenciais.

Fonte original: https://github.com/achrefelouafi/LinearAbiltyCastingExtendedThreeJS/tree/8c377c886ac2c68b26bc65c8f3507905818b974a. Código/licenças e histórico permanecem preservados. Sem nota AAA atribuída a este estudo.
