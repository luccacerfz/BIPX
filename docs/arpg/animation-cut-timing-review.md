> **Atualização:** overlay explícito agora capturado na [QA final](../../output/playwright/arpg-animation-release-final-1789784291764/report.json), com runtime07952 e seis timings atuais. HTML continua substituição de fixture; nenhuma mudança no jogo. GPU própria liberada. Seção abaixo preserva a conferência anterior à nova captura.

# Conciliação da revisão v2: corte atual e prova dos timings

`docs/arpg/review/v2-death-cut-review.md` e `v3-cut-followup.md` relidos integralmente. Os achados são preservados como revisão das respectivas fontes históricas. A queda/tampa solicitada na primeira revisão e o braço solto da segunda já receberam a implementação v3, promovida pelo dono na janela Combat00:38, às00:53:49UTC.

## Corte presente no runtime

SHA atual **e37398db9fa3d02294cd5abb4929a52afc6caa84678f465fa099f62c61b63371**, conferido contra o candidato explicitamente substituído na fixture `arpg-animation-cut-v3-arms-final` e o report CPU `runtime-fall-cpu.json`. Não confundir o hash do runtime antigo guardado no campo `before` da fixture com o módulo candidato que aquela fixture realmente renderizou.

O controlador atual aplica arco balístico com gravidade12m/s² e impulso inicial. Tombamento termina em.66s; suporte da geometria visível impede cruzar piso+12mm. Tampas escuras são trianguladas nas interseções do corte. Braços/mãos permanecem com o torso por componentes conectados. Mantidos limite24cadáveres, vida1.65s e fade.35s; isso preserva limites configurados, **não demonstra orçamento GPU de horda/mobile**.

Foram reexaminados os PNGs atuais deOrc/Walker/Lich em.9s, sem editar imagens. As peças estão tombadas, em vez do torso vertical suspenso do v2. O suporte mínimo dos grupos não significa que todo vértice está no piso; braços/props ainda podem sustentar o torso. A solução é rígida em duas partes e continua sem aceite AAA de peso/acabamento.

- [Orc](../../output/playwright/arpg-animation-cut-v3-arms-final/orcPeon-candidate-0.9.png), [Walker](../../output/playwright/arpg-animation-cut-v3-arms-final/zombie-candidate-0.9.png), [Lich](../../output/playwright/arpg-animation-cut-v3-arms-final/lich-candidate-0.9.png).
- [Três instantes e playback preservados](../../output/playwright/arpg-animation-cut-v3-arms-final/report.json):.12/.38/.9s,4rigs,28PNG/4vídeos. Nesta conferência foram revistos só os3PNGs finais acima; não declaramos nova inspeção contínua dos vídeos.
- [CPU fonte atual,16casos](../../output/arpg-animation/death-cut-v3/runtime-fall-cpu.json):mínimos das metades e apoio antes do fade, tampas, rig/originais/descarte. Evidência existente vinculada por hash, sem repetir teste inalterado.
- [Death-only integrado](../../output/playwright/arpg-animation-death-only-v3/death-only.json): morte confirmada pelo dash, um kill/corte e expiração. Não é nova execução, rede ou benchmark.

V2 permanece em `death-cut-v3/before/`; v3 com mão flutuante em `before-floating-hand/`. Nenhuma nova alteração de corte é necessária para reaplicar a mesma correção já promovida; refinamentos artísticos posteriores precisam candidato e janela próprios.

## Tempos finais dos heróis

A revisão root citava `arpg-animation-skills-v2`, que fica histórica. A prova posterior é [arpg-animation-skills-v2-final/report.json](../../output/playwright/arpg-animation-skills-v2-final/report.json). Os hashes do módulo de skill, bibliotecas dos heróis e dois sidecars coincidem com a fonte atual; o controller de locomoção dessa fixture ainda era df93, portanto não transferimos essa prova para aprovação da locomoção07952.

Os três PNGs finais foram reexaminados. Seu overlay exibe **elapsed**, não o parâmetro release. Valores conferidos no JSON associado:

|Gesto|Release real s|Elapsed no PNG s|Duração s|
|---|---:|---:|---:|
|[Grito](../../output/playwright/arpg-animation-skills-v2-final/warrior_war_cry-release.png)|.380|.391667|.850|
|[Escudo](../../output/playwright/arpg-animation-skills-v2-final/warrior_shield_charge-release.png)|.280|.291667|1.100|
|[Canhão](../../output/playwright/arpg-animation-skills-v2-final/dwarf_explosive_cannon-release.png)|.300|.308333|.720|

Todos são samples em recovery, menos de1/60s após o release configurado. A captura não ocorreu exatamente no instante matemático do release. O contrato foi novamente comparado com o core na [conferência02:12](../../output/arpg-animation/combat-contract-confirmation/2026-09-19T02-12-16.009Z.json). A validação integrada posterior do Combat usa [manifesto213fontes/18relatórios](../../output/qa/arpg-horizon-integrated-20260919/evidence-provenance.json); esta nota não reexecuta nem reaprova a suíte.

Para eliminar a ambiguidade do overlay, preparei **somente em cópia** `output/arpg-animation/cut-timing-review-confirmation/candidate/tools/animation-skill-preview.html`: mostra `elapsed`, `release` e `duration` com três casas, lendo os valores ativos de `stats.cast`. Antes preservado ao lado. Sintaxe do script passou. A cópia ainda **não foi renderizada nem promovida**; não é uma imagem nova nem evidência nativa. Pode ser consumida pela próxima captura explícita em janela Combat com lockGPU, sem retocar os PNGs antigos.

## Coordenação

[Recibo/hash/PNGs vistos e dados extraídos](../../output/arpg-animation/cut-timing-review-confirmation/confirmation.json). Não houve escrita em runtime, main/server, ferramenta de captura ativa ou auditor root. Nenhuma reservaGPU, mensagem em fila ou interrupt. A fase Physics/Combat permanece livre de mudanças desta frente. Handoff de corte atualizado para distinguir o estado atual da nota histórica de locomoção no seu rodapé. Ré v5 permanece em cópia; no-slide e AAA continuam pendentes.
