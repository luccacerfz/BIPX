# Spawn do jogador não consulta atores vivos

Diagnóstico root01:58:03, `node docs/arpg/review/player-spawn-audit.mjs`, `output/qa/arpg-root-review/2026-09-19T01-58-03-667Z-player-spawn.json`: fonte estável;8/8casos violam spawn livre, sobreposição1.42m contra monstro/1.28m contra jogador. O diagnóstico extrai literalmente getSpawnPoint do server atual e usa física/layout reais. Ocupantes são sintéticos, sem execução de protocolo/gameplay. O mesmo findFreePosition recebe actors e encontra alternativa válida em cada caso.

Leitura do fluxo: createInitialPlayerState chama getSpawnPoint(slot) duas vezes para x/z, e startClientRun a usa sem room. sendWelcome também calcula o ponto sem atores. Monster spawn já consulta getServerCrowdBodies(room). A nova política de crowd não deve ser obrigada a corrigir uma sobreposição criada na entrada de um jogador vivo. O problema é anterior ao cache; a janela de integração o torna relevante para a invariável prometida.

Correção solicitada ao dono Combat: resolver posição uma única vez no startRun usando os corpos vivos do room, excluindo o próprio cliente anterior; não mover a identidade reconectada, gastar recursos ou trocar runId nesse fluxo. Welcome/state/client devem concordar com a posição realmente atribuída. Entrada impossível precisa tratamento explícito sem sobrepor/teleportar atores existentes; uma nova escolha legítima de ponto de nascimento não é correção de caminhada. Testar late join, novo start após morte em sala viva, body/boss no ponto, caso sem espaço e retomada sem reposicionamento. Fontes main/server continuam sob Combat.

## Correção posterior — confirmação independente02:04:58

Combat ajustou createInitialPlayerState/startClientRun para consultar a sala/excluir self e resolver x/z juntos; sendWelcome usa posição atribuída e cliente aplica runStarted. Root leu esses hooks e executou `node docs/arpg/review/player-start-audit.mjs`: **20/20/sourceStable**, em `output/qa/arpg-root-review/2026-09-19T02-04-58-015Z-player-start.json`. Quatro slots×monstro/chefe/jogador/self/busca sem espaço. Candidatos de nascimento não sobrepõem os ocupantes; rejeição conserva referência de estado, requestId, recursos simulados e registros antes de finishPlayerSession.

Fixture CPU extrai funções atuais; transporte, inicialização da progressão e contador de sessões são stubs. O bloqueador de20m do caso sem espaço é sintético, cabe nos bounds55 e cobre a busca16m; não representa chefe ou crowd natural. Primeiro ensaio02:04:22 usou100m e teve4falhas do harness por raio maior que a arena, preservadas;16casos geométricos já passavam. Corrigiu-se somente a entrada dessa fixture, sem relaxar asserts. Não há nova execução de v1: aquele auditor histórico chama getSpawnPoint sem actors e não corresponde ao novo fluxo startRun.

Protocolo/reconnect/cliente visual e recurso real continuam gates do dono Combat; este diagnóstico não os aprova nem implica restart de5173.

## Protocolo do dono lido02:06

`output/qa/arpg-crowd-integrated-20260919/2026-09-19T02-05-06-899Z/player-spawn.json`:4gruposPASS/sourceUnchanged:true, servidor29bbf681. CPU12slot/body/boss/player com ator desconectado ainda vivo; WebSocket real em servidor isolado para latejoin/restart, reconnect preservando identidade/run/posição/recurso/CD/sequence e rejeição atômica com retry do mesmo request após liberar espaço. Arranjos/ocupantes são sintéticos viaIPC privado; não gameplay natural. Root leu o relatório e escopo, sem repetir a execução. BrowserUI e custo integrado ainda em andamento neste checkpoint;5173 continua no backend anterior até restart validado do dono.

Browser atual02:13:10, `output/playwright/2026-09-19T02-13-10-153Z-verify-player-spawn-browser/player-spawn-browser.json`: duas situações PASS/sourceChanged=false. Spawn ocupado recebido emx1.5 e aplicado ao cliente; falta de espaço manteve menu com aviso e permitiu retry bem-sucedido. Arranjos sintéticos em servidor isolado; não sessão natural. Falhas02:05/02:11 permanecem históricas.
