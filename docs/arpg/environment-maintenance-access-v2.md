# Environment — abertura física da manutenção, variante separadaa5f4

**Staging congelado; candidato Physics resolve as duas origens focais em cópia. Sem promoção;9e45 preservado.** Candidato em `output/environment/maintenance-access-v2/`. Baseado no [certificado Physics](physics-maintenance-boss-approach.md), lido integralmente após publicação; cópias dos witnesses/documento/recibo arquivadas em `physics-witness/`. Nenhuma edição runtime/Physics/main/server ou mudança de raio/ataque/planner/budget.

[Manifesto/hashes](../../output/environment/maintenance-access-v2/selection-manifest.json) · [patch de uma linha relativo a9e45](../../output/environment/maintenance-access-v2/maintenance-access-v2.patch) · [preservação focal](../../output/environment/maintenance-access-v2/preservation.json) · [nativo](../../output/environment/maintenance-access-v2/native-summary.json).

## Atualização Physics — duas origens chegam ao melee em cópia

[Contrato e resultado Physics](physics-pursuit-terminal.md), [recibo/hashes](../../output/physics/pursuit-terminal-20260919/receipt.json) e [caller focal final](../../output/physics/pursuit-terminal-20260919/2026-09-19T04-23-55-358Z-candidate-a5f4-focal.json) lidos. **a5f4 permanece exato e não exige nova abertura para esses dois casos.** Com contacts912c, navigation candidato `e46cc63f…` e adapter BloodCow `c0fbc03b…` sobre mainafc, o caller literal offline produz melee em **3,50 s norte / 7,35 s sul**, sem tiros/relocalização; LOS livre e fonte estável. Máximo14/74 nós por plano, maiores passos.1275m. Baseline nas mesmas fontes continua0hit/30s.

A opção `attackRegion:{range:3.10,minDistance:2.36,losY:.9}` usa16poses determinísticas e conexões limitadas; não contém coordenadas do mapa nem altera alcance de dano. Trocar somente arrival2.44→3.10 não bastava. Negativos9e45/parede/barreira baixa continuam0hit; quatro walkers e tiro oeste servidor.30s preservam resultados e rotas exatos. Recibo e hashes dos artefatos conferidos por Environment, sem rerunCPU/72/GPU.

**Dependência explícita:** abertura a5f4 + navigation candidato + adapter Combat. Não transfere o sucesso ao layout143/nav911/mainafc sem adapter ainda em runtime. CustoCPU/frame, horda, alvo móvel em gameplay e multiplayer permanecem fora da prova. O ramo melee servidor possui política distinta; ranged preservado não equivale a melee servidor validado.

Seleção artística Root já registrada em [maintenance-access-v2-selection.json](review/maintenance-access-v2-selection.json). Fontes Environment9e45/a5f4 reconferidas e congeladas; nenhuma promoção ou novo placement. Integração futura depende de seleção/janela Root/Combat dos três componentes, sem copiar snapshots main/server/Physics. Surface-life já foi promovido separadamente; cripta153 é outra proposta isolada e não faz parte desta combinação.

## Histórico04:16 — freeze para análise do objetivo terminal

Confirmação em `2026-09-19T04:16:14.109669+00:00`: Root leu este handoff completo e aceitou a separação entre abertura física e falha residual do caller. **a5f4 e9e45 reconferidos por hash e congelados.** Nenhuma repetição72/GPU, novo placement ou promoção runtime enquanto Physics analisa candidato bounded de objetivo terminal/alcance/amostragem em cópia. Sem grade global menor ou novo cenário. O par focal aguarda seleção visual Root; Surface-life continua selecionado para futuro lote coordenado. Environment não inicia novo CPU/GPU durante essa análise.

## Único placement adicional

`barrel-2`: **(15.8,12) → (16.6,11.6)**, +.8m leste e−.4m norte, junto ao estoque. Escala, yaw.5, asset, material, círculo raio.516 e altura intactos. Visual e collider derivam do mesmo módulo. A viga fica em(20.2,14.3), exatamente9e45; todos os demais placements permanecem.143colisores/arena55/y0, nenhum asset removido/adicionado.

SHA-256 candidato: **a5f46359e489f154618230bc66620a9c0598d0c4dc26a41386b87e700957a010**. Baseline congelado9e45b0c2ddb41e125c225e35083d7ed308fc8151357f8b7fbf845196b6371d40. A diagonal evita encostar demais no barrel-0 ao buscar margem além do limiar tangente de Physics. Superfície selecionada será igual nos dois lados da revisão focal, sem reabrir composição.

## Histórico04:04 — resultado físico e limite do caller separados

[Geometria e witnesses](../../output/environment/maintenance-access-v2/geometry.json). Mesmo corpo BloodCow raio1.72, altura2, player(18.933,14.268)/raio.64, pose melee Physics(16.183,14.418000000000001), distância2.7540879 e LOS real livre. Starts efetivos originais, incluindo correção sul.94m já arquivada; nenhuma nova correção/teleporte.

| Par oeste |9e45|a5f4|Folga total além do diâmetro3.44 |
|---|---:|---:|---:|
|cross-37/barrel-2|3.063117m|3.956165m|.516165m|
|headstone-3/barrel-2|3.285512m|4.111695m|.671695m|
|headstone-11/barrel-2|3.551544m|4.440090m|1.000090m|

A API de navegação **inalterada**, consultada explicitamente à pose melee, agora encontra trajeto em9nós norte/65sul;9e45 falhava768. Witness contínuo adicional via entrada(14.4,12.8), varrido com corpo real,69passos norte/160sul, velocidade2.55×dt.05, sem movimento cortando sólido. O ponto-guia é somente prova geométrica, nunca foi injetado no caller. Trecho entrada→pose tem margem amostrada mínima.131084m, amostras separadas por no máximo.02m. Pela distância assinada1-Lipschitz, a folga contínua conservadora é pelo menos.121084m nesse trecho; trajetos externos ainda passam por folgas menores herdadas (.023741m norte e.000010m na origem sul original). Não declarar toda a rota confortável pela distância entre dois sólidos.

**O caller offline ainda não se aproxima.** [Dois casos reais congelados](../../output/environment/maintenance-access-v2/2026-09-19T04-04-09-198Z-candidate-boss-inverse.json):0movimento/0hit30s,43planos,768máximo nas duas origens. Objetivo player/arrival2.44/grade1.25 continua sem nó terminal adequado. Abertura física e conexão a uma pose válida agora existem; não é correto chamar o zero movimento restante de barreira fechada. Nenhum grid/arrivalRadius/ataque/budget alterado. **Não ampliar72; encaminhar essa causa residual a Physics/Combat.**

CPU executada em janela curta com lock atômico próprio após liberação Physics/Combat, sem GPU/benchmark. Contacts direto/transitivo290a, nav911 e main455/server29bb congelados como no diagnóstico; não misturar912c nem alegar runtime atual.

## Preservação focal concluída

[Cinco callers](../../output/environment/maintenance-access-v2/2026-09-19T04-04-57-080Z-candidate-preservation-inverse.json): quatro walkers capturados mantêm melee/LOS, norte2.55s cliente/servidor e sul2.60/2.65s; serverBloodCow oeste continua1shot/hit.30s da mesma posição real(12.999156710361104,11.936954817748697), LOS livre. Sem novo spawn/relocalização. [Rotas do player](../../output/environment/maintenance-access-v2/preservation.json): entrada/saída e três tracks locais originais de9e45 continuam livres, com raio.64 e passos reais, sem mudar o trajeto para acomodar a nova variante. Todos os demais placements/atributos exatos e9e45 original preservado. **Somente2casos boss +5callers de preservação; nenhum rerun72.**

## Histórico04:07 — revisão visual focal, posteriormente selecionada por Root

Um par nativo no recanto,1440×900, Chrome visível/Metal,04:07:06.566–04:07:08.501UTC; mesma câmera/luz/atores estáticos/tempo e os três módulos Surface-life selecionados. **215fontes servidas diferem apenas no layout**, snapshots estáveis e zero page/console/HTTP/request/GL errors. Ambos os PNGs originais examinados.

|9e45 + Surface-life selecionado|a5f4 + mesma superfície|
|---|---|
|[Baseline original](../../output/playwright/environment-maintenance-access-v2/boss-access-baseline-pocket.png)|[Candidato original](../../output/playwright/environment-maintenance-access-v2/boss-access-candidate-pocket.png)|

O barril se agrupa mais próximo ao estoque superior, com contato y0 e sem apagar sua identidade; a entrada oeste continua clara. Viga e demais props/decorações/solo não mudam. Copas pontilhadas, regularidade de cruzes/caminhos e limite do material de piso permanecem. Não AAA; não é captura de gameplay ou revisão de movimento.

Orçamento igual:66props/46lotes/15materiais/30texturas,249683triângulos dressing; contatos528triângulos/um lote. Frame focal127draws/521058triângulos,45geometrias/47texturas nos dois lados. Zero novoasset/material/textura/luz/passe/instância. **Não houve benchmark GPU/FPS.** Lock atômico próprio e recursos efêmeros liberados em finally às04:07:08; nenhuma próxima captura prevista.

## Histórico da entrega anterior ao candidato terminal Physics

Physics recebeu atualização única `msg_85da79aa0a44` em04:06, com fonte a5f4 e separação entre barreira aberta e chegada do caller ainda falha. O recorte já permite revisar a causa residual de objetivo/amostragem; não mover mais cenário ou ampliar72 para esconder esse resultado. Contacts290a/nav911/main455/server29bb congelados e transitivos alinhados em ambas as variantes; integração912c/main atual permanece gate separado.

Runtime Environment8e756fe4/ec488add/2d512097/d9335c23 continua preservado por hash, assim como9e45 e todos os originais. Servidor5173/PID75665 permanece ativo e não foi operado por Environment; ledger7f580798…igual. O patch é relativo ao candidato9e45, **não ao layout143 live**; um futuro lote aprovado deve conferir baseline real e usar somente módulos Environment autorizados, nunca snapshots main/server/Physics.

Próximos gates: seleção Root deste único par, análise Physics/Combat de objetivo melee alcançável com semântica real e gameplay integrado. O requisito de ameaça BloodCow pelo caller offline permanece aberto apesar da prova de acesso físico. Nenhuma promoção ou mudança adicional de placements prevista enquanto essa causa é tratada pelos donos.
