# Environment combinado — cripta selecionada + manutenção a5f4

**Pacote novo em cópia, pronto e congelado para os gates coordenados; sem promoção/restart.** A [seleção Root da cripta](review/crypt-entrance-v1-selection.json) foi incorporada junto de somente dois placements da manutenção. [Pacote de sete arquivos](../../output/environment/crypt-maintenance-combined-v1/environment-crypt-maintenance-v1.tar.gz), [manifesto completo](../../output/environment/crypt-maintenance-combined-v1/manifest.json), [CPU8/8](../../output/environment/crypt-maintenance-combined-v1/cpu.json), [diff de descritores](../../output/environment/crypt-maintenance-combined-v1/descriptor-diff.json).

Diretório `output/environment/crypt-maintenance-combined-v1/payload/` contém **somente sete arquivos**. Não há snapshots222/main/server/Physics/Lich no payload ou arquivo compactado. Os candidatos isolados cripta b3ed6566, manutenção a5f4/9e45 e suas evidências permaneceram iguais por hash. Nenhum novo asset/refino/placement além da combinação autorizada. Nenhuma GPU ou rodada artística; a prova funcional integrada fica para janela após [Physics native](physics-pursuit-native.md).

## Composição exata e contrato físico

Layout combinado **9f6ebea2041910f829042ec14f177cfb26beee44ebcd9e5f5c11333d0c9c486c**,153colisores, arena55m/chão0. Os seis arquivos restantes são byte-idênticos aos da cripta selecionada. O layout difere da cripta por **exatamente duas linhas**, sem mudar sua versão/exports ou outros placements:

| ID | Cripta sobre runtime143 | Combinado = a5f4 | Atributos preservados |
|---|---|---|---|
|barrel-2|(17.2,14.6)|(16.6,11.6)|asset, largura1.2, yaw.5, raio.516, altura, cor e flags|
|fallen-beam-3|(19.7,14.3)|(20.2,14.3)|asset, largura2.4, yaw1.45, altura.16, dimensões e flags|

Comparação por ID/valor, não somente contagem: sobre cripta,0adicionados/0removidos/2alterados; sobre manutenção a5f4,11adicionados/1removido/3alterados da cripta selecionada; sobre runtime143,11adicionados/1removido/5alterados. Os11 são10partes do arco+flanco; removida a parede antiga; os5 existentes são porta,2rochas,barril,viga. Props não sólidos da cripta mantêm exatamente sua seleção prévia; nenhum outro prop, túmulo, árvore, cruz, cerca, chão ou bound mudou.

Render e colisores continuam consumindo `getEnvironmentLayout()` / `getEnvironmentColliders()` do mesmo módulo puro. Contatos do solo acompanham os placements automaticamente, sem editar ground3a8ca8 ou Surface-life. O contrato ThreeY de yaw, minY/maxY e flags de bloqueio permanece intacto.

## Provas CPU limitadas

Oito grupos passaram sem captura/GPU, com contacts912c real e fonte estável:

- Payload exato, apenas dois deltas e153IDs únicos; todos os descritores restantes comparados iguais.
- Quatro posições originais da fixture da cripta livres; aproximação da soleira e travessia frontal livres; porta fechada bloqueia corpo.64/projétil.25. Três lajes continuam não sólidas, y0/topo≤35mm.
- Entrada e saída originais da manutenção,35passos cada, e três tracks locais preservados. Cada resultado de `moveActor` coincide com a5f4 sob contacts912c; sem deslocamento/raio adaptado para passar.
- Duas consultas de **API de rota**, usando navigation candidato e46cc63f/attackRegion3.10/min2.36/LOS.9, retornam exatamente o mesmo objeto de rota que a5f4:14nós norte/74sul, waypoints/terminal/LOS iguais. Segmentos varridos livres. **Não foi repetido o caller/melee nativo**; os tempos3,50/7,35s pertencem à prova Physics isolada, não ao pacote combinado.
- Imports atuais de main/server encontram os mesmos exports; módulo importa em Node sem DOM/Three e devolve arrays frescos. Assinaturas de `createCemetery`, `loadAssetDressing`, `loadCemeteryLibrary` e `update(position,playing,threats=[],hazards=[],skillAreas=[])` preservadas; dependências da sobreposição resolvem para payload ou fonte live registrada.
- Nenhum asset/material/instância adicional. O conjunto de chaves de instancing é igual à cripta; a viga muda de célula para uma célula que já possui o mesmo lote. Budget artístico de origem permanece70props/48lotes/17materiais/32texturas/257180triângulos, contato544triângulos/umlote. **Igualdade por construção, não nova medição nativa combinada.**

Os222hashes runtime e os candidatos/evidências isolados foram reconferidos iguais. Isso não cobre horda, autoridade/rede, alvo móvel em gameplay, custoCPU/GPU/frame ou toda arena. Não há promessa de interior da cripta ou acesso universal do boss.

## Arquivos e patches mínimos

| Caminho no payload | SHA-256 |
|---|---|
|src/render/environment-layout.js|9f6ebea2041910f829042ec14f177cfb26beee44ebcd9e5f5c11333d0c9c486c|
|src/render/asset-dressing.js|92ef51b5e314e84d01d2f3aeab24fa07cc7da2b685eb01f7987c8a6cad3eabc0|
|src/render/environment-library.js|7664174bcdaeb92da0920184f1c4dc17ebf5e501e69867725ae7ccd62294ffa6|
|src/render/cemetery.js|bc6732abe788dce7b80c38cdfaec8873fdc756714e07e8b36f527f50a34018db|
|assets/environment/crypt-entrance-v1/crypt-root-arch.glb|c3a2e6f7b87e63275c1fad921a6ca68092dc3a1571d146f196b0d6de6ee3bf14|
|assets/environment/crypt-entrance-v1/crypt-flagstone.glb|b692a2db3097990772824f38913c8d91ad4a1be6e15c657accf596fc953823d7|
|assets/environment/crypt-entrance-v1/provenance.json|f6a2b988f4420bc7289930bea7c1af6a74a69d9c210633ae1c8a2746e3f540bc|

[Patch dos quatro módulos sobre live atual](../../output/environment/crypt-maintenance-combined-v1/patches/environment-combined-from-live.patch), `git apply --check` passou sem aplicar. Os dois GLBs+proveniência são arquivos novos já incluídos no payload. [Patch somente manutenção sobre cripta](../../output/environment/crypt-maintenance-combined-v1/patches/maintenance-only-over-crypt.patch), duas linhas, serve para cópia que já tenha a cripta selecionada. **São bases alternativas; não aplicar ambos.** Quatro patches individuais também disponíveis para revisão. O tar293576bytes possui exatamente sete entradas, cada conteúdo conferido contra o manifesto; SHA `e9570bccb5a4f2619f0fe43425e47df18039982090352c676acfc1b3d4ae5d80`.

Baseline live arquivado somente para os quatro módulos Environment; manifesto registra os222hashes sem copiar o snapshot. O `prepare.mjs` recusa sobrescrever o pacote e o verificador não altera runtime. Revalidar baseline na futura janela; nunca copiar os snapshots dos candidatos isolados.

## Próxima janela funcional e coerência cliente/servidor

**Preparação não depende de Lich.** Ordem solicitada Root: concluir nativePhysics em curso/preparação; depois testar o lote Environment+rotaBoss; promoçãoLich permanece separada. Environment não adquiriu lock nem lançou browser nesta tarefa.

Para a cópia funcional futura, Combat/Physics usam estes sete arquivos e seus próprios navigatione46cc63f + pequeno adapterBloodCow sobre o main então atual. Contacts912c permanece; não copiar main/server inteiros de snapshots. Server não recebeu alteração de política melee e conserva ranged conforme seu contrato.

Gates focais da combinação: confirmar que cliente e processoNode usam o mesmo hash153; repetir somente os cenários de aproximação/melee relevantes com a nova fonte e checar porta/soleira/manutenção por input, inclusive colisão/LOS e expiração se um campo for usado. A prova Physics com a5f4 não vira automaticamente prova do layout combinado. Câmera/arte setorial selecionadas não exigem novo A/B artístico. Caso surja defeito, limitar correção ao achado e manter evidência.

**Ainda não promover nem reiniciar5173.** Cliente pode carregar módulos frescos enquanto servidor conserva imports em memória; futura promoção geométrica precisa janela dos donos, sete arquivos/visuais+layout juntos e restart controlado somente por Combat quando autorizado. Baseline atual observado permanece layout8e756fe4/143, nav911e0ea2, mainafc7d5ac, server29bb, contacts912c;5173PID75665 e ledger7f580798 iguais. Fontes Environment prontas para QA, sem novas escritas previstas até achado concreto ou autorização de integração.

Avisos finais aceitos pelo mailbox: Physics `msg_8a3db2696c2e`, Combat `msg_801ebd3e3ab1`. Não se presume leitura/aceite nem reservaGPU confirmada. A ordem funcional após nativePhysics foi comunicada; nenhuma captura antecipada.
