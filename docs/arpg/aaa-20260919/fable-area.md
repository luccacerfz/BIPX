# Fable 4 — +Área coerente com as habilidades (2026-09-19)

Tarefa `task_7f024dc9e409`. Candidato isolado `output/qa/aaa-20260919/fable-area-v1/candidate/`, copiado de `integration-v1/candidate` (assets/vendor por symlink para a integration-v1). **Fonte viva e integration-v1 inalteradas** (manifestos `live-hashes-{before,after}.txt`, `base-hashes{,-after}.txt` idênticos). Rampa inicial, custos, recargas, IDs, controles e identidade não foram tocados.

| Arquivo | integration-v1 | fable-area-v1 |
| --- | --- | --- |
| `src/combat/class-skills.mjs` | `6fa8f8709bbf47b5015535c438a77ad97b933a8dbb2da05c6b0df21b8cee93c3` | `92ae0ec1a76e0a72e3b2ae0dd81eba0f857e076be1d759810a25e5d6a28e4b03` |
| `server.mjs` | `eb80b8a675cb8b01d335916f1d63fcd297cb3052203f91135350e79840a140bd` | `c5e5e8367f1bcc2846418eb078ac9d7f57abb029d0b96e01c2541e8aeaa50063` |
| `src/main.js` | `dd23e1b5590852b7077551d31dd4ded2a3e88515e1da282ac02ed3a86e0ccc20` | `f489ab2d0076374fb3ac045b59f376186937130a204be446e9312f30e887e02e` |

Patch incremental: `fable-area-v1/patches/area-incremental-on-integration-v1.patch` (3 arquivos, 9 hunks, +30/−9; `patch -p1 --dry-run` limpo sobre integration-v1).

## Desenho

- **Fonte confiável, congelada no cast.** `beginSkill` grava `cast.areaMultiplier = sanitizeAreaMultiplier(actor.areaMultiplier)` (clamp [1, 2,25] = 5 pilhas × 0,13 × Tempestade Prismática 1,35; qualquer valor inválido → 1) e `cast.radius = getSkillRadius(def, m)`. O *intent* de rede nunca é lido para isso. No servidor, `handleServerSkill` passa `areaMultiplier: attackStats(client.progression).areaMultiplier` **depois** do spread de `client.state`, de modo que nada reportado pelo cliente o sobrepõe. Offline usa `getAreaMultiplier()` (mesma fórmula, mesma progressão local que já governa cone da espada/explosões).
- **Lei de escala.** "+13 % de área" literal: a área cresce linearmente com o multiplicador, o raio com a raiz (`r = r₀·√m`). 5 pilhas: Canhão 3,4→4,37 m, Glacial 4→5,14 m, Núcleo 5→6,42 m (+65 % de área, não +172 % como seria com raio linear — contido de propósito para congelamento/atração). Expoente isolado em `getSkillRadius` para ajuste do Combat.
- **O que escala.** Só `shape: 'projectile'` com área anunciada: explosão do Canhão, área do Glacial, raio do campo do Núcleo (o campo guarda `radius`/`areaMultiplier` próprios; centro fixo no impacto). Física do projétil, `projectileRadius`, range, parada em parede, linha de visada do impacto à vítima, resistências de chefe, `hitIds` (uma recompensa por vítima) e cleanup são os mesmos caminhos de código.
- **Corte/Escudo: examinados, não escalados.** A faixa é um sweep ao longo do caminho percorrido, não uma área anunciada; as descrições não citam largura; o VFX limita a largura da esteira a 1,05 (`class-skill-vfx.js:144`) e a frente dash-segment do Astra depende dessa geometria. Alargar a faixa mudaria contato/leitura sem texto que o anuncie. Distância autoritativa intacta (teste). O raio 3 do Grito é apenas visual do buff próprio. Recomendo manter assim; Aldric já recebe +Área no cone da espada.
- **Eventos/status/HUD/VFX.** `eventFor` e `persistentEvent` emitem `radius` efetivo + `areaMultiplier` em todas as fases (cast, release, travel, impact, status, end). `class-skill-vfx.js`/`class-skill-fields.js`/`gravity-field-*` já consomem `payload.radius` (clamp 18), então nenhum arquivo de VFX foi editado. `getSkillHud` recebe `areaMultiplier`, expõe `radius` por skill e reescreve a descrição com o raio efetivo ("…raio 4,4 m…", "…área de 5,1 m…", "Campo fixo de 6,4 m…"); sem upgrade o texto é byte a byte o da integration-v1. `restoreSkillSnapshot` re-deriva o raio do campo a partir do multiplicador saneado (snapshot legado → 5 m; `radius: 500` adulterado → 7,5 m máx.).

## Cobertura (sem render)

**CPU — `tools/verify-area-cpu.mjs` → `evidence/verify-area-cpu.json` (passou).** Mesmo módulo usado offline e importado pelo servidor.

| Skill | 0 pilhas | 1 | 3 | 5 | Vítimas no raio de 0,25 m (0→5 pilhas) |
| --- | --- | --- | --- | --- | --- |
| Canhão | 3,400 | 3,614 | 4,009 | 4,367 m | cresce; nenhuma vítima além do raio, nenhuma omitida dentro |
| Glacial | 4,000 | 4,252 | 4,716 | 5,138 m | 15 → 20 |
| Núcleo | 5,000 | 5,315 | 5,895 | 6,423 m | 19 → 25 atingidos; 20 → 26 puxados |

Também: (1) **baseline** — as 6 skills emitem eventos e acertos idênticos à integration-v1 com multiplicador 1/ausente (única diferença: campo novo `areaMultiplier: 1`); (2) **faixas** — Corte/Escudo com 5 pilhas: mesmos eventos, vítimas e distância; (3) **sólidos** — parede dentro do raio ampliado: 18 → 9 vítimas, nenhuma atrás da parede; projétil para na parede em z = −5 com 0 vítimas; (4) **chefe** — congelamento 0,8 s, `resisted`; (5) **confiança** — multiplicador alterado após o cast não muda o raio; 999/−5/NaN/∞/'5'/null/{} ficam em [3,4; 5,1]; `radius/areaMultiplier/area` no intent ignorados; (6) **um acerto por vítima**; (7) **campo** — centro fixo, todos os status com o raio efetivo, `end` final e `state.fields` vazio; (8) **snapshot+HUD** — raio do snapshot = raio do evento e sobrevive a JSON; descrições conferidas.

**Servidor real por WebSocket — `tools/verify-area-server.mjs` → `evidence/verify-area-server.json` (passou).** Cópia isolada do servidor do candidato via `tools/quality-protocol.mjs`; IPC privado posiciona monstros/jogador e define as pilhas na progressão **do servidor** (fixture rotulada). Cliente hostil envia `radius: 60, areaMultiplier: 9, area, stacks.area: 99, damageMultiplier: 99` no `skill` e `areaMultiplier/radius/upgradeStats` no `state`:

| Pilhas no servidor | Raio nos eventos | Congelados | Borda da vítima mais distante | Borda do não atingido mais próximo |
| --- | --- | --- | --- | --- |
| 0 | 4,000 m | 7 | 3,945 m | 4,511 m |
| 5 | 5,138 m | 10 | 4,912 m | 6,122 m |

Núcleo com 5 pilhas: 8 eventos de status, snapshot autoritativo (`skills.fields[0]`) e evento `end` com 6,423 m e o mesmo centro; 1 `end` natural; desconexão com campo vivo → 1 `end` `reason: disconnect` com o mesmo raio (cleanup). Regressão: `tools/verify-class-skills.mjs` e `verify-class-skills-server.mjs` executados com cwd = candidato, ambos exit 0 (`evidence/regression/`).

## Coordenação com Grok

Mensagem comum (sem interrupção) enviada a `term_40612a7e…` e contrato em `fable-area-v1/grok-snapshot-field-contract.md`: `snapshotActive` deve incluir `areaMultiplier` e `radius`; `restoreActive` **não** confia em `radius` — re-deriva com `sanitizeAreaMultiplier` + `getSkillRadius` (exportados por este patch); snapshot legado = 1. Não editei `grok-network-v2`. Sem confirmação de leitura do Grok até o envio deste relatório. Atenção no merge: um cast restaurado sem `radius` faria o teste de área usar `undefined` — o restore precisa preencher os dois campos.

## Limitações

- **Nada renderizado**: VFX/horda/HUD visual **não verificados**; afirmo só que os consumidores de VFX leem `payload.radius` (clamp 18 m > máx. 7,5 m) e que a descrição do HUD muda. `label()` do HUD corta em 100 caracteres; a descrição mais longa (Núcleo) tem 99.
- Multiplayer com pilhas ganhas por level-up natural e Tempestade Prismática ativa não foram jogados; o valor vem da mesma `attackStats` testada.
- Cliente online exibe o raio pela progressão espelhada; se houver atraso de sincronização, o HUD pode mostrar o raio anterior por instantes — eventos do servidor sempre mandam.
- Balanceamento do expoente (√m) é proposta; Combat decide. Sem JEF, sem nota.
