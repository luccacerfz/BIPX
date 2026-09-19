# Copas v2 — melhoria local selecionada

Root revisou os quatro PNGs originais1440x900 da captura06:44, o patch mínimo, manifest e oito gates do report em `output/playwright/2026-09-19T06-44-37Z-environment-canopy-v2-current`. **Selecionada como melhoria local para integração dos dois arquivos; não é aprovação artística final.**

O pontilhado amplo da copa frontal deixa de competir com a leitura do cenário, retendo mais folhagem opaca e abertura limpa. A borda ainda tem crista angular e parte do contorno fica atrás do painel de controles. Dois estados separados por30cm não provam continuidade em movimento. O retículo mudou entre lados e impede alegar equivalência global do frame; não invalida o recorte de árvore nem os ROIs corporais exatos documentados.

RGBA19x19 de herói e BloodCow permanece byte exato nos dois pares. Color/depth nas nove batches de cedro tem zero mismatch, ator opaco não foi adaptado. Draws, programas, geometrias e texturas iguais; nenhum tempo GPU medido, portanto nenhuma alegação de custo de fragmento idêntico. Modo legado continua nas paredes/cripta e não há novo asset/passe.

Integrar somente `src/render/environment-cutaway.js` e335279c→977548e0 e `src/render/asset-dressing.js`92ef51b5→1edbc66c, da cópia `canopy-transition-v2-native-ebb8`. Conferir hashes de origem/destino e HTTP servido, manter layout153, main ebb8, servidor16ac/PID5973, ledger e outras fontes. Nunca transportar o dressing histórico00c3. Preservar candidatas e v1FAILED.

Depois da integração, próximo refinamento autorizado em cópia: contorno menos angular e revisão curta em movimento com painel de controles fechado por fluxo normal, retículo/câmera/atores/folhas normalizados. Preparar CPU primeiro, coordenar GPU depois dos focais em andamento. Não mudar opacidade dos atores ou colisões, nem enfraquecer RGBA/color-depth. Este é seguimento artístico concreto, não motivo para reexecutar toda a matriz de ambiente.

## Integração confirmada

Root conferiu independentemente às06:54:52UTC:232 fontes iguais ao manifesto mais os dois deltas selecionados, zero drift; ambos os GETs HTTP200 byte exatos; rota offline200 e mesmo NodePID5973. Recibo: `output/qa/arpg-root-review/canopy-v2-promotion-20260919.json`. Não foi necessário reinício nem recarga da aba do usuário. O shader só será recebido por páginas carregadas depois da integração; não alegar que a aba já aberta atualizou automaticamente.
