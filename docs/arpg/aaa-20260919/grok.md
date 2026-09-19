# Revisão Grok 4.6 high — física, autoridade, multiplayer, confiabilidade, pacing

**Auditoria desta frente encerrada** em 2026-09-19T08:56:57Z. **Não é aceite de qualidade.** Alvo permanece **10/10 em cada uma das 12 dimensões** de `docs/quality-gates.md`. Evidência ausente fica pendente. JEF textual real não foi submetido; revisão visual/sonora continua com Astra e donos de arte/VFX/SFX. Sem Gemini.

Coordenação vigente: sessão `01a0b8c0-c642-7ee3-9f38-5f7234f855fb` (`docs/arpg/goal-production-20260919.md`). Publicação Vercel/produção só depois de candidato validado; **Render público está 503 suspend** — esta frente não republica, não chama esse endpoint como prova e não trata 503 como evidência de gameplay. Servidor local **5173 PID 95599 HTTP 200**; ledger `7f580798…` intacto.

## Encerramento — WebSocket isolado

Candidato **byte-idêntico** ao CPU (`source-hashes-closeout.json`, `changed_count: 0`). Servidor efêmero próprio, sem fixtures de monstros, sem 5173, sem GPU: `output/qa/aaa-20260919/grok/focal-ws-reconnect.json` **5/5**.

| Check | Resultado |
| --- | --- |
| Resume na graça 30 s | Identidade e `runId` preservados (`resumed: true`) |
| P0 buff no reconnect | Grito vivo `remaining=7.85` → welcome `buff: null`, `lock=0`, cooldown `13.3` e recurso `81.6` (gasto mantido, efeito perdido) |
| Late join com caster ligado | Observador recebe campo gravitacional `remaining=4.8` |
| P1 late join no canhão | `lock=0.32`, snapshot **sem** `active` (keys: classId/resource/cooldowns/lock/sequence/buff/fields/movement) |
| P0 peer no disconnect | `skillEvent` `phase=end` `status=gravity` `reason=disconnect` |

Isso fecha o contrato de auditoria técnica desta frente: P0/P1 agora estão no CPU **e** no protocolo real. Dois browsers naturais, rede adversa, soak, JEF e endpoint público funcional **permanecem pendentes** e bloqueiam Multiplayer/Confiabilidade/Produção em 10/10. Patches isolados inalterados em `output/qa/aaa-20260919/grok/patches/` — Combat integra.

Frente: terminal `term_40612a7e-27f9-419c-bfa7-c8eab9c021fa`, modelo `grok-4.6` high. Goal original `01a0b6a0-2a5d-7822-8f7d-0a6824912952`; coordenador atual `01a0b8c0-c642-7ee3-9f38-5f7234f855fb`. Sem disputa de runtime. Sem commit/merge/push/deploy/reset/clean.

## Candidato inspecionado

Fonte estável durante a prova CPU (`sourceChangedDuringRun: false`). Captura `2026-09-19T08:49:32.286Z`.

| Arquivo | SHA-256 |
| --- | --- |
| `src/physics/contacts.mjs` | `912c00fe18457ac0951812d31a6215bbff1cb01b05e9fae619e8aa2cbe4db6d4` |
| `src/physics/navigation.mjs` | `e46cc63f5964aabd2ecd737a5ceaef8911863a2e081ad1563f01a4761a77b98d` |
| `src/combat/class-skills.mjs` | `6fa8f8709bbf47b5015535c438a77ad97b933a8dbb2da05c6b0df21b8cee93c3` |
| `src/combat/crowd-control.mjs` | `2cbbab3ebb7ff507f24f3057f659eea85c0b8470e708180c8a1c265806d8bb39` |
| `src/combat/collision-heights.mjs` | `cd75eeeb84218f060583cea5f64dbf8b8373b0cdf274ad148bc64eb402c4ecce` |
| `src/main.js` | `d9e6fed48d8609acbd495f9a1c747bbe8e6b9d3cc00447aa75e4896b156b6d3b` |
| `server.mjs` | `eb80b8a675cb8b01d335916f1d63fcd297cb3052203f91135350e79840a140bd` |
| `src/progression/authority.mjs` | `ce3311cef97a84dc9e60321ae4353a7fcdd2b238f60464b21080f7950ba58e39` |
| `src/render/environment-layout.js` | `9f6ebea2041910f829042ec14f177cfb26beee44ebcd9e5f5c11333d0c9c486c` |

Prova: `output/qa/aaa-20260919/grok/focal-cpu.json` — **16/16 checks**, zero falhas. Ferramenta: `output/qa/aaa-20260919/grok/focal-cpu.mjs`. Patches **não aplicados**: `output/qa/aaa-20260919/grok/patches/`.

Não foram chamadas suíte AAA, fixtures de gameplay, `verify:all`, browsers nem GPU.

## Achados

Separação: **reproduzido** (CPU no candidato atual), **estático confirmado** (leitura + linha), **pendente** (falta evidência nativa/dois browsers/soak).

### P0 — reproduzido

**Disconnect cancela buff, campo e casts em voo apesar da graça de 30 s**

- **Impacto:** o jogador que perde o socket (aba, Wi-Fi, troca de rede) gasta Fervor/Foco e cooldown e o efeito some para o grupo. Grito acaba; o núcleo gravitacional some no meio do puxão; canhão/gelo em viagem evaporam. O `resumeToken` ainda recupera identidade, XP e runId, mas não o estado das seis skills. O contrato Combat pede reconstrução por `skillSnapshot` em late join/reconnect.
- **Reprodução:** `beginSkill` grito → `tick(0.5)` deixa `buff.remaining=7.88` → `cancelSkills(..., 'disconnect')` (literal de `removeClient`) zera buff/lock → `restoreSkillSnapshot` devolve `buff=null`. Gravidade: campo com `remaining=4.72` some no mesmo cancel. Comando: `node output/qa/aaa-20260919/grok/focal-cpu.mjs`.
- **Arquivo/linha:** `server.mjs:2180` (`cancelSkills` em `removeClient`). Graça `reconnectGraceMs=30000` em `server.mjs:38`. Snapshot sem `active`: `src/combat/class-skills.mjs:20-24`.
- **Correção:** patch `patches/01-disconnect-keep-skills.diff`. Não cancelar em `removeClient`. Cancelar em `expireClient`, morte e `startClientRun`. `playerLeft` pode marcar apresentação desconectada com `resumable:true`. Integração Combat; não alterar autoridade para mascarar VFX.

### P1 — reproduzidos

**1. `skillSnapshot` / `restoreSkillSnapshot` omitem `active`**

- **Impacto:** late join e o pacote `skillState` a cada 0,2 s reconstroem o cliente sem projétil/dash em curso. Observador não vê o canhão a meio caminho; o próprio caster, se só o snapshot for a fonte, perde o restante do travel.
- **Reprodução:** canhão após 0,4 s tem `active.length=1`, `released=true`, `distance>1`. Snapshot keys: `classId,resource,cooldowns,lock,sequence,buff,fields,movement`. Restore → `active=[]`. Avançar o estado restaurado não gera hits.
- **Arquivo/linha:** `src/combat/class-skills.mjs:20` e `:25`.
- **Correção:** `patches/02-skill-snapshot-active.diff`. Serializar `active[]` com `hitIds` como array; restore reconstrói `Set`. Limitar a 3 casts da classe. Apresentação late-join deve emitir `travel` a partir do `active` restaurado, sem replay de `impact`.

**2. Movimento de rede sem teto de velocidade**

- **Impacto:** o servidor varre o segmento, então **não atravessa parede**, mas aceita dezenas de metros num único `state`. Pedido 40 m a partir de `(0,0)` andou **17,726 m** no layout real; o passo legal `stepActor` 8 m/s × 50 ms anda **0,40 m**. Cliente modificado ou pacote atrasado teleporta em campo aberto. Physics já registrou que Combat ainda precisa desse teto.
- **Reprodução:** `moveActor` com o delta de `normalizePlayerState` (`server.mjs:599-602`) vs `stepActor` 50 ms. Focal CPU, check “network state accepts unbounded open-space displacement”.
- **Arquivo/linha:** `server.mjs:599`.
- **Correção:** `patches/03-network-move-cap.diff`. `stepActor` com dt do último pacote (cap 0,1 s) e teto ~12 m/s na locomoção ordinária. Dash/charge continuam só pelo `moveCaster` autoritativo. Excesso → `positionCorrection`.

**3. Crowd 10 corpos / dt 100 ms ainda penetra fundo**

- **Impacto:** freeze/stun **já imobiliza** um alvo contra um perseguidor (`frozenTravel=0` com `separateControlledActors`). Com 10 corpos no mesmo ponto e dt 0,1 s, `maxPenetration=0.913 m`. Em frame longo ou empilhamento no núcleo gravitacional, a horda compacta atravessa-se; o gelo parece arrastar.
- **Reprodução:** focal CPU, check de crowd. Confirma o limite histórico Physics, não uma regressão da promoção `912c`.
- **Arquivo/linha:** `src/combat/crowd-control.mjs:5`. Solver: `src/physics/contacts.mjs` `separateActors`/`pullActors`.
- **Correção:** subpassos movimento→crowd quando `maxPenetration>0.2`, ou sweep dinâmico no avanço. Não fingir zero overlap em pose impossível. Sem patch de runtime neste lote.

### P2 — reproduzidos / estáticos

**HUD omite duração do campo gravitacional.** `getSkillHud` publica o buff do grito e zero statuses com campo ativo (`src/combat/class-skills.mjs:52`). O jogador não lê o tempo restante do puxão. Patch `patches/04-hud-gravity-status.diff`. GUI já desenha `statuses` recebidos.

**Simulação capada a 35 ms.** `src/main.js:5949` `Math.min(rawDt, 0.035)`. Evita túnel; frames piores viram câmara lenta. `perfStats.dt` guarda o bruto. Sem série nativa de frame-time nesta frente — Performance continua pendente.

**Alocações pull+crowd.** 120 corpos × 60 Hz: **1,54 ms/frame** só no solver neste host, sem render. Não é prova de 60 fps. Reuso de buffers fica para Physics/Combat após A/B estável.

## Contratos CPU que passaram no candidato atual

Não promovem o jogo a 10/10. São regressões que **não** voltaram a falhar nesta fonte:

- Seis IDs canônicos, três slots por classe, sem alias antigo.
- Offline e servidor usam `moveActor(..., { stopOnContact: true })` e `pullActors` em lote; cliente MP não simula dano (`updateClassSkills` retorna se `multiplayer.enabled`).
- Dash/charge param no primeiro sólido real e não acertam atrás da parede.
- Projétil: parede vence empate; área não vaza através de sólido fino.
- Gravidade: centro fixo, puxa elegíveis, expira; jogador `inverseMass:0`.
- Freeze/stun atingem todos os alvos válidos; boss `0.8 s` / `0.65 s` com `resisted`.
- Dash: um hit por vítima, `deathStyle:'cleave'` só em `warrior_cleaving_dash`.
- `beginSkill` ignora `damage`/`cost` spoofados; slot inválido recusa.
- `dt=0.1` não fura parede de 20 cm no dash.
- `findFreePosition` recusa spawn impossível (`found:false`).
- Classe não troca depois de `playing` (`normalizePlayerState`).
- `rewardKill` é interno; o servidor só chama após `Map.delete`. Coleta de drop com o mesmo `requestId` é duplicata. Não prova drops em gameplay natural.
- Freeze contra um perseguidor: translação 0 m com a política atual de massa fixa.

## Dimensões (alvo 10; nota máxima só com evidência)

| Dimensão | Nota | Estado |
| --- | --- | --- |
| Game design e identidade | `null` | IDs/custos/autoridade CPU ok. Fantasia, contra-jogo e input natural pendentes (Fable/Astra). |
| Animação / locomoção / contato | `null` | Fora desta frente. Anti-slide continua pendente no brief AAA. |
| Direção de arte | `null` | Fora desta frente. |
| VFX | `null` | Fora desta frente. Dash remoto e descontinuidade gelo/gravidade na boca do rifle: revalidar nos donos, não reabertos aqui. |
| Sensação de combate | `null` | Sweeps/stop/pull CPU ok. Vídeo de input natural e dash MP interpolado por evento: pendente. |
| UI e fluxo | `null` | Campo gravitacional sem status na HUD (P2). Restante Fable/GUI. |
| Mobile | `null` | Sem dispositivo físico. |
| Áudio | `null` | Não ouvido. |
| Desempenho | `null` | Sem série nativa. Solver 120 corpos 1,54 ms/frame CPU. Cap 35 ms. GPU livre não usada para não disputar. |
| Multiplayer | `null` | P0 disconnect e P1 `active` confirmados em WebSocket isolado. Teto de movimento CPU. Dois browsers naturais, rede adversa e endpoint público (Render 503) pendentes. |
| Acessibilidade | `null` | Fora desta frente. |
| Confiabilidade | `null` | Spoof/slot/spawn/cancel CPU ok. Contrato resume falha (P0). Soak e sessão longa pendentes. |

Nenhuma dimensão está 10. Não alterei limiares.

## JEF

Não submetido. `node tools/evaluate-jev.mjs` avalia texto, não vê o jogo. Root Astra consolida observações humanas e decide o envio. Este arquivo é evidência técnica, não score JEF.

## Pendências herdadas, revalidadas só no domínio desta frente

- Dash art2 segmento remoto, gelo/gravidade na boca do rifle, copas, locomoção anti-slide, qualidade sonora, dispositivo físico, soak: **permanecem pendentes** (não exercitados aqui; não afirmados como corrigidos nem como ainda presentes na apresentação).
- Physics runtime `912c` / navegação `e46cc63f` / skills `6fa8f870` / main `d9e6fed4` / server `eb80b8a6` coincidem com os handoffs Combat/Physics lidos no início.

## Encaminhamento

Auditoria Grok **completa** no candidato `main d9e6fed4` / `server eb80b8a6`. Combat aplica os quatro diffs na ordem do `patches/README.md`, em janela própria, com teste isolado **antes** de qualquer restart de 5173. Esta frente não reinicia o servidor do usuário, não publica Vercel e não tenta recuperar o Render 503.

Coordenador (`01a0b8c0-c642-7ee3-9f38-5f7234f855fb`) recebe este arquivo como entrega. Revalidação desta frente só depois da integração Combat, ainda sem suíte AAA e sem GPU alheia.
