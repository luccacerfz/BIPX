# Fontes adicionais de VFX solicitadas pelo usuário

Adendo de 18/09/2026 ao goal descrito em [retomada-20260918.md](retomada-20260918.md). As duas fontes abaixo devem ser usadas junto ao [Samurai](vfx-reference.md). Nesta etapa foram consultados README, árvore de arquivos, package.json e LICENSE; os efeitos ainda não foram adaptados nem aprovados no runtime BIPX.

## Versões consultadas

| Fonte | Commit consultado | Estado do inventário |
| --- | --- | --- |
| [HandCastAbilityThreeJS](https://github.com/achrefelouafi/HandCastAbilityThreeJS/tree/3431252f7ad88059681d4b9b6484cb7483f7d0d6) | `3431252f7ad88059681d4b9b6484cb7483f7d0d6` | README descreve nove habilidades; árvore ativa contém nove classes concretas. A descrição do package.json diz onze, portanto não usar esse número como cobertura comprovada |
| [LinearAbiltyCastingExtendedThreeJS](https://github.com/achrefelouafi/LinearAbiltyCastingExtendedThreeJS/tree/8c377c886ac2c68b26bc65c8f3507905818b974a) | `8c377c886ac2c68b26bc65c8f3507905818b974a` | README e árvore ativa apresentam dez habilidades |

Ambos declaram `three: ^0.185.1`; o BIPX usa Three r164. A adaptação deve conferir APIs, shaders, iluminação e pós-processamento na versão instalada. Não atualizar o engine automaticamente como atalho para portar efeitos. Ambos têm licença MIT, copyright 2026 mohamedachrefelouafi; reter o aviso completo nos trechos incorporados. Assets externos requerem procedência própria.

## Mapeamento inicial de design

Os usos abaixo são propostas para implementação e avaliação, não capacidades já entregues no BIPX.

| Fonte / módulos existentes | Uso proposto no BIPX |
| --- | --- |
| HandCast: `GlacialShardStormAbility`, `GlacialPrisonAbility`, `effects/IceStatue` | Gelo do Visor, impacto/fratura e congelamento visual quando houver estado de gameplay correspondente |
| HandCast: `CorruptedShardAbility`, `ToxicShieldAbility`, `PhoenixAbility` | Conjuração do Lich, cristais de corrupção, barreiras e acontecimentos de fogo em bosses/arena |
| HandCast: `ShimmeringFluxAbility`, `VoidSlashAbility`, `AimIndicator`, `ZoneIndicator` | Rastros, impactos e avisos de ataques inimigos; adaptar componentes conforme a identidade visual |
| Linear: `AcidAbility`, `VenomSurgeAbility`, `WardAbility` | Ácido/veneno e barreiras em inimigos ou armadilhas com área e duração reais |
| Linear: `AstralVoidAbility`, `MonolithRiftAbility`, `CelestialRendAbility`, `BalefulCascadeAbility` | Eventos de boss: ruptura do chão, impacto ritual e ameaça celestial com preparação legível |
| Linear: `ArborBloomAbility`, `SumiTideAbility`, `CyberSerpentAbility`, `AimIndicator`, `ZoneIndicator` | Componentes de invocação, fumaça/tinta, rastros e avisos direcionais; selecionar o que combinar com o cemitério |

Os nomes correspondem a arquivos sob `src/abilities/`, salvo os módulos de efeitos explicitados. HandCast também contém `DroneAbility` e `MonowheelAbility`; inventariá-los, mas avaliar coerência temática antes de importar construções completas. Os diretórios `src/archive/` guardam alternativas antigas, separadas das habilidades ativas.

## Contrato de integração e avaliação

1. Para cada adaptação, registrar fonte/commit/arquivos, diferenças, gatilho de gameplay, emissor, alvo, fase e mecanismo de limpeza. Compartilhar pools e materiais compatíveis quando isso preservar o visual.
2. Manter Aldric somente espada e Lyra somente rifle. Um efeito de projétil mágico pode pertencer a inimigos/bosses; importar esse efeito não altera automaticamente o arsenal dos heróis.
3. Sincronizar o lançamento com a pose Mixamo e a confirmação de gameplay. Aviso no chão deve corresponder à área, direção e instante reais do dano. Efeito visual não decide dano, recompensa ou controle de personagem.
4. Validar o efeito em câmera próxima e de gameplay, horda ativa, pausa/restart, qualidade baixa e movimento reduzido. Medir buffers, draw calls e picos de frame; não transportar toda a cena, interface ou infraestrutura de câmera/gestos dos sandboxes só para reutilizar VFX.
5. Preservar antes/depois e capturas de gatilhos reais. Revisar visualmente timing, legibilidade, contraste, contato e identidade; enviar observações e medições ao JEF, distinguindo avaliação textual de revisão visual.
6. O relatório do candidato deve indicar quais efeitos das três fontes foram integrados, quais foram excluídos por design e quais estão pendentes. A meta continua 10/10 por critério, sem tratar disponibilidade de código como qualidade comprovada.
