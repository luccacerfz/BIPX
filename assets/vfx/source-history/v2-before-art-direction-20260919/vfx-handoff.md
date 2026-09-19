# Astra · VFX & Arsenal — v2 liberada para integração

Direção vigente: [skill-direction-v2.md](skill-direction-v2.md). A seleção inicial foi substituída; fontes/evidências anteriores são histórico. Propriedade: `src/vfx/`, ferramentas `*vfx*`, assets VFX e este documento. `main.js`, servidor e package pertencem exclusivamente ao Combat. Checkout compartilhado/WIP preservados; sem commit/merge/push/deploy. 5173 permanece ligado.

## API concreta v2

```js
import { createClassSkillVfx } from './vfx/class-skill-vfx.js';
const classSkillVfx = createClassSkillVfx({
  THREE, scene, quality, reducedMotion, combatVfx, elementalVfx,
});
classSkillVfx.emit({ skillId, phase, origin, direction, target, castId,
  emitter, radius, groundY, contactId, release, terminal,
  status, targetId, remaining, statusDuration, duration });
classSkillVfx.syncState({ buffs, statuses, fields });
classSkillVfx.update(dt); // simulation seconds; zero pauses
classSkillVfx.setQuality('high'); // high/medium/low
classSkillVfx.setReducedMotion(true);
classSkillVfx.reset();
classSkillVfx.getStats();
classSkillVfx.dispose();
```

Somente seis IDs canônicos: `warrior_war_cry`, `warrior_cleaving_dash`, `warrior_shield_charge`, `dwarf_explosive_cannon`, `dwarf_frost_shot`, `dwarf_gravity_shot`. IDs v1 são rejeitados, sem barra/arsenal adicional.

Fases:

- `cast`: antecipação no aceite, jamais impacto. `emitter` opcional fornece arma/mão em mundo; sem ele há fallback vertical na raiz, que **não prova alinhamento à arma**.
- `release`: execução autorizada; grito produz onda, dash arco da espada, escudo feedback metálico, canhão flare/pluma, gelo/gravidade descarga inicial. Não exige vítima.
- `travel`: `origin` anterior e `target` atual reais, `castId` obrigatório. Dash/charge seguem deslocamento resolvido; dwarf atualiza corpo essencial e rastro decorativo. `release:true` também executa release uma única vez. `terminal:true` remove corpo no último segmento sem inventar hit. Saltos >8m/gaps de snapshots não são ligados por rastros falsos.
- `impact`: target = contato/detonação confirmada. `contactId` deduplica vítimas/retransmissão. Explosões de canhão/gelo/gravidade são uma por detonação, não uma por vítima. Dash/escudo recebem contatos individuais. Impactos dwarf encerram seus corpos.
- `status` e `end`: aceitam `status:'buff'|'freeze'|'stun'|'gravity'`, `remaining`, `statusDuration`/`duration`; buff/field identificados por castId, freeze/stun por targetId. End de status não cancela outro corpo do mesmo cast.
- `end` sem status remove corpo sem inventar explosão. Um corpo sem atualização por .3s expira; simulação pausada congela esse prazo.

`radius` e `groundY` vêm da simulação/superfície. Qualidade/reduced não diminuem a área exibida. Fallbacks de raio são artísticos; integração deve sempre passar o raio do core.

Snapshot completo autoritativo (recomendado por frame para posições atuais e reconnect):

```js
classSkillVfx.syncState({
  buffs: [{ id: buff.castId, position: actorPosition, remaining, duration: 8 }],
  statuses: [{ id: enemy.id, position: enemyPosition,
    freezeRemaining, stunRemaining, radius: enemyRadius + .2, height: enemyHeight + .3 }],
  fields: [{ id: field.castId, position: fieldCenter,
    radius: field.radius, remaining: field.remaining, duration: field.duration }],
});
```

Arrays completos substituem o estado anterior; `syncState({})` limpa. IDs iguais aos eventos impedem duplicação. Buff acompanha posição do ator; o centro gravitacional permanece no ponto fornecido. Snapshot recém-recebido não desconta dt duas vezes. Expiração/remoção produz fratura curta do gelo e colapso arcano, sem dano ou controle. Reset/dispose não fabricam feedback de término.

Instâncias `combatVfx`/`elementalVfx` emprestadas continuam atualizadas, configuradas, resetadas e descartadas pelo dono original. O wrapper nunca avança nem descarta esses pools. Possui somente os corpos e estados adicionais. Sem injeção, cria pools próprios com ambiente desativado para fixture.

## Aparência, limites e acessibilidade

| Sistema | Implementação |
| --- | --- |
| Grito | onda dourada no release, halo durável e segmentos de tempo no chão do guerreiro |
| Dash | arcos de aço ao longo do caminho efetivo e corte/contacto individual; nenhum impacto fictício em dash vazio |
| Escudo | poeira de arranque/deslocamento, choque metálico nos contatos, três estrelas sobre cada alvo realmente stunned |
| Canhão | corpo térmico facetado, pluma no cano, fogo/trilha, explosão com coroa vazada, fogo periférico e brasas |
| Gelo | corpo cristalino, trilha, fratura, anel da área, floco/pequenos cristais persistentes nos alvos frozen, quebra ao terminar |
| Gravidade | corpo roxo/ciano, trilhas entrelaçadas, anéis abertos no contato e campo com braços/debris fluindo para dentro, colapso ao terminar |

- Um batch de corpos: 64 slots alocados; limite ativo high64/medium40/low20. Corpo mantém dimensões/posição em low/reduced; reduced remove o rastro decorativo, não o corpo.
- Um batch de estados/áreas: 256 slots invariantes por qualidade, incluindo buffs, freezes, stuns e fields. Quando excedidos, `states.dropped` registra a limitação; a implementação não prova cobertura de mais de256 estados simultâneos.
- Um batch de cristais de congelamento: três/dois/um cristais por frozen em high/medium/low. Área e quantidade de alvos marcados permanecem iguais.
- Máximo de três draws adicionais; sem luz por partícula, texturas novas ou renderer extra. Pools Samurai/Elemental existentes conservam seus próprios budgets e atendem também inimigos.
- Materiais depth-tested, sem depth-write; campos e fogo vazados preservam o centro do alvo. Reduced congela órbitas/debris/turbulência, mantém área, estado e projétil.
- `getStats` inclui versão2, fases por ID, rejeições, dedup, pathDistance, corpos, estados/frozen/stunned/fields, `dropped`, pools e limites. Contadores são cumulativos; reset zera transientes e clocks.

## Três fontes realmente usadas

Commits dos clones locais conferidos com `git rev-parse HEAD`, fontes reais inspecionadas. Tentativa de abrir páginas pinadas pelo navegador de pesquisa falhou com cache miss; inspeção real foi nos clones Git já existentes. MIT integral preservada em `SAMURAI-LICENSE.txt` e `ELEMENTAL-LICENSE.txt`.

| Fonte pinada | Adaptação concreta v2 |
| --- | --- |
| [Samurai](https://github.com/achrefelouafi/SamuraiThirdPersonTemplateThreeJS/tree/496862cda55bfba3be6d02eec5aee3ca808a31a3), `vfx/BladeImpact.js`, `ShockRing.js`, `shaders/lib/blackbody.glsl.js` | Pools existentes de faíscas/brasas com dinâmica analítica e emissão térmica, impacto, arcos e onda de choque passam a responder a cast/release/path/contact das skills v2. Coroa de fogo vazada é extensão BIPX; não importação de Phoenix completo. |
| [HandCast](https://github.com/achrefelouafi/HandCastAbilityThreeJS/tree/3431252f7ad88059681d4b9b6484cb7483f7d0d6), `assets/GlacialGeometry.js`, `materials/GlacialShardStormMaterials.js` | Topologia facetada, anéis torcidos/chips, pivôs de fratura, normais e lattice de seis ramos reutilizados no projétil/coroa/fratura e gelo persistente. Corpos partilham geometria instanciada; não mesh opaco gigante ou IceStatue integral. |
| [Linear](https://github.com/achrefelouafi/LinearAbiltyCastingExtendedThreeJS/tree/8c377c886ac2c68b26bc65c8f3507905818b974a), `materials/NeonTrailMaterial.js`, `SingularityMaterial.js` | Trilha com envelope afilado, fase/pitch por fio e billboard; ring AA e enrolamento usados em contato/campo roxo. BIPX adiciona abertura central, braços com velocidade radial para dentro e debris procedurais. Atração real vem do core; shader não desloca inimigos. |

Preservados: VFX elemental dos inimigos (void/glacial/toxic), Three0.164.1, licenças, fontes originais e v1 em `assets/vfx/source-history/initial-skills-20260918/manifest.json`. Não portados: sandboxes completos, veículos/drone, Phoenix completo, pipelines/câmeras, screen refraction, todo o catálogo das fontes.

## QA e integração

- API v2 entregue ao Combat por `codex queue`, providerSessionId `01a0b6ce-ab1e-7012-9a5b-add00d2b8032`. Uma primeira tentativa usou um messageId fornecido como thread e retornou `no rollout found`; endereço corrigido, fila funcionando. Não usar `orca terminal send --interrupt`.
- CPU v2: `node tools/class-skill-vfx-cpu.mjs`; última execução16/16 em `output/qa/class-skill-vfx-v2-2026-09-19T00-08-47-931Z-cpu.json`, fonte estável. Exercita buffers reais, contato/raio, corpos low/reduced, status/eventos/snapshots, TTL, reset/dispose, overload e recursos emprestados. Não é render/gameplay.
- CPU elemental anterior preservado e rerodado7/7. O acumulador de distância ganhou tolerância consistente: agora fogo28 amostras e arcano24 instâncias em8m, iguais em30/60/144Hz. Corrige emissão duplicada por arredondamento.
- Nativo v2: `node tools/class-skill-vfx-native.mjs`; reserva `/tmp/bipx-arpg-gpu.lock` atomicamente e libera apenas token próprio. Servidor efêmero, Chrome/Metal, fecha somente seu contexto. Primeira v2 rejeitada por preparação de dash invisível aos120ms; preparação ajustada para durar a janela. Candidato final nativo passou; fontes de runtime liberadas ao Combat às00:11 UTC em19/09/2026.
- Os takes `23-30-28`/`23-32-34` da seleção inicial passaram em seus escopos, mas **não validam v2**. O corpo substituto da fixture inicial foi removido: o verificador v2 exige a mesh real do wrapper inclusive em low/reduced.
- Corte de cadáver pertence à integração Combat/Animation: Animation publicou `animatedEnemies.remove(zombie,{death:true,deathStyle:'bisect',killedBySkillId:'warrior_cleaving_dash',deathDirection})`, clones privados com planos complementares/fade. Combat deve encaminhar somente mortes confirmadas do dash e habilitar clipping. VFX não duplica esse corpse nem recompensa; QA independente do corte está no handoff Animation.

Captura v2 nativa final e inspeção visual concluídas no escopo de fixture descrito abaixo. Pendente: janela integrada estável para gameplay natural, rede/status/reconnect, arma/mão real, horda/oclusão, desempenho/mobile e JEF textual honesto. Nenhuma nota AAA/10 ou aprovação global foi atribuída.


## Candidato nativo v2 liberado

Evidência final: [`2026-09-19T00-08-48-141Z-class-skill-vfx-v2/verification.json`](../../output/playwright/2026-09-19T00-08-48-141Z-class-skill-vfx-v2/verification.json). **60 capturas**, seis loops nativos de2.25s, fonte estável, zero erros de browser/shader/GL; ANGLE Metal Apple M5 Pro. Includes antes/antecipação/release/viagem/impacto/estado, high/medium/low e reduced. Todos PNGs têm SHA256 no report; WebM no subdiretório video. Fixture sintética explícita, sem modelo/colisão do gameplay.

Inspeção visual: seis identidades revisadas em high, três corpos reais revisados em low/reduced, freeze/stun/campo revisados em low/reduced. O corpo roxo foi corrigido após a primeira v2 parecer branco demais; fogo periférico foi alterado para chamas dispersas após a versão com pequenos anéis repetidos. A coroa térmica permanece estilizada; não é fogo volumétrico completo. Os cristais de congelamento marcam os pés, não encapsulam o rig inteiro. As estrelas de stun são pequenas e ainda precisam revisão na horda/câmera real.

Recursos na fixture:28 geometrias/0 texturas antes e após800 detonações;19 geometrias após dispose; zero draws de VFX após reset. Só duas das três draws adicionais máximas estiveram simultaneamente ativas nesses quadros. Os seis loops tiveram p95 entre16.7–16.8ms; isso é fixture desktop limitada, **não** frame time de horda/mobile/natural60s.

Regressão dos inimigos: [`2026-09-19T00-10-00-884Z-elemental-vfx/verification.json`](../../output/playwright/2026-09-19T00-10-00-884Z-elemental-vfx/verification.json), fonte estável, cinco capturas e lifecycle/GL aprovados. Execução envolvida pela reserva atômica desta frente;5173 intacto.

Integração de `emitter` real e `syncState` confirmada por inspeção do main atual feito por Combat; isso ainda não substitui playback. Ferramenta nova `node tools/class-skill-vfx-gameplay.mjs` prepara captura de input real nas duas classes high e dwarf low/reduced usando servidor efêmero, opções da interface e telemetria somente leitura. Aguarda slot/janela integrada; não editar fontes VFX durante a janela do Combat.

## Arquivos desta revisão

- Runtime novo: `src/vfx/class-skill-vfx.js`, `class-skill-bodies.js`, `class-skill-fields.js`.
- Runtime estendido: `src/vfx/elemental-vfx.js`, `elemental-shaders.js`; módulos/licenças anteriores preservados.
- QA: `tools/class-skill-vfx-{support,cpu,native,gameplay}.mjs`, `tools/class-skill-vfx-preview.html`.
- Histórico: `assets/vfx/source-history/initial-skills-20260918/`; evidências em `output/qa/` e `output/playwright/` indicadas neste documento.
- Contrato/entrega: este handoff. Integração em `src/main.js` pertence ao Combat e não foi editada por esta frente.
