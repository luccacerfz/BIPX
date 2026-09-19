# Dwarf: correção de material corporal em cópia

A auditoria pelo caminho nó → malha → material confirma DwarfBody/mesh1/skin0/material1 BLEND; DwarfRifle/mesh0/material0 OPAQUE. Corrige a atribuição textual anterior do Root, preservada no histórico.

Material corporal `tripo_mat_2a1e3867`: textura RGBA1024×1024, todos os1.048.576pixels alpha255, fator alpha1. Candidato altera somente alphaMode para OPAQUE. JSON restante, BIN e chunks seguintes idênticos; rig, skin, meshes, textura e animações preservados. Original live intacto.

[Auditoria e hashes](../../../output/qa/arpg-root-review/dwarf-material-audit-20260919/audit.json). Candidato `dc0867dacd22b04e42475a686fffe808ad8c7e66e9889b2a182eb4393eb5378e`, origem `e11eadb8b428ad46332b0f70bc2db3459628775b65cbb101886cd46fdcd643b0`.

O diagnóstico nativo VFX usou override equivalente no material carregado e mostrou a causa da ausência do corpo no depth. O GLB candidato exato ainda precisa conferência pelo loader, com a máscara original e composição claramente separadas. Não é aprovação artística/global nem promoção automática.
