# Copas v2 — comparação nativa em cópias atuais

**Adendo de integração06:53:** Root selecionou a melhoria local em [parecer](review/environment-canopy-v2-selection.md). Dois arquivos977548/1edbc6 promovidos exatamente e servidos HTTP200/hashigual; [recibo232fontes/2deltas](../../output/environment/canopy-v2-promotion-20260919/promotion.json). Main/server/layout153/PID5973/ledger preservados, sem restart ou novoGPU. Limites e report originais abaixo continuam válidos; não representam aprovação artística final. O estado “staging” nas seções históricas descreve o momento da captura.


## Entrega 06:44 — nativo encerrado, candidato em staging

**Oito gates técnicos passaram.** Captura 06:44:38–06:44:43 UTC em Chrome nativo/WebGL2/ANGLE Metal M5 Pro, após liberação Combat `msg_9a6d08eb7119`. Duas cópias coerentes de **232 arquivos**, main **ebb8**, layout **153**, com apenas os dois deltas Environment abaixo. Sem promoção, novo asset, alteração de posição ou gameplay.

[Report bruto](../../output/playwright/2026-09-19T06-44-37Z-environment-canopy-v2-current/report.json) · [revisão dos quatro originais e pixels](../../output/playwright/2026-09-19T06-44-37Z-environment-canopy-v2-current/review.json) · [liberação/hashes](../../output/environment/canopy-transition-v2-native-ebb8/release.json) · [patch sobre92ef](../../output/environment/canopy-transition-v2-native-ebb8/cedar-on-current.patch).

| Estado | Baseline live legado | Candidato v2 |
| --- | --- | --- |
| Câmera anterior | [Original1440×900](../../output/playwright/2026-09-19T06-44-37Z-environment-canopy-v2-current/baseline-north-fixed.png) | [Original1440×900](../../output/playwright/2026-09-19T06-44-37Z-environment-canopy-v2-current/candidate-north-fixed.png) |
| Próximo, translação30cm | [Original1440×900](../../output/playwright/2026-09-19T06-44-37Z-environment-canopy-v2-current/baseline-north-nearby.png) | [Original1440×900](../../output/playwright/2026-09-19T06-44-37Z-environment-canopy-v2-current/candidate-north-nearby.png) |

SHA256 dos originais, sem edição/crop:

- baseline fixo: `d6f918bce10e2a609ddf77c8edbd3f327182f00309424b78ed008c6990420a44`
- candidato fixo: `a5e83e752be5241af0a095faf9da9525ffb87eb854ef465170b2bfeda9133937`
- baseline próximo: `513d0728a5a46c23c819fb427749176bb8642e4c95f80748af3cf85ecc47408c`
- candidato próximo: `e6e57f15b8eb08546003036e4e5533ec9c3071166dc37b3408eb971a26d525d2`

### Leitura artística e limites

Os quatro originais foram inspecionados. O candidato elimina o pontilhado amplo da copa frontal e retém mais folhagem opaca, deixando o interior aberto limpo. Herói e BloodCow continuam legíveis nos dois estados. A abertura em perspectiva é mais contida; no probe das mesmas nove batches, a superfície visível total passa de90.240 para98.462pixels. Esse número descreve cobertura, não qualidade artística ou custo.

**A borda ainda revela recorte de geometria:** há uma crista angular e trechos que parecem cortes curtos acima do painel de controles. O painel, mantido igual, cobre parte da copa e limita o julgamento de todo o contorno. A amostra30cm mostra outra configuração da borda, mas duas imagens estáticas não demonstram suavidade contínua nem ausência de flicker na locomoção. Não afirmar que v2 resolveu definitivamente o defeito artístico ou que éAAA. Candidato retido para seleçãoRoot, sem promoção automática.

**Ressalva da fixture:** o retículo azul não foi normalizado nem incluído no estado comparado. Há diferença visível de posição;622pixels alterados na região[395,330,458,375] em cada par. O main atual atualiza esse objeto porpointerWorld; não foi feita ablação nativa da causa. Não atribuir todas as diferenças da imagem ao shader nem declarar o frame inteiro idêntico fora da copa. Essa região é distante dos ROIs corporais e da borda frontal. Câmera, luzes, poses/ossos, instâncias/árvores e uniformes das folhas foram comparados e são exatos entre os lados.

### Gates e orçamento observado

- Loader realwarrior **2.7** em ambos; folhas visíveis **520**, tempo0, velocidade0 e posição normalizados por estado.
- **RGBA19×19: 361/361pixels exatos** para herói e BloodCow, tanto fixo quanto próximo; mesmos centros e objetoROI inteiro. Nenhuma tolerância, exclusão de pixel ou redefinição do gate.
- Nove batches reaiscedar: **zero mismatch color/depth** no baseline e candidato. ControleBloodCow:18meshes opacas,7.017pixels em ambos, zero mismatch e **zero materiais adaptados**.
- Zero erros de página/console/HTTP/GL. API `shareEnvironmentCutawayDepth(colorMaterial, depthMaterial)` mantida; paredes/cripta usam o modo legado. Depth foi forçado pelo consumidor de teste, sem volume de campoHorizon: isso não prova leitura de magia em gameplay.

| Medida | Baseline | Candidato |
| --- | ---: | ---: |
| Cena em cor: draws / triângulos |179 /520.370|179 /520.370|
| Programas cor / comdepth |80 /92|80 /92|
| Geometrias render / texturas cor |104 /46|104 /46|
| Cena comdepth: draws / triângulos |258 /757.617|258 /757.617|
| Prepass compartilhado: draws / adaptados |79 /18|79 /18|
| Texturas comdepth |47|47|
| Environment: props / lotes / materiais / texturas |70 /48 /17 /32|70 /48 /17 /32|

Environment14geometrias,257.180triângulos instanciados máximos, estimativa97.867.093bytes de texturas e153colisores iguais. Nenhum passe ou recurso novo no candidato. **Não foi executado benchmark de tempoGPU**; contagens iguais não provam custo de fragmento igual. Ambos receberam a composição/grito já integrada; nenhum móduloVFX/pipeline/main foi alterado nesta proposta.

### Freeze e liberação

Lock adquirido comtoken/PID e liberado pelo próprio runner emfinally às **06:44:43.573 UTC**. Browser e dois servidores privados encerrados; Combat informado uma vez em `msg_432a1f955de5`. Live232 igual ao snapshot antes e depois, PID5173 **5973** e ledger preservados. Históricos20v1,16v2CPU,23combined153,8artefatos05:45 e471arquivos do primeiro preparoaf0c intactos. **V1FAILED/5pixels continua reprovado**; este novo PASS com altura/folhas corrigidas não isola retroativamente sua causa.

ReportSHA256 `c57eb57e314a75d087156bc507b52d0a19be827e5137ac880f58eb7f6f72c518`; reviewSHA256 `cdd27f156ed57f3245283acb196543855186e81d975657b34ca4d46421e710ea`; patchSHA256 `272c056683814823b0c263115fd4052d4c2778f444c79882f876177adb7e444d`. Fontes candidatas congeladas. Nenhuma próxima captura, ajuste ou escrita runtime prevista sem nova seleção.

## Histórico do preparo


## Atual 06:42 UTC — base pós-promoção do grito

Combat promoveu grito/composição às 06:39, main `ebb8c9b2`. Para manter o par na fonte atual, foi criada **outra pasta**, [canopy-transition-v2-native-ebb8](../../output/environment/canopy-transition-v2-native-ebb8/source-manifest.json), com **232 arquivos por lado** (228 no filtro Combat). Ambos recebem a mesma integração; os únicos deltas entre baseline/candidato continuam `977548`/`1edbc6`. Fixture e gates têm os mesmos hashes do preparo anterior. [CPU rebase 6/6](../../output/environment/canopy-transition-v2-native-ebb8/cpu-rebase.json) e patch conferidos. A cópia `af0c` abaixo permanece intacta e não será usada para a captura. Sem GPU ainda; Lich/parede precede este par.

## Preparação06:37 UTC

Nova autorização Root: par curto para julgar abertura em perspectiva/borda, loader real2.7, folhas normalizadas, RGBA19×19 estrito e color/depth. [Alternativa CPU histórica](environment-canopy-transition-v2.md) permanece intacta. Combat confirmou ordem em `msg_97a355dce54e`: grito real encerrou06:32; único Lich/parede precede esta captura. **GPU ainda não adquirida; aguardando liberação comunicada.**

[Duas cópias completas e hashes](../../output/environment/canopy-transition-v2-native-current/source-manifest.json),230arquivos cada, feitas do live estabilizado mainaf0c/server16ac/layout9f6e153/nav e46/dressing92ef. Os226 de Combat usam outro filtro de inventário; esta lista inclui todos os arquivos sobsrc/assets/vendor excetosource-history, mais os cinco arquivosraiz. Não é o snapshot histórico04:52. Baseline é o shader legado live, não v1 rejeitado. Sem inclusão de propostas grito/Lich/Animation.

Somente dois deltas no candidato:

| Arquivo | Baseline | Candidato |
| --- | --- | --- |
| `src/render/environment-cutaway.js` |e335279cb687f6de4a9d203843f733ed9332d1cf9b0dcf94f2b7f66fe6e7fa73|977548e0bc9ae95d64a12bae07d92bdf4edc2bbac816dda05fe11bab241e1aec|
| `src/render/asset-dressing.js` |92ef51b5e314e84d01d2f3aeab24fa07cc7da2b685eb01f7987c8a6cad3eabc0|1edbc66c5cc8be2f56dd9f1578c86c8acb596bd511b1847fdd0fada4fe98f1d5|

[Patch mínimo](../../output/environment/canopy-transition-v2-native-current/cedar-on-current.patch): dressing só adiciona classificação cedar, propaga o boolean e escolhe o modo. `crypt-root-arch`, pátina, update5args e demais composição atuais preservados; reversão dessas três edições reproduz92ef byte a byte. **Nunca copiar00c3 histórico para live.** Helper977548 é exatamente o candidato lido porRoot, sem ajuste artístico adicional.

[CPU rebase6/6](../../output/environment/canopy-transition-v2-native-current/cpu-rebase.json): integridade das cópias; somente dois deltas;153descritores; shader legado color/depth exato; fixture/ROI/parser/patch; históricos preservados. Não é prova de arte ou compilaçãoGLSL.

## Recorte delimitado

Chrome nativo1440×900, high, mesma luz/câmera/atores/árvores nos dois lados. Eye(18.933,17,34.268), target(18.933,1.2,11.668),fov48; herói(18.933,0,14.268) pelo loaderwarrior2.7 atual e BloodCow realspawn da fixture. Pose e relógio congelados, folhas visíveis520/time0/velocity0/bodyatual iguais; todos esses estados ficam no report. Instrumentação somente anexada à respostaHTTP do main em servidores privados, nunca escrita nomain.

Um par fixo original + uma amostra próxima por lado: câmera/herói +0.30m emX, pose fixa e mesmo tempo, câmera acompanha com direção igual. **Translação controlada, não caminhada/input/gameplay nem prova temporal contínua.** Serve para detectar mudança perceptível da borda em dois estados próximos; não garante ausência de flicker entre eles.

[Runner](../../output/environment/canopy-transition-v2-native-current/native.mjs) exige recibo de liberação Combat, lockmkdir atômico comtoken/PID; fecha apenas browsers/HTTP/token próprios. Gates RGBA19×19 exatos nos dois corpos em cada estado, sem relaxar tolerância/excluirpixels; compartilhamento color/depth nas batches reais de cedro e controle opacoBloodCow. Depthforçado usa o prepass compartilhado sem campoHorizon: é teste da máscara, não leitura de magia. Contagemdraws/programas/memória em cor e depth, sem benchmarktimer/matriznova. +0assets/texturas/placements/passes propostos; medição nativa pendente.

## Preservação e decisão

Nenhuma promoção/runtime/servidor editado. Protegidos20arquivosv1,16v2CPU,23combined153 e8artefatos da captura05:45. **V1FAILED/5pixels e rejeição artística permanecem**; mecanismo das folhas conhecido emCPU não prova retrospectivamente a causa daqueles pixels. Ledger ePID5173 serão conferidos antes/depois. Novos PNGs serão entregues originais para seleçãoRoot; nenhum PASS técnico concede seleção artística/AAA automática.
