# Animation ↔ Combat/VFX — cadáver cortado e controle v2

Contrato conferido na fonte em 2026-09-19T01:20Z. A [direção v2](skill-direction-v2.md) está incorporada. Animation mantém a implementação do corte e da pausa de pose; VFX mantém impactos, rastros e ornamentos de status. Fonte liberada, sem mudança de runtime nesta confirmação e sem reserva GPU própria.

## Chamada integrada de morte

O ponto público existente é o pool `animatedEnemies.remove`, não `visual.die`. Combat já o chama no fluxo letal local e na morte confirmada pela rede, antes de devolver a entidade original ao pool:

```js
// Combat: uma vez por entidade morta pelo dash confirmado.
animatedEnemies.remove(zombie, {
  death: true,
  deathStyle: 'cleave',
  killedBySkillId: 'warrior_cleaving_dash',
  direction: { x: dashDirection.x, z: dashDirection.z },
});
removeZombieByRef(zombie); // Fluxo existente de Combat, não uma API de VFX.
```

`direction` está no plano XZ do mundo e orienta a separação/tombamento; o corte é horizontal. Sempre passar o ID canônico. `deathStyle:'bisect'` também exige esse ID; o booleano `bisect:true` não faz parte da assinatura. `cleave` sem ID continua aceito apenas por compatibilidade histórica. `remove` retorna `undefined`.

O chamador confirma a morte: o pool não decide a partir de HP nem concede dano, XP, kills ou drops. O evento `impact` do dash já contém `killed:boolean`, `targetId` e `castId`; VFX pode usá-los para apresentar o contato, **sem criar outro cadáver ou disparar outra remoção**. A chave de um contato inclui o alvo, pois um mesmo cast pode matar vários inimigos.

`castId` não é consumido nem deduplicado pelo pool de cadáveres. `remove(...,{death:true,...})` não é idempotente: uma segunda chamada pode criar um corte do fallback. Manter a remoção letal exclusivamente no fluxo de Combat, uma vez por entidade; não fazer replay de cortes a partir de eventos VFX/status/reconnect. O `killed` de apresentação não substitui a autoridade de recompensa.

## Pose, hierarquia e ciclo de vida

- Animation captura `entry.controller.root` na pose renderizada antes do reset/reuso; sem ator detalhado, usa `zombie.mesh`. Faz duas cópias com esqueletos, materiais, índices e tampas privados. Texturas permanecem compartilhadas.
- A pose dos clones fica congelada; as duas partes caem e tombam como corpos rígidos. Braços/mãos permanecem inteiros com o torso. O rig original não recebe clipping ou partição e volta ao pool imediatamente.
- A chamada do pool usa `hideSource:false`: Animation retira/recicla seu ator, e `removeZombieByRef` de Combat devolve a malha original da entidade. VFX não precisa ocultar nem modificar essa hierarquia.
- Vida 1,65 s, fade nos últimos 0,35 s, até 24 cortes; `dt=0` pausa. `clear`/expiração descartam somente recursos privados. Diagnósticos: `getStats().cutCorpses` e `cutEvents`.
- `renderer.localClippingEnabled=true` já está integrado. A queda atual assume o piso da arena em Y=0.

Implementação: [pool](../../src/render/animated-enemies.js), [fragmentos](../../src/assets/enemy-death-cut.js). O helper interno `createEnemyDeathCut({THREE,source,scene,direction,hideSource=true,groundY=0})` retorna `null` ou `{parts,diagnostics,update,dispose}`. Com `hideSource:true`, `dispose` restaura a visibilidade anterior; não usar esse modo sobre ator que será reutilizado pelo pool. A integração existente administra isso e continua sendo o único dono do cadáver.

## Freeze/stun persistentes

Combat fornece `zombie.freezeTimer` e `zombie.stunTimer` em **segundos restantes**, a partir da autoridade local/rede. Animation lê ambos a cada update, pausa mixer/pose e suprime novos ataques/reação de hit enquanto algum for positivo; morte prevalece e reset limpa. Não decrementa nem estende o status. Aliases `freezeRemaining`/`stunRemaining` são aceitos quando o respectivo timer canônico está ausente. Diagnóstico `stats.control`; helper [enemy-control-state.js](../../src/assets/enemy-control-state.js).

O `syncState` de VFX já recebe a lista completa dos inimigos vivos afetados, com posição renderizada e os mesmos tempos:

```js
{
  id: zombie.id,
  position: zombie.mesh.position,
  freezeRemaining: zombie.freezeTimer || 0,
  stunRemaining: zombie.stunTimer || 0,
  radius: zombie.radius + 0.2,
  height: (profile.height || 2) + 0.3,
}
```

Essa estrutura é cada item de `syncState({buffs,fields,statuses})`. VFX reconcilia presença/expiração/remoção por snapshot; não altera bones, mixer, HP ou timers. Deslocamento por gravidade/colisão continua sob Combat/Physics mesmo com a pose pausada. Resistências e durações vêm dos valores reais do core, não de defaults visuais.

## Evidência e limites

Corte SHA `e37398db9fa3d02294cd5abb4929a52afc6caa84678f465fa099f62c61b63371`, pool SHA `e73ad4f939f4d4dcb001d1f1c7bbc4239de607fe3dac21475ff2f8f77d936184`. [Manifesto desta conferência](../../output/arpg-animation/vfx-contract-confirmation/20260919T012025Z/sources.json).

[Handoff v3](animation-cut-v3-handoff.md): CPU 16 casos, captura nativa de quatro rigs e morte por input real; antes/candidato preservados. [Controle CPU](../../output/arpg-animation/v2-reconfirmation/enemy-state-cpu.json): quatro rigs, pausa/retomada, morte e reuso. Esta confirmação apenas verificou fonte e integração, sem repetir render ou teste de gameplay. Não aprova AAA/ragdoll, desempenho de horda/mobile ou no-slide; [continuidade de locomoção](animation-locomotion-v3-candidate.md) segue isolada.
