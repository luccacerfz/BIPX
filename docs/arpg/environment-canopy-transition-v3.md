# Copas v3 — alternativa de contorno, somente CPU

A melhoria local v2 foi [integrada por seleçãoRoot](environment-canopy-v2-promotion.md). Esta continuação autorizada está em **nova cópia** `output/environment/canopy-transition-v3`, com duas árvores de232arquivos da fonte pós-promoção. Somente **um módulo shader** difere; dressing1edbc6, layout153, API, assets, poses e opacidade dos atores permanecem iguais. Não altera o v2 selecionado nem suas evidências.

[Manifesto/proveniência](../../output/environment/canopy-transition-v3/source-manifest.json) · [patch mínimo](../../output/environment/canopy-transition-v3/v3-over-selected-v2.patch) · [CPU12/12](../../output/environment/canopy-transition-v3/cpu.json) · [plano nativo preparado](../../output/environment/canopy-transition-v3/native-plan.json).

## Hipótese e autoria delimitada

V2 combina os corredores de foco/ameaças/áreas por `max`. Quando máscaras com inclinações diferentes se encontram, essa escolha pode introduzir uma quina no contorno. O formato da malha recortada e a ondulação em coordenadas mundiais também podem contribuir. **É diagnóstico estático de um mecanismo possível, não isolamento da causa de todos os ângulos vistos nos PNGs.**

Uma única alternativa preparada:

1. Apenas no modo cedar, combinar máscaras por `a + b - a*b`. Para entradas[0,1], a união permanece nesse intervalo, preserva zero e um, não reduz a maior máscara e não abre pixels fora de todos os corredores. A união é independente da ordem. O raio em perspectiva e os limites de profundidade permanecem iguais.
2. Reduzir amplitude da modulação do contorno de.08 para.025 e reduzir as frequências das duas ondas mundiais. Faixa da borda passa de.04–.20 para.095–.145. As duas avaliações seno já existiam; sem relógio, textura ou ruído novo. Mantém interior removido, contato da base e franja estreita baseada emderivadas.
3. Usar exatamente a mesma combinação em cor e depth. O modo `legacy` em paredes/cripta gera shaders byte-idênticos à versão selecionada. Pátina e hooks próprios, clipping/side/alpha/packing, instancing/transformed e uniform objects permanecem preservados. Atores sem binding continuam opacos e sem adaptação.

**Tradeoff registrado:** a união pode aumentar a área aberta nas sobreposições. Máscaras individuais.1 dão.19 com duas,.3439 com quatro e.6513215599 com dez; no `max` continuariam.1. Nenhum suporte externo de corredor é acrescentado, mas a folhagem dentro da sobreposição pode desaparecer mais. Isso precisa de julgamento artístico; a propriedade matemática não garante borda natural, integração da malha ou ganho de performance. Não promover automaticamente.

## Hash e orçamento

| Arquivo | Baseline integrado | Candidato CPU |
| --- | --- | --- |
| `src/render/environment-cutaway.js` |977548e0bc9ae95d64a12bae07d92bdf4edc2bbac816dda05fe11bab241e1aec|04f3a377ad2dcfc1071788ecb0084d5a8b2028d8a3453ddaaf8a0882ec3dd49a|

PatchSHA256 `7e7855e370b1cc41caa9b4bb15ac3b2c438eb1340020fe0b3d50d7c497cad81e`. O dressing continua **1edbc66c**, byte-idêntico ao live. Modo público `canopy-lobed-aperture` e assinatura do adaptador não mudam; chave do programa identifica a proposta v3.

Budget estrutural: **+0assets/texturas/uniforms/materiais/geometrias/instâncias/lotes/passes**,10ameaças/4áreas mantidos. `max` torna-se multiplicação/soma nas mesmas iterações; mesmas duas chamadas seno. Nenhum custoGPU ou programa compilado medido para v3; não transferir80/92 da prova v2 como resultado desta candidata.

CPU12/12 confere shader legado, paridade de patch cor/depth, hooks/clipping/transformações, uniformes/expiry/ator opaco, propriedades da união/zero/ordem, um exemplo analítico de quina, núcleo/borda/base, contrato da nova fixture, gates estritos que rejeitam um único byte ou drift de retículo/UI/folhas, trajeto estático, sintaxe/patch e preservação. O exemplo analítico reduz salto de derivada~2 para~.00002 com passo1e-5; isso **não é avaliação visual**. GLSL/render/temporalidade continuam pendentes.

## Próximo recorte nativo preparado, ainda sem GPU

[Fixture](../../output/environment/canopy-transition-v3/motion-fixture.js) · [driver sem abrir browser](../../output/environment/canopy-transition-v3/motion-driver.mjs) · [gates originais](../../output/environment/canopy-transition-v3/strict-gates.mjs).

Um único enquadramento norte1440×900, baselinev2 versus v3; uma trajetória curta1.2s por lado,73amostras a1/60. Câmera e foco/herói fazem ida/volta60cm emX, de18.933 até18.333 e retorno, com curva cosseno contínua. Poses são fixas, herói pelo loaderreal2.7 e BloodCow; clocks ambientais normalizados. **É movimento controlado de câmera/foco/raiz, não gameplay por input, caminhada/locomoção validada ou avaliação de pés.** A consulta estática com `kind:'actor'`, raio.64, altura2 do corpo atual encontrou zero contato nos72segmentos; não substitui simulação da horda.

O painel será fechado pelo **botão real “Dispensar dica”**, depois dePlay. O driver exige `hidden` e a preferência gravada pelo handler normal; não seta CSS/atributo/storage para esconder o painel. Retículo mantém mesh/material nativos, recebe `pointerWorld`/posição normalizados a cada amostra e entra na comparação estrita. Folhas seguem visíveis520, time0/velocity0/bodyatual; hashes deorigens/seeds agora também são registrados.

Os gates **RGBA19×19 integrais continuam byte-idênticos**, agora em cada amostra correspondente, além de câmera/luz/atores/árvores/folhas/retículo/UI. Fonte do gate anterior foi copiada sem alteração. Cor/depth das batches reais e controle opaco no meio do percurso; draws/programas/memória, sem benchmarktimer/matrizglobal. Vídeo nativo do contexto deve ser preservado com preroll; driver registra tempos e recusa declarar1× se duração/pacing não passarem. Nenhum vídeo foi produzido ainda.

Driver exige recibos de liberação Combat/Animation/Brute e token atômico próprio fornecido pelo futuro runner. **Não abre browser, HTTP nem lock sozinho.** Brute comunicou encerramento06:50:34, mas a janela Animation e o dono atual devem ser reconciliados antes de executar. Não antecipar reserva nem usar lock livre como autorização de ordem. Sem promoção automática do refinamento.

## Preservação

563arquivos históricos protegidos e232live pós-integração permaneceram iguais durante autoria/CPU, incluindo v1FAILED, v2CPU/nativo, recibo da promoção ecombined153. Ledger preservado. A tentativa inicial do verificador tratou `sweepStatic` comoobjeto em vez de aceitar null; apenas o verificador foi corrigido. Consulta conservadora2D anterior preservada, seguida da consulta explícita actor/altura2. Nenhuma alteração de Physics/raios/planner/caller.

Fontes v3 congeladas para leitura. Somente preparoCPU concluído; sem novo render/GPU, restart5173, asset ou escrita runtime depois dos dois arquivos v2 selecionados.
