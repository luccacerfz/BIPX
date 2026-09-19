# Fable 7 — mobile emulado e teclado/acessibilidade no candidato combinado (2026-09-19)

Tarefa `task_acbfbd071b7e`. Base congelada exclusiva `output/qa/aaa-20260919/fable-mobile-v3/candidate/` (cópia da integration-v3: UX + área + rede + dash + canopy + loot + pointblank A). **Base, fonte viva, 5173 e ranking intocados** (manifesto de 110 arquivos conferido antes/depois; o servidor rodou de `runner/`, que só contém symlinks para a base e uma cópia byte-idêntica de `server.mjs`, com Supabase desligado e ranking descartável). Nenhum `candidate-fixed` foi criado: **não encontrei bug real** nesta rodada. Sem commit/merge/push/deploy/JEF. Rodada única de GPU, anunciada antes e liberada ao fim; não repetida.

| Arquivo | SHA-256 |
| --- | --- |
| `src/main.js` | `cb1e551738f1de27bac7979c3f72fcb157e76a3f99a1d5ec9b765e8973a6632d` |
| `server.mjs` | `bcbeb948a8b292559c9daed87a6a0e42caba8fde620efe0f53b2ee84b10a5131` |
| `src/combat/class-skills.mjs` | `058bda880930384a6a5baa210905ab2be52e38d3f88f435ed41824fc3872406d` |
| `index.html` / `styles.css` / `src/ui/arpg-hud.js` / `presentation.js` / `arpg-painted.css` | `dc6870e3…` / `3010fcf4…` / `36e157e7…` / `c846d5b3…` / `f143b4e2…` — **idênticos aos da `fable-fixes-v2`** |

Manifesto completo: `fable-mobile-v3/candidate-manifest-frozen.txt`.

## Método e limites

`tools/mobile-a11y-probe.mjs`, Chromium headless com ANGLE/Metal, modo solo (`?offline=1`), vídeo contínuo por perfil, **6 perfis curtos**: desktop 1440×900 só com teclado (Aldric e Lyra), toque 390×844 @3x (Aldric e Lyra), toque 844×390 @3x (Aldric e Lyra). Entradas reais listadas em `inputs` de cada `probe.json`: teclas, toques simples e **multi-toque por CDP** (até 3 dedos). Getters de debug só como leitura. **Nenhuma fixture foi usada** (o roteiro previa `grantXp` rotulado apenas para abrir cartas; não chegou a ser acionado). Zero erros de página/console nos 6 perfis.

Isto é **emulação de viewport/touch, não dispositivo físico**: não prova safe-area real, teclado virtual, latência de toque, térmica nem leitor de tela. Nenhuma nota atribuída.

## Teclado e acessibilidade (desktop, duas classes)

| Verificação | Resultado |
| --- | --- |
| Menu por Tab | som → "Entrar na noite" → ranking → ajuda → opções; foco visível em todos. O 1º Tab cai no botão de som antes da ação principal (ordem do DOM) — sugestão P2, não bug |
| Enter abre o login; foco | `#player-name` |
| Seleção de classe só por teclado | Shift+Tab cai no rádio marcado; **→ seleciona Lyra**, foco permanece no rádio, status `aria-live` "Lyra Brasswarden pronta para a noite."; Tab volta ao nome |
| Nome + Enter inicia; foco | canvas |
| WASD / setas (700 ms) | 4,55–4,66 m / 4,55 m |
| L (mira IJKL) + Espaço | ataque básico observado nas duas classes |
| Dígitos 1/2/3 | as **6 habilidades** lançadas (Aldric: lista de eventos; Lyra: as três entram em recarga — o histórico de eventos de debug tem teto de 128 e os `travel` do projétil expulsam o `cast` do canhão; é artefato da leitura, não falha de entrada) |
| Tab → "Som", Espaço | alterna o som, foco fica no botão e **WASD continua movendo** (3,9–4,5 m) |
| Tab ×2 → botão de skill | tooltip por foco visível, com nome, descrição, custo, recarga, efeito ativo e estado; `aria-label` "1: Grito de Guerra. Custo 24 de Fervor. 9,3 s de recarga." |
| Esc | abre opções, pausa, foco no ×; Tab percorre 7 controles; Enter troca abas ("Como sobreviver"); Espaço liga/desliga contraste; movimento bloqueado com o diálogo aberto (0 m); Esc fecha, foco no canvas, despausa |
| `<select>` de qualidade com seta | valor não mudou em headless macOS (a seta abre o popup nativo); **não verificado**, não classifico como bug |
| Cartas (naturais, Lyra, nível 2) | status "Evolução", anúncio `aria-live` com as 3 opções, skill anuncia "Escolha uma evolução", painel **não cobre as esferas** (y 446–750), foco permanece no canvas, tecla 1 escolhe e fecha |
| Morte natural (0:17–0:18) | foco explícito em "Tentar de novo", `aria-describedby` → resumo com `role="status"` ("0:17 de sobrevivência · 8 abates · 80 pontos · Nível 2. Poderes: +Raio de coleta x1."); Enter reinicia; foco volta ao canvas |

Observação de texto (P2): com o Grito ativo o tooltip repete a descrição no efeito ("Efeito ativo: 4s · Por 8 s: +35%…").

## Toque 390×844 e 844×390 (duas classes cada)

| Verificação | Retrato | Paisagem |
| --- | --- | --- |
| Menu/login sem overflow; botão de jogar visível; campo de nome 16 px (sem zoom do iOS) | sim | sim |
| Seleção de classe por toque + status | ok | ok |
| Stick (800 ms) | 4,45 m | 4,52–4,54 m |
| 2º dedo: segurar ataque e arrastar mira com o stick preso | atacou; 6,6–6,7 m percorridos | atacou; 6,7 m |
| **3º dedo** toca a skill 1 com stick + ataque presos | lançou (Grito / Canhão) | lançou |
| Toque nas skills 2 e 3 | lançadas; **6/6 habilidades por toque** (paisagem-Lyra confirmada pela captura `04-after-skills.png`: recargas 2 s / 7 s / 11 s) | idem |
| Tooltip após toque | oculto | oculto |
| Som por toque | alterna, alvo 63×44 | 73×44 |
| Pausa → diálogo | 352×646 dentro da tela, sem rolagem | 510×350, **rola**: contraste, som e "Voltar à partida" ficam abaixo da dobra até rolar (× sempre visível) |
| Abas, "Como jogar" com instruções de toque, interruptor de movimento, retomar | ok, despausa | ok |
| Morte natural (0:14–0:17) | resumo visível, sem overflow, botão na tela, toque reinicia | idem |

**Overlap:** li todos os retângulos DOM visíveis (skills, ataque básico, esferas, barra, status, stick, botão de ataque, som, pausa, linhas do HUD superior, XP, chips, ranking, dica inicial) com `pointer-events` e opacidade antes de classificar: **nenhuma interseção** nos 4 perfis de toque (a única relação contida é skills dentro da barra de ação, esperada). Nomes de jogadores, rótulos de loot e cartas são escopos distintos: rótulos de loot e nomes são desenhados no canvas e **não foram avaliados** aqui (sem drops nem segundo jogador nestas sessões curtas); cartas — ver lacunas.

Legibilidade (medida, não julgada em aparelho): custo da skill e estado da arma **9 px**, tecla 10–11 px, stats 10–11 px, rótulo das esferas 10–11 px, valor das esferas 20 px, resumo de morte e tooltip 12 px. Alvos de skill 47–48 px; × do diálogo **38×40 px** no retrato (abaixo de 44); interruptores 42×24 px, mas a linha inteira é o rótulo clicável.

Sugestões P2 (sem patch, por não serem defeito reproduzido): × do diálogo ≥ 44 px; subir o custo da skill para ≥ 11 px; em paisagem a dica inicial (379×58, até 14 s) fica logo abaixo do herói.

## Lacunas desta rodada (não auto-repeti)

- **Cartas por toque não ocorreram**: nos 4 perfis de toque o personagem morreu naturalmente entre 0:14 e 0:17, antes do primeiro nível; como já estava morto, a fixture rotulada também não rodou. O layout das cartas em 390×844 e 844×390 tem evidência anterior (`fable-fixes-v1/v2`) com **os mesmos hashes** de `index.html`, `styles.css` e `arpg-hud.js`, mas não foi reobservado neste candidato.
- Sessões naturais muito curtas (14–18 s, jogador quase parado — mesmo achado N-01 já reportado; não é tema desta tarefa): HUD com buffs/efeitos, drops, rótulos de loot, chefes e pilhas de +Área no HUD não apareceram.
- Multiplayer (lista de grupo, nomes remotos) fora desta rodada.
- Teclado: mudança do `<select>` por seta e leitor de tela real não verificados. Contraste de cores não medido.
- Dispositivo físico iOS/Android: inexistente nesta evidência.

## Artefatos

`output/qa/aaa-20260919/fable-mobile-v3/`: `tools/mobile-a11y-probe.mjs`, `candidate-manifest-frozen.txt`, `live-hashes-before.txt`, `runner/`, `evidence/<perfil>-<classe>/` com `probe.json` (entradas, medidas, retângulos), 6–8 PNG e um `.webm` cada (6 vídeos, 95 MB no total).
