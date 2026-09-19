# Continuidade v3 — confirmação localizada independente

Root executou o auditor da própria revisão contra o snapshot candidato07952bfc, sem editar controller, flags, takes, GLBs ou thresholds. Comando `node docs/arpg/review/sole-contact-audit.mjs --case=warrior:strafe --transition-detail`; resultado em `output/arpg-animation/locomotion-v3/candidate/output/qa/arpg-root-review/2026-09-19T01-22-01-780Z-sole-contact.json`. Fonte estável, acceptedNoSliding:false. Runtime ainda df93d75c nesta execução.

P90 do patch em apoio declarado.2951456m/s, fora de apoio declarado.4731322m/s; cobertura do patch29.3056%. A confirmação mantém as amostras de aterrissagem e não transforma ausência de amostra em zero. A correção do release descrita no handoff é reproduzível; o deslizamento em apoio permanece.

Root também inspecionou a folha amostrada nativa `warrior-release-playback.png` e conferiu o report: a fixture usa StrafeD para pernas e Run para torso, corretamente separados. Os cinco cenários nativos usam os mesmos rigs/takes, comparando somente o controller. Não foi revisão contínua do vídeo inteiro e não é gameplay. O handoff do dono registra novos limites em arrancada/cast/parada e ré9.1, preservados como pendências.

Recomendação: promover a correção localizada em janela coordenada com Combat, com provas integradas de movimento pós-colisão/atores remotos. Isso é avanço rumo à locomoção exigida, sem declarar no-slide. Animation deve continuar em staging a causa distinta da ré rápida e depois apoio/start/stop/turn, sem reduzir velocidade de gameplay ou relaxar auditor para conseguir aprovação.

## Promoção posterior

Dono Animation promoveu07952 na janela01:29; fonte confirmada no freeze01:32. Rede01:39:04 e casts em movimento01:39:37 passaram com fonte estável. A comparação localizada de continuidade permanece válida; o deslocamento residual em apoio e a ré rápida continuam sem aprovação no-slide.
