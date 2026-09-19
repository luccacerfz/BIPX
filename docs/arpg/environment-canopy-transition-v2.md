# Copas v2 — uma alternativa em cópia, somente CPU

**Adendo06:44:** a autorização posteriorRoot foi executada em outro pacote, com rebase mínimo sobreliveebb8/dressing92ef. [Par nativo, amostra próxima e limites](environment-canopy-transition-v2-native.md):8gates técnicosPASS, candidato ainda emstaging; shader977548 preservado, dressing rebased1edbc6. O documento e artefatosCPU abaixo registram a etapa anterior, sem reatribuir prova às suas cópias históricas.


Pedido Root incorporado: mensagem `msg_3cf8643b8ce5` (05:56:46UTC, revisão Root05:57). **V1 não selecionado**: remove pontos, mas deixa grande contorno duro. Esta entrega contém uma única alternativa v2 e correções de preparação da fixture. **Sem GPU, promoção, rebase live153, novo asset ou placement.** Prioridade dos próximos testes continua VFX/Animation/SFX/Combat.

[Manifesto/hashes](../../output/environment/canopy-transition-v2/candidate-manifest.json) · [CPU13/13](../../output/environment/canopy-transition-v2/cpu.json) · [patch sobre a cópia v1](../../output/environment/canopy-transition-v2/v2-over-isolated-v1.patch).

## Limitações de v1 registradas

A fixture05:45 chamou `loadHeroVisual(...height:2.4)`. O caller real é `main.selectCharacter` → `loadPlayableCharacter('warrior')`, cujo perfil em `src/assets/playable-characters.js` fornece **2.7**. O herói na comparação ficou0.3m menor (~11%); **não era reconstrução fiel do herói atual**. A igualdade de pose/câmera entre os dois lados não elimina esse erro de escala. Os PNGs, hashes e reportFAILED de v1 continuam preservados; não atribuir ao novo harness os resultados antigos.

A hipótese ambiental sobre os5pixels de cor divergentes da BloodCow continua **não isolada em GPU**. CPU com o módulo real `createLeafAtmosphere` reproduziu que `reset()` deixa `uTime/uBody/uVelocity` anteriores; depois `update(0,0,position,...)` os normaliza. Isso confirma o mecanismo da fixture, não que aquelas diferenças de imagem vieram exclusivamente das folhas.

## Alternativa: abertura em perspectiva com borda de folhagem

V1 usava corredor de largura fixa em metros e uma rampa de altura1.6–2.8m. Em primeiro plano, o corredor ocupa uma grande região projetada; a rampa pode recortar vários volumes da copa na mesma altura. A alternativa trabalha esses dois fatores, sem alterar a árvore ou a câmera:

1. **Abertura proporcional à distância até o alvo.** Para cedar, raios interno/externo de foco, ameaça e área são multiplicados pela fração ao longo do raio câmera→alvo (`max(along,.02)`). Mantém os raios de referência no plano do alvo; reduz o tamanho excessivo em primeiro plano. Nenhum raio físico, ataque, collider ou dado de gameplay muda.
2. **Proteção do pé da árvore, abaixo da copa.** A rampa visual cedar passa a0.35–1.15m. Acima de1.15m, a altura deixa de cortar a copa por um plano global; o limite vem principalmente da abertura em perspectiva. Contato abaixo de0.35m fica intacto. É uma escolha visual a verificar nativamente, não garantia de preservação de toda silhueta de tronco.
3. **Pequenas curvas estáveis na borda.** Duas ondas suaves em coordenadas mundiais modulam apenas o isocontorno entre.04 e.20. Sem relógio/textura/ruído por pixel na forma. A franja de cobertura continua estreita, aproximadamente1.5pixels localmente, com amplitude limitada. Máscara≥.24 tem interior totalmente removido; máscara0 nunca abre pixels.

Exemplo analítico do raio externo4.2m do foco, não medida de imagem:

| Fração câmera→alvo | Corredor fixo anterior | Abertura v2 |
| --- | --- | --- |
| .25 |4.2m|1.05m|
| .50 |4.2m|2.10m|
| .75 |4.2m|3.15m|
| 1.00 |4.2m|4.20m|

O objetivo é uma abertura menor e menos lisa na copa frontal, mantendo interior limpo. **Ainda é um recorte de geometria:** pode revelar superfícies internas, parecer uma borda ondulada artificial ou interferir na leitura em outros ângulos. Curvas matemáticas não equivalem a folhagem convincente. Não há imagem/seleção de v2 nem promessa de suavidade temporal.

## Escopo e API

```js
installEnvironmentCutaway(material, sharedUniforms, {
  threatLimit: 10,
  skillAreaLimit: 4,
  transition: 'canopy-lobed-aperture', // somente cedar
});
// Default continua 'legacy'; assinatura já integrada não muda:
shareEnvironmentCutawayDepth(colorMaterial, depthMaterial);
```

Cor e depth compartilham o mesmo cone, borda e uniform objects. Pátina anterior do color, hook próprio do depth, clipping/alpha/side/packing, transformed/morph/skin/displacement/instancing/batching preservados. Atores sem registro permanecem opacos e sem patch. Shader default legacy em standard/depth é byte-idêntico ao baseline, inclusive para paredes/santuários/cripta. `update(position, playing, threats, hazards, skillAreas)` e seletores/limites permanecem iguais.

**A cópia de dressing ainda é a referência histórica de v1.** Ela difere do dressing v1 somente pelo identificador do modo cedar. Não é payload de promoção nem rebase aprovado para o atual92ef/cripta153. O patch passa `git apply --check` apenas sobre `output/environment/canopy-transition-v1/candidate`, sem aplicação. Se futuramente selecionado, o dono fará outro pacote com somente os deltas necessários sobre a fonte atual; nunca copiar este dressing inteiro para live.

| Arquivo candidato | SHA256 |
| --- | --- |
| environment-cutaway.js |977548e0bc9ae95d64a12bae07d92bdf4edc2bbac816dda05fe11bab241e1aec|
| asset-dressing.js |00c3d20f51ffafb183d0252720b18e5acd21595a0d582419adaaa47844e81b25|

## Harness futuro corrigido em CPU

[Apêndice preparado](../../output/environment/canopy-transition-v2/harness/future-fixture.js) · [gates estritos](../../output/environment/canopy-transition-v2/harness/strict-gates.mjs) · [plano sem janela autorizada](../../output/environment/canopy-transition-v2/future-native-plan.json).

- Usa `loadPlayableCharacter('warrior',...)`, o mesmo caminho do caller, e exige `runtimeHeight===2.7` nos dois lados; não repete o default2.4 da library.
- Faz spawn no tempo0 e depois fixa o tempo visual3.0348; evita transformar a passagem de tempo antes do spawn em outro HP de label.
- Após reset/reposicionamento, chama `combatVfx.update(0,{playerPosition})`; registra e exige folhas visíveis, `uTime=0`, `uBody` na posição congelada e `uVelocity=0`. Estado ambiental deve ser idêntico no par. Não esconde folhas para passar gate.
- Mantém ROI **19×19**, mesmas coordenadas, todos os bytesRGBA idênticos, sem tolerância/exclusão. Teste CPU confirma que um byte alterado, altura2.4 ou tempo ambiental residual reprova. Câmera/luz/poses/instâncias continuam comparadas.

Não existe runner ou reciboGPU novo nesta pasta. O apêndice foi somente analisado sintaticamente junto ao main histórico; normalização real de folhas foi testada em Node sem renderer. Fonte/GLB/metadata do futuro par precisam de manifesto explícito antes de execução autorizada. Corrigir altura não converte o material histórico Aldric0e5 em5c nem torna v1 prova do runtime atual. Ambos os lados de eventual A/B deverão usar o harness corrigido; PNGs05:45 não servem como baseline idêntico.

## Validação, orçamento e preservação

CPU13/13: legado exato; shader/binding color-depth; hooks/uniforms/expiry; atores opacos; escopo cedar;36raios amostrados dos discos interiores de player/ameaça/área em quatro profundidades; contato/altura; borda contínua/interior; normalização real de folhas; caller2.7/gates estritos; sintaxe; preservação. São testemunhos analíticos de discos internos, **não teste de todos os vértices/poses dos atores**, compilaçãoGLSL, arte, campo Horizon ou custoGPU.

Budget estrutural: **+0 assets/texturas/materiais/geometrias/instâncias/lotes/uniforms/passes**, limites10ameaças/4áreas intactos. Até2 variantes de programa se houver separação de programas anteriormente compartilhados. Duas avaliações seno e multiplicações dos raios por profundidade acrescentam trabalho de fragmento; fwidth/cobertura já existiam em v1. Custo e contagem compilada de v2 não medidos. Não transferir77/87programas ou timings nativos de v1 para v2.

Os20arquivos da pasta v1 e os23do pacote combinado permanecem byte-idênticos. Live230arquivos sem drift durante o preparo/CPU; environment layout9f6e153/dressing92ef/nav e46 preservados, ledger igual. Servidor5173 observado noPID5973, reiniciado anteriormente pelo dono Combat; nenhum restart desta frente. Atualizações live de GUI/server/Dwarf de outros donos não são desta proposta. Nenhum lock/browser/GPU aberto. Candidate congelado para leitura; sem outra alternativa, refinamento adicional ou captura agora.
