# BIPX — sete frentes Astra / direção ARPG

> **ATUALIZAÇÃO VIGENTE DO USUÁRIO:** a seleção inicial abaixo foi substituída por [skill-direction-v2.md](skill-direction-v2.md): grito/buff, dash cortante, investida de escudo; canhão de fogo, congelamento e campo gravitacional roxo. Ler esse documento primeiro. Contratos/IDs antigos ficam históricos até a migração completa.

Pedido do usuário em 18/09/2026: agentes Astra reais no Orca cuidando de VFX e armas elementais antigas (fogo, gelo etc.), SFX com ElevenLabs, física, animação, environment rico em assets e GUI. Guerreiro e dwarf rifle terão três magias ativas cada; HUD inspirado em ARPG/Diablo com duas esferas e skills embaixo. Continuar avaliação real JEF e deixar servidor ligado.

## Autorização, histórico e preservação

- Este documento e o pedido atual prevalecem sobre a regra histórica "Aldric somente espada, sem magias". Espada/rifle são ataques básicos; as seis habilidades abaixo são casts intencionais adicionais. Adaptar testes antigos à nova semântica mantendo autoridade, colisões, recursos e cooldowns.
- Checkout compartilhado: `/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX`, branch main, HEAD inicial `9124df5657474e9ad0a82634a53b987c75d70e9b`, extenso WIP local de usuário/agentes. NÃO resetar, limpar, sobrescrever com cópias antigas, commit/merge/push ou publicar. Preservar fontes e candidatos anteriores.
- Sete terminais novos GPT-6-Astra no mesmo checkout, cada um com propriedade abaixo. Handoffs diretos de ownership; não são dispatches supervisionados do Orca. Não inventar task IDs, worker_done ou aprovação de outro agente.
- Servidor do usuário já ativo em `http://localhost:5173/?offline=1` (PID observado 2591, `node server.mjs`). Ranking local `/tmp/bipx-aaa-local-leaderboard.json`, Supabase desativado. Somente Combat pode reiniciar se uma mudança de backend exigir, verificando antes o processo/porta e restabelecendo imediatamente as mesmas opções locais. Nenhuma limpeza de ranking/produção. Demais agentes usam servidores efêmeros próprios para fixtures, nunca encerram 5173 nem abas do usuário.
- Credenciais: apenas ambiente de processo; nunca imprimir/gravar em docs, frontend, assets, argumentos de comando, commits ou logs. Serviços e acervo já autorizados; reutilizar material gerado antes de gerar duplicatas.
- Testes com GPU devem ser sequenciais. Reservar atomicamente `/tmp/bipx-arpg-gpu.lock` com mkdir, escrever owner/pid, liberar somente a própria reserva em finally. Se ocupado, trabalhar em CPU/documentação; não apagar lock vivo nem fechar navegador de outro agente. Não iniciar captura de benchmark durante outro render pesado/export. Todos os contextos abertos pelo agente são fechados ao concluir; servidor do usuário permanece.
- Reports por frente em `docs/arpg/<frente>-handoff.md`: arquivos modificados, exports/APIs exatos, como integrar, evidências com hashes, limitações/rejeições e próximos passos. Publicar contrato/API cedo; registrar entrega integrada vs módulo ainda pendente. O agente Combat é dono da integração do candidato jogável.

## Propriedade exclusiva

| Frente / id | Arquivos que pode editar | Responsabilidade |
| --- | --- | --- |
| Combat & integração / combat | `src/main.js`, `server.mjs`, `src/combat/`, `src/progression/`, `src/config/defaults.js`, `package.json`, ferramentas de integração e docs JEF | Gameplay das seis magias, recursos/cooldown/autoridade, conexão dos módulos, testes finais e JEF |
| VFX & arsenal / vfx | `src/vfx/`, `assets/vfx/`, ferramentas `*vfx*` e seus docs | Fogo/gelo/raio/arcano, casts/impactos/trails e leitura das seis skills usando três GH |
| SFX ElevenLabs / sfx | `src/audio/`, `assets/audio/`, ferramentas `*audio*` e `generate-elevenlabs.mjs` | Geração real, mix, variação, desbloqueio/mute e gatilhos sincronizados |
| Física / physics | novos `src/physics/`, `tools/physics-*`, seus docs | Colisão e deslizamento tangencial em obstáculos, separação/contato e contratos de colisores; propor integração ao Combat |
| Animação / animation | `src/assets/` (exceto vendor), `src/render/animated-enemies.js`, `src/render/visual-motion.js`, assets de personagens/monstros e ferramentas de animação | Mixamo, passada/apoio, retarget, corpo/arma, idle/walk/run/cast/hit/morte; assumir handoffs hero/enemy anteriores |
| Environment / environment | `src/render/asset-dressing.js`, `cemetery.js`, `atmosphere.js`, novos módulos environment, `assets/environment/`, ferramentas de export de environment | Cemitério detalhado e jogável usando biblioteca local; fornecer colisores a Physics |
| GUI ARPG / gui | `index.html`, `styles.css`, `src/ui/`, `assets/ui/`, novas ferramentas de UI | Duas esferas, barra inferior três skills e arma básica, cooldowns/recursos, controles mobile e legibilidade |

Qualquer arquivo fora da própria linha deve receber proposta/patch em documento, aplicado por seu dono. Não editar silenciosamente arquivos de outro agente. Se acrescentar assets, usar subpastas por domínio para evitar colisões. Combat é dono de `package.json`, outros informam comandos de teste no próprio report.

## Contrato vigente de gameplay e integração

Os IDs e comportamentos desta seção são os seis definidos em [skill-direction-v2.md](skill-direction-v2.md). A tabela antiga de `warrior_flame_cleave`, `warrior_frost_nova`, `warrior_thunder_judgment`, `dwarf_incendiary_burst`, `dwarf_cryo_grenade` e `dwarf_arcane_shot` permanece somente nos relatórios históricos; não deve ser reintroduzida em código, HUD, fixtures ou handoffs.

IDs estáveis para os agentes construírem em paralelo; Combat pode calibrar números/nomes, mantendo IDs e slots. Esta é direção de implementação, ainda não funcionalidade concluída.

| Classe | Slot | ID | Comportamento vigente |
| --- | --- | --- | --- |
| warrior | 0 | `warrior_war_cry` | Grito com buff real de dano/movimento, aura e duração replicada |
| warrior | 1 | `warrior_cleaving_dash` | Dash de espada, sweep autoritativo e corte estilizado só em mortos |
| warrior | 2 | `warrior_shield_charge` | Corrida de escudo com impacto e stun em todos os alvos válidos |
| dwarf | 0 | `dwarf_explosive_cannon` | Canhão de fogo explosivo com dano em área e bloqueio por sólidos |
| dwarf | 1 | `dwarf_frost_shot` | Projétil que congela todos os alvos válidos na área |
| dwarf | 2 | `dwarf_gravity_shot` | Projétil que deixa campo persistente fixo e puxa com colisão |

- Teclas iniciais `1`, `2`, `3` e botões de toque/teclado focáveis. Preservar WASD/IJKL, mouse, ataque básico e acessibilidade. Evitar disparar skills ao digitar em inputs/dialogs.
- Vida à esquerda e recurso de classe à direita no HUD inferior, três skills ao centro mais indicador da arma básica; status superior compacto para arma/vida de party/boss/progressão sem competir com a barra. Interface original do BIPX inspirada no gênero, não cópia de logos/arte de Diablo.
- GUI emite `bipx:skill-request` em window, `detail: { slot: 0|1|2 }`; isso é somente intenção local. Combat valida e publica `bipx:arpg-state`, `detail: { classId, health, maxHealth, resource, maxResource, resourceLabel, weapon, skills: [{id,slot,name,key,cost,cooldownRemaining,cooldownDuration,enabled}], dead, paused }`. Combat garante snapshot após montar HUD/iniciar/trocar classe e atualização dos cooldowns com limite razoável; GUI pode solicitar snapshot com `bipx:arpg-ready`. DOM/UI nunca concede dano/recurso/cooldown.
- VFX fornece wrapper `createClassSkillVfx({scene, quality, reducedMotion})` (ajustar assinatura mínima e documentar cedo), com `emit({skillId,phase,origin,direction,target,castId})`, `update(dt,time)`, `reset`, `dispose`, `getStats`; phases = cast/release/travel/impact/status/end conforme aplicável. Reusar sistema existente, não duplicar renderer. Payloads são apresentação, nunca fonte de dano.
- SFX fornece `playSkillSound(skillId, phase, options)` integrado ao sample bank atual, com limites de vozes e ganhos. Documentar chamada/import exatos cedo. Providers geram assets offline; não expor chave no runtime.
- Physics publica resolução determinística por passo e colisores estáticos sem dependência de DOM/WebGL, com testes de canto/túnel/frame longo e delta limitado. Environment publica descritores de colisores, com geometria e unidades claras. Combat aplica no cliente e servidor quando apropriado, mantendo movimentos de animação medidos APÓS colisão.
- Animação fornece gesto por skill e janela de cast/impacto quando viável, mantém locomoção das pernas ao atacar/castar em movimento e não reintroduz deformação de cintura/arma. Contrato de visual atual deve continuar compatível; comunicar exports/estado adicional no report.

## Fontes e estado comprovado antes deste lote

- Três fontes VFX obrigatórias: https://github.com/achrefelouafi/SamuraiThirdPersonTemplateThreeJS (496862cda55bfba3be6d02eec5aee3ca808a31a3); https://github.com/achrefelouafi/HandCastAbilityThreeJS (3431252f7ad88059681d4b9b6484cb7483f7d0d6); https://github.com/achrefelouafi/LinearAbiltyCastingExtendedThreeJS (8c377c886ac2c68b26bc65c8f3507905818b974a). Preservar MIT/procedência. BIPX usa Three 0.164.1, não atualizar motor só porque exemplos usam outra versão. Ver `docs/vfx-elemental-integration.md`, `vfx-reference.md`, `vfx-additional-references.md`.
- Biblioteca environment da imagem: `/Users/luccacerf/Projetos/Assets/Environment/{Harbor_Map,Tunnel_Map,House_Reconstruction,House_Tripo_Delivery.zip}`. Inspecionar riqueza utilizável e extrair cópias otimizadas; preservar originais editáveis e respeitar tema/caminhos de combate/oclusão/VRAM.
- Animação: ler `docs/hero-locomotion.md` e `docs/enemy-locomotion.md` PRIMEIRO. Agentes anteriores já finalizaram e liberaram fontes/GPU. Default Orc v1 com Run Mixamo real, footContacts:false; v2 opcional e solver rejeitados por alcance/cobertura. Hero cintura Lyra corrigida, mas anti-slide continua REPROVADO: sola P90 Aldric .397–1.108 / Lyra .573–1.429 m/s em 6.5; backward rápido Lyra residual1.722. Não confundir ToeBase fixo com sola deformada estável. Native final hero: `output/playwright/hero-locomotion-handoff-native/`, ciclos completos, fonte estável, zero erros.
- Último VFX integrado aprovado apenas em seu escopo: `output/playwright/2026-09-18T23-02-31-684Z-verify-vfx/vfx-integration.json`, cast/impact/trail dos inimigos, classes e qualidades, sourceChanged:false. Isso não prova as seis novas skills.
- JEF REAL HTTP200 `jev-1.13.0`, requires_further_work: `docs/jef-locomotion-vfx-milestone.md`, `output/qa/locomotion-vfx-milestone-20260918/jef.json`. É snapshot ANTERIOR ao conserto de cintura; aceitação de todas as dimensões pendente, não reusar como aprovação atual. JEF avalia texto; não afirmar que viu PNG/ouviu vídeo. Evidência ausente permanece pendente, sem inflar notas.
- Sampler de deslocamento real integrado local/remoto/enemy; partículas de passos usam contatos reais. `verify:motion`, `verify:enemy-projectiles` e `verify:progression:parity` corrigidos; não assumir suite antiga29/29 prova candidato novo.

## Critérios para o novo candidato

Realizar melhorias visíveis e audíveis no jogo; seis casts funcionais por input, com custo/cooldown/autoridade, fire/frost legíveis, corpo/armas íntegros, ambiente rico sem esconder ameaças e HUD desktop/mobile acessível. Testar ambos os personagens e rede local. Capturas de fixtures são identificadas como fixtures; gameplay natural e medições físicas são provas separadas. Hash de fonte estável durante captura é obrigatório para promover candidato; vários agentes escrevendo invalida avaliação global antecipada. Combat reúne reports e agenda janela estável antes de suíte/JEF finais. Goal não termina por abrir agentes: permanece ativo enquanto critérios e avaliação estiverem pendentes.
