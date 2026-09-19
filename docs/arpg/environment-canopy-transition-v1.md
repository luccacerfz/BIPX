# Copas em primeiro plano — transição v1 em cópia

**Decisão Root05:57 (`msg_3cf8643b8ce5`): v1 NÃO SELECIONADO.** Registrar limitação adicional: a fixture carregou Aldric com `height:2.4`, enquanto `main.selectCharacter` usa `loadPlayableCharacter`, perfil warrior**2.7**. O herói da fixture ficou0.3m menor; não chamar reconstrução fiel do herói atual. A hipótese de folhas/tempo para os5pixels permanece não isolada em GPU. [Única alternativa v2 em cópia, somente CPU](environment-canopy-transition-v2.md) prepara altura correta e normalização ambiental sem relaxar ROI. PNGs/reportFAILED/hashes v1 preservados; nenhum novo render ou rebase live.

**A/B nativo05:45 encerrado; candidato retido, sem promoção/rebase.** O pontilhado amplo da copa frontal diminuiu, mas a abertura ganhou um contorno abrupto/artificial. Os dois corpos continuam legíveis nesta vista. Cor/depth das copas e BloodCow coincidem; nenhum programa/lote/textura extra foi observado. O report bruto permanece **FAILED** por5pixels diferentes no ROI de cor da BloodCow; diagnóstico e limites abaixo. GPU/browser/HTTP próprios liberados. O live combinado153/dressing92ef/nave46/mainc0fbc/5173PID65261 foi preservado.

## Par original e decisão focal

- [Baseline original1440×900](../../output/playwright/2026-09-19T05-45-19-026Z-environment-canopy-transition/baseline-north-fixed.png) — SHA256 `dc8d60208ee79d69fdec3f2d79531b0aafd4e48d68d0a0ded7c81fe8f962252f`.
- [Candidato original1440×900](../../output/playwright/2026-09-19T05-45-19-026Z-environment-canopy-transition/candidate-north-fixed.png) — SHA256 `44d57c73dc054daa7a3cbd6d91e30066d0a2b007fa8f23f1f35c63b2eb69ae96`.
- [Report bruto preservado](../../output/playwright/2026-09-19T05-45-19-026Z-environment-canopy-transition/report.json) e [review CPU/visual separado](../../output/playwright/2026-09-19T05-45-19-026Z-environment-canopy-transition/review.json).

Revistos ambos os originais. A região frontal deixa de ter uma superfície amplamente perfurada e passa a uma abertura contínua. Porém os lóbulos cortados e a borda quase horizontal expõem o recorte do mesh; o resultado ainda não é uma transição natural. **Recomendação desta frente: reter, não promover.** Root recebe o par para seleção; não se afirma AAA nem que o baseline pontilhado seja o melhor compromisso possível. Se houver uma próxima proposta, priorizar composição que mantenha a copa fora do corredor projetado da câmera, com visual/collider juntos em cópia; nenhum placement foi movido aqui.

A/B é uma reencenação visual no **snapshot Physics04:52/226fontes**, não replay do hit nem prova do live153. Câmera48°/matrizes, luzes, poses/bones dos atores, instâncias/cores das árvores e placements iguais nos dois lados. A montagem usa o spawn real congelado depois de definir tempo3.0348; o label752 difere do744 histórico, sem significado de gameplay. Não houve dano/input/IA medidos nesta prova. Apenas dois módulos servidos por overrideHTTP diferem entre os lados. O main recebeu um apêndice de instrumentação idêntico no servidor da fixture; nenhum arquivo main/runtime foi editado.

## Oclusão e falha conservada

Leitura offscreen dos **nove lotes cedar reais**, com mesmos transforms/câmera: máscara alpha de cor versus depth RGBA pelo adaptador existente, **zero pixels divergentes** em ambos. Baseline90240pixels de copa; candidato83883. A redução6367 é cobertura renderizada conjunta das árvores, não número de pixels do personagem recuperados. BloodCow:18meshes opacas,7017pixels de silhueta nos dois lados, zero divergência color/depth e **zero materiais adaptados**. Compilação GL/console/HTTP sem erro.

O gate de identidade de cor final passou para Aldric361/361, falhou para BloodCow356/361:5pixels mudaram,1com diferença máxima de canal113; erro absoluto médioRGB.240/255. Não reduzir o ROI/tolerância nem mudar o report para PASS. O review separado verifica as demais métricas já capturadas; não é reteste.

A fixture deixou um estado ambiental incompletamente normalizado: `combat-vfx.reset()` chama `leaves.reset()`, que reinicializa apenas `initialized`; `uTime/uBody/uVelocity` só mudam em `leaves.update`. Após reset/reposicionamento, a fixture não chamou `combatVfx.update(0,{playerPosition})`. Portanto câmera/luz/atores/árvores são iguais, mas **não afirmar que todos os uniforms ambientais estavam congelados em valores iguais**. Há842pixels distintos na região superior fora da copa frontal,466com diferença>16. Folhas são uma hipótese concreta para o resíduo, não causa confirmada por ablação. Nenhuma nova GPU foi aberta para esconder a falha; eventual correção dessa fixture pode ser avaliada separadamente, se necessária.

Aldric no snapshot é o GLB histórico0e5, corpoBLEND/depthWritefalse; o teste não o converteu em OPAQUE e não prova sua oclusão volumétrica. O live já usa5c por promoção Animation independente. A prova de depth usa BloodCow opaca. Não foram renderizados campo Horizon/casts: o modo com depth força o prepass já existente com um consumer de diagnóstico, sem volume VFX. Coerência de descarte não substitui gameplay de campo/cutaway/ator.

## Custo observado, sem matriz global

Chrome nativo/Metal,1440×900, high, mesmo cenário histórico. Contagem antes dos materiais auxiliares do probe:

| Medida | Baseline | Candidato |
| --- | --- | --- |
| Programas, cena sem prepass |77|77|
| Programas, com prepass existente |87|87|
| Draws/triângulos sem prepass |176 /510398|176 /510398|
| Draws com prepass |252|252|
| Prepass: draws/adaptados |76 /17|76 /17|
| Memória renderer sem prepass: geometrias/texturas |102 /44|102 /44|
| World: props/lotes/materiais/texturas |66 /46 /15 /30|66 /46 /15 /30|

Programas adicionais observados **0**, contra teto estrutural proposto≤2. Nenhum asset/material/lote/textura/passe de produção adicionado pelo candidato. A textura45 no modo depth é o target do prepass existente, igual nos dois lados.

TimerGPU `EXT_disjoint_timer_query_webgl2`:4warmups e8amostras sequenciais por variante/modo, zero disjoint. Medianas cena1.328→1.400ms; com prepass1.391→1.322ms. Intervalos sem prepass1.268–3.355 e1.265–3.267ms; com prepass1.306–1.458 e1.298–1.707ms. **Não são pares alternados**, amostra pequena; não inferir melhora/piora sustentada, FPS natural, custo móvel ou carga de campos. Números completos no review.

## Fechamento e preservação

Fonte histórica226 estável; live225 estável durante a janela e ledger byte-idêntico. Candidatos5c2132b6/e2c8f538 e pacote combinado23arquivos permanecem exatos. [Preflight](../../output/environment/canopy-transition-v1/native-preflight.json) e [recibo da janela](../../output/environment/canopy-transition-v1/gpu-window.json). Nenhum rebase, promoção, asset novo, movimento de sólido ou restart. O [lote153 promovido por Combat](combat-environment-pursuit-integration.md) não depende desta tentativa.

A ordem VFX05:37→Animationv1105:44:30→Environment foi respeitada. Aquisição por mkdir/token/PID; browser e HTTP efêmero encerrados, token próprio removido no finally. Combat recebeu início `msg_54efcbde370d` e encerramento `msg_293fdb2b14cc`; VFX recebeu liberação `msg_70bd24515117`. Nenhuma próxima GPU Environment planejada. Não sobrescrever dressing92ef com o antigo e2c8: se Root selecionar futuramente, rebase só do delta cedar em pacote separado, preservando cripta153.

## Histórico CPU05:18 — preservado

Estado 19/09/2026 05:18 UTC: **candidato CPU pronto, sem promoção e sem nova captura**. Pedido Root: diagnosticar o pontilhado nativo Physics04:52, mantendo árvore/placement/collider/budget e a revelação de personagens/ameaças. O pacote cripta+manutenção **9f6ebea2/153** continua congelado e independente desta proposta.

## Diagnóstico ligado à fonte

Revistos os dois originais 1440×900: [north-fixed-melee](../../output/playwright/2026-09-19T04-52-58-805Z-physics-pursuit-native/north-fixed-melee.png) e [north-moving-melee](../../output/playwright/2026-09-19T04-52-58-805Z-physics-pursuit-native/north-moving-melee.png). A copa frontal exibe uma grande faixa de pontos; os corpos estão visíveis nesses frames. Isso não demonstra que toda situação de ameaça esteja protegida.

O snapshot Physics usa os mesmos módulos de cutaway/dressing do live conferido: `e335279c` / `947c7cd9`. O fragment shader calcula os corredores câmera→player/ameaças/áreas e multiplica por altura. Aplica então `screenNoise < cutaway * .94` em **toda** a faixa de 1,7 m do foco (mais rampas de altura/ameaça/área). Resultado: mesmo com máscara 1, cerca de 6% dos fragmentos continuam escritos; valores intermediários produzem grandes superfícies parcialmente perfuradas. O ruído usa `gl_FragCoord`, portanto fica preso à tela enquanto o recorte e a geometria se movem. É uma causa direta no shader compatível com os originais; ainda falta a comparação nativa causal deste candidato.

Não foi encontrada aqui uma nova falha do compartilhamento depth: o helper atual chama `shareEnvironmentCutawayDepth` e ambos recebem o mesmo descarte. O defeito visual investigado é a distribuição da cobertura, não motivo para ignorar depth/oclusão de todos os materiais. A proposta mantém o material opaco com depthWrite e o mesmo prepass existente.

## Mudança concreta, somente dois módulos

Cópia: [canopy-transition-v1](../../output/environment/canopy-transition-v1/candidate-manifest.json). Baseline preservado ao lado. [Patch mínimo](../../output/environment/canopy-transition-v1/canopy-transition.patch), `git apply --check` passou **sem aplicar**.

| Módulo | Baseline SHA256 | Candidato SHA256 |
| --- | --- | --- |
| environment-cutaway.js | e335279cb687f6de4a9d203843f733ed9332d1cf9b0dcf94f2b7f66fe6e7fa73 | 5c2132b6f765aee1ddb78820f942fcbe119bb9bc9fcac2fdd98718ebf4c0d1cd |
| asset-dressing.js | 947c7cd94475663fadd456c628e44945b65d1057340525a8125b99ef699d7b91 | e2c8f538177a639a5fc09bc75ba6c080b7e2153f1ad7193e00f824d2923b70b4 |

Somente `cedar-tree` recebe `transition: 'canopy-contour'`. O código que constrói lotes, cores, escala, posição, geometrias e recursos não muda. Paredes/santuários continuam com `legacy`; shaders default de cor e depth são **byte-idênticos** ao baseline na construção CPU. A cripta selecionada não está neste overlay; sua futura integração preserva a classificação de cripta do pacote combinado e aplica apenas o delta cedar, nunca copia este dressing antigo inteiro sobre o combinado.

A variante usa isocontorno de máscara `.12`, com cobertura parcial numa borda de aproximadamente 1,5 pixels localmente, derivada de `fwidth(cutaway)`, limitada em amplitude a `.04`. O interior descarta 100%; o exterior fica opaco. O ruído anterior continua somente na borda estreita como cobertura, sem textura nova. Foco/ameaças/áreas/altura/limites e geometria dos corredores permanecem os mesmos. As bases sob a altura de recorte continuam visíveis.

**Compromisso explícito:** regiões antes fracamente perfuradas (máscara abaixo de aproximadamente `.08`) passam a opacas; regiões com máscara pelo menos `.16` ficam totalmente removidas. Isso deve trocar uma superfície pontilhada por uma abertura contínua, mas pode formar um contorno artificial ou uma abertura grande demais. Entrada/saída de ameaça na lista e movimento ainda podem produzir mudanças perceptíveis. Não há novo filtro temporal, blending global, material transparente nem modificação de sombras neste recorte. Seleção depende do par nativo; não é afirmação AAA.

## API proposta para Combat; pipeline inalterado

```js
installEnvironmentCutaway(colorMaterial, sharedUniforms, {
  threatLimit: 10,
  skillAreaLimit: 4,
  transition: 'canopy-contour', // apenas materiais cedar; default 'legacy'
});

// Assinatura e retorno já integrados permanecem iguais:
shareEnvironmentCutawayDepth(colorMaterial, depthMaterial);
```

A opção faz parte do binding e da chave de programa. O adaptador copia automaticamente o mesmo modo para o depth, junto aos mesmos uniform objects; não copia a pátina de cor. Idempotência permanece; tentar reusar um material com modo conflitante falha explicitamente. Atores não registrados continuam sem patch. Clipping, alphaTest, side, packing, skin/morph/displacement/instancing/batching preservados. `update(position, playing, threats, hazards, skillAreas)` permanece exato, sem argumento novo. Não há solicitação de edição de main/pipeline/scene-depth; Combat receberia apenas o mesmo adaptador, caso o candidato seja selecionado.

## CPU e orçamento

[CPU13/13](../../output/environment/canopy-transition-v1/cpu.json): construção de shaders standard/depth, legado exato, descarte color/depth idêntico, hooks/packing/clipping, transformações, identidade/expiração dos uniforms, atores opacos, cache/idempotência/conflitos, escopo cedar, cobertura analítica, arquivos permitidos e preservação.

Amostragem de referência 128×128 do ruído, **não pixels renderizados**:

| Máscara | Remoção baseline | Remoção candidato |
| --- | --- | --- |
| 0 | 0% | 0% |
| .08 | 7,56% | 0% |
| .12 | 11,26% | 50,05% |
| .26 | 24,46% | 100% |
| 1 | 94,06% | 100% |

Derivada de referência `.008`. O primeiro teste da borda detectou apenas precisão numérica CPU em `.12-.04`; a comparação de cobertura parcial passou a ignorar resíduos inferiores a 1e-10. Não houve alteração do candidato para esconder uma falha física/visual. CPU não compila GLSL e não mede GPU ou visibilidade de gameplay.

Orçamento estrutural: **+0 assets/texturas/geometrias/materiais/instâncias/lotes/uniforms/passes**. A árvore existente contém uma mesh e um material. Pode haver até duas variantes adicionais de programa (cor/depth), se árvores antes compartilhavam programa com paredes; contagem compilada e custo precisam de observação nativa. Há derivada e smoothstep adicionais no fragmento cedar; não afirmar custo zero ou ganho de FPS. Nenhuma busca/export de asset foi feita.

## Preservação e janela seguinte

[Manifesto de origem](../../output/environment/canopy-transition-v1/source-manifest.json): os **23 arquivos** do pacote combinado, inclusive manifesto/patches/tar/CPU, e os dois PNGs Physics permanecem byte-idênticos. Os **225 arquivos runtime** conferidos antes/depois não apresentaram drift; layout live143, nav911, contacts912c, pipeline, fontes e ledger preservados. 5173 observado no PID75665; sem restart. Não se alteraram as cópias a5f4/9e45 nem snapshots Physics.

GPU **não adquirida**. A reserva observada durante a preparação pertencia à GUI (`gui-ios-safari-v1`, PID20959); GUI/Physics/Lich/VFX preparados têm precedência por instrução Root, mesmo quando o lock ficar momentaneamente ausente.

[Plano do par focal](../../output/environment/canopy-transition-v1/native-plan.json): um A/B frozen1440×900 no recanto north-fixed, mesmos atores/árvores/luz/câmera/tempo, reproduzindo as posições reais registradas pelo Physics. O screenshot histórico não serializou matriz/trauma/aim da câmera; a câmera inicial será reconstruída a partir do main, e as **duas imagens novas** terão matrizes idênticas registradas. Não chamar isso reprodução pixel-idêntica do frame histórico. Usar snapshot Physics04:52 intacto por leitura, com overlay dos dois módulos em servidor efêmero próprio; não misturar combinado153, metadata Aldric5c ou Lich. Conferir GL/compilação, borda da copa, corpos, budgets e coerência color/depth. Nada de nova matriz72/whole-map.

Próximas escritas autorizadas: fixture/evidência e adendo deste handoff após coordenação; candidato permanece congelado até resultado. Aquisição atômica com token/PID e liberação somente própria em finally. Se a borda ficar pior ou esconder ameaça, preservar a tentativa e registrar o comparativo; não promover por CPU. A alternativa de composição por posição só seria proposta separadamente, sem mover os placements neste trabalho.

Coordenação: aviso único registrado para Combat via mailbox Orca, `msg_d074dc13bb62` às05:20:41UTC. Aceito para entrega; leitura não confirmada. Nenhum interrupt/reenvio. O documento durável acima é a referência de integração.
