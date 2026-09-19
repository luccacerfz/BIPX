# Revisão independente: volume VFX e HUD após os ajustes

Root inspecionou individualmente oito PNGs originais em 2026-09-19: quatro da fixture `output/playwright/2026-09-19T00-29-00-799Z-class-skill-vfx-v2` e quatro de gameplay `output/playwright/2026-09-19T00-30-38-775Z-class-skill-vfx-gameplay`. A primeira é sintética; a segunda usa as classes/assets reais. Nomes/hashes estão em `v2-volume-followup.json`. Não houve edição/composição das imagens.

Melhorias visíveis:

- `warrior_war_cry-state-high.png`: agora há faixas e motes dourados na altura do torso. Na câmera real, `vfx-v2-warrior-high-slot1-release.png` ainda é dominado pelos anéis no piso; o efeito sobre o corpo é discreto. Atualização da posição por frame é necessária para julgar o acompanhamento durante movimento.
- `warrior_shield_charge-travel-high.png`: a frente vertical com borda/brasão distingue o escudo da poeira. `vfx-v2-warrior-high-slot3-execution.png` mostra essa frente junto do guerreiro e de uma vítima, sem transformar a habilidade em projétil separado.
- `dwarf_frost_shot-state-high.png`: crosta parcial até o corpo substitui a marca limitada aos pés. `vfx-v2-dwarf-high-slot2-impact.png` mostra vários inimigos marcados individualmente, com rig legível; fragmentos bastante brancos têm contraste forte. Um frame não comprova duração/paralisação, já cobertas separadamente pelo relatório de controle.
- `dwarf_gravity_shot-state-high.png` e `vfx-v2-dwarf-high-slot3-impact.png`: núcleo/funil existem, mas as linhas circulares grandes ainda dominam a composição; o volume tem pouca presença na câmera de jogo. Isso é evolução sobre o baseline plano, ainda aquém da direção de um vórtice convincente.

Próxima melhoria artística recomendada ao VFX: estudar em cópia isolada somente a gravidade, com núcleo/anel de acreção reconhecíveis na câmera real e filamentos que expressem convergência em playback. Reduzir a competição das múltiplas bordas planas, mantendo um limite de alcance claro. Material pode ter contraste por rim e camadas translúcidas, sem depender de ocultar o torso nem aumentar a área da simulação. A tentativa anterior rejeitada por oclusão continua rejeitada; não enfraquecer a proteção de leitura para obter volume. Promover apenas em janela acordada com Combat, preservando esta versão.

Separadamente, root viu `gui-v2-dwarf-cast-3.png` e `gui-v2-dwarf-landscape.png` da rodada GUI `2026-09-19T00-25-23-626Z-ui-arpg-gameplay`. No cast portrait, tooltip já não cobre o combate e ambos os joysticks ficam livres. A imagem landscape mostra ajuda consultada intencionalmente; não é a permanência automática de 2200 ms do defeito anterior. O report do dono registra input e fonte estável; continua sendo toque emulado no Chrome, não aparelho físico.

Nenhuma nota AAA/10 atribuída. Esta revisão estática não substitui playback, áudio ouvido, desempenho de horda ou revisão JEF do candidato integrado.
