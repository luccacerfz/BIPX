# Combat v2 — contrato de implementação

Substitui o catálogo v1; evidências v1 permanecem históricas. IDs em `skill-direction-v2.md`. Propriedade Combat confirmada; runtime em migração, ainda sem aceite v2.

| ID | custo/CD | preparo/gesto | execução |
|---|---|---|---|
| warrior_war_cry | 24/14s | .38/.85s | buff8s: dano ×1.35, velocidade ×1.15 |
| warrior_cleaving_dash | 28/6s | .22/.78s | 8m em .36s, faixa raio.85, dano14×atributo, um hit/vítima |
| warrior_shield_charge | 34/10s | .28/1.10s | 7m em .65s, faixa raio1.05, dano1.2×atributo, stun2.2s |
| dwarf_explosive_cannon | 28/5s | .30/.72s | 22m,22m/s, projétil raio.32, área3.4m, dano14×atributo |
| dwarf_frost_shot | 32/9s | .28/.68s | 20m,24m/s, projétil raio.25, área4m, dano.8×atributo, freeze3s |
| dwarf_gravity_shot | 38/12s | .42/.85s | 18m,20m/s, projétil raio.3, área5m, dano.6×atributo, campo5s, pull4.5m/s |

Boss: stun máximo.65s, freeze máximo.8s, atração35% da velocidade normal; snapshots explicitam resistência. Arena55m/body.64 e colisores partilhados. Dash/charge param no primeiro obstáculo (sem deslizar em redor e inventar trajeto), nunca somam caminhada durante deslocamento. Atração usa solver e crowd e suspende a translação voluntária dentro do campo (ataques ainda são permitidos); centro com zona de repouso por raio do alvo, sem singularidade. Dano inicial uma vez por alvo; campo não causa dano por tick.

Eventos `emit` mantêm payload anterior e castId. Fases v2: `cast` aceite/preparo; `release` origem atual na emissão; `travel` origin anterior/target atual, `terminal`; `impact` contato real/detonação; `status` início/refresh com `status`, `remaining`, `statusDuration`, `targetId`, `resisted`; `end` com status e motivo. Grito status=buff acompanha jogador. Campo status=gravity fica no impacto. Freeze/stun status por vítima; campo transmite refresh no máximo10Hz. `impact` de dash inclui `killed:boolean` e `targetId`; corte de cadáver é autorizado somente por morte real (`deathStyle:'cleave'` no fluxo de remoção). Sem reaplicar recompensas por apresentação.

Snapshot skill inclui `buff:{remaining,damageMultiplier,speedMultiplier,castId}` ou null, `fields:[{castId,skillId,x,y,z,radius,remaining,duration}]`, `movement:{skillId,castId,remaining}` ou null. HUD recebe `statuses:[{id,name,remaining,duration,damageMultiplier?,speedMultiplier?}]`; fontes UI continuam sem autoridade. Monstros replicam `freezeTimer`, `stunTimer`, `controlResistance` e fonte dos status. Latejoin/reconnect reconstroem apresentação a partir de snapshots, sem replay de dano/som de impacto. Morte/reset/desconexão cancelam buff/casts/campos; reconexão preserva recurso/cooldowns/sequence, sem ressuscitar efeitos transitórios.

SFX: fases cast/release/travel/impact/status/end/ready/resourcefail; `status`, `remaining`, `duration` em options para loops. VFX: mesma API, essenciais visíveis em low/reduced. Animation: visual.cast retimado pelos tempos acima; inimigos com freeze/stun param ataque/locomoção; proposta de `animatedEnemies.remove(zombie,{death:true,deathStyle:'cleave',direction})` para cadáver, preservar demais mortes. Confirme API no seu handoff.
