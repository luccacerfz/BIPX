# Fable 5 — QA nativo v3: origem visual gelo/gravidade e +Área (2026-09-19)

Tarefa `task_fc56e72eb35f`, somente QA. Pasta `output/qa/aaa-20260919/fable-native-v3/`. **Fonte viva e `integration-v2/candidate` inalteradas** (manifestos antes/depois idênticos). Sem JEF, sem deploy; late join **não** foi exercitado e não é dado como resolvido.

| Item | SHA-256 |
| --- | --- |
| `integration-v2` `src/vfx/projectile-origin-bridge.js` | `f3514585426a9f552c9880757931192eb7ae3c52a22b8efa8b3474ef4d39ffd2` |
| `integration-v2` `src/vfx/class-skill-vfx.js` | `46dd5df93dc197319690018d9b42bb2dd742a048b43f59804aed591a3978177f` |
| `integration-v2` `src/main.js` | `f489ab2d0076374fb3ac045b59f376186937130a204be446e9312f30e887e02e` |
| cópia instrumentada `src/main.js` (única diferença de fonte cliente) | `5659cf022e1a781d795501777f6bfa3534783cb28898bfd11ab035b8756cfc1a` |

**Instrumentação (declarada):** `fable-native-v3/instrumented/` = integration-v2 + um hook somente leitura `window.__fableQA` (cena, câmera, posição mundial do muzzle local/remotos) em `main.js`, e `server-qa.mjs` = `server.mjs` + IPC privado `qa-area-stacks`. Nenhuma regra de jogo alterada. O hook existe para ler **atributos realmente enviados à GPU** a cada frame (`ClassSkillProjectileBodies.aOrigin/aStyle`, `ElementalHelicalRibbons.aOrigin/aEnd`, `ElementalImpactSurfaces.aParams`, `ClassSkillStatusFields.aState`, escala dos filhos de `GravityHorizonPool`), além de `getStats` do bridge e vídeo.

## Revisão estática do bridge e do wrapper

`projectile-origin-bridge.js` (90 linhas) é só apresentação: nunca altera evento/contato; falha fechado (sweep inválido → `invalid-sweep`, socket bloqueado → `blocked-socket`, offset/segmento bloqueado → abandona e mostra só o endpoint autoritativo, gap > 8 m → `segment-gap`, socket > 3 m ou evento > 250 ms → `stale-or-distant-socket`); no terminal o alvo visual é exatamente o autoritativo. `cannon-origin-bridge.js` virou wrapper de 5 linhas do bridge compartilhado. A suíte CPU anterior (`frost-gravity-origin-v1/verify-cpu.mjs`) reexecutada contra a integration-v2: **192/192 casos, exit 0** (`cpu192/frozen-v2.log`). Observação: o emitter é amostrado quando o evento é tratado (`main.js` `presentClassSkill`, após `updateWorldMatrix`), ou seja, com a pose do último frame renderizado; nas medições abaixo isso ficou ≤ 1–12 cm do muzzle lido pós-render.

## Captura no jogo real

`tools/native-origin.mjs`: servidor próprio (porta 5190, Supabase off, ranking descartável), Chromium headless ANGLE/Metal, **dois clientes reais na mesma sala** ("2/4"), AltaA = `high`, LeveB = `low` + reduzir movimento, ambos Lyra. Mira por mouse real, casts por **Dígito 2/3**, defesa com ataque básico real, cartas por dígito, reinício por Enter. Sem HP invulnerável, sem golpes/XP/inimigos fabricados. Lock de GPU próprio em todas as janelas (nunca estava ocupado). Vídeos contínuos dos dois clientes. Zero erros de página/console.

| Execução | Conteúdo | Casts analisados (lançador + observador) |
| --- | --- | --- |
| `mp-natural-zero-stacks` | 10 rodadas: aberto, mira em inimigo, direita, esquerda **andando**, baixo; A lança/B observa e vice-versa | 20 casts × 2 visões |
| `mp-FIXTURE-area-5-stacks` | **FIXTURE DE PROGRESSÃO DO SERVIDOR** (+Área = 5 pilhas por IPC; não é gameplay natural) | 8 casts × 2 visões |
| `solo-offline-zero-stacks` | primeira execução entrou em solo por falta de `?ws=`; mantida como evidência offline local (sem remoto) | 12 casts locais |

Terminais obtidos naturalmente: alcance total (20/18 m), sólido/paredão (4,4–16,9 m), contato com inimigo (2,7–12,7 m), e 5 casts à queima-roupa (< 1,1 m) — cada um visto pelos dois clientes.

### Resultado por critério (bridge ativo; mediana [mín–máx])

| Critério | Local (lançador) | Remoto (observador) |
| --- | --- | --- |
| Início da trilha ↔ boca (só `high`; reduced não desenha trilha por projeto) | 0,01 m [0,002–0,12] | 0,04 m [0,001–0,09] |
| Primeiro corpo visível ↔ boca | gelo 0,40 m, grav. 0,48 m [0,40–0,59] | idem [0,39–0,61] |
| Deslocamento lateral inicial → após 3,6 m | 0,12–0,20 m → **0,000 m** | 0,20 m → ≤ 0,005 m (0,046 m no cast andando) |
| Altura residual após 3,6 m | 0 | 0 (0,31 m em 1 cast andando, settle = 2× offset; zera depois) |
| Continuidade da trilha (maior vão entre segmentos) | **0,000 m** | **0,000 m** |
| Corpo além do terminal | 0 em 27/28 | 0 em 27/28 (ver D-1) |
| Corpo andou para trás | nunca | nunca |
| Corpo parado na última posição | ~33 ms (1–2 frames) | 33–51 ms |
| Último corpo ↔ terminal | 0,37–0,73 m [0,01–1,15] | idem |
| Fim da trilha ↔ terminal | 0,07–0,45 m | 0,05–0,33 m |
| Socket bloqueado | 4 casts: `blocked-socket` nos dois clientes, corpo nasce na origem autoritativa, sem atravessar | 1 divergência só de rótulo (`blocked-offset` no remoto); ambos desligados |

Leitura: origem na boca, corpo e trilha coerentes, convergência total para a linha autoritativa, nada atravessando sólidos, local ≈ remoto e `high` ≈ `low/reduced` (reduced mantém corpo/anel/campo e omite só a trilha). "Primeiro corpo a 0,4 m da boca" é o primeiro passo de rede (24 m/s × tick), não um salto: a trilha começa na boca. O corpo não é redesenhado no evento terminal — some em ~33 ms a até um passo do terminal enquanto nova/campo nascem exatamente no terminal (distância centro↔impacto **0,000 m** em todos os casos). Aceitável; registrado.

**Campo gravitacional fixo:** anel renderizado com centro = impacto (0,000 m), deriva máxima 0,0000 m em ~300 frames, idêntico nos dois clientes; encerra ao expirar e some em 5–9 frames quando o lançador morre (cleanup). Quadros de vídeo `evidence/frames/fixture-{A,B}-11.5.png` mostram o mesmo campo no mesmo poste nos dois clientes.

### Defeito reproduzido

**D-1 · P2 · Corpo do projétil aparece além do contato à queima-roupa.** No cast de gravidade da LeveB com terminal a 0,99 m (fixture-run, rodada 4; nessa vida as pilhas já eram 0), o corpo renderizado ficou **0,38 m (local) e 0,59 m (remoto) além do terminal autoritativo**, deslocamento lateral inicial 0,8–1,0 m. Causa: o offset socket−origem tem ~1,4 m de componente *para a frente*; somado ao alvo autoritativo, o corpo corre à frente da autoridade, e se ela termina antes da boca o corpo já passou do contato. Negativo preservado (`round-4-enemy-LeveB-slot3.json`, vídeos da execução fixture). Reprodução CPU no bridge congelado: 0,58 m além com terminal a 0,99 m, 0,30 m com 2 m, e segmento visual para trás no terminal (`evidence/verify-point-blank-cpu.json`).
**Proposta isolada** `patches/origin-bridge-point-blank.patch` (2 arquivos, 5 hunks, dry-run limpo): opção `clampMuzzleLead` (ligada só para gelo/gravidade; canhão byte-idêntico) separa o avanço frontal, mantém o corpo na boca até a autoridade alcançá-la e abandona com `terminal-before-muzzle` se o terminal ocorrer antes da boca. CPU: overshoot 0 em todos os casos, voo longo idêntico após o settle, **192/192 da suíte anterior continuam passando** (`cpu192/proposal.log`). **Não verificado com render** — dono VFX decide.

## +Área: HUD × evento × render

| Situação | HUD (`radius`/descrição) | Evento | Nova de gelo renderizada | Anel do campo renderizado | Nébula (escala) |
| --- | --- | --- | --- | --- | --- |
| 0 pilhas (natural) | 4 / 5 m | 4 / 5 | 4,000 | 5,000 | 5,616 |
| **1 pilha obtida naturalmente** (LeveB escolheu +Área 2× com tecla real em vidas distintas) | 4,252 / 5,315 | 4,252 / 5,315 | 4,252 | 5,315 | 5,970 |
| 5 pilhas — **fixture de servidor** | 5,138 / 6,423 (LeveB) | 5,138 / 6,423 | 5,138 | 6,423 | 7,214 |

Raio renderizado = raio do evento em 100 % dos casts, nos dois clientes e nas duas qualidades; nébula = r × 0,96 × 1,17. Ressalvas: (a) na fixture, o HUD da AltaA ainda mostrava 4/5 m ~0,7 s depois do IPC enquanto o evento já saía com 5,138/6,423 — o HUD usa o espelho local de progressão e a fixture não gera mensagem de progressão; com progressão natural HUD = evento sempre. Risco real apenas de atraso transitório. (b) Estático: `gravity-field-visual.js` limita o disco do horizonte (`uSize = min(r·0,62; núcleo·4,1)`, núcleo travado em r ≥ 5), então com pilhas o **miolo** não cresce; anel e nébula crescem. (c) Tooltips capturados ao final mostram 4/5 m porque as mortes reiniciam a progressão — coerente.

## Não alcançado / limites

Máximo natural foi 1 pilha (jogadores parados para lançar morrem cedo: 8 e 4 mortes nas execuções MP); 5 pilhas só por fixture rotulada. Headless com GPU real; sem dispositivo físico, sem áudio. Late join, reconexão no meio do voo e perda de pacotes não exercitados. Proposta D-1 sem verificação nativa. Análise completa: `evidence/analysis.json`, `analysis-summary.json`; brutos por cast em `evidence/*/round-*.json`; vídeos `evidence/*/*.webm`.
