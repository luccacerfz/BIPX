# Formulário das sessões do dono — evidência v2 (BIPX)

Três sessões de ~10 minutos. São a única forma de fechar os 24 requisitos da rubrica que **nenhum agente pode atestar**: jogar em aparelho físico, ouvir o jogo e julgar como ele parece e responde. Cada bloco `### [ID]` abaixo corresponde a **exatamente um** requisito `human`/`device` de `docs/quality-rubric.json` (o teste `npm run verify:jef` falha se esse mapeamento 1:1 quebrar).

## Regras (valem para as três sessões)

1. **Quem preenche é o dono.** Copie este arquivo para `docs/arpg/aaa-loop/owner-sessions/<data>-<sessão>-<aparelho>.md` (ex.: `2026-09-21-s1-iphone15.md`) e responda ali. Nenhum agente cria, edita ou "melhora" arquivos dessa pasta.
2. O orquestrador preenche **antes** de entregar: candidato, SHA-256 do manifesto e o link. O lint só aceita o arquivo se o SHA-256 completo do manifesto estiver escrito nele.
3. Respostas curtas: marque `S`, `N` ou `Parcial` (ou a nota de 1 a 5) e escreva **uma frase** com o que aconteceu. Não precisa elogiar nem justificar.
4. **Todo `N`, `Parcial` ou nota ≤ 3 vira defeito aberto** na evidência. Isso é esperado e útil; não suavize.
5. O orquestrador transcreve cada bloco **literalmente** para a evidência (`source: "owner"`, campo `verbatim` com as suas palavras, aparelho e data). O lint confere que o texto de `verbatim` existe neste arquivo.
6. Antes de aceitar qualquer nota do JEF em `mobile`, `audio`, `art_direction` e `combat_feel`, leia o texto enviado dessas quatro dimensões (5 min): nelas o JEF só lê as suas palavras.

## Cabeçalho (preencher em toda cópia)

| Campo | Valor |
| --- | --- |
| Candidato (id) | `________` |
| Manifesto do candidato — SHA-256 completo (64 hex) | `________________________________________________________________` |
| Link usado (com `?qa=<SHA-256 do manifesto>-<aparelho>`) | `________` |
| Sessão | `S1 celular` / `S2 escuta` / `S3 olho e mão` |
| Data (AAAA-MM-DD) | `________` |
| Aparelho (modelo exato) | `________` |
| Sistema e versão | `________` |
| Navegador e versão | `________` |
| Aparelho físico nas minhas mãos? (não é simulador nem emulação) | `( ) sim  ( ) não` |
| Fones / alto-falante usados (S2) | `________` |
| Preenchido por | `________ (dono)` |

---

## Sessão 1 — Celular (≈10 min por aparelho; fazer uma vez no iPhone/Safari e uma vez em um Android/Chrome)

Roteiro:

1. Volume em 50 %, modo silencioso desligado. Abra o link em **retrato**.
2. Menu → campo de nome (o teclado cobre o botão? a página dá zoom sozinha?) → Aldric → jogar.
3. Jogue 3 min: polegar esquerdo move **enquanto** o direito ataca; use as 3 habilidades; escolha ao menos 1 carta por toque. Anote o FPS do overlay (`?perf=1`) perto de 1:00 e 2:30.
4. Gire para **paisagem no meio da run** e jogue mais 2 min. Anote o FPS perto de 4:00.
5. Bloqueie a tela por 10 s e desbloqueie.
6. Pausa → opções → som desliga/liga → "Reduzir movimento" → voltar.
7. Morra, leia o resumo, "Tentar de novo" com a Lyra por 2 min.
8. Toque em **"Copiar relatório QA"** (canto superior esquerdo, abaixo do HUD) e cole no bloco `[PF7]`.

### [MB3] Gameplay no iPhone/iPad físico (preencher só na sessão iOS)

- O som tocou no primeiro toque? `( ) S ( ) N ( ) Parcial`
- Moveu e atacou ao mesmo tempo, sem falha? `( ) S ( ) N ( ) Parcial`
- Usou as 3 habilidades e escolheu uma carta por toque (deu tempo de ler)? `( ) S ( ) N ( ) Parcial`
- O teclado virtual cobriu o botão ou a página deu zoom sozinha no campo de nome? `( ) S ( ) N`
- Algo ficou cortado ou sobreposto (notch, barra inferior, cantos) em retrato? E em paisagem? `( ) S ( ) N ( ) Parcial`
- Girar no meio da run quebrou alguma coisa? `( ) S ( ) N`
- Após bloquear/desbloquear: pausou, voltou sem travar e o som voltou? `( ) S ( ) N ( ) Parcial`
- O som no alto-falante do celular distorce? `( ) S ( ) N`
- Em uma frase: `________`

### [MB4] Gameplay no Android físico (preencher só na sessão Android)

- O som tocou no primeiro toque? `( ) S ( ) N ( ) Parcial`
- Moveu e atacou ao mesmo tempo, sem falha? `( ) S ( ) N ( ) Parcial`
- Usou as 3 habilidades e escolheu uma carta por toque (deu tempo de ler)? `( ) S ( ) N ( ) Parcial`
- O teclado virtual cobriu o botão ou a página deu zoom sozinha no campo de nome? `( ) S ( ) N`
- Algo ficou cortado ou sobreposto (câmera, barra de gestos, cantos) em retrato? E em paisagem? `( ) S ( ) N ( ) Parcial`
- Girar no meio da run quebrou alguma coisa? `( ) S ( ) N`
- Após bloquear/desbloquear: pausou, voltou sem travar e o som voltou? `( ) S ( ) N ( ) Parcial`
- O som no alto-falante do celular distorce? `( ) S ( ) N`
- Em uma frase: `________`

### [MB5] Conforto dos alvos de toque

- Algum botão foi difícil de acertar (controle, ataque, 3 habilidades, pausa, som, cartas, "Tentar de novo")? `( ) S ( ) N` — quais: `________`
- Os polegares alcançam tudo sem trocar a pegada? `( ) S ( ) N ( ) Parcial`
- Em uma frase: `________`

### [MB7] Temperatura do aparelho

- Ao final da sessão o aparelho estava: `( ) frio ( ) morno ( ) quente`
- Minutos jogados sem parar: `____` · Bateria no início e no fim: `____ % → ____ %`
- O jogo ficou mais lento conforme esquentou? `( ) S ( ) N`
- Em uma frase: `________`

### [PF6] Comportamento de desempenho no aparelho

- FPS do overlay perto de 1:00 / 2:30 / 4:00: `____ / ____ / ____` · FPS no fim: `____`
- Algum travamento perceptível? `( ) S ( ) N` — quando: `________`
- Com a tela cheia de inimigos o jogo continuou fluido? `( ) S ( ) N ( ) Parcial`
- Em uma frase: `________`

### [PF7] Relatório QA colado (p95 de frame-time ≤ 25 ms)

Toque em "Copiar relatório QA" no fim da sessão e cole o JSON inteiro abaixo (o orquestrador salva como arquivo; o número é conferido em código, não precisa ler).

```json
COLE AQUI
```

- O botão copiou sozinho? `( ) S ( ) N (usei a caixa de texto manual)`

---

## Sessão 2 — Escuta (≈10 min, desktop com fones)

Roteiro: 1 min calmo → 3 min de combate denso → cada habilidade 3× (as 6 skills, nas duas classes) → tomar dano e morrer → silenciar/reativar → recarregar a página.

### [AU2] Os eventos são audíveis e distintos

- De olhos fechados, distingue golpe de espada, tiro e cada uma das 6 habilidades? `( ) S ( ) N ( ) Parcial` — as que confundem: `________`
- Dano recebido e vida baixa são audíveis no meio da horda? `( ) S ( ) N ( ) Parcial`
- Algum som faltando ou atrasado em relação à animação? `( ) S ( ) N` — qual: `________`
- Em uma frase: `________`

### [AU3] Volume e mix equilibrados

- Equilíbrio entre ambiente, música e efeitos (1 = ruim, 5 = ótimo): `____`
- Algum som alto ou baixo demais em relação aos outros? `( ) S ( ) N` — qual: `________`
- Em uma frase: `________`

### [AU4] Pistas espaciais

- Dá para perceber de que lado vem o perigo ou o chefe só pelo som? `( ) S ( ) N ( ) Parcial`
- Em uma frase: `________`

### [AU5] Sem clipping

- Algum som estoura, racha ou distorce (principalmente em combate denso)? `( ) S ( ) N` — quando: `________`
- Em uma frase: `________`

### [AU6] Sem fadiga em combate prolongado

- Depois de 3 min de combate denso, algo cansa ou irrita? `( ) S ( ) N` — o quê: `________`
- Em uma frase: `________`

### [AU7] Destravamento, mudo e persistência

- O som começou no primeiro clique/toque, sem precisar de um segundo gesto? `( ) S ( ) N`
- Silenciar cortou tudo na hora e reativar trouxe tudo de volta? `( ) S ( ) N ( ) Parcial`
- Depois de recarregar a página, mudo e volume continuaram como você deixou? `( ) S ( ) N`
- Em uma frase: `________`

### [AU8] O que foi escutado nesta sessão

Marque só o que você realmente ouviu com atenção:

- `( )` jogo calmo `( )` combate pesado `( )` dano recebido e morte `( )` silenciar / reativar / opções
- Ficou algo sem escutar? `________`

---

## Sessão 3 — Olho e mão (≈10 min, desktop)

Primeiros 5 min jogando (Aldric 2:30, Lyra 2:30):

### [CF3] Resposta aos comandos

- O herói responde na hora ao mover, mirar e atacar (1 = atrasado, 5 = imediato): `____`
- Alguma ação com atraso perceptível? `( ) S ( ) N` — qual: `________`
- Em uma frase: `________`

### [CF10] Impacto, recuperação e feedback na horda

- Os golpes têm peso e o herói se recupera de forma coerente (1–5): `____`
- No combate denso o retorno (flash, som, número, empurrão) continua útil? `( ) S ( ) N ( ) Parcial`
- Em uma frase: `________`

### [CF2] Impactos e perigos legíveis

- No meio da horda você entende o que está te acertando e de onde? `( ) S ( ) N ( ) Parcial`
- Algum perigo que você só percebeu depois de tomar o dano? `( ) S ( ) N` — qual: `________`
- Em uma frase: `________`

### [GD9] Ritmo das ondas

- A dificuldade dos primeiros 60 s é justa? `( ) S ( ) N ( ) Parcial`
- O ritmo entre ondas, respiros e chefes segura o interesse (1–5): `____`
- Em uma frase: `________`

Últimos 5 min com o pacote dos agentes (folha de contato com 12 capturas, 6 clipes de 10 s, 1 clipe lado a lado de locomoção):

### [AR2] Luz e materiais coerentes

- Luz e materiais parecem do mesmo mundo em todas as capturas (1–5): `____`
- Algo destoa? `( ) S ( ) N` — o quê: `________`

### [AR3] Composição intencional

- As cenas parecem compostas de propósito, com foco claro (1–5): `____`
- Em uma frase: `________`

### [AR4] Silhuetas claras

- Heróis e inimigos têm silhueta clara, inclusive no combate denso? `( ) S ( ) N ( ) Parcial`
- Quem se confunde com quem: `________`

### [AR8] Ambiente coeso, sem cara de placeholder

- Algo parece placeholder ou de outro jogo? `( ) S ( ) N` — o quê: `________`
- Em uma frase: `________`

### [VX3] Efeitos legíveis no combate denso

- Em cada um dos 6 clipes, entendi o que aconteceu? Marque as skills que **não** entendi: `( )` grito `( )` dash `( )` escudo `( )` canhão `( )` gelo `( )` gravidade
- Algum efeito esconde inimigo ou perigo? `( ) S ( ) N` — qual: `________`

### [AN8] Peso e transições naturais

- O movimento tem peso e as transições (parar, virar, atacar) parecem naturais (1–5): `____`
- Em uma frase: `________`

### [AN12] Pés deslizando e qualidade do movimento

- No clipe lado a lado, vejo pé deslizando? `( ) S ( ) N ( ) Parcial` — em qual movimento: `________`
- A qualidade artística da animação é aceitável para publicar? `( ) S ( ) N`
- Em uma frase: `________`

---

## Extras opcionais (apoio; **não** contam como cobertura de requisito)

Respostas daqui viram observações de apoio em requisitos que os agentes já cobrem. Pule se o tempo acabar.

- (apoio a `UI2`) No celular, consegui ler custo e recarga das habilidades? `( ) S ( ) N ( ) Parcial`
- (apoio a `UI6`) As cartas por toque funcionaram de primeira? `( ) S ( ) N`
- (apoio a `GD6`) As duas classes pedem decisões diferentes? `( ) S ( ) N ( ) Parcial`
- (apoio a `GD10`) As cartas mudam de verdade como eu jogo? `( ) S ( ) N ( ) Parcial`
- (apoio a `AN7`) A arma "flutua" na mão em algum movimento? `( ) S ( ) N`
- (apoio a `VX9`) Vi o corte do cadáver no dash, e só em abates do dash? `( ) S ( ) N ( ) não vi`
- Observações livres: `________`

---

## Para o orquestrador: como isso vira evidência

| Bloco | Dimensão | Tipo | Requisito (texto da rubrica) |
| --- | --- | --- | --- |
| MB3 | mobile | device | Gameplay is documented on a physical iOS device. |
| MB4 | mobile | device | Gameplay is documented on a physical Android device. |
| MB5 | mobile | device | Touch targets are comfortable on a physical device. |
| MB7 | mobile | device | Thermal evidence from physical-device play is documented. |
| PF6 | performance | device | Behaviour on a physical mobile device is documented. |
| PF7 | performance | device | Frame-time p95 is at most 25 ms on the declared mobile target, measured on a physical device. |
| AU2 | audio | human | Listening shows that gameplay events are audible and distinct from each other. |
| AU3 | audio | human | Listening shows a balanced volume and mix. |
| AU4 | audio | human | Listening shows useful spatial or directional cues. |
| AU5 | audio | human | Listening shows no clipping. |
| AU6 | audio | human | Listening shows no fatigue during sustained combat. |
| AU7 | audio | human | Audio unlock, mute and persistence behave as expected when listened to. |
| AU8 | audio | human | Listening notes cover quiet play, heavy combat, damage and death, and mute, unmute and settings. |
| CF2 | combat_feel | human | Impacts and hazards are readable. |
| CF3 | combat_feel | human | Motion, aim and fire respond to input without perceptible delay. |
| CF10 | combat_feel | human | Impact and recovery feel coherent, and feedback stays useful under dense combat. |
| GD9 | game_design | human | Wave pacing is meaningful in natural play. |
| AR2 | art_direction | human | Lighting and materials are coherent and balanced. |
| AR3 | art_direction | human | Composition is intentional. |
| AR4 | art_direction | human | Character and enemy silhouettes are clear. |
| AR8 | art_direction | human | The environment is cohesive, with no obvious placeholder clash. |
| VX3 | vfx | human | Effects stay readable over time under dense combat. |
| AN8 | animation | human | Weight and transitions look natural. |
| AN12 | animation | human | Inspected playback shows no visible foot sliding and acceptable artistic quality. |

Passos:

1. Registre o arquivo preenchido em `artifacts` (caminho em `docs/arpg/aaa-loop/owner-sessions/`, SHA-256 do arquivo). Ele se liga ao candidato porque contém o SHA-256 completo do manifesto.
2. Salve o JSON colado em `[PF7]` como arquivo próprio (ex.: `output/qa/aaa-loop/owner/<data>-<aparelho>-qa.json`). Se o link tiver usado `?qa=<SHA-256 do manifesto>-<aparelho>`, o relatório já referencia o candidato sozinho. A afirmação numérica de `[PF7]` é um ponteiro: `{"claim": "frame time p95 in milliseconds on the phone", "metric": "frameTimeP95Ms", "value": <valor>, "artifact": "<id>", "pointer": "/frames/total/p95Ms"}`.
3. Um bloco = uma observação: `scenarios: ["<ID>"]`, `source: "owner"`, `inputKind: "natural"`, `environment: {device, os, browser, physical, date}` (para `human` bastam `device` e `date`), `method` (o roteiro da sessão), `result` (versão em inglês simples, fiel, sem adjetivos de nota), `verbatim` (as palavras do dono, copiadas deste arquivo), `limits`, `artifacts`.
4. Cada `N`, `Parcial` ou nota ≤ 3 entra em `openDefects` com a dimensão correspondente. Defeito só sai da lista quando fechado com artefato.
5. Rode `npm run jef:lint -- --evidence <arquivo> --out <pasta>` antes de qualquer chamada ao JEF.
