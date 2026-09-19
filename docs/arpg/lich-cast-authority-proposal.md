# Lich — proposta CPU de autoridade para Combat

**Proposta em cópia, sem integração runtime.** Apoio SFX autorizado pelo Root após a revisão visual do marcador. Entrega em `output/lich-cast-v1/combat-proposal/`; ferramentas exclusivas `tools/lich-cast-review-authority*`. Combat revisa/aplica em futura janela depois de Environment. Não houve GPU, browser, WebSocket, novo framework, agente, VFX/SFX ou operação sobre5173. Nenhum main/server/core/asset runtime foi escrito.

Base inspecionada: checkout compartilhado `main`, HEAD9124df5657474e9ad0a82634a53b987c75d70e9b, WIP preservado. [Contrato](lich-cast-contract.md) e [perfil visual já revisado](lich-cast-asset-handoff.md) continuam separados de aceite de contato/AAA. O core usa somente os números **duration1.10 / releaseAt0.5971428571428572**, sem importar Three, GLB ou perfil de asset.

## Arquivos entregues

- [caster-cast.mjs](../../output/lich-cast-v1/combat-proposal/caster-cast.mjs): estado puro, fases/eventos, identidade e snapshots.
- [caster-caller-boundary.mjs](../../output/lich-cast-v1/combat-proposal/caster-caller-boundary.mjs): fronteira pura que retorna `assignCooldown`/`consumeActorStep`; não altera objetos do caller nem cria projéteis.
- [new-core.diff](../../output/lich-cast-v1/combat-proposal/new-core.diff): diff completo de inclusão desses dois módulos no destino futuro `src/combat/`. **Não aplicado.**
- [caller-integration-sketch.diff](../../output/lich-cast-v1/combat-proposal/caller-integration-sketch.diff): trechos antigos reais e proposta dos pontos de chamada. **Esboço de revisão, não patch runtime aplicável**: contexto, lifecycle, transporte e consumo de projétil exigem os hooks descritos abaixo. Evita sugerir que uma troca só no ramo `cooldown<=0` seja integração correta.
- [referências congeladas](../../output/lich-cast-v1/combat-proposal/source-reference/): cópias de main/server usados na leitura e hashes. Nunca copiá-las sobre os arquivos concorrentes.
- [CPU final40grupos](../../output/lich-cast-v1/combat-proposal/cpu-2026-09-19T02-50-38-816Z/report.json), [verificação/manifesto](../../output/lich-cast-v1/combat-proposal/delivery.json). Históricos36/40grupos anteriores permanecem em diretórios separados.

## Identidade e ownership do estado

Tipo runtime é **`caster`**. `lich` é o asset visual selecionado por `src/main.js:113`; não é outro monstro de autoridade. `createCasterCastState({worldEpoch,actorId,actorType:'caster'})` rejeita `actorType:'lich'`.

Um estado por monstro em um mundo: `monster.casterCast`/`zombie.casterCast`. `castId = JSON.stringify([worldEpoch, actorId, sequence])`; sequência monotônica **do monstro**, independente do ID/run/skillSequence do jogador. Vários jogadores recebem a mesma conjuração; não se avança cast no loop `playingClients`.

No servidor, `createRoomWorld` já cria `world.epoch` (`server.mjs:349`) e IDs de monstro monotônicos no mundo. Reutilizar esse epoch; acrescentar tick de simulação próprio uma vez por atualização do mundo. **Não usar `world.seq` de snapshots nem `client.state.runId` como sequência/epoch de cast.** Offline: criar epoch próprio quando o mundo/entidades forem recriados, por exemplo `game.casterWorldEpoch`, e tick por updateZombies; não redefinir por troca de alvo. Reconexão de um jogador não reinicia estado do monstro compartilhado. Reset real do mundo descarta todos os estados e troca epoch explicitamente.

O alvo fica identificado separadamente por `targetId`. `targetLifeId` opcional captura a vida/run daquele alvo e impede acertar silenciosamente uma nova encarnação com o mesmo ID. Isso **não entra no castId**. O servidor já possui runId por alvo; o array offline `livingPlayerTargets` atualmente não o inclui e precisará carregá-lo se Combat quiser a mesma proteção contra respawn.

## API pura

```js
import {
  createCasterCastState, prepareCasterCast, advanceCasterCast,
  cancelCasterCast, casterCastSnapshot,
  acceptCasterCastSnapshot, projectCasterCastSnapshot,
} from './caster-cast.mjs'; // arquivo da proposta, não import atual do jogo

let state = createCasterCastState({ worldEpoch, actorId: monsterId });
const context = {
  actor: {
    id: monsterId, type: 'caster', present: true, alive: true,
    frozen: false, stunned: false, position: { x, z },
  },
  target: {
    id: targetId, lifeId: targetRunId, present: true, alive: true,
    position: { x: targetX, z: targetZ },
  },
  inRange: true, // regra real do caller
  losClear: true, // teste real do caller, fresco no release
};
let change = prepareCasterCast(state, {
  ...context, sequence: state.sequence + 1, ready: cooldown <= 0,
});
state = change.state; // guardar ANTES de consumir/publicar change.events

change = advanceCasterCast(state, {
  ...freshContextForTheLockedTarget, tick: worldTick, dt, paused,
});
state = change.state;
// Somente a autoridade consome release para emitir uma vez/eventId.
// Os receptores de snapshot nunca chamam spawn de projétil.

change = cancelCasterCast(state, {
  castId: state.cast.castId, reason: 'removal',
});
state = change.state;
```

Resultado padrão `{state,events,accepted,reason}`; entrada não é mutada. Mesmo input sempre produz mesmo resultado, sem relógio global/RNG/I/O. O caller tem que encadear o estado retornado: recalcular indefinidamente de um estado antigo produz o mesmo evento determinístico; não é garantia de entrega transacional entre processos.

Estado contém `worldEpoch,actorId,actorType,sequence,revision,lastTick,paused,cast`. Cast contém `castId,sequence,phase,elapsed,duration,releaseAt,targetId,targetLifeId?,direction,preparedOrigin,releaseOrigin,released,cancelReason,endReason`. Direção XZ unitária é copiada no preparo e nunca persegue o alvo. `released` não volta a false depois da emissão.

Eventos: `prepare`, `release`, `cancel`, `end`, com `eventId = JSON.stringify([castId,phase])`, identidade do monstro/mundo, tempo e direção. Estado persistido usa `phase:prepare|release|end`; cancelamento terminal emite **cancel seguido de end**, conserva `cancelReason` e `endReason:'cancelled'`. `phase:'release'` no estado significa recuperação após disparo, não um pedido de emitir a cada quadro.

No release, `origin:{x,z}` é copiada da posição atual do ator. `target` precisa continuar sendo o mesmo ID/vida, vivo/presente e em faixa, com LOS válido. Ausência de `inRange:true` ou `losClear:true` cancela, não assume permissão. A origem não usa bone nem contém altura: altura/offset/raio/dano pertencem ao caller existente. Não substituir a direção travada pelo vetor atual até o alvo ao chamar spawn.

## Tempos, cancelamento e snapshots

Prepare não emite projétil. Release ocorre ao cruzar `elapsed >= .5971428571428572`, uma vez. `dt` finito não negativo é tempo **da simulação**, sem o clamp visual de0.1s. Passo longo pode emitir release e end na mesma chamada, nessa ordem. Repetir ou regredir `tick` não avança o estado. A simulação produz somente um cast por vez; prepare com sequência antiga, saltada ou com cast ativo é recusado.

O evento release expõe `releaseOffsetInStep` e `remainderAfterRelease`. Ambos os loops atuais executam monstros antes dos projéteis (`src/main.js:5914`, `server.mjs:722`). Se o release ocorreu no meio do passo, avançar o novo projétil pelo dt inteiro seria incorreto. Combat deve consumir somente o restante desse passo para esse projétil ou subdividir o tick. O core informa essa fração, **não modifica o integrador de projétil**. A origem é a posição fresca fornecida pelo caller no passo; sem histórico/substeps não há reconstrução espacial subframe de um ator que se deslocou dentro de um dt longo.

Freeze/stun/morte/remoção têm prioridade sobre release no mesmo passo. Antes do marcador: cancel/end sem release, sem retomada ao descongelar. Depois do marcador: cancel/end apenas encerram a conjuração; não existe referência, remoção, refund ou alteração de um projétil emitido. Pausa segura idade; cancelamento por controle/morte/remoção ainda é aceito durante pausa. `cancelCasterCast` exige castId atual para um comando atrasado não cancelar outro cast.

**Atenção à ordem existente:** main e server decrementam controles antes de vários `continue`. Capturar `freezeTimer>0`/`stunTimer>0` no início do passo e combinar com o estado depois dos updates, ou cancelar imediatamente ao aplicar controle. Caso contrário, um controle que expire nesse dt pode deixar o cast liberar. O teste inclui timer inicial.01→final0 em dt longo. Cancelamento também precisa existir no caminho de morte/removal que exclui o monstro antes do loop, não somente dentro do loop dos vivos.

`casterCastSnapshot(state)` retorna cópia JSON destacada, com idade autoritativa. `acceptCasterCastSnapshot(previous,incoming,{worldEpoch,actorId})` verifica escopo, sequência/revisão, idade sem regressão, direção fixa, origem já liberada e resultado terminal; snapshots velhos/duplicados não ressuscitam o cast. Troca de epoch só é aceita quando o receptor explicitamente informa o novo mundo esperado.

`projectCasterCastSnapshot(snapshot,ageSeconds)` extrapola apenas `elapsed/remaining/normalizedTime/visualActive`. Mantém `authoritativeElapsed`, `phase` autoritativa e `releaseConfirmed`. Cruzar o marcador por estimativa local **não cria release**, nem end/cancel/evento: `events:[]` sempre. Pausa/terminal não acumulam idade adicional. Guardar snapshot aceito separado da projeção visual; não devolver a projeção como estado autoritativo.

Latejoin/reconnect devem aplicar pose pela idade, sem reapresentar preparo ou impacto antigos. Projetil existente chega pela lista normal de projéteis do mundo. Ao juntar stream de eventos com snapshots, Combat ainda precisa marcar fases históricas como consumidas e descartar eventos atrasados de cast terminal/epoch anterior. Esse merge de transporte não está integrado nem provado em rede aqui.

## Parâmetros reais dos callers — manter a divergência atual

As funções abaixo foram extraídas das fontes e executadas em NodeVM sem importar/subir o servidor. A condição ranged do servidor também foi avaliada literalmente. Dados completos no `callerAudit` do relatório CPU.

| Aspecto caster | Cliente offline | Servidor |
| --- | --- | --- |
| Faixa, estrita | `distance > 4.2 && distance < 16` | `distance > meleeRange + 1.2 && distance < 22` |
| meleeRange servidor | — | `(profile.meleeRange ?? monster.radius + .72) + reachBonus`; caster base mínimo2.74m, aumenta com bônus |
| Cooldown | `getRangedCooldown('caster')` = **1.45s** | `getServerRangedCooldown('caster')` = **1.65s** |
| Dano de projétil | `zombie.damage + floor(player.wave * .35)` | `monster.damage + floor(world.wave * .35)` |
| LOS atual | sweep y=.9, raio0 | sweep y=.9, raio0 |
| Colisão vertical comum | `enemyProjectileCollisionHeight('caster')` =1.05 | mesma função1.05 |
| Especificação atual | speed14; radius.42; height visual1.38; offset.9; lifespan2.25; impactRadius2.4 | speed11; radius.36; height1.05; offset radius+.4 (=1.22base); lifespan4.2; impactRadius2.2 |

Referências do snapshot de fonte: main `canUseRangedAttack:9097`, `getRangedCooldown:9110`, `spawnEnemyProjectile:9142`; servidor `updateServerMonsters:844`, `spawnServerProjectile:946`, `getServerRangedCooldown:1419`, `getServerProjectileSpec:1426`; linhas podem mudar na janela Environment. **Não unifiquei alcance/cooldown/spec/dano**. O atraso inicial do release é a mudança deliberada da nova conjuração; balanceamento posterior precisa ser decidido por Combat.

`stepCasterCaller` recebe essas políticas já calculadas, inclusive `cooldownDuration`; devolve `assignCooldown` somente se prepare for aceito. Debitar no aceite, continuar decremento normal durante o cast e não debitar novamente no release/fim. Cancelamento não reembolsa nem reinicia cooldown. Preservar diferença atual dos timers congelados: main limita em.12; server chega a0. Não executar decremento duas vezes ao rearranjar os hooks.

## Roteiro de integração a revisar depois de Environment

1. Instalar os módulos somente por Combat. Criar epoch offline e tick por mundo; guardar estado no monstro. Aplicar perfil somente a `type==='caster'`, mantendo Walker/melee/bosses fora do ramo.
2. No início do passo, capturar flags de controle anteriores; processar status existentes e cancelamento de morte/remoção. Determinar presença real do ator e alvo fresco. Para cast ativo, procurar **o targetId travado**, nunca substituir pelo jogador mais próximo. No servidor, filtrar também connected/playing/health atuais; offline, atualizar os descritores vivos para não usar saúde capturada antes de outra morte no mesmo tick.
3. Decrementar cooldown exatamente uma vez conforme caller. Atualizar cast ativo **antes** dos early returns de alvo/controle e independentemente de cooldown/faixa. Só tentar prepare de cast novo com gates válidos. `consumeActorStep:true` impede uma segunda ação melee/ranged no mesmo passo; deslocamento externo/pull continua permitido e será refletido na nova origem. O módulo não desloca nem gira ator.
4. Persistir novo estado antes de consumir eventos. Só offline autoritativo/servidor emitem projétil uma vez/eventId. Usar a direção do evento e origem amostrada; executar spawn sincronamente ou adaptar o helper para usar explicitamente essa origem. Preservar cálculos reais de dano/spec/alturas/volumes e aplicar `remainderAfterRelease` no primeiro update. Não passar `L_Hand` à colisão.
5. Remover/suprimir o `animatedEnemies.attack(zombie,.65)` automático dentro do helper de spawn **apenas para esse novo caminho preparado**: ele substituiria o gesto1.10s no release. A API visual staged já tem `cast/cancelCast`; apresentação futura observa estado/eventos, sem conceder dano. Nenhum novo efeito/áudio foi gerado nesta proposta.
6. Acrescentar snapshot por monstro em `serializeMonster`, preservando `world.epoch`/serverTime do envelope. Fases imediatas e snapshots devem compartilhar castId/sequence/revision. Consumir somente apresentação nos peers; dedup por castId+fase, seed a partir do snapshot, terminal/epoch antigo não reaparece. `revision` ordena observações deste estado, não substitui um protocolo de entrega confiável.
7. Death/removal/reset encerram cast antes de descartar estado; não apagar projéteis já existentes por cancelamento do emissor. Disconnect de **um jogador** não cancela indiscriminadamente todos os monstros do mundo dos outros jogadores; só invalida alvo indisponível na revalidação. Disconnect do cliente suspende apresentação local; reconnect reconstrói da autoridade nova.

## Prova CPU e limites

**40grupos PASS**, com hashes das fontes estáveis durante execução: marcador exato/antes/depois, dt0/longo/inválido, partições120Hz/10Hz/um passo, pausa, cada cancelamento antes/depois, target perdido/trocado/nova vida, LOS/range perdido, origem deslocada e direção travada, tick repetido/regredido, sequência antiga/busy, cancelamento atrasado, imutabilidade, snapshot antigo/terminal/releaseOrigin, latejoin/reconnect em memória sem replay, epoch trocado, fanout simulado para dois observadores, cooldowns dos dois callers e expiração de controle dentro do passo. O fanout é **simulação CPU**, não dois clientes de rede.

Reprodução: `node tools/lich-cast-review-authority.mjs`; geração dos diffs: `python3 tools/lich-cast-review-authority-diff.py`. Ambos só escrevem a proposta/evidências. Cada execução CPU tem diretório próprio. Nenhum runtime importado pelo core; VM executa apenas funções/expressão selecionadas, não `server.mjs` inteiro.

O teste de LOS injeta resultado booleano e verifica fail-closed; não prova sweep real contra Environment. Não houve teste do loop main/server modificado, movimento subframe, pausa de sala, broadcast, latência/reconexão real, projétil/dano de jogo, animação integrada ou gameplay. Eventos release são comandos propostos, não projéteis criados durante esta tarefa. A garantia de uma emissão depende de autoridade única, estado encadeado e consumo deduplicado; não cobre rollback/restart transacional.

**Fonte de proposta liberada para Combat revisar; não integrada e sem autorização de promoção nesta tarefa.** Não há próximas escritas previstas em runtime. Servidor5173 foi apenas inspecionado em modo leitura, PID66986 no início desta tarefa; processos/ranking não foram operados.
