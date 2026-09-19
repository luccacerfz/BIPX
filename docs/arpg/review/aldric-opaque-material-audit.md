> Correção posterior: a atribuição textual corpo/rifle do Dwarf estava invertida. Os índices e pixels inventariados continuam corretos; DwarfBody usa material1 BLEND. Ver [auditoria por nós](dwarf-opaque-material-audit.md).

# Aldric: corpo opaco declarado como transparente

Root inspecionou a textura original extraída sem alteração e a captura QA do asset fonte. O torso sem armadura já pertence ao asset original; não foi identificado desaparecimento de roupa.

O material0 tripo_mat_5c5194c8.001 do GLB declara alphaMode BLEND. Os1.048.576pixels da texturaRGBA têm alpha255, e o fator de cor tem alpha1. O GLTFLoader local ativa transparent e desativa depthWrite para BLEND; scene-depth.js exclui materiais sem depthWrite. O loader do personagem não corrige essa declaração. Isso estabelece um defeito de participação na profundidade, ainda sem prova nativa de seu efeito visual.

[Auditoria e hashes](../../../output/qa/arpg-root-review/aldric-material-audit-20260919/audit.json) e [candidato isolado](../../../output/qa/arpg-root-review/aldric-material-audit-20260919/aldric-hero-opaque-candidate.glb). Única mudança lógica: alphaMode do material0 passa a OPAQUE. Outros dadosJSON são exatos e todos os chunks seguintes ficam byte-idênticos; original runtime preservado.

VFX/Combat/Animation devem comparar o material carregado, participação no depth e Aldric com efeitos coincidentes antes de integrar. Não alterar todos os materiais transparentes, não substituir o passe compartilhado e não chamar hipótese de melhoria AAA. Próxima prova cabe no diagnóstico de material/depth do grito art2; nenhum novo benchmark/matriz ampla solicitado.

## Inventário adicional, somente leitura

[SeisGLBs runtime](../../../output/qa/arpg-root-review/aldric-material-audit-20260919/character-material-inventory.json): Brute/Lich/Walker/Orc usam materiaisOPAQUE. Dwarf corpo já éOPAQUE; o material1 do rifle declaraBLEND apesar de alpha255 em toda textura e fatoralpha1. Não foi criada correção do Dwarf nem alterado runtime. Esse achado deve ser considerado separadamente na próxima revisão de sobreposição do canhão/arma; não reatribuir resultados de proteção do torso, que usa outro material.
