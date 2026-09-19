# Fable fixes v1 — F-01 a F-04 em candidato isolado (2026-09-19)

Tarefa `task_1626d162faae`. Candidato: `output/qa/aaa-20260919/fable-fixes-v1/candidate/` (cópia de `index.html`, `styles.css`, `server.mjs`, `package.json`, `src/` sem `source-history`; `assets/`, `vendor/`, `node_modules/` por symlink somente leitura). **Nenhum arquivo vivo foi alterado**: `live-hashes-before.txt` e `live-hashes-after.txt` (105 arquivos) são idênticos. Autoridade e balanceamento intactos; cartas continuam em tempo real.

## Hashes (SHA-256)

| Arquivo | Antes (vivo = candidato inicial) | Depois (candidato) |
| --- | --- | --- |
| `src/main.js` | `d9e6fed48d8609acbd495f9a1c747bbe8e6b9d3cc00447aa75e4896b156b6d3b` | `23771fc012d6f2d3340e74e2f171c0371fb1eb2cb8ae81475e037e8ff148ba00` |
| `src/ui/arpg-hud.js` | `9f0f35dd4f80d71e6df073dc52707373a1068e212b45aed83c308d897d3b8927` | `36bbde7540f0f1ef486b8faf08d6cbacc87b23305f6ae26aa2bad8018b054133` |
| `src/progression/authority.mjs` | `ce3311cef97a84dc9e60321ae4353a7fcdd2b238f60464b21080f7950ba58e39` | `8cd94a624379bb0b90cec6baac14de9462d0f2a0e52fc277a0ed3c45698a27c3` |
| `index.html` | `f3f909164742d1d79303fbc914b343d20d19585ced0fb198150912854bf8474c` | `dc6870e36b0a08a1cf278827c1813241241be9a6437df8c6f9a13c4cdabeb31f` |
| `styles.css` | `0dfb40e3a4b21e6e34b7de521a9544a9fc1f9a278718c35468e4962964c6a3ac` | `3010fcf4c36bba90b5ad6b9211be322c9cd51202a4c59bb42b73f8da38338a38` |

Manifestos completos: `output/qa/aaa-20260919/fable-fixes-v1/{live,candidate}-hashes-{before,after}.txt`. Os outros 100 arquivos do candidato são idênticos aos vivos.

## Patches

`output/qa/aaa-20260919/fable-fixes-v1/patches/`: um por arquivo + `all-fable-fixes-v1.patch` (5 arquivos, +58/−18). `git apply --check` passa contra a árvore viva atual (main.js `d9e6fed4…`). Se um dono alterar esses trechos antes da aplicação, regenerar a partir do candidato.

| Achado | Mudança | Dono sugerido |
| --- | --- | --- |
| F-01 | `main.js` keydown: durante a run só campos de texto/diálogos bloqueiam teclas de jogo; Espaço/Enter num botão/summary focado mantêm a ativação nativa e não disparam a arma; clique por ponteiro em "Som" devolve o foco ao canvas (ativação por teclado mantém o foco). `arpg-hud.js`: 1/2/3 não são mais silenciados por botão focado. Fora da run (menus) o comportamento antigo é preservado. | Combat + GUI |
| F-02 | `styles.css`: com HUD ARPG conectado e viewport ≥901×700, o painel de evolução reserva 150 px inferiores; layouts compactos mantêm regras próprias. | GUI |
| F-03 | `endGame()`: resumo com dados existentes (tempo, abates, pontos, nível, `getPlayerBuildSummary()`), `role="status"`, botão "Tentar de novo" preservando SVG/`#play-button-label`, `aria-describedby`, foco explícito no botão e guarda de 600 ms contra Enter/clique herdado do combate. `restoreMenuIdentity()` devolve título/kicker/copy/rótulo originais em Voltar e em `startGame()` (remove "☠ Noite Zumbi ☠", "cemiterio", "▶ Entrar no jogo"). CSS mantém o resumo visível no login compacto em paisagem. | Combat + GUI |
| F-04 | "Attack Speed"→"+Cadência" (cliente **e** rótulo em `authority.mjs`, apenas string de exibição/ranking; nenhuma regra mudou), "x/y stacks"→"Nível x/y", "LVL n"→"Nv. n", descrições de +Dano/+Área sem "armas automáticas", "Nivel"→"Nível", valor inicial "Pistola"→"Arma". | GUI (+ Combat p/ authority) |

## Evidência before/after

Mesma sonda (`output/qa/aaa-20260919/fable-fixes-v1/fixes-probe.mjs`) com teclado/mouse/toque reais, Chromium headless, servidores próprios (vivo somente leitura em 5197, candidato em 5198), Supabase desligado, ranking descartável, lock de GPU reservado só durante o browser e liberado pelo dono. XP, tempo e morte por fixtures de debug. Zero erros de página/console no candidato (3 contextos). JSON e PNGs em `output/qa/aaa-20260919/fable-fixes-v1/evidence/{before,after}/`.

| Verificação (desktop 1440×900) | Before (vivo) | After (candidato) |
| --- | --- | --- |
| Foco após clicar "Som" | `#audio-toggle` | `#game-canvas` |
| WASD 700 ms após clicar "Som" (baseline 2,05 m) | **0 m** | 2,05 m |
| Dígito 1 lança skill após clicar "Som" | não | sim |
| Tab→"Som", Espaço alterna o som (semântica de ativação) | sim | sim, foco permanece no botão |
| WASD com "Som" focado por teclado / com skill focada | 0 m / 0 m | 1,83 m / 1,57 m |
| Dígito com skill focada | sim | sim |
| Diálogo: Esc abre, foco no ×, Tab percorre 7 controles, Espaço alterna switch, WASD bloqueado aberto, foco volta ao canvas | — (auditoria anterior: ok) | ok (0 m aberto; 3,0 m após fechar) |
| Painel de evolução cobre esferas / barra | **sim / sim** (y 572–876) | não / não (y 446–750), movimento continua 1,35 m |
| Textos das cartas e chip | "0/6 stacks", "armas manuais e automáticas", "LVL 2" | "Nível 0/6", "seus ataques e habilidades", "Nv. 2" |
| Enter 250 ms após morrer (segurando Espaço) | **run reiniciou sem mostrar a tela** | permanece em "dead" |
| Foco na morte | canvas atrás do menu | `#play-button` |
| Resumo da morte | "0 pontos · Nivel 2", copy oculto | "1:23 de sobrevivência · 0 abates · 0 pontos · Nível 2. Poderes: +Dano x1." visível |
| Botão | "↻Reiniciar" sem SVG | "Tentar de novo" com SVG |
| Voltar após morte | (auditoria: "☠ Noite Zumbi ☠", "cemiterio", "▶ Entrar no jogo") | "Noite Zumbi", "…cemitério.", "Sobreviver sozinho" |
| Reinício por teclado (botão focado+Enter; Enter após a guarda) e WASD após reinício | — | ok, 2,05 m |

A sonda before aborta depois da morte porque o Enter precoce reinicia a run viva — comportamento registrado, não falha da sonda; o before mobile é o da auditoria (`output/qa/aaa-20260919/fable/evidence/`). Mobile after (390×844 e 844×390, touch @3x): stick + skill com segundo dedo move (1,50 / 1,36 m) e lança; cartas inteiras na tela; resumo de morte visível nos dois, sem overflow, botão dentro da tela; reinício por toque ok.

## Limitações

- Headless e fixtures: não prova sensação, áudio, leitor de tela real, dispositivo físico nem run natural longa. Multiplayer (morte/oferta autoritativa/rótulo do servidor no ranking) não exercitado; o servidor 5173 continua com o rótulo antigo até o dono reiniciar.
- Nenhuma suíte global foi rodada; suítes que comparem os textos antigos ("Reiniciar", "stacks", "Attack Speed") precisarão de atualização pelo dono — `grep` em `tools/*.mjs` não achou dependências dessas strings.
- Observação residual (não corrigida, fora do escopo): com cartas abertas o HUD mostra "Em pausa"/Ⅱ nas skills embora a horda continue (`main.js` `paused || pendingUpgradeChoices`, `arpg-hud.js:72-74`); sugerido texto "Evolução" coerente. `formatHudNumber` usa `en-US`.
- S-01 (progressão das skills) fica para tarefa separada, conforme instrução.
