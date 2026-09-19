# Auditoria Fable — design e experiência (2026-09-19)

Autor: Fable 5.1 high, terminal `term_7d6c7989…`, tarefa `task_f05fb3a7f21e`. Escopo: game design, identidade das classes, progressão/recompensas, ritmo, HUD, entrada/menus/upgrade/morte/restart, teclado/foco/labels/reduced motion, controles mobile e legibilidade. Nenhum arquivo de runtime foi editado. **Este relatório não atribui nota a nenhuma dimensão**; nenhuma chega a 10 com a evidência abaixo.

## Candidato e método

Fonte local de trabalho (não commitada), estável durante as sondas (último mtime `src/main.js` 04:10 −03; sondas 05:35–05:50 −03). SHA-256:

| Arquivo | SHA-256 |
| --- | --- |
| `src/main.js` | `d9e6fed48d8609acbd495f9a1c747bbe8e6b9d3cc00447aa75e4896b156b6d3b` |
| `index.html` | `f3f909164742d1d79303fbc914b343d20d19585ced0fb198150912854bf8474c` |
| `styles.css` | `0dfb40e3a4b21e6e34b7de521a9544a9fc1f9a278718c35468e4962964c6a3ac` |
| `src/ui/arpg-hud.js` | `9f0f35dd4f80d71e6df073dc52707373a1068e212b45aed83c308d897d3b8927` |
| `src/ui/presentation.js` | `c846d5b334a77e178de44148ad49285f251c1b5b9223431ba8486c83f9bc944b` |
| `src/ui/arpg-painted.css` | `f143b4e2c1256b70bd7d30877dcfb4ae6bc4d2f6837f0d7259204c0b728267da` |
| `src/combat/class-skills.mjs` | `6fa8f8709bbf47b5015535c438a77ad97b933a8dbb2da05c6b0df21b8cee93c3` |

Método: leitura da fonte + duas sondas Playwright focais (`output/qa/aaa-20260919/fable/focal-ux-probe.mjs`, `focus-followup-probe.mjs`) com **teclado, mouse e toque reais** (multi-toque via CDP), em servidor próprio `127.0.0.1:5199`, Supabase desligado e ranking descartável — o 5173 e o ranking local do usuário não foram tocados. GPU reservada pelo lock atômico e liberada pelo próprio dono. Chromium headless 1440×900, 390×844@3x touch e 844×390@3x touch. Zero erros de página/console nos três contextos. XP, dano letal e abertura de cartas usaram **fixtures de debug** (`grantXp`, `damagePlayer`), rotuladas abaixo. Nenhuma bateria global foi repetida.

Limites: headless não prova sensação de jogo, áudio, dispositivo físico nem sessão longa; não joguei ondas avançadas, então ritmo/dificuldade é análise estática. Multiplayer não foi exercitado (escopo do Grok).

## A. Defeitos reproduzidos

### F-01 · P1 · Foco em qualquer botão do HUD mata movimento, ataque e habilidades
- **Impacto:** o jogador clica em "Som: ON" (ou chega por Tab ao som/pausa/skill) no meio da horda e o personagem **para de responder a WASD, Espaço e 1/2/3** sem nenhum aviso; Espaço passa a alternar o som. Só volta ao clicar na arena. Para quem joga só no teclado (IJKL+Espaço, caminho documentado em "Como jogar") a run fica efetivamente travada — o primeiro Tab a partir do canvas já cai em `#audio-toggle`.
- **Reprodução:** iniciar run solo → clicar em `#audio-toggle` → segurar A 700 ms. Medido: deslocamento **0** (baseline 2,05 m); Espaço re-alternou o áudio; `Digit1` não gerou evento de skill. Follow-up: Tab×3 do canvas → foco em `.arpg-skill`, A 700 ms → **0**; foco em `#pause-button` → **0** (baseline 1,37 m). Foco em `summary` do ranking não bloqueia (2,05 m) — confirma que a causa é o seletor `button`.
- **Causa:** `src/main.js:1718` inclui `button` em `interactiveTarget` e retorna em 1727 antes de `keys.add`; `src/ui/arpg-hud.js:265` ignora dígitos com `button:not(.arpg-skill)` focado; `src/main.js:1627-1631` não devolve o foco após clique por ponteiro (os botões de skill devolvem, `arpg-hud.js:115`).
- **Evidência:** `evidence/focal-ux-probe.json` (`desktop.moveAfterAudioClick`, `spaceRetoggledAudio`, `skillEventsWhileAudioFocused`), `evidence/focus-followup-probe.json`, `evidence/desktop-audio-focus.png`.
- **Proposta:** `proposals/01-…patch`, `01b-…patch`, `01c-…patch` (aplicam limpo com `git apply --check`; **não testados em runtime**). Donos: Combat (`main.js`), GUI (`arpg-hud.js`).

### F-02 · P1 · Painel de evolução cobre as esferas de vida/recurso enquanto a horda continua batendo (desktop)
- **Impacto:** o texto do painel diz "A horda continua avançando" e é verdade (relógio 0:07→0:08, movimento 1,37 m com painel aberto, captura mostra `-14` de dano). Em 1440×900 o painel ocupa y 572–876 e **esconde as duas esferas e a barra de skills**; a barra de vida antiga está oculta por `styles.css:524`. O jogador decide uma carta sem ver a própria vida, e 1/2/3 viram seleção de carta (skills bloqueadas, `main.js:6775`). Morte durante a leitura é plausível e parece injusta.
- **Reprodução:** run solo desktop → `grantXp(40)` (fixture) → observar painel. Em 390×844 e 844×390 as cartas ficam inteiras acima do HUD (sem o defeito).
- **Evidência:** `evidence/desktop-upgrade.png`, `focal-ux-probe.json` (`desktop.upgrade`).
- **Proposta:** `proposals/02-…patch` (CSS restrito a ≥901×700, preserva layouts compactos). Decisão de design em aberto para o coordenador (ver D-02): manter tempo real exige vida visível; alternativa é pausar no solo.

### F-03 · P2 · Tela de morte pobre, foco perdido e menu muda de identidade após morrer
- **Impacto:** o fim da run — momento central de um roguelite — mostra só "Fim da noite / Onda 1 / 0 pontos · Nivel 2" sob o título fixo "Deixe sua marca.". Sem tempo, abates, poderes escolhidos ou causa da morte, embora o ranking já guarde tudo isso. O foco fica no canvas atrás do menu (leitor de tela não anuncia nada). Depois de "← Voltar", o menu vira "☠ Noite Zumbi ☠", "cemiterio" sem acento e botão "▶ Entrar no jogo" no lugar de "Sobreviver sozinho", com o ícone SVG perdido.
- **Reprodução:** `damagePlayer(100000)` (fixture) com o mouse pressionado → ler a tela → Voltar → Enter.
- **Causa:** `src/main.js:10205-10208` e `1660-1672`.
- **Evidência:** `evidence/desktop-death.png`, `desktop-after-death-back.png`, `focal-ux-probe.json` (`desktop.death`). Observação positiva: soltar o mouse sobre a tela de morte **não** reiniciou a run.
- **Proposta:** `proposals/03-death-summary-and-copy.md`.

### F-04 · P2 · Idioma e termos inconsistentes nas cartas e no HUD
- Reproduzido nas cartas renderizadas: "0/5 **stacks**"; na fonte: rótulo "**Attack Speed**" (`main.js:1245`), chip "LVL 1", descrições de `+Dano`/`+Área` citando "armas automáticas" que `isUpgradeAvailable` desativa (`main.js:6472`). Quebra a voz em pt-BR do resto do jogo e promete um sistema que não existe. Proposta em `03-…md` item 3–4.

## B. Suspeitas estáticas (não reproduzidas)

- **S-01 · P1 · Progressão não conversa com a identidade das classes.** As 20 evoluções (`main.js:1233-1393`) são genéricas; nenhuma altera custo, recarga, raio, duração ou comportamento das seis habilidades v2, nem Fervor/Foco. Só `damage` chega às skills (`getCombatDamageMultiplier`, `main.js:6787`). A diferença entre classes no catálogo é Aldric *perder* duas opções (`6473`). Resultado provável: builds de Aldric e Lyra convergem, e as skills — o investimento mais caro do projeto — ficam estáticas do minuto 1 ao fim. Sugestão: 2–3 evoluções raras por skill (ex.: Grito +3 s / Corte devolve recurso por abate / Glacial estilhaça congelados / Núcleo colapsa com dano), autoritativas em `src/progression/authority.mjs`.
- **S-02 · P2 · Recompensa vazia no fim de run longa.** Esgotadas as ~45 pilhas, `openUpgradeChoices` zera `pendingLevelUps` em silêncio (`6382-6385`): subir de nível deixa de dar algo. Precisa de fallback (cura/pontos) e aviso.
- **S-03 · P2 · Economia de recurso:** gasto com tudo em recarga ≈ 9,8/s vs 8/s (Aldric) e 12,3/s vs 9/s (Lyra) — há escolha real, bom sinal; mas não medi se o dano das skills acompanha a vida das ondas tardias. Pendente de run natural.
- **S-04 · P2 · Abas do diálogo** usam `aria-pressed` em vez de `role="tablist/tab"` + `aria-selected` (`index.html:107`); o stick é `role="img"`. Funciona por teclado (verificado), rótulo semântico impreciso.
- **S-05 · P2 · Legibilidade mobile:** custo da skill e estado da arma em **9 px**, tecla em 10–11 px, stats 10–11 px (`focal-ux-probe.json` `fontSizes`). Alvos de toque estão ≥44 px. Em aparelho físico a 9 px o custo — informação de decisão — tende a ser ilegível; precisa de dispositivo real.

## C. Verificado sem defeito

- Menu→login→run só com teclado (Enter, nome, Enter); foco vai ao campo de nome e depois ao canvas.
- Esc abre opções, pausa o solo, foco no "×", Tab percorre todos os controles, "Reduzir movimento" alterna com Espaço, Esc fecha, foco volta ao canvas e a run retoma.
- Com reduced motion ligado, **nenhuma** animação CSS em execução no documento; default respeita `prefers-reduced-motion` (`src/render/preferences.js`). Supressão no WebGL/VFX não foi avaliada visualmente.
- Toque: segurar o stick e tocar uma skill com o segundo dedo lança a skill e o movimento continua (retrato 3,0 m, paisagem 2,4 m); tooltip não aparece no toque; sem overflow horizontal; botões de jogar visíveis; cartas inteiras na tela. A sobreposição som/pausa × `.survivor-hud` em retrato é só de caixa — na captura não há colisão visual.
- Orbes com `role="meter"` e `aria-valuetext`; skills com rótulo de custo/estado; anúncio `aria-live` das cartas.

## D. Requisitos pendentes / decisões

- **D-01** Runs naturais longas nas duas classes (ritmo de ondas, dificuldade, valor real de cada skill, contra-jogo dos inimigos): não executadas; design/classes e combate seguem **pendentes**.
- **D-02** Decidir: cartas em tempo real (então F-02 + atalho que não roube 1/2/3, p.ex. segurar para confirmar) ou pausa no solo.
- **D-03** iOS/Android físicos, zoom 200 %, contraste medido, leitor de tela real e reduced motion no WebGL: sem evidência.
- **D-04** HUD/upgrade/morte em multiplayer (oferta autoritativa, `aria-busy`, reconexão) não exercitados aqui.

## Artefatos

`output/qa/aaa-20260919/fable/`: `focal-ux-probe.mjs`, `focus-followup-probe.mjs`, `evidence/` (2 JSON, `candidate-hashes.txt`, 13 PNG), `proposals/` (4 patches verificados com `git apply --check`, 1 proposta em texto). Prioridade sugerida: F-01 → F-02 → S-01 → F-03/F-04.
