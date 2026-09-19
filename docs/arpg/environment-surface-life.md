# Environment — superfície e vegetação baixa, seleção surface-life-v1

## Estado atual — três módulos promovidos e QA focal entregue

Autorização Root executada04:23, QA por input04:26 e aceite focal04:29. [Handoff final](environment-surface-promotion.md) contém baseline, três deltas exatos, HTTP5173, CPU6 e evidência integrada; fontes/GPU liberadas, sem restart. Layout143/nav911/contacts912c preservados. Abaixo permanece o histórico da seleção isolada03:16, sem transformar aquela fixture em prova de gameplay.

## Histórico03:16 — segunda iteração selecionada em staging

Fechamento para Combat: rodada final baseline03:16:18.321–03:16:19.198Z e candidato03:16:19.623–03:16:20.656Z; browser/servidor efêmeros e lock próprio encerrados no finally. O marco03:18 anterior era a publicação do documento. **Nenhuma nova captura surface-life necessária.** A fixture não executa o main do snapshot e não valida mainf4df/UI atual; importa os módulos Environment congelados. Os quatro PNGs abaixo são a entrega de seleção.

**Seleção Root confirmada:** [revisão](review/environment-surface-selection.md), quatro originais/hashes conferidos. Ground3a8ca80f/cemeteryef17cfbe/dressing947c7cd9 aceitos para futura integração coordenada, fora do lote canhão+contacts. Refino local moderado; limites de copa/repetição/caminhos mantidos. Não repetir A/B sem mudança.

[Manifesto/hashes](../../output/environment/surface-life-v1/selection-manifest.json), [resumo nativo](../../output/environment/surface-life-v1/native-summary.json). **Dois pares nativos passaram**, CPU5 atual passou, fontes congeladas estáveis e zero erros page/console/HTTP/request/GL. Chrome visível/Metal,1440×900, mesmos atores/câmera/luz por par. Os quatro originais foram conferidos; baselines da segunda rodada são byte-idênticos aos da primeira.

| Vista | Baseline143 | Candidato de superfície |
| --- | --- | --- |
| Jardim |[PNG](../../output/playwright/environment-surface-life-v2/surface-baseline-garden.png)|[PNG](../../output/playwright/environment-surface-life-v2/surface-candidate-garden.png)|
| Manutenção |[PNG](../../output/playwright/environment-surface-life-v2/surface-baseline-maintenance.png)|[PNG](../../output/playwright/environment-surface-life-v2/surface-candidate-maintenance.png)|

Leitura própria: terra mais quente entre os props, transição e contatos menos uniformes; mudanças de vegetação são pequenas na câmera ARPG. Refinamento moderado, não grande salto artístico/AAA; copa pontilhada e repetição legada continuam presentes. Primeira tentativa produziu solo claro/liso demais: preservada em `iteration-1/` e `output/playwright/environment-surface-life-v1/`, rejeitada por Environment antes da seleção. Segunda versão usa luminância/detalhe do terreno original como base, evitando a mancha clara. **Ground atual:3a8ca80fbd3a96f1e98101cbd2c5e6ca4fec9b15276bfeef1775fbc729f06f15**; demais dois hashes abaixo inalterados.

Orçamento observado idêntico nos dois lados:66props,46lotes,15materiais,30texturas,249683triângulos do dressing; contato528triângulos/um lote. Cena: jardim137draws/501965triângulos, manutenção144/559563; memória chega a46geometrias/47texturas em ambos. Não é medição de GPU-time/FPS. Posições/bounds de todo sólido e demais placements não autorizados comparados iguais;14decorações com topo≤.30m e base y0.

GPU adquirida somente após receipt density143 de Physics completar seis casos e seu finally encerrar recursos; liberada pelo token próprio em ambas as rodadas. Nenhuma próxima captura de superfície prevista. **Runtime Environment/layout/nav/assets/5173 intactos; aguarda seleção root, sem promoção automática.** Próxima investigação de passagem tem staging/documento separados.

**Em staging próprio, sem promoção.** Pedido Root e [revisão dos originais02:43](review/environment-gui-followup.md) incorporados. A entrega integrada anterior depth/custo está concluída e liberada em [environment-handoff.md](environment-handoff.md), com21CPU/7gates/8nativos. Este novo candidato não altera essa fonte aprovada no escopo.

## Direção e limites

Jardim: solo de terra escura entre túmulos, musgo em ilhas nas bordas e faixa irregular de pedra gasta; flores/raízes menores e assimétricas nas margens. Manutenção: terra seca e pó junto às vigas/barris, transição irregular para pedra e vegetação rente ao chão. Cor/albedo, rugosidade e intensidade do normal variam apenas nos dois conjuntos; eixos e centro mantêm proteção explícita. A cripta mantém sua composição anterior.

O pontilhado verde da copa recortada visto pela root não é textura de chão; o cutaway dessa copa continua intacto. Nenhum sólido, árvore, cerca, túmulo, fonte de luz, passe global ou posição de ameaça/câmera foi modificado. Cruz/headstone repetitivos de main não fazem parte deste staging. Não apresentar este refino de chão como correção completa da direçãoAAA.

## Mudanças isoladas

Diretório [surface-life-v1](../../output/environment/surface-life-v1/), baseline/candidato congelados antes de editar. Apenas três módulos candidatos diferem:

- `candidate/src/render/environment-composition-ground.js`: terra/musgo/pedra com máscaras de baixa frequência e faixa de desgaste; rugosidade e normal atenuado localmente. Compartilha a textura de pedra já carregada, não cria mapa novo. Mancha de contato irregular mais escura sob props dos dois conjuntos; mantém528triângulos/um lote.
- `candidate/src/render/cemetery.js`: passa ao shader a referência do `stoneColor` existente; restante byte a byte preservado.
- `candidate/src/render/asset-dressing.js`:14overrides de decoração existente:4raízes,4grupos de cogumelos,3roseiras,3oferendas. Mesmos assets/contagem/materiais; tintas por instância. Raízes5–5.5cm, cogumelos8.5–14cm, roseiras24–30cm; todos sem collider e com aparência baixa atravessável. Posições/altura completas em `cpu.json`.

**Layout143 `8e756fe4…` e navigation `911e0ea2…` byte-idênticos**, assim como os restantes arquivos do snapshot, assets originais, exportados e runtime Environment. Não promover snapshots/main/server/Physics. Fonte de acervo: derivados já inventariados `root-border`/`mushrooms` de Tunnel e `rose-bush` de Harbor em [proveniência](../../assets/environment/cemetery-v1/provenance.json); nenhuma variante GLB/export nova necessária.

## Orçamento e prova atual

[CPU pequena](../../output/environment/surface-life-v1/cpu.json): **5checks passaram**, preservação de escopo/fontes/assets, layout/nav, limites da decoração, referência de textura/chunks e malha de contato. Isso não prova compilação GLSL ou aparência final.

Orçamento previsto: **66props/46lotes/15materiais/30texturas de dressing**,249683triângulos instanciados; contato1lote/1material/528triângulos. Zero textura/material/GLB/placement adicional. A textura de pedra compartilhada acrescenta um sampler/leitura ao material do chão, sem novo armazenamento. O custo adicional de shader ainda não foi medido; não reutilizar a medição anterior como seu custo. O A/B de seleção só coleta contagens/erros, sem nova matriz extensa.

## Histórico — preparação antes da janela GPU

**A/B nativo ainda pendente.** Duas vistas pareadas, jardim/manutenção,1440×900, mesma câmera ARPG/iluminação/atores estáticos/tempo por par. Reutiliza fixture de composição com headstones estáticos; não altera main. Runtime143 e física911e0ea2 idênticos por construção; apenas os três módulos acima mudam.

Runner pronto: `output/environment/surface-life-v1/native.mjs`. Aguardar encerramento da janela anunciada Combat e das comparações Animation/Physics; lock livre sozinho não substitui essa coordenação. Depois reservar atomicamente com owner/token e liberar em finally. **Sem GPU solicitada durante a prioridade dos pares, sem promoção automática.** Entrega final incluirá quatro PNGs originais/hashes para seleção root, limites e orçamento observado. Servidor5173/ledger não serão operados.

Coordenação03:02UTC: mensagem única mailboxOrca `msg_904b0e8c3479` aceita para Physics, solicitando somente aviso de encerramento após seu A/B143. Sem filaCodex, input de TUI, interrupt ou reenvio. Animation já publicou liberação; Physics ainda tem prioridade. A aceitação do mailbox não é confirmação de leitura nem permissão de antecipar a janela.

Conferência03:05UTC: Combat encerrou checkpoint Environment/JEF03:00 e reiniciou5173 por sua própria autoridade; serviço observado PID18430, ledger `7f580798…` inalterado. Layout143 e navigation911e0ea2 ainda exatos. Animation publicou liberação, mas o A/B143 de Physics continua pendente de coordenação no documento daquele dono; Environment não antecipou a ordem GPU solicitada. **Quatro PNGs/compilação GLSL/seleção visual permanecem pendentes**, não aprovados pela CPU5. O novo achado estacionário dwarf/visited2 no checkpoint Combat é separado do caso boss/visited1 resolvido e continua com Physics; este staging não altera navegação para contorná-lo.

SHA-256 candidato inicial CPU:

| Arquivo | SHA-256 |
| --- | --- |
| asset-dressing.js |947c7cd94475663fadd456c628e44945b65d1057340525a8125b99ef699d7b91|
| cemetery.js |ef17cfbe3eda058ac88250a063a60346b2d1b449ee1d9e847fd774b1a9f27ae5|
| environment-composition-ground.js |1f52aa5d14a77fbb716d500da4f5b4cc56559f6c08196ecf6bbbd86dfd415075|
