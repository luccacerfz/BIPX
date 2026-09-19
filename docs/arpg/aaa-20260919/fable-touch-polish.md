# Fable 8 — polimento de toque (2026-09-19)

Tarefa `task_262582339928`. Candidato exclusivo `output/qa/aaa-20260919/fable-touch-polish-v1/candidate/`, copiado de `fable-mobile-v3/candidate` (cópia conferida idêntica antes de editar). **Só CSS**: nada em `main.js`, `server.mjs`, gameplay, candidatos alheios, fonte viva, 5173 ou ranking (manifestos conferidos ao final: base e viva inalteradas). Sem commit/merge/push/deploy/JEF. Os negativos anteriores (Fable 7: fechar 38×40 px, custo 9 px) permanecem em `fable-mobile-v3/evidence/` e são reproduzidos aqui no "antes".

## Patch congelado

`fable-touch-polish-v1/patches/touch-polish-v1.patch` — 2 arquivos, 4 linhas, `patch --dry-run` limpo sobre `fable-mobile-v3/candidate`. SHA-256 do patch: `538e23a972240be40b00ebd0b7908066bdd6e5137f5c07bb8b3227acb896b565`.

| Arquivo | SHA-256 no candidato |
| --- | --- |
| `styles.css` | `c2ea6147bc688341dd95c40565a132068c8eefb24d99b88b63bc8eb1056ba69f` |
| `src/ui/arpg-painted.css` | `9b29b76e1b3907a952020591a70cf2d90eb58de0038379d48f7189d41fd58b8c` |
| demais 108 arquivos | idênticos à base (`candidate-manifest-frozen.txt`) |

| Regra | Antes | Depois | Motivo |
| --- | --- | --- | --- |
| `.dialog-close` (`styles.css`) | `width/height: 40px` | `flex: 0 0 44px; width/height: 44px` | o item flex encolhia para 37,7 px no retrato; agora o alvo é fixo em 44×44 |
| `.arpg-art-v3 .arpg-skill__cost` no bloco compacto (`arpg-painted.css`) | `font-size: 9px` | `11px` (mesma `line-height: 16px`) | custo da skill em telas ≤ 680 px / paisagem de toque |
| `.hud__stat small` (`styles.css`) | `9px` | `11px` | estado da arma ("PRONTA") e legenda "Local" |
| `.hud__stat--weapon small` no bloco compacto | `9px` | `11px` | mesmo estado no retrato |

Não alterado de propósito: custo da skill no desktop (já 10 px, fora do critério "onde hoje 9 px"), `.skill-chip small` 8 px, legendas de 9–10 px do menu/ranking/esferas — fora do pedido; nenhum redesenho.

## Inspeção estática (sem GPU, antes da janela)

`tools/static-layout.mjs`: Chromium com `--disable-gpu`, `main.js` bloqueado (sem WebGL, sem jogo), HUD montado pelo `arpg-hud.js` real e alimentado por **um snapshot sintético** de pior caso (timer "11s" + custo de 2 dígitos). É fixture de layout, não gameplay. `evidence/static-before/` e `static-after/`.

| Viewport | Fechar antes → depois | Custo antes → depois | Skill | Esfera | Custo × timer / tecla | Linha do HUD | Overflow |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1440×900 | 40×40 → **44×44** | 10 px → 10 px | 66×66 = | 104×125 = | sem toque | 24 px = | não |
| 390×844 | **37,7×40 → 44×44** | **9 → 11 px** (14,5×16 → 16,8×16) | 47×47 = | 64×84 = | sem toque | 22 px = | não |
| 844×390 | 40×40 → **44×44** | **9 → 11 px** | 48×48 = | 64×83 = | sem toque | 20 px = | não |

Fechar mede 44×44 também na aba "Como jogar" (título mais curto/longo não muda o alvo) e o título não encosta no botão. Estado da arma: 9 → 11 px (em paisagem continua `display: none`, como antes).

## Validação nativa curta (janela de GPU autorizada, lock próprio, liberado)

`tools/native-check.mjs`: jogo real em modo solo, emulação de toque @3x, **toques reais** (menu → Lyra → jogar → 3 skills → pausa → aba → ×), sem esperar morte, zero erros de console. `evidence/native/` (JSON + 4 capturas).

| Medida | 390×844 | 844×390 |
| --- | --- | --- |
| `#dialog-close` | 44×44 (44×44 na outra aba); tocar no × fecha e despausa | 44×44; idem |
| Botões de skill | 47×47 ×3 (inalterado) | 48×48 ×3 (inalterado) |
| Custo | 11 px, "28"/"32"/"38", dentro do botão | 11 px, idem |
| Custo × timer ("2s", "7s", "11s") e × tecla | sem interseção | sem interseção |
| Esferas | 64×84 (inalterado) | 64×83 (inalterado) |
| Estado da arma | 11 px, visível | 11 px, oculto por regra pré-existente |
| Overflow horizontal | não | não |

## Limites

Tamanho de fonte em px medido em emulação **não é prova perceptiva em dispositivo físico**; contraste, DPI real, safe-area e teclado virtual não foram avaliados. Não abri nova matriz: cartas, morte, multiplayer e desktop com jogo real não foram reexercitados (desktop só na inspeção estática). O smoke do pacote fica com o Root.
