# Backlog consolidado — BIPX rumo a AAA (trilha T6)

Gerado em 2026-09-19 por um agente Fable de análise (somente leitura do runtime). Branch `aaa-loop`, HEAD `d657af5`; `git diff 7ea3d6a HEAD` toca apenas `docs/`, portanto **o código analisado é o que está em produção** (integration-v5, `src/main.js f0600b67…`, `server.mjs bcbeb948…`). Nenhum arquivo do repositório foi editado além deste; nenhum browser, GPU, deploy, porta 5173, `.data/`, `.env` ou terminal Orca foi tocado. Evidências desta trilha: `output/qa/aaa-loop/t6/` (fora do git).

**Fontes lidas:** `docs/quality-gates.md`, `docs/quality-rubric.json`, `docs/arpg/README.md`, os sete `docs/arpg/*-handoff.md` e seus documentos satélites, todos os relatórios de `docs/arpg/aaa-20260919/`, as notas de `output/qa/aaa-20260919/fable-closeout/*/`, `docs/arpg/aaa-loop/LOOP-STATE.md` e o relatório JEF diagnóstico (`output/qa/aaa-20260919/jef-diagnostic-v1/report.json`). Quatro subagentes leitores extraíram as frentes Animação, VFX/Áudio, Environment/Física e GUI/Combate/Rede; um quinto inventariou as suítes. Tudo foi deduplicado aqui e os itens de maior peso foram reconferidos no código.

**Não duplicado de propósito:** poder/ritmo dos heróis (T1), upgrades 2.0 (T2) e arsenal legado (T3) estão em implementação; a crítica visual (T5) e a pesquisa JEF (T4) também. O que pertence a essas trilhas está só listado na seção 1.13, com alertas para quando pousarem.

## Legenda

| Campo | Valores |
| --- | --- |
| Tipo | **DR** defeito reproduzido · **SE** suspeita estática · **LE** lacuna de evidência · **CI** candidato inacabado · **DEC** decisão pendente |
| Status no código | **VC** = verificado no código publicado (arquivo:linha) · **SR** = segundo o relatório, não reconferido |
| Sev. | **C** crítica (impede a dimensão de passar de ~8, ou quebra o jogo) · **A** alta · **M** média · **B** baixa |
| Precisa | **CPU** só CPU · **GPU** browser/GPU (headless com ANGLE/Metal serve) · **2C** dois clientes reais · **AST** assets novos · **DEV** dispositivo físico · **HUM** olhar/escuta humana · **DEC** decisão do dono/orquestrador |
| Esf. | **S** ≤ meio dia de agente · **M** 1–2 dias · **L** vários dias ou iterações |
| Fontes | nomes curtos referem-se a `docs/arpg/aaa-20260919/` (ex.: `fable-natural`), ou a `docs/arpg/` (ex.: `animation-handoff`), ou a `docs/` quando indicado |

## 0. Resumo executivo

**88 itens abertos.** Por severidade: **5 críticas, 25 altas, 41 médias, 17 baixas.**

| Dimensão | JEF 09:50Z | Itens | C | A | M | B |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| game_design | 4,6 | 5 | 0 | 2 | 3 | 0 |
| animation | 3,1 | 10 | 1 | 3 | 6 | 0 |
| art_direction | 3,7 | 5 | 0 | 2 | 2 | 1 |
| vfx | 4,2 | 13 | 0 | 2 | 7 | 4 |
| combat_feel | 4,6 | 6 | 0 | 3 | 1 | 2 |
| ui_ux | 4,8 | 6 | 0 | 0 | 4 | 2 |
| mobile | 0,1 | 6 | 2 | 1 | 2 | 1 |
| audio | 0,1 | 5 | 1 | 1 | 1 | 2 |
| performance | 0,9 | 7 | 1 | 2 | 3 | 1 |
| multiplayer | 3,5 | 9 | 0 | 4 | 4 | 1 |
| accessibility | 4,0 | 6 | 0 | 2 | 3 | 1 |
| reliability | 4,4 | 10 | 0 | 3 | 5 | 2 |

Todas as notas JEF são preliminares com `coverage: pending` (`evidence_complete` 0,03): **o juiz lê só texto e hoje nenhuma dimensão tem evidência completa.** Entre 06:38Z e 07:48Z a nota de multiplayer foi de 1,5 a 6,9 com o mesmo código, só porque o texto da evidência mudou. Fechar lacunas de evidência rende mais nota, mais rápido, do que qualquer correção isolada — desde que a observação escrita seja honesta.

### Os dez itens mais importantes

1. **PF-01** — não existe série sustentada de frame-time/memória do candidato publicado em hardware declarado. É a dimensão mais baixa que **não** depende do dono.
2. **RL-01 + RL-02** — a rede de regressão está furada: 7 suítes CPU/protocolo falham no código publicado por defasagem do harness, `verify:all` nunca rodou no v5 (37 de 41 suítes sem evidência) e o runner bate na porta 5173 do usuário.
3. **Sessão do dono (MO-01, MO-05, AU-01, AC-02, CF-06)** — sem aparelho físico, escuta e leitor de tela, mobile e áudio ficam em ~0,1 e acessibilidade/combate têm teto.
4. **AN-01 (+AN-02)** — anti-sliding dos heróis reprovado (`acceptedNoSliding:false`); é o critério explícito da dimensão animação.
5. **CF-01** — melee de Brute/Orc/CowWalker/BloodCow aplica dano em t=0 e mostra o gesto depois, no solo e no servidor: golpe sem telegraph.
6. **CF-02 + VF-03** — no multiplayer o dano no jogador não toca som nem sacode a câmera, e projétil inimigo some sem impacto. A produção é multiplayer.
7. **MP-02** — reconexão frágil: token só em memória, sessões num `Map` do processo, vaga em graça conta no limite de 4 (recarregar pode dar `roomFull`).
8. **MP-06 + PF-02** — navegação: BloodCow no servidor sem `attackRegion` (busca esgota 768 nós, chefe de marco pode travar) e A* repetido que leva o P95 a 20,9 ms com picos de 180 ms.
9. **AU-02** — 17 eventos ainda em oscilador, música de 4 osciladores, sem passos; fica mais exposto quando o arsenal (T3) voltar.
10. **AD-01 + AD-04** — arte: piso/materiais/repetição e BloodCow procedural abaixo do alvo, e nenhuma revisão artística global (só aceites focais).

## 1. Backlog por dimensão

### 1.1 game_design

| ID | Item | Fonte | Tipo | Status no código | Sev. | O que fecha | Precisa | Esf. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GD-01 | Nenhuma run natural passou da onda 2: chefes, elites, cartas raras/épicas, fim das pilhas, economia tardia e contra-jogo nunca foram exercitados | `fable-natural` §Limitações; `fable` D-01 | LE | n/a (evidência) | A | Depois de T1/T2/T3: bot `natural-play.mjs` com política melhor (desvia, usa cenário) até a onda 10+ nas duas classes, mais uma sessão humana curta por classe | GPU (+HUM) | M |
| GD-02 | Decisão D-02 em aberto: cartas em tempo real × pausa no solo. 10 de 14 escolhas do Aldric ocorreram com vida < 30 %; por ~1,3 s as teclas 1/2/3 viram seleção de carta | `fable` D-02; `fable-natural` N-03 | DEC | VC: tempo real mantido (`src/main.js:6793` bloqueia skill com cartas abertas) | M | Decidir; se ficar tempo real, janela curta de redução de dano/empurrão ao abrir cartas | DEC + CPU | S |
| GD-03 | Lyra fica presa no cerco sem válvula de escape (vídeo 0:15–0:23 e 1:55–2:20); Aldric escapa com Corte/Escudo | `fable-natural` N-02 | DR | SR. LOOP-STATE só promete kit de sobrevivência ao Aldric — confirmar se T1 cobre a Lyra | A | Recuo curto no Glacial ou empurrão ao ser cercada; remedir com o bot | CPU + GPU | S–M |
| GD-04 | Lich diverge entre solo e servidor: alcance 16 m × 22 m, recarga 1,45 × 1,65 s, projétil 14/.42/2,25 × 11/.36/4,2; `targetLifeId` ausente no solo | `lich-cast-authority-proposal` §Parâmetros | SE | VC `src/main.js:9382`, `server.mjs:910,1515,1522` | M | Parâmetros num módulo compartilhado (como `melee-timing.mjs`) ou divergência documentada | CPU | S |
| GD-05 | BloodCow tem ataque à distância só no servidor (tiro em 0,30 s) | `physics-navigation-pocket` | DR | VC `server.mjs:81` (`ranged:true`) × `src/main.js:9380-9391` (lista sem bloodCow) | M | Paridade solo × servidor | CPU | S |

### 1.2 animation

| ID | Item | Fonte | Tipo | Status no código | Sev. | O que fecha | Precisa | Esf. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AN-01 | Anti-sliding dos heróis reprovado (`acceptedNoSliding:false`). P90 de apoio a 6,5 m/s (frente/lado/ré): Aldric 0,394/0,295/0,598 m/s, Lyra 0,209/0,314/0,137 m/s; 73 contatos declarados sem patch a 30 Hz | `animation-handoff` §Contato; `animation-backward-v13-staging` | DR (CPU) | VC: runtime `hero-locomotion.js 07952bfc`, nenhum candidato ativo | **C** | `docs/arpg/review/sole-contact-audit.mjs` aceitando os 8 casos + playback nativo revisto | CPU + GPU + HUM | L |
| AN-02 | Ré rápida da Lyra a 9,1 m/s: mismatch 1,722 m/s, aterrissagem 4,593 m/s, rate 2,2 e stride 1,06 saturados | `docs/hero-locomotion.md` §Remaining 2; `review/locomotion-transition-findings` | DR | VC: `RunBackwardFast` excluído em `src/assets/hero-locomotion.js:38` | A | Take/retarget novo com auditoria de bind/rest | AST + CPU | L |
| AN-03 | Transientes de arrancada/parada/curva/cast: reach 0,251 m na arrancada de ré; Aldric em curva+escudo 0,237 m; cast diagonal 0,154 m | `animation-locomotion-v3-candidate` §Playback A/B | DR | VC (07952bfc) | M | Revisão de escolha/blend/alcance do driver + matriz start/stop/turn/cast | CPU + GPU | M |
| AN-04 | Apoio inviável em ator remoto: Aldric em StrafeC com reach 0,401 m e probeY 0,256 m com `contact/locked:true` (observado uma vez, sem replay pareado) | `animation-locomotion-v3-integrated` §Novo achado | DR (1×) | SR | A | Replay pareado df93/07952 e correção em staging | 2C + CPU | M |
| AN-05 | Junção de pouso Strafe→ré (linha v9–v15) sem substituto selecionado; "na escala ARPG a diferença é pequena" | `animation-backward-v14-staging`; `animation-backward-v13-native-ab` | CI | VC: não ativo (`src/assets/hero-air-joint-poses.js` não existe) | M | Trajetória conjunta do antepé em vários pontos materiais; ver seção 2 | CPU (GPU depois) | L |
| AN-06 | Clips do Brute v4–v8 não promovíveis: encaixe só a 1,89 m, `contactAt:null`, peso/impacto "não aprovados" | `brute-motion-v7`; `brute-v6-contact-policy-proposal`; `review/brute-v7-body-review` | CI | VC: `assets/models/monsters/brute.glb d1d58b1a` (original) ativo | M | Contrato de melee do Combat (CF-01) + verificação/doc do v8 | DEC + CPU + GPU | L |
| AN-07 | Corte de morte: duas metades rígidas, leitura fraca na horda; limite de 24 cortes sem orçamento de GPU medido; `remove()` não deduplica por entidade | `animation-cut-v3-handoff` §Pendente artístico; `review/crowd-integrated-art-followup` | DR + SE | VC `src/render/animated-enemies.js:89-103` | M | Dedup (CPU) + captura com horda e revisão | CPU + GPU + HUM | M |
| AN-08 | Locomoção dos inimigos sem foot lock: Orc v1 `footContacts=false`; solver v1 cobre 42 %; v2 cobertura zero; proxies do Walker com P90 de 2,0–3,9 m/s | `docs/enemy-locomotion.md`; `docs/monster-motion.md` | DR + CI | VC `src/assets/enemy-library.js:10,26`, `src/main.js:2896` | M | Refit do retarget + solver aceito | AST + CPU + GPU | L |
| AN-09 | Limites artísticos das skills: grito sem articulação de boca; as 3 skills da Lyra usam um único take de rifle; peso/parada do Escudo e pernas em dash/charge não revistos | `animation-handoff` §Limitações | LE | SR | M | Takes novos + revisão na velocidade real | AST + HUM | M–L |
| AN-10 | Evidência de animação fraca: vídeos "gravados, não revistos continuamente", WebM a 25 fps, capturas em fixture, sem mobile, custo do skin-witness com 4 heróis não perfilado, reduced-motion da animação não avaliado, JEF de animação não refeito | `animation-handoff`; `docs/hero-locomotion.md` §Remaining 6 | LE | n/a | A | Captura a 60 Hz em gameplay natural + revisão de frames por agente com visão + medição de custo | GPU + HUM (+DEV) | M |

### 1.3 art_direction

| ID | Item | Fonte | Tipo | Status no código | Sev. | O que fecha | Precisa | Esf. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AD-01 | Piso, materiais e repetição legada abaixo da direção AAA; BloodCow é forma procedural "provisória"; soleira/lintel da cripta simples; nenhuma textura nova (70 props, 17 materiais, 32 texturas, 257 mil triângulos) | `environment-composition-v2`; `environment-surface-promotion`; `environment-crypt-entrance-v1`; `review/environment-pursuit-integrated` | DR | VC: BloodCow procedural em `src/main.js:4546` | A | Passe de arte: materiais/solo, variação de lápides, modelo do chefe | AST + HUM | L |
| AD-02 | Borda da abertura de copa (canopy v2, no ar) angular e recortada; Root pediu "diferença perceptível de composição/assets", não outra borda | `environment-canopy-transition-v2-native`; `review/environment-canopy-v4-review` | DR (4 PNG) | VC `src/render/environment-cutaway.js:61,79`, `src/render/asset-dressing.js:86` | M | Tirar copas do corredor da câmera ou trocar o asset de copa | GPU + HUM (+AST) | M |
| AD-03 | Continuidade temporal/flicker da abertura em caminhada real nunca provada (só 2 estados estáticos e 73 frames de câmera controlada) | `environment-canopy-transition-v2-native`; `environment-canopy-transition-v4`; `review/jef-canopy-checkpoint` | LE | n/a | M | Vídeo nativo com WASD real + revisão contínua | GPU + HUM | S |
| AD-04 | Não existe revisão artística global: todo aceite é "focal" (copa, loot, dash técnico). Falta captura desktop+mobile, vídeo sustentado e momentos extremos de combate | `coordinator-review-v3`; `astra-dash-review`; `docs/quality-gates.md` | LE | n/a | A | Usar a saída da T5 como ponto de partida; pacote de capturas + observações por cena | GPU + HUM | M |
| AD-05 | Colisores aproximados (cabeça da cruz maior que o collider; cripta em 10 caixas "não certifica watertight") e cripta sem interior | `environment-crypt-entrance-v1`; `environment-composition-v2` | SE | SR | B | Ajuste fino de caixas; interior é decisão de escopo | CPU + HUM | S |

### 1.4 vfx

| ID | Item | Fonte | Tipo | Status no código | Sev. | O que fecha | Precisa | Esf. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| VF-01 | Dash art2 está no ar sem aceite artístico: esteira de 0,10 m é fina contra a pedra escura e disputa com anel/nome no remoto; A/B pareado planejado nunca rodou; custo de GPU nunca medido | `astra-dash-native-v2` §Inspeção artística; `astra-dash-review` §Arte; `vfx-handoff` | CI + LE | VC `src/vfx/dash-vfx.js:5,124-129`; hook `src/main.js:6943-6961` | A | art3 em cópia, A/B pareado e timer de GPU | GPU + HUM | M |
| VF-02 | Dash/Escudo: zero contatos `killed:false`, corte do cadáver não identificado visualmente, som de contato/morte só em fixture | `astra-dash-native-v2` §Matriz; `sfx-handoff` §Freeze final | LE | SR | M | Captura com alvo de vida alta + sequência legível de morte/corte + PCM do mixer | GPU + HUM | S–M |
| VF-03 | **Multiplayer: projétil inimigo some sem VFX de impacto** (glacial/void/toxic). O servidor não transmite contato; o cliente só remove a malha | `docs/vfx-elemental-integration.md` §Integration contract ("must remain an explicit gap") | SE | **VC** `src/main.js:10918-10922` e `removeServerProjectile` (~11080) sem `emitProjectileImpact`; só o solo emite (`:9522`, `:9529`) | A | Evento autoritativo de contato em `server.mjs` + emissão no cliente | CPU (+smoke 2C) | M |
| VF-04 | Grito art2-follow: sustain discreto, poeira fraca, fitas ornamentais, término sutil | `vfx-warcry-art-v1` §Atual 05:49; `review/warcry-art2-selection` | CI | VC `src/vfx/warcry-vfx.js:141` (`candidate:'warcry-art2'`) | M | art3: aura com ritmo/assimetria em ombros e arma, término legível | GPU + HUM | M |
| VF-05 | Gravidade: 8 campos sobrepostos saturam a composição; v3 no ar sem ROI/custo re-medidos (p95 11,0 ms com 8 campos foi medido no predecessor) | `vfx-cannon-depth-composition` §Limite; `vfx-gravity-integration` | LE | VC capacidade 8 em `src/vfx/gravity-field-pool.js:6` | M | Re-medir ROI e custo pareado com 4 e 8 campos | GPU (+DEV) | M |
| VF-06 | Canhão × gravidade concêntricos: o núcleo roxo domina o fogo; margem histórica de silhueta 65,289 % contra gate de 65 % | `vfx-cannon-integrated-art`; `combat-cannon-integration-findings`; `docs/jef-arpg-fallback-dwarf.md` | DR (arte) | VC: composição v1 e GLB OPAQUE publicados | M | Refino em cópia no caso real (alvo atraído a ~2 m), sem baixar o gate | GPU + HUM | M |
| VF-07 | Interpolação temporal dos projéteis de gelo/gravidade fora da produção: corpo salta 1,20 m / 1,00 m por pulso de 20 Hz | `grok-projectile-temporal`; `astra-projectile-temporal-review`; `grok-projectile-temporal-v2` | CI | **VC**: 0 ocorrências de `stepVisual`/`visualActive`/`pendingTo` em `src/vfx/class-skill-vfx.js` | M | Revisão independente da v2 + nativo com 2 clientes (seção 2) | GPU + 2C | M |
| VF-08 | Opção A (point-blank): caminho `terminal-before-muzzle` nunca obtido em local/high, nem LeveB como lançador low/reduced; late join e reconexão em voo não exercitados | `fable-pointblank-v2` §Lacunas | LE | VC bridge `81fcaca6…` publicado (`src/vfx/class-skill-vfx.js:79`) | B | Captura nativa dos dois caminhos | GPU + 2C | S–M |
| VF-09 | Escudo, gelo e stun sem candidato de refino (estrelas de stun pequenas, crosta de gelo não segue ossos); resíduo tóxico sem captura pós-ajuste | `vfx-v2-refinement-status`; `vfx-handoff` | LE | SR | B | Decidir se ganham candidato; capturar contato tóxico sobre o portal | GPU + HUM | M |
| VF-10 | Famílias upstream sem mapeamento nem exclusão justificada: `CorruptedShard`, `ShimmeringFlux`, `VenomSurge`, `AimIndicator/ZoneIndicator` (0 ocorrências em `src/vfx`). A rubrica exige uso real ou exclusão fundamentada | `docs/vfx-elemental-integration.md`; `docs/vfx-additional-references.md` | LE/SE | VC (ausência) | M | `AimIndicator/ZoneIndicator` como telegraph de ataque inimigo (casa com CF-01); demais: integrar ou excluir por escrito | CPU + GPU | M |
| VF-11 | Lich: salto visual de ~0,303 m no abandono da ponte de lançamento; orb opaca/lisa; encaixe dos dedos e pose | `combat-lich-launch-bridge`; `animation-lich-launch-bridge-review`; `docs/jef-arpg-lich-integrated.md` | DR | VC `src/combat/caster-launch-bridge.mjs:31,49,58-60` | M | Suavizar o abandono, arte da orb, revisão em playback contínuo | GPU + HUM | M |
| VF-12 | Matriz das seis skills contra o cenário nunca executada (`tools/environment-skills-v2-gameplay.mjs` "preparado e não executado") | `environment-handoff` | LE | n/a | B | Uma janela de GPU | GPU | S |
| VF-13 | Divergência cor/profundidade por `fwidth` no shader de copa (v4 falhou por 1 px; o v2 no ar também usa `fwidth`) | `environment-canopy-transition-v4`; `output/environment/canopy-v4-depth-fix/gradient-cpu.json` | SE | VC `src/render/environment-cutaway.js:81` | B | Prova em GPU do v4b | GPU | S |

### 1.5 combat_feel

| ID | Item | Fonte | Tipo | Status no código | Sev. | O que fecha | Precisa | Esf. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CF-01 | Melee de Brute/Orc/CowWalker/BloodCow aplica dano em t=0 e anima depois; só zombie e runner têm janela de impacto. O fallback de melee do servidor também é instantâneo | `brute-motion-v7`; `physics-server-fallback-melee`; `docs/character-combat.md` | DR | **VC** `src/combat/melee-timing.mjs:4-6`; `src/main.js:8776-8779`; `server.mjs:1005-1008` | A | Perfis de melee por família (marker, revalidação, cancelamento) no módulo compartilhado + clip aprovado (AN-06) + telegraph (VF-10) | DEC + CPU + GPU | L |
| CF-02 | **Multiplayer: dano no jogador sem som `playerDamage` e sem trauma de câmera** (o solo tem os dois) | achado da leitura de código nesta rodada | SE | **VC** solo `src/main.js:9330-9331`; rede `src/main.js:11604-11614` só chama `hit`, `impact`, número e `pulseHealth` | A | Alinhar o caminho de rede ao solo (respeitando reduced motion) | CPU | S |
| CF-03 | Horda densa: 10 corpos com dt 100 ms penetram 0,913 m; alvos congelados/atordoados transladam 1,1–1,8 m com a pose pausada ("o gelo parece arrastar") | `grok` P1-3; `animation-handoff` §Confirmação root stun/freeze; `review/v2-timeline-findings` | DR (CPU + nativo) | VC: `src/combat/crowd-control.mjs` sem subpassos (orçamento fixo 0,2) | M | Subpassos movimento→crowd quando `maxPenetration > 0,2` ou sweep dinâmico; política de empurrão para controlados | CPU (+GPU) | M |
| CF-04 | Simulação capada a 35 ms: frame pior vira câmera lenta em vez de perder passo | `grok` P2 | SE | VC `src/main.js:5974` | B | Decisão de design + subpassos fixos | DEC + CPU | S |
| CF-05 | Linha de visada do melee é um raio de largura zero em Y=0,9 (`maxY` 0,89 deixa o golpe passar por cima); sobreposição transitória de até 0,0375 m | `physics-combined-native`; `physics-server-fallback-melee` | DR (CPU) | VC `src/main.js:8873-8875`, `server.mjs:975` | B | LOS com raio/altura do ator | CPU | S |
| CF-06 | Nenhuma evidência humana de sensação: tudo que existe é política automática e headless (sem latência de input percebida, peso, leitura de telegraph) | `fable-natural` §Limitações; `docs/quality-gates.md` | LE | n/a | A | 10 min de jogo do dono por classe com notas estruturadas (seção 5) | HUM | S |

### 1.6 ui_ux

| ID | Item | Fonte | Tipo | Status no código | Sev. | O que fecha | Precisa | Esf. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UI-01 | HUD não mostra a duração do campo gravitacional; tooltip repete a descrição dentro de "Efeito ativo" | `grok` P2; `fable-mobile-v3` | DR | **VC** `src/combat/class-skills.mjs:55-69` (`statuses` só do buff); `src/ui/arpg-hud.js:249` | M | Publicar `fields` em `statuses`; patch pronto em `output/qa/aaa-20260919/grok/patches/04-hud-gravity-status.diff` (base antiga — reaplicar à mão) | CPU | S |
| UI-02 | Painel de cartas cobre o herói em 1280×720; a reserva de 150 px só vale para ≥ 901×700 | `fable-natural` N-03 | DR | VC `styles.css:173` | M | Painel mais baixo/estreito em alturas < 700 px (junto com GD-02) | CPU + GPU | S |
| UI-03 | Nomes de jogadores ainda caem sobre a ação; o layout novo só reposiciona rótulos de loot | `astra-loot-labels` §Limites (A2-02); `astra-dash-native-v2` | DR | VC: `src/ui/world-label-layout.js` só trata drops (`src/main.js:6057`) | M | Estender o layout aos nomes | CPU + 2C | S–M |
| UI-04 | HUD, cartas e morte em multiplayer nunca exercitados (oferta autoritativa, `aria-busy`, reconexão no meio da oferta) | `fable` D-04; `fable-mobile-v3` §Lacunas | LE | n/a | M | Roteiro de 2 clientes: nível, carta, morte, retorno | GPU + 2C | S |
| UI-05 | Promoções de GUI validadas só por CPU/HTTP: custo da pintura da placa de chefe não medido, nome longo fica pequeno, Voltar/reabrir da recusa de spawn só em staging | `gui-boss-label-v1`; `gui-spawn-rejection` §Pendências | LE | VC ativos `src/main.js:30,8475,2323-2348` | B | Medir e repetir no código integrado | GPU | S |
| UI-06 | Miudezas: dica inicial (379×58) fica sob o herói por até 14 s em paisagem; `label()` do HUD corta em 100 caracteres e a descrição do Núcleo já tem 99 — textos novos de T2 podem truncar | `fable-mobile-v3`; `fable-area` §Limitações | SE | SR | B | Reposicionar dica; teste de comprimento para descrições | CPU | S |

### 1.7 mobile

| ID | Item | Fonte | Tipo | Status no código | Sev. | O que fecha | Precisa | Esf. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MO-01 | Zero evidência em aparelho físico iOS/Android: safe-area real, teclado virtual, latência e conforto de toque, orientação | `fable` D-03; `fable-mobile-v3`; `gui-handoff`; `docs/quality-gates.md` | LE | n/a | **C** | Sessão do dono (seção 5) | DEV + HUM | M |
| MO-02 | Safari iOS: rolar até o botão com o QWERTY aberto no build v5 nunca provado (a correção de autozoom — input 16 px — está ativa) | `gui-ios-safari-v1` §Promoção; `output/gui-ios-safari-v1/report.json` | LE | VC `styles.css:688-690`; `visualViewport` em `src/main.js:1706-1707,2567` | A | Safari real: QWERTY aberto → CTA → Start → HUD inteiro | DEV | S |
| MO-03 | Texto minúsculo restante: `.skill-chip small` em 6–8 px; 22 ocorrências de 9 px e 8 de 8 px em `styles.css` | `fable-touch-polish` ("não alterado de propósito"); `fable` S-05 | SE | VC `styles.css:145,341,415,589`; já corrigidos: custo 11 px (`src/ui/arpg-painted.css:44`) e × 44 px (`styles.css:242`) | M | Piso de 11 px em informação de decisão; conferir no aparelho | CPU + DEV | S |
| MO-04 | Cartas por toque nunca observadas no candidato final (mortes aos 0:14–0:17, antes do 1º nível); rótulos de loot e nomes em toque não avaliados | `fable-mobile-v3` §Lacunas | LE | n/a | M | Repetir `mobile-a11y-probe.mjs` depois da rampa de T1 | GPU | S |
| MO-05 | Desempenho e térmica em aparelho nunca medidos (alvo p95 ≤ 25 ms); VFX, horda e cena só têm números de desktop M5 Pro | `vfx-handoff`; `physics-crowd-density` §Limites; `environment-composition-v2` | LE | n/a | **C** | 10 min de jogo com contador de frame-time exportável no aparelho | DEV | M |
| MO-06 | Diálogo de pausa em paisagem (844×390) rola; contraste, som e "Voltar à partida" ficam abaixo da dobra | `fable-mobile-v3` | DR | VC `styles.css:238` | B | Layout compacto em duas colunas | CPU + GPU | S |

### 1.8 audio

| ID | Item | Fonte | Tipo | Status no código | Sev. | O que fecha | Precisa | Esf. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AU-01 | Nenhuma escuta humana: 8 pontos de escuta pendentes; "no justified score above 9.5". Material pronto: `output/playwright/arpg-v2-audio-listening-review/index.html` e WAVs em `output/qa/aaa-20260919/audio-native-v1/` (picos 0,379/0,402; cauda pós-mute ~1e-8) | `docs/audio-review.md`; `sfx-handoff` §Estado de QA; `coordinator-audio` | LE | n/a | **C** | Sessão do dono com fone e com alto-falante do aparelho | HUM + DEV | S |
| AU-02 | 17 eventos ainda em oscilador (gameStart, gameOver, axe, autoBlade, crossbow, boneCannon, sealRain, orbitOrb, xpDrop, xp, upgradeChoice, perkDrop, bossChest, weaponPickup, weaponEvolve, playerDamage, bossAttack); música = 4 osciladores; passos só geram poeira; todo disparo inimigo usa `bossAttack` | leitura de código nesta rodada | LE | VC `src/main.js:411-712`, `:316-326`, `:6182-6199`, `:9481`; 28 cues com sample em `assets/audio/processed` | A | Gerar os cues (ElevenLabs, offline) e uma trilha; priorizar os sons do arsenal que T3 reativa | AST + HUM | L |
| AU-03 | Timeout intermitente do Aldric esperando áudio de cast (2 ocorrências, causa não demonstrada; a repetição passou) | `coordinator-audio`; `sfx-handoff` §V1 histórico | DR (intermitente) | SR; módulos de áudio idênticos por hash | M | N repetições com trace de `skillPlayedByPhase` × estado de unlock do `AudioContext` | GPU | M |
| AU-04 | Reteste de SFX de desconexão/graça no v5: o 31/31 rodou na integration-v3 | `fable-closeout`; `coordinator-audio` | LE | VC patch de desconexão presente (`src/main.js:6038,6804,6987,10546-10551`) | B | Rodar `audio-native-v1/audio-grace-native.mjs` no candidato atual | GPU + 2C | S |
| AU-05 | Dois cues órfãos e decode eager de todos os 28 cues no load (828 KB) | leitura de código nesta rodada | SE | VC `src/audio/sample-bank.js:23-24` e `:68-72` | B | Remover órfãos; adiar decode fora do combate | CPU | S |

### 1.9 performance

| ID | Item | Fonte | Tipo | Status no código | Sev. | O que fecha | Precisa | Esf. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PF-01 | Não existe série sustentada de frame-time, memória e contagem de recursos do candidato publicado em jogo natural normal / nível 6 / nível 16, com hardware e browser declarados (alvo p95 ≤ 20 ms) | `grok` tabela de dimensões; `docs/quality-gates.md`; JEF 0,9 | LE | n/a | **C** | `BIPX_BROWSER_CHANNEL=chrome BIPX_HEADLESS=0` em servidor próprio (nunca 5173), 3 cenários × 5 min, p50/p95/p99, heap e `renderer.info` | GPU | M |
| PF-02 | Buscas A* que esgotam 768 nós são repetidas a cada replanejamento; caso natural da Lyra na rota de manutenção: 0 abates, P95 20,9 ms, P99 34,3 ms, picos de 55,8 e 180,4 ms; 4 planos por tick sem região dão P95 de 46,9 ms em `updateZombies` | `physics-navigation-pocket`; `physics-pursuit-native`; `combat-environment-findings`; `review/environment-natural-followup` | DR (causa não isolada) | VC região só para bloodCow; cooldown 0,65–1 s em `src/physics/navigation.mjs:157-163` | A | Cache/backoff de falha + medição com o jogador estacionado | CPU + GPU | M |
| PF-03 | Custo de GPU do shader de copa nunca medido (cada fragmento de cedro percorre 10 ameaças + 4 áreas + 4 atores) | `environment-canopy-transition-v2-native`; `astra-canopy` | LE | VC `src/render/environment-cutaway.js:37-69`; `src/render/environment-actor-focus.js:2` | M | Timer query alternado, high e low, com 10/4/4 ativos | GPU | S |
| PF-04 | Orçamento de cena sem prova de FPS sustentado: 258 draws e 757.617 triângulos com prepass; um LOD por modelo; ~97,9 MB de texturas estimados | `environment-composition-v2` ("custo medido, sem aprovação de FPS") | LE | VC `src/render/asset-dressing.js:115,130` | A | Sai de PF-01; se estourar, LOD/culling | GPU (+DEV) | M |
| PF-05 | Densidade de horda com evidência de uma rodada só (400 atores: P95 9,8 ms em M5 Pro); solver pull+crowd custa 1,54 ms/frame com 120 corpos e aloca por frame | `physics-crowd-density` §Limites; `grok` P2 | LE + SE | VC índice estático em `src/physics/contacts.mjs:26-44` | M | Soak com horda + reuso de buffers no solver | CPU + GPU | M |
| PF-06 | Custo dos VFX finais nunca re-medido: dash (1 draw, 576 slots, nunca medido), prepass do grito (0,30–0,47 ms sem pareamento), canhão (P95 7,2–8,4 ms no predecessor), gravidade (VF-05). O contrato CPU de `bodies.drawCalls` esperava 1 e o wrapper publicado reporta 2 | `vfx-handoff`; `vfx-warcry-follow-contract`; `vfx-cannon-composition`; baseline desta trilha | LE | VC (falha do harness em `tools/class-skill-vfx-cpu.mjs:35`) | M | Medição pareada por efeito nos bytes finais | GPU | M |
| PF-07 | Payload órfão no pacote: `orc-peon.glb` (2,33 MB) sem referência, `orc-peon-locomotion-v2.glb` (2,56 MB) só com `assetVersion===2`, `source-history` duplicando ~7 MB; pacote de 46,97 MB | `fable-closeout/environment/notes.md`; `animation-handoff` | SE | SR | B | Manifesto de assets referenciados + exclusão no release | CPU | S |

### 1.10 multiplayer

| ID | Item | Fonte | Tipo | Status no código | Sev. | O que fecha | Precisa | Esf. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MP-01 | Fluidez de jogadores remotos sob jitter declarado de 20–220 ms: erro máximo 1,160 m, médio 0,644 m, jerk 0,490 m | `grok-native-v4` §Movimento | DR (medido) | SR | A | Buffer de interpolação de entidades remotas com atraso fixo; repetir a medição | GPU + 2C | M |
| MP-02 | Reconexão frágil fora da aba viva: token só em memória e enviado na query do WebSocket; sessões num `Map` do processo (todo redeploy do Render derruba); vaga retida por 30 s conta no limite de 4, então recarregar pode dar `roomFull` | `docs/multiplayer-reconnect.md`; `grok-native-v4` ("4/4 + graça 30 s") | SE | **VC** `src/main.js:10629`, `:10483`; `server.mjs:38`, `:247-250` | A | Token em `sessionStorage`; vaga em graça não bloqueia o mesmo dispositivo; aviso de redeploy | CPU + WS | M |
| MP-03 | Late join só por snapshot nunca isolado em nativo (no v4 o observador já tinha WebSocket antes do cast); "zero replay de áudio" sem controle positivo; dash/charge em curso não são reconstruídos | `coordinator-review-v3` §Late join; `grok-native-v4` §Limites; `grok-projectile-temporal` | LE | VC ordenação por `serverTime` ativa (`src/vfx/class-skill-vfx.js:238-245`) | M | Entrada sem cast/release anteriores + contador de áudio com controle positivo | GPU + 2C | S |
| MP-04 | `positionCorrection` espúria: dois `state` no mesmo milissegundo dão crédito zero e o pedido é descartado ("documentada, não corrigida"); a única correção nativa, em (1,284; −7,688), segue sem causa demonstrada | `grok-projectile-temporal` §Correção; `grok-snapshot-order` | DR (CPU) | **VC** `src/combat/network-move.mjs:9-15` (crédito = velocidade × `elapsed`); envio em `server.mjs:567` | M | Tolerância para `elapsed=0` dentro do acumulador + log de causa | CPU + WS | S |
| MP-05 | Rede adversa (perda/jitter), soak, rede móvel real, dois browsers naturais longos e morte simultânea/wipe em browser: sem evidência; `network-move` sem prova de rede real | `grok` §Encerramento; `fable-closeout`; `docs/multiplayer-reconnect.md` §Verification | LE | n/a | A | Sessão de 20–30 min com 2 clientes naturais e perfis de rede declarados | GPU + 2C + tempo | L |
| MP-06 | BloodCow no servidor sem `attackRegion` e com alcance diferente do cliente; com arrival 2,44 a busca falha com 768 nós nas duas origens — o chefe de marco (onda 10) pode ficar parado em multiplayer | `physics-pursuit-terminal`; `physics-combined-native` | SE + DR (CPU) | **VC** cliente `src/main.js:8982-8983`; servidor `server.mjs:904,974,998` | A | Passar a região de ataque no servidor + par WS causal | CPU + WS | S |
| MP-07 | Réplica remota do projétil do Lich: pausa de 148 ms e sumiço antes do contato (vão de 1,57 m); fallback de parede nunca acionado em WS | `combat-lich-launch-bridge` §Correção de escopo 06:43 | DR (causa inferida) | VC tick 50 ms e broadcast ≥ 120 ms (`server.mjs:60-61,741`) | M | Captura com parede e log de chegada de pacotes | GPU + 2C | M |
| MP-08 | Smoke de produção terminou `passed:false`: a Lyra morreu parada em ~7 s e as skills dela nunca rodaram em produção | `fable-closeout` §5; `output/qa/aaa-20260919/fable-closeout/production-smoke/report.json` | LE | n/a | M | Repetir depois de T1 com roteiro de cartas, morte e reconexão | GPU + 2C | S |
| MP-09 | Cobertura parcial do corredor de copa para companheiros (4 simultâneos só em CPU; reconexão com o mesmo ID não testada); spawn do jogador no cliente não passa `actors`, o servidor passa | `astra-canopy` §Negativos; `physics-crowd-density` | LE + SE | VC `src/main.js:6052`; `src/main.js:2389` × `server.mjs:401` | B | Sessão de 4–5 clientes com resume token | GPU + 2C | M |

### 1.11 accessibility

| ID | Item | Fonte | Tipo | Status no código | Sev. | O que fecha | Precisa | Esf. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AC-01 | Contraste nunca medido e zoom 200 % nunca exercitado — ambos automatizáveis | `fable` D-03; `fable-mobile-v3` §Lacunas | LE | n/a | A | Varredura de contraste (tokens de `styles.css` + checagem no browser) e captura a 200 % nos fluxos menu/HUD/cartas/morte | CPU + GPU | S |
| AC-02 | Leitor de tela real (VoiceOver/TalkBack): sem evidência. Os rótulos existem (`role="meter"`, `aria-live`, `aria-describedby` na morte) mas nunca foram ouvidos | `fable` D-03; `gui-handoff` | LE | n/a | A | Passe do dono em menu, login, cartas e morte | HUM (+DEV) | S |
| AC-03 | Reduced motion no WebGL/VFX não avaliado: o CSS zera animações e a trilha é omitida por projeto, mas trauma de câmera, halos e partículas não foram observados | `fable` §C; `fable-native-v3` | LE | VC propagação em `src/main.js:1594-1600` | M | Captura A/B com a preferência ligada nas 6 skills e em dano | GPU | S–M |
| AC-04 | Semântica residual: abas do diálogo com `aria-pressed` em vez de `tablist/tab`; stick com `role="img"`; primeiro Tab cai em "Som" antes da ação principal; `<select>` de qualidade por seta "não verificado" | `fable` S-04; `fable-mobile-v3` | SE | **VC** `index.html:107`, `:100`, `:31` | B | Trocar para `tablist/tab/aria-selected`, reordenar o DOM, teste curto de teclado | CPU (+GPU curto) | S |
| AC-05 | Informação só por cor ou só por som em gameplay nunca auditada (raridade por cor nos rótulos de loot, telegraphs, estados de recarga) | `docs/quality-gates.md` (critério); nenhum relatório cobre | LE | n/a | M | Auditoria por captura + ícone/forma redundante onde faltar | GPU + HUM | S–M |
| AC-06 | Halo central da gravidade "muito luminoso" sem avaliação de fotossensibilidade | `review/integrated-art-followup`; `vfx-handoff` | LE | SR | M | Medir luminância/flash por frame com 1–8 campos; teto em reduced motion | GPU | S |

### 1.12 reliability

| ID | Item | Fonte | Tipo | Status no código | Sev. | O que fecha | Precisa | Esf. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RL-01 | **Sete suítes CPU/protocolo falham no código publicado** (baseline desta trilha, seção 3.2): `verify:progression` (o harness teleporta o cliente e o servidor v5 não aceita mais), `verify:enemy-projectiles` (stub ausente para `emitEnemyProjectileTrail`), `verify:physics:integration` (8/16), `verify:skills:vfx` (`drawCalls` 2≠1), `verify-arpg-layout` (espera 143 colisores, há 153), `environment-cpu` (colisor composto da cripta), `verify:orc` (ator parado morre na rampa inicial) | baseline T6 em `output/qa/aaa-loop/t6/` | DR (reproduzido hoje) | VC | A | Atualizar os harnesses (usar `placePlayer` por IPC, stubs novos, 153 colisores) **antes** de integrar T1/T2/T3, para que falhas novas sejam atribuíveis | CPU | M |
| RL-02 | `verify:all` nunca rodou no v5 (37 das 41 suítes sem evidência no candidato publicado; maior run registrado: 29 suítes em 18/09). O runner não sobe servidor nem repassa URL: **20 suítes apontam para `127.0.0.1:5173`** (o servidor do usuário) e 4 têm URL fixa (`verify-enemy-lods`, `verify-melee-integration`, `verify-keyboard-combat`, `assets-verify`) | inventário desta trilha; `tools/run-quality-suite.mjs:68` | DR (estático) | VC | A | Runner com servidor efêmero próprio (PORT 0, ranking descartável) e URL por ambiente; depois um run completo no candidato integrado | CPU, depois GPU | M |
| RL-03 | Harnesses que dão falsa confiança ou quebram em clone limpo: `cannon-*-vfx-cpu` e `gravity-vfx-pool-cpu` (default) testam snapshots em `assets/vfx/source-history`, não o runtime; `animation-skill-cpu` lê export de staging em `output/`; `physics-combined-*`, `physics-pursuit-native-*` e `verify-crowd-integration` importam de `output/`, que não é versionado | baseline T6; inventário | SE | VC | M | Apontar para `src/` por padrão (o pool de gravidade passa 11/11 com `VFX_GRAVITY_SOURCE=src/vfx`); versionar baselines necessários | CPU | S–M |
| RL-04 | `window.__zombieNightDebug` exposto em produção com mutadores (`grantXp`, `damagePlayer`, spawns). O ranking do servidor é autoritativo; o dano é ao ranking local e à integridade percebida | `fable-closeout` §Observações | DR | **VC** `src/main.js:1809`, `:2020`, `:2078`; sem gate por query/host | M | Expor só com flag explícita (as suítes dependem dos getters) | CPU | S |
| RL-05 | Soak, sessão longa e recuperação de ciclo de vida sem evidência no candidato (aba em segundo plano, restart repetido, persistência de opções) | `grok`; `docs/quality-gates.md` | LE | n/a | A | 30 min contínuos + 20 restarts + background/foreground, com heap e contagem de recursos | GPU + tempo | M |
| RL-06 | Runner natural fortalecido (valida casts aceitos, não tentativas) nunca rodou em browser; CPU 16/16 | `combat-contract-reconciliation` §Novo critério | LE | n/a | M | Uma rodada de 60–120 s por classe | GPU | S |
| RL-07 | Layout publicado se declara `crypt-entrance-v1-staging` e tem 153 colisores sem contrato CPU atualizado (só um harness de browser afirma 153). O planner é incompleto por desenho (2 anéis de conectores, 16 poses, 256 sweeps) e falta auditoria de alcançabilidade para raios 0,78 e 1,72 | `physics-navigation-connectors` §Limite; `fable-closeout` (Física: "layout 153") | SE | VC `src/render/environment-layout.js:3`; `src/physics/navigation.mjs:77,105-108` | M | Contrato CPU do layout 153 + varredura de alcançabilidade | CPU | M |
| RL-08 | Higiene de proveniência e gates: `*.provenance.json` dos GLB ainda gravam hashes antigos; o gate estrito do dash só existe em `output/`; o gate nativo do dash não exige pontas locais entre eventos (`verify-native.mjs:78`); o trace de input guarda só `keyup` | `astra-dash-review` §P2; leitura VFX | SE | SR | B | Atualizar proveniência; portar o gate para `tools/` | CPU | S |
| RL-09 | Documentação contraditória que o juiz (só texto) vai ler: handoffs dizem "não promovido" para coisas publicadas (copa para companheiros, navegação, fallback de melee, Lich, dash), `aaa-review-20260919.md` lista como abertos itens já no v5, `asset-inventory.md` está defasado, os JEF `.md` dizem "12 notas null" enquanto os JSON trazem notas preliminares | contradições levantadas pelos quatro leitores (seção 6) | DR (doc) | n/a | M | Um `STATUS.md` vigente por frente, com data e hash; não reescrever o histórico | CPU | S |
| RL-10 | Harnesses reutilizáveis presos em `output/` (fora do git): bot natural, sonda mobile/a11y, captura de origem com 2 clientes, gate estrito do dash, áudio nativo + graça | `fable-natural`; `fable-mobile-v3`; `fable-native-v3`; `astra-dash-native-v2`; `coordinator-audio` | SE | n/a | B | Portar para `tools/` com porta e pasta de evidência configuráveis | CPU | S |

### 1.13 Coberto pelas trilhas em andamento (não contado acima)

| Achado | Fonte | Trilha | O que conferir quando pousar |
| --- | --- | --- | --- |
| N-01 — a onda 1 cerca o jogador antes do primeiro poder (7 inimigos aos 0:04, 24–30 aos 0:20; 3 de 7 runs acabaram ≤ 0:24) | `fable-natural` | T1 | Remedir com `output/qa/aaa-20260919/fable-fixes-v2/natural-play.mjs`; `verify:orc` deve voltar a passar; o smoke de produção (MP-08) deve completar |
| N-04 / S-01 — cartas não conversam com as skills; `+Área` não alterava as skills da Lyra (parte corrigida pela `fable-area`, no v5) | `fable`; `fable-natural`; `fable-area` | T2 | `verify:progression:parity` e `verify:progression` têm números cravados (7×2=14, 14→15,12, +18 de vida) — separar contrato de ajuste fino |
| S-02 — recompensa vazia quando as ~45 pilhas acabam | `fable` | T2 | Fallback autoritativo + aviso no HUD |
| N-05 — no início o limite é recarga, não recurso (a esfera direita vira enfeite) | `fable-natural` | T1 | Observar ondas tardias em GD-01 |
| Aldric corpo a corpo frágil | pedido do usuário | T1 | Número de mortes do bot do Aldric × Lyra |
| Arsenal antigo neutralizado (`activateWeapon` só dá buff; `autoWeapon`/`sealRitual` bloqueados) | LOOP-STATE tick 1 | T3 | Os sons dessas armas são osciladores (AU-02); o texto das cartas que removeu "armas automáticas" (F-04) precisa voltar a bater; descrições novas × corte de 100 caracteres (UI-06) |

## 2. Candidatos inacabados ou rejeitados que ainda têm valor

Todos vivem fora do git, sob `/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX/output/`. Nenhum está ativo no runtime publicado (conferido por hash ou por ausência de símbolos).

| Candidato | Onde vive | Ferramentas | O que já conseguiu | O que bloqueou | O que falta para promover |
| --- | --- | --- | --- | --- | --- |
| **Backward v13** `a7792f05` (melhor retido da linha anti-sliding) | `output/arpg-animation/backward-v13/candidate` | `tools/animation-backward-v13-native.mjs`; `witness-runner.mjs`, `compare.py`, `refresh-zero.mjs` na pasta | Tornozelo no pouso 12,086→5,539 e 6,952→4,601 m/s; 6 casos de dt=0 passam; A/B nativo com 80 PNG | Material/Toe pioram no frame seguinte (6,741→8,980); zero patch em 103/207; só uma história validada | Generalizar além da história turn, matriz ampla, auditor de 8 casos |
| Backward v14 (4 ablações) | `output/arpg-animation/backward-v14` | locais | Giro do Foot 36,2°→28,8° | Material piora (8,980→9,643); `selectedCandidate:null` | Nada: negativo útil |
| **Backward v15** `7cb809c7` (parado no limite do Codex) | `output/arpg-animation/backward-v15` | `joint-air-solver.mjs`, `build-candidate.py` | Material em 207: 7,287→5,544; giro 36,2°→33,0°; dt=0 passa | Frame 208 piora (4,533→5,327); tabela condicionada à testemunha, "no online prediction"; sem `status.json` nem doc | Solver online, doc e status; decidir se a linha continua ou se entra take novo (AN-02) |
| Backward v4–v12 | `output/arpg-animation/backward-v4` … `-v12` | `tools/animation-backward-*.mjs` | Cada um melhora uma métrica (ex.: v9 apoio a 60 Hz 0,764→0,054) | Cada um piora outra (ex.: v12 pouso a 30 Hz 5,5→12,1) | Superados; manter como negativos |
| **Brute motion v7** candidate-04 / **v8** candidate-03 | `output/brute-motion-v7`, `output/brute-motion-v8` (v4–v6 ao lado) | `tools/brute-motion-review-*.mjs` | v7: 12 GLB byte-idênticos, 24 checks, folga 1,998 mm; v8: 3 GLB com `maxWholeMeshPairs:0`, 37 trilhas preservadas | v7: 4 negativos e envelope de 0,5 mm; v8: sem doc/manifesto, caso dwarf-withdraw (213) aberto; **falta o contrato de melee do Combat** | CF-01 primeiro; depois verificação nativa e doc do v8 |
| Solver de apoio do Orc v1/v2 | `output/enemy-locomotion` | `tools/enemy-locomotion-*.mjs` | Drift do run 1,728→0,105 m/s | Cobertura 42 %, correção vertical de 156 mm; v2 cobertura zero | Refit do retarget |
| **Canopy transition v4 / v4b** | `output/environment/canopy-transition-v4`, `output/environment/canopy-v4-depth-fix`, `output/environment/canopy-v4-depth-diagnostic` (v1 e v3 ao lado) | `native.mjs`, `study.mjs`, `verify-gradient.mjs`, `native-causal.mjs` | v4: CPU 13, 73 frames, abertura independente de multiplicidade; v4b: causa do pixel isolada, 600 testes de gradiente | v4 falhou por 1 px cor × profundidade; v4b sem GPU (terminal parado); ganho visual pequeno, sem seleção artística | Um par nativo + rebase (patch sobre `977548…`, o publicado é `d53b7c13…`). Só vale se AD-02 não optar por trocar composição/asset |
| Canopy v3 | `output/environment/canopy-transition-v3` | `motion-driver.mjs`, `strict-gates.mjs` | CPU 12/12 | União cresce com duplicatas (0,1→0,651 com 10); nunca renderizado | Nada: superado pelo v4 |
| **Dash art** (art1 rejeitado, art2 no ar) | `output/vfx-dash-art-v1`, `output/vfx-dash-art-v2`, `output/dash-post-mixer-integration-v1` (negativo local 5 / remoto 0), `output/qa/aaa-20260919/dash-segment-v1`, `output/qa/aaa-20260919/astra-dash-native-v2` | `tools/dash-art-vfx-{cpu,native}.mjs`, `tools/dash-art2-vfx-{cpu,native,observer-cpu}.mjs`; `strict-gate.mjs`, `capture-matrix.mjs` na pasta Astra | CPU 13, integrado 7/7, nativo 12/12, 428/428 frames com ponta, erro ≤ 9,5e-7 m | Arte não aceita; A/B pareado nunca rodou; custo de GPU não medido | art3 + A/B + timer (VF-01); captura com sobrevivente e corte (VF-02) |
| Grito art2-follow (no ar) e art1a/b (rejeitados) | `output/vfx-warcry-art-v1/{art2,art2-follow,candidate,iterations}`, `output/warcry-moving-integration-v1` | `tools/warcry-art-vfx-{cpu,native}.mjs`, `tools/warcry-follow-vfx-native.mjs` | Lag de preparo 2,38 m→0; nativo 3/3 | art1 rejeitado (preparo invisível); art2 com sustain fraco | art3 (VF-04), pausa-no-preparo em nativo, custo pareado |
| **Interpolação de projéteis temporal-v2** | `output/qa/aaa-20260919/grok-projectile-temporal-v2` (v1 reprovada em `…-temporal-v1`; ordenação `grok-snapshot-order-v1` e base `latejoin-projectile-v1` já estão no v5; `grok-native-v4` é negativo) | `verify-geometric.mjs`, `pointblank-combined.mjs` na pasta; testemunhos em `output/qa/aaa-20260919/astra-projectile-review-v1` | Salto máximo 1,20→0,40 m (gelo) e 1,00→0,33 m (gravidade); CPU 8/8 + 8/8; patch parte do wrapper publicado `636dd452…` | v1 reprovada pelo Astra5 (overflow perde vértices; trilha vira corda); v2 sem GPU e sem revisão independente | Revisão independente + nativo 2 clientes (VF-07) |
| Patch HUD de gravidade | `output/qa/aaa-20260919/grok/patches/04-hud-gravity-status.diff` | `tools/ui-arpg-verify.mjs` | Diff pronto; a GUI já desenha `statuses` | Base `6fa8f870…` ≠ publicado `058bda88…` | Reaplicar à mão (UI-01) |
| Runner natural fortalecido | `output/qa/arpg-contract-reconciliation-20260919` | `tools/verify-natural-runs.mjs`, `tools/verify-arpg-natural-skill-evidence.mjs` | CPU 16/16 (também nesta rodada) | Adiado pelas promoções visuais | Uma rodada por classe (RL-06) |
| Áudio nativo + graça | `output/qa/aaa-20260919/audio-native-v1` | `run.mjs`, `audio-grace-native.mjs` | PCM das 6 skills; reconexão 31/31 | Timeout intermitente do Aldric | Causa raiz (AU-03), rodar no candidato atual (AU-04), escuta (AU-01) |
| Safari no Simulator | `output/gui-ios-safari-v1` | `staging-server.mjs` | Causa do autozoom provada por A/B | QWERTY não reapareceu após `orca emulator type` | Aparelho físico (MO-02) |
| Ponte de lançamento do Lich v1→v3 (promovida) | `output/lich-cast-launch-bridge-v3` (+v1, v2, `output/lich-cast-integration-v1`, `output/lich-cast-v1`) | `tools/lich-cast-review-run.mjs --gpu`, `tools/lich-cast-review-authority.mjs` | Primeiro corpo a 0 m da mão em 2 clientes | Salto de 0,303 m; pausa de 148 ms no remoto | VF-11 e MP-07 |
| Matriz das seis skills × cenário | `tools/environment-skills-v2-gameplay.mjs` | a própria | Pronta | Nunca rodou | Uma janela de GPU (VF-12) |
| Fallback de conectores nas bordas | sem artefato | — | Só proposta | — | Algoritmo + custo + determinismo (RL-07) |
| Harnesses reutilizáveis | `output/qa/aaa-20260919/fable-fixes-v2/natural-play.mjs`, `…/fable-mobile-v3/tools/mobile-a11y-probe.mjs`, `…/fable-native-v3/tools/native-origin.mjs` | — | Já produziram N-01…N-05, a sonda mobile e D-1 | Presos em `output/` | Portar para `tools/` (RL-10) |

## 3. Suítes automatizadas

### 3.1 Inventário

`npm run verify:all` (`tools/run-quality-suite.mjs`) encadeia 41 suítes na ordem do mapa `available`, em sequência, sem timeout por suíte, gravando em `output/playwright/<ISO>-quality-suite/suite.json` (ou `BIPX_EVIDENCE_DIR`). O status final exige todas aprovadas sem mudança de fonte nem de ferramentas durante o run. **Não rodar como está: 20 suítes apontam para a porta 5173 do usuário (RL-02), e as de browser disputam `/tmp/bipx-arpg-gpu.lock`.**

| Grupo | Suítes (script npm → arquivo) | Precisa de browser? | Onde escreve | Último resultado conhecido |
| --- | --- | --- | --- | --- |
| CPU puro | `verify:skills` → `verify-class-skills.mjs`; `verify:progression:parity`; `verify:evaluator`; `verify:motion`; `verify:npcs:pool`; `verify:enemy-projectiles`; `verify:local-records`; fora do `verify:all`: `verify:physics`, `verify:physics:v2`, `verify:physics:integration`, `verify:skills:vfx`, `verify:skills:animation` | Não (algumas importam `quality-browser.mjs`, que exige o pacote `playwright` instalado mas não abre browser) | `BIPX_EVIDENCE_DIR`, ou caminho fixo relativo ao cwd (`output/qa/...`, `output/physics/...`) | No v5 (closeout 10:55–10:57Z): skills 16/16, paridade 14/14, física 22/22 e 12/12. Demais: pré-v5. **Hoje: ver 3.2** |
| CPU + servidor efêmero (WebSocket, `PORT=0`, ranking descartável, Supabase vazio) | `verify:skills:server`, `verify:skills:controls`, `verify:multiplayer`, `verify:classes`, `verify:melee:server`, `verify:orc`, `verify:reconnect`, `verify:ranking-authority`, `verify:protocol`, `verify:progression` | Não | `BIPX_EVIDENCE_DIR` + staging em `os.tmpdir()` | skills:server e protocol aprovadas às 09:45Z com servidor idêntico ao v5; as outras oito **nunca tinham rodado no v5** até o baseline de hoje (3.2) |
| HTTP | `verify:http` | Não, mas exige servidor já rodando (default 5173; aceita URL por argumento, só localhost) | `BIPX_EVIDENCE_DIR` | Aprovada às 08:01Z contra o 5173 pré-v5 |
| Browser + servidor próprio | `verify:natural`, `verify:audio:signal`, `verify:reconnect:browser`, `verify:entry-ranking` (**nunca executada**) | Sim | evidência + vídeo | Aprovadas em 18/09 19:08Z (29 suítes); `verify:natural` avulso às 03:44Z |
| Browser + **porta 5173** | `verify`, `verify:experience`, `verify:characters`, `verify:projectiles`, `verify:keyboard`†, `verify:locomotion`, `verify:melee`†, `verify:npcs`, `verify:lifecycle`, `verify:vfx`, `verify:vfx:catalogue`, `verify:mobile`, `verify:performance`, `verify:performance:lv16`, `verify:multiplayer:browser`, `verify:assets`†, `verify:audio`, `verify:webkit`, `verify:npcs:lods`† († URL fixa) | Sim | evidência (+vídeo) | Aprovadas em 18/09 19:08Z; **nenhuma no v5** |
| Browser fora do `verify:all` | `verify:skills:browser`, `verify:skills:network`, `verify:skills:audio` | Sim (Chrome com janela + lock de GPU) | evidência + vídeo | Aprovadas às 07:43–07:44Z, pré-v5 (`main d9e6fed4`) |
| Órfãs (sem script npm) | CPU: `verify-arpg-layout`, `verify-arpg-natural-skill-evidence`, `verify-crowd-integration`, `verify-player-spawn`, `verify-skill-presentation`; browser: `verify-release-package` (**v5 aprovado às 10:45Z**), `verify-arpg-combos`, `verify-arpg-cannon-miss`, `verify-arpg-layout-gameplay`, `verify-crowd-gameplay`, `verify-player-spawn-browser`, `verify-scene-depth`, `ui-arpg-*`, `audio-arpg-*` | misto | caminhos fixos em `output/qa/...` | Todas aprovadas entre 00:20Z e 07:55Z, pré-v5 |
| Rede externa | `evaluate:jev` (`--dry-run` não envia) | Não | `--output` obrigatório | Diagnóstico de 09:50Z (HTTP 200, `requires_further_work`) |

O `suite.json` mais novo é `output/playwright/2026-09-19T03-33-53-276Z-quality-suite/suite.json`: 6 suítes, todas aprovadas, fonte **pré-v5** (`main 7bde570f`, `server 29bbf681`). Não existe `suite.json` do v5. `output/qa/aaa-20260919/integration-regression-v1/result.json` (09:45Z) tem 4 suítes aprovadas com servidor/skills/autoridade idênticos ao v5.

### 3.2 Baseline CPU desta trilha (2026-09-19, ~11:40Z)

Cópia de trabalho `output/qa/aaa-loop/t6/scratch/`: `src/` (sem `source-history`), `tools/`, `index.html`, `styles.css`, `server.mjs`, `package*.json` e `docs/quality-rubric.json` copiados — **432 arquivos, 0 diferenças contra a árvore viva** (`evidence/scratch-vs-live-manifest.txt`) — com `assets`, `vendor` e `node_modules` por symlink. Tudo rodou com `cwd` = scratch, `TMPDIR` e `BIPX_EVIDENCE_DIR` redirecionados para dentro de `t6/`, servidores efêmeros em `127.0.0.1` com `PORT=0`. Node v24.12.0. Sem browser, sem GPU, sem rede externa, sem tocar a 5173. Resumo legível por máquina: `output/qa/aaa-loop/t6/baseline-summary.json`; logs em `t6/logs/`.

**Pedidas na tarefa — todas aprovadas:**

| Comando | Resultado |
| --- | --- |
| `node --check` em cada `src/**/*.js\|mjs` e em `server.mjs` | **95/95** |
| `node tools/verify-class-skills.mjs` | exit 0 — 16 checks, `sourceChanged:false` |
| `node tools/verify-class-skills-server.mjs` | exit 0 — 2 cenários WebSocket (warrior, dwarf) |
| `node tools/verify-progression-parity.mjs` | exit 0 — 14 checks |
| `node tools/verify-evaluator-contract.mjs` | exit 0 — 6 checks (`fetch` simulado, nenhuma requisição externa) |

**Extensão — aprovadas (23, todas exercitam módulos de `src/` ou o `server.mjs` publicado):** `verify-class-skills-controls-server` (5), `verify-protocol-robustness` (11), `verify-reconnect-protocol`, `verify-player-spawn` (4), `verify-multiplayer-world`, `verify-character-authority`, `verify-melee-server`, `verify-ranking-authority`, `verify-crowd-integration` (17/17, entradas históricas por symlink somente leitura), `verify-enemy-pool` (8), `verify-local-records` (8), `verify-visual-motion`, `verify-arpg-natural-skill-evidence` (16), `verify-http` (23/23 contra servidor próprio do scratch em porta efêmera), `physics-verify` (22/22), `physics-v2-verify` (12/12), `elemental-vfx-cpu` (7), `gravity-vfx-pool-cpu` com `VFX_GRAVITY_SOURCE=src/vfx` (11), `animation-enemy-state-cpu`, `animation-retiming-cpu` (36), `monster-motion-cpu`, `monster-phase-cpu`, `enemy-locomotion-cpu`.

**Falham no código publicado (7) — nenhuma por erro de sintaxe ou de autoridade; seis são defasagem do harness:**

| Comando | Falha | Leitura |
| --- | --- | --- |
| `node tools/verify-progression-authority.mjs` (`verify:progression`, está no `verify:all`) | 4 de 8 checks passam; para em "Pickup protocol": `false !== true` | O harness move o cliente com `state {x:10}`; o servidor v5 (orçamento de movimento do Grok v3) não aceita teleporte, então a coleta fica `out-of-range`. Os 4 checks seguintes (restart, dano 7×2=14, 14→15,12) nem rodam. **É a suíte mais relevante para T2** |
| `node tools/verify-enemy-projectiles.mjs` (`verify:enemy-projectiles`, no `verify:all`) | `ReferenceError: emitEnemyProjectileTrail is not defined` | O harness injeta `emitProjectileTrail`; `src/main.js:9521` chama a função nova. Passava às 03:33Z com 27 casos |
| `node tools/physics-integration.mjs` (`verify:physics:integration`) | 8 de 16 falham | `getServerCrowdBodies` sem stub, contrato de `normalizePlayerState` mudou, ids de colisor esperados mudaram com o layout 153. Era 16/16 à 01:52Z |
| `node tools/class-skill-vfx-cpu.mjs` (`verify:skills:vfx`) | `bodies.drawCalls` 2 ≠ 1 | Contrato anterior à integração do canhão; era 18/18 à 01:28Z (ver PF-06) |
| `node tools/verify-arpg-layout.mjs` (órfã) | 3 de 7 falham | Espera 143 colisores e o id `crypt-entry-wall`; o publicado tem 153 e 10 caixas `crypt-entry-wall-*` |
| `node tools/environment-cpu.mjs` | "Every new solid has matching collider id" | Mesmo motivo: a parede da cripta virou colisor composto. Não é buraco de colisão |
| `node tools/verify-orc-spawning.mjs` (`verify:orc`, no `verify:all`) | `'dead' !== 'playing'`: "Protocol actor died during real wave progression" | O ator de protocolo parado morre na rampa inicial antes da onda de orcs — mesma causa do N-01. Reexecutar depois de T1 |

**Não aplicáveis / não executáveis:** `cannon-vfx-cpu`, `cannon-wrapper-vfx-cpu`, `cannon-depth-vfx-cpu` (passam, mas testam snapshots em `assets/vfx/source-history`), `cannon-origin-vfx-cpu` e `gravity-vfx-pool-cpu` no default (falham contra snapshots de staging, irrelevante para o runtime), `animation-skill-cpu` (lê GLB de staging em `output/`, ausente no scratch).

**Como usar:** depois de integrar T1/T2/T3, repetir exatamente esta lista. Qualquer suíte que hoje passa e deixar de passar é regressão das trilhas; as sete acima já estavam quebradas e devem ser consertadas antes (RL-01). Suítes com números de balanceamento cravados que as trilhas vão alterar de forma legítima: `verify-progression-authority`, `verify-progression-parity`, `verify-class-skills*`, `verify-character-authority`, `verify-melee-server`.

## 4. Próximas três ondas (depois que T1, T2 e T3 pousarem)

Regras que valem para todas: GPU serializada por `mkdir /tmp/bipx-arpg-gpu.lock`; servidor próprio por trilha (nunca 5173); um dono por arquivo quente. `src/main.js` e `server.mjs` são tocados por quase tudo — **uma única raia por onda pode editá-los**; as demais entregam módulos novos ou patches.

### Onda B — rede de segurança e evidência barata (ganho de nota mais rápido)

Alvo: performance 0,9→~7, reliability 4,4→~7, multiplayer 3,5→~6,5, accessibility 4,0→~6,5 — quase tudo CPU ou medição sem editar o jogo.

| Raia | Itens | Arquivos | Precisa |
| --- | --- | --- | --- |
| B1 — suítes | RL-01, RL-02, RL-03, RL-10, RL-08 | só `tools/**` e `package.json` | CPU |
| B2 — rede e paridade (única raia que edita `server.mjs` e `src/main.js` nesta onda) | CF-02, VF-03, MP-02, MP-04, MP-06, GD-04, GD-05, RL-04 | `server.mjs`, `src/combat/network-move.mjs`, `src/main.js` | CPU + WS |
| B3 — HUD e semântica | UI-01, UI-02, UI-06, AC-04, MO-03, MO-06 | `index.html`, `styles.css`, `src/ui/**`, `src/combat/class-skills.mjs` (só `getSkillHud`) | CPU (+GPU curto) |
| B4 — medição (não edita fonte) | PF-01, PF-03, PF-06, RL-05, RL-06, GD-01, AC-01, AC-03, AC-06, MO-04 | nenhum; só `output/qa/aaa-loop/` | GPU (serial) |

B1, B2 e B3 rodam em paralelo (arquivos disjuntos). B4 começa quando B1 entregar o runner sem 5173 e roda sobre o candidato já integrado. Fecha a onda: `verify:all` completo no mesmo candidato + pacote de evidência escrito → nova consulta JEF (candidato novo, não repetição).

### Onda C — sensação e leitura de combate

Alvo: combat_feel, vfx, multiplayer e game_design para a faixa 7–8,5.

| Raia | Itens | Arquivos | Precisa |
| --- | --- | --- | --- |
| C1 — contrato de melee inimigo (dona de `server.mjs`/`main.js`) | CF-01 (+AN-06 como insumo), CF-05, GD-03 se T1 não cobriu | `src/combat/melee-timing.mjs`, `server.mjs`, `src/main.js`, `src/render/animated-enemies.js` | DEC + CPU + GPU |
| C2 — VFX | VF-01, VF-02, VF-04, VF-06, VF-10 (telegraph de inimigo para C1), VF-07, VF-11 | só `src/vfx/**` e `assets/vfx/**` | GPU + HUM (agente com visão revê frames) |
| C3 — física e navegação | CF-03, PF-02, PF-05, RL-07, AN-07 (dedup) | `src/physics/**`, `src/combat/crowd-control.mjs` | CPU (+GPU para medir) |
| C4 — multiplayer nativo | MP-01, MP-03, MP-05, MP-07, MP-08, UI-03, UI-04, AU-04 | `src/ui/world-label-layout.js`; interpolação remota em módulo novo | GPU + 2C |

C2 e C3 são independentes. C1 e C4 disputam `main.js`: C4 entrega módulos e patches que C1 integra.

### Onda D — animação, arte e áudio (itens L, com assets)

Alvo: animation 3,1 e art_direction 3,7 para ≥ 8; áudio pronto para a escuta do dono.

| Raia | Itens | Arquivos | Precisa |
| --- | --- | --- | --- |
| D1 — anti-sliding dos heróis | AN-01, AN-02, AN-03, AN-04, AN-05, AN-10 | `src/assets/**`, `src/render/visual-motion.js`, GLB dos heróis | CPU pesado + GPU + AST. Decidir cedo: continuar v13–v15 ou trazer takes novos |
| D2 — inimigos | AN-06, AN-08, AN-09 | `src/render/animated-enemies.js`, GLB de monstros | AST + CPU + GPU |
| D3 — arte do cenário | AD-01, AD-02, AD-03, AD-05, PF-04, PF-07 | `src/render/asset-dressing.js`, `cemetery.js`, `assets/environment/**` | AST + GPU + HUM |
| D4 — áudio | AU-02, AU-03, AU-05 | `src/audio/**`, `assets/audio/**`, e a tabela de osciladores do `main.js` (patch para o dono do `main.js`) | AST (ElevenLabs offline) + HUM |

**D4 pode começar junto com a Onda B** (só gera assets e mexe em `src/audio`); assim a sessão do dono escuta tudo de uma vez. D1 é o caminho mais longo do projeto e também pode abrir em paralelo desde já, pois não toca arquivos das outras raias.

## 5. Dimensões travadas no dono

| Dimensão | Por quê | O que pedir |
| --- | --- | --- |
| mobile (MO-01, MO-02, MO-05) | A rubrica exige iOS **e** Android físicos; emulação de viewport é declarada insuficiente | Uma sessão de ~30 min: abrir o preview no iPhone (Safari) e num Android (Chrome), 10 min por classe em retrato e paisagem, gravação de tela, notas sobre alcance do polegar, safe-area, teclado no login, aquecimento e quedas de quadro |
| audio (AU-01) | O JEF é só texto e nenhum agente escuta | Na mesma sessão: fone + alto-falante do aparelho, os 8 pontos de `docs/audio-review.md`, mais a página `output/playwright/arpg-v2-audio-listening-review/index.html` no desktop |
| accessibility (AC-02) | Leitor de tela real | 5 min de VoiceOver em menu → login → cartas → morte |
| combat_feel (CF-06), art/animation (parte) | "Sensação" e movimento contínuo: agentes revêem quadros, não fluidez nem peso | 10 min por classe no desktop com notas curtas; o agente converte em observações para o JEF |
| performance (parte mobile) | Alvo de p95 ≤ 25 ms em aparelho | Sai da mesma sessão, se o build tiver contador de frame-time exportável (preparar em B4) |
| Decisões | GD-02 (cartas em tempo real × pausa), AD-02 (trocar composição/asset de copa), linha v13–v15 × takes novos, e qualquer promoção para `main`/produção | Resposta curta do dono destrava C1, D1 e D3 |

Sem essa sessão, mobile e áudio não passam de ~0,1–2 no JEF e o alvo "> 9,5 em todas" é inalcançável, por melhor que o resto fique. Os agentes podem deixar tudo pronto: build de preview, roteiro de 1 página, formulário que já sai no formato da evidência.

## 6. Contradições documentais a sanear (o juiz lê texto)

- `grok.md` lista o P0 de disconnect e os P1 (`active` no snapshot, teto de movimento) como abertos; no v5 estão corrigidos — VC `server.mjs:15,1344,2235`, `src/combat/class-skills.mjs:36,49`.
- `aaa-review-20260919.md` lista dash remoto e boca do rifle como abertos; ambos estão no v5 (`dash-vfx.js 0d8efb4a…`, bridge `81fcaca6…`).
- `astra-canopy.md` e as notas de closeout de environment dizem que o corredor de copa para companheiros não foi promovido; o código publicado tem os três módulos (`src/main.js:6052`).
- `physics-handoff.md` e `physics-pursuit-terminal.md` dizem "sem promoção" da navegação `e46cc63f…` e do adapter; `combat-environment-pursuit-integration.md` e `src/main.js:8983` mostram o contrário. O mesmo vale para o fallback de melee (`server.mjs:974`).
- `sfx-handoff.md` diz que o patch de desconexão "não foi aplicado"; está no código, e `coordinator-audio.md` registra 31/31 — na integration-v3, não no v5.
- `vfx-handoff.md` fala em "28 módulos congelados, dash só em cópia" e "Dwarf BLEND"; a produção tem 34 arquivos em `src/vfx`, dash art2 e GLB OPAQUE `dc0867da…`. `vfx-dash-post-mixer-contract.md` chama `e19eefbd…` de "pool final"; o final é `0d8efb4a…`.
- `fable-closeout/gui/notes.txt` lista "Em pausa com cartas abertas" como pendente; está corrigido (`src/ui/arpg-hud.js:175`).
- `docs/multiplayer-reconnect.md` e `docs/quality-classes.md` dizem que posição e vida são reportadas pelo cliente; no v5 o `state` é intenção e o movimento é orçado (`server.mjs:548-567`).
- Render: `grok.md` e `orchestration-status.md` registram 503 (workspace suspenso por cobrança); `fable-closeout.md` (~11:00Z) registra 200 após redeploy. Risco operacional a vigiar.
- Contagem de colisores aparece como 138, 143, 147 e 153 ao longo dos documentos; vale **153**. `docs/asset-inventory.md` está defasado (5 GLB, altura do herói 2,4; o runtime usa 2,7).
- Os `docs/jef-*.md` dizem "12 notas null", mas os JSON trazem notas preliminares; a `LOOP-STATE.md` já usa as preliminares. O limiar da rubrica (`docs/quality-rubric.json`) é `>= 10` e `verify-evaluator-contract` o afirma; o alvo do loop é `> 9,5` — usar o campo `allDimensionsStrictlyAbove95` do relatório em vez de mexer na rubrica.
- P90 de apoio divergem entre `docs/hero-locomotion.md` (banda de 4 cm: ré 1,108/1,429) e `animation-handoff.md` (patch declarado: 0,598/0,137): são métricas diferentes; não comparar.

## Apêndice — reproduzir o baseline CPU

```sh
REPO=/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX
T6=$REPO/output/qa/aaa-loop/t6; SCRATCH=$T6/scratch
mkdir -p "$SCRATCH" "$T6/tmp" "$T6/evidence" "$T6/logs"
rsync -a --exclude source-history "$REPO/src/" "$SCRATCH/src/"
rsync -a --exclude __pycache__ "$REPO/tools/" "$SCRATCH/tools/"
cp "$REPO"/{index.html,styles.css,server.mjs,package.json,package-lock.json} "$SCRATCH/"
mkdir -p "$SCRATCH/docs" && cp "$REPO"/docs/quality-{rubric,evidence.template}.json "$SCRATCH/docs/"
for d in assets vendor node_modules; do ln -s "$REPO/$d" "$SCRATCH/$d"; done   # nunca copiar .env nem .data
cd "$SCRATCH" && export TMPDIR="$T6/tmp/"
BIPX_EVIDENCE_DIR="$T6/evidence/<suite>" node tools/<suite>.mjs                 # uma por vez
# verify-http: subir o servidor do próprio scratch e passar a URL
HOST=127.0.0.1 PORT=0 LEADERBOARD_FILE="$T6/tmp/lb.json" SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= node server.mjs &
node tools/verify-http.mjs "http://127.0.0.1:<porta impressa>/"; kill %1
```
