# Fable 6 — D-1 point-blank, patch v2 (2026-09-19)

Tarefa `task_d962790ed352`. Pasta `output/qa/aaa-20260919/fable-pointblank-v2/`. Base: `integration-v2/candidate`. **Fonte viva, integration-v2 e os originais da fable-native-v3 inalterados** (manifestos conferidos ao final). Sem JEF/deploy. Decisões do coordenador aplicadas: Opção A estrita (msg_70e2877ec078), miolo do campo constante aprovado, atraso de HUD da fixture não é bug, rótulos de loot A2-02 ficam com o Root.

## Revisão da msg_da8474953fa6 — confirmada

A proposta v1 (`fable-native-v3/patches/origin-bridge-point-blank.patch`) removia a componente frontal do offset **antes** de `offset.length() > 3`, então um emissor alinhado e distante passava na guarda. Reproduzido em CPU: socket alinhado a **100 m → v1 aceita (`enabled: true`)**, bridge congelado rejeita.

## Patch v2 (final)

`patches/pointblank-v2-on-integration-v2.patch` — 2 arquivos, 9 hunks, `patch --dry-run` limpo sobre a integration-v2. Candidato congelado: `candidate-manifest-frozen.txt`.

| Arquivo | SHA-256 v2 final |
| --- | --- |
| `src/vfx/projectile-origin-bridge.js` | `81fcaca6f9d293f6c7c085e173d7c2a162f70b852459398c3aa9e7e44425ad19` |
| `src/vfx/class-skill-vfx.js` | `05e4c4f522fa3a402dd8b4283b01485fbe43f0a1090e5f8c1b4e2a26435916c2` |
| `src/vfx/cannon-origin-bridge.js` | byte-idêntico à integration-v2 |

1. **Guarda sobre a distância COMPLETA** source→socket (e idade > 250 ms), avaliada antes de qualquer decomposição; socket rejeitado apresenta o segmento autoritativo puro. `settleDistance` continua derivado do alcance completo.
2. `clampMuzzleLead` **opt-in** (só gelo/gravidade). Sem a opção, saída e `getStats` do bridge são deep-equal ao congelado — canhão em opt-out equivalente.
3. Avanço frontal separado do offset lateral/vertical: o visual fica em `max(progresso, boca)`; se o terminal autoritativo ocorre **antes da boca** (limiar 1e-6) → `abandon('terminal-before-muzzle')`, só o endpoint real é apresentado, sem segmento para trás.
4. **Opção A estrita:** com `forward > 0` o release **não cria corpo** (`bodies.hide` + `bodyUntil = 0`); em travel `hideBody` oculta explicitamente instância existente, zera `bodyUntil` e **não emite trilha dentro do cano**. O flash elemental no socket continua.

Versões intermediárias preservadas com **código exato e hashes** (`evidence/superseded-v2a/`, `superseded-v2b/`, `superseded-code-hashes.txt`) junto das capturas nativas que as motivaram: v2a = guarda + clamp; v2b = + `hideBody` só em travel.

## CPU

| Verificação | Resultado |
| --- | --- |
| `tools/verify-bridge-v2-cpu.mjs` — guardas | 100 m alinhado, 3,01 m alinhado, 3,5 m lateral, 2,2 m lateral + 2,2 m frontal (3,11 m), 100 m atrás → `stale-or-distant-socket`; 2,99 m alinhado e boca normal → aceitos; decisão idêntica à do bridge congelado nos 7 casos; regressão da v1 reproduzida; idade 251 ms rejeitada |
| idem — canhão | wrapper byte-idêntico; `travel()` e `getStats()` deep-equal ao congelado em 3 comportamentos de sweep × 30 passos, com `direction` presente |
| idem — voo livre | após o settle (≥ 3,6 m) posição visual idêntica à do congelado |
| `tools/verify-wrapper-pointblank.mjs` — **wrapper real + core real + atributos reais `aStyle.w`/`aOrigin`**, incluindo o frame de release e amostras **entre** eventos; 48 casos (2 skills × contato 0,6/0,99/1,3/1,5/2,5/8 m × 30/60 Hz × high/low-reduced) | tabela abaixo |
| `verify-cpu-v2.mjs` — suíte de 192 casos com asserções **mais estritas** (só o contrato "release desenha corpo no socket" foi substituído): `aStyle.w = 0` do release até a saída da boca, primeiro corpo na/além da boca, nenhuma trilha dentro do cano, corpo ausente no terminal, socket do bridge = muzzle, autoridade e canhão invariantes | **192/192**; a mesma suíte **falha na integration-v2 congelada** ("Release must not draw a body inside the barrel") — negativo em `evidence/cpu192-v2-strict-NEGATIVE-on-frozen.log`; suíte antiga preservada (`patches/verify-cpu-192-strict-assertions.diff` mostra só os 3 hunks) |

Pior caso nos 48 casos de wrapper (duas medidas, conforme msg_961d83021e64):

| Variante | Corpo além do **contato** | Corpo além de max(contato, boca) | Ponta da trilha além do contato | Segmento para trás | Corpo visível no release | Corpo após terminal |
| --- | --- | --- | --- | --- | --- | --- |
| congelado | **1,269 m** | 0,788 m | 1,269 m | 1,193 m | 48/48 | 0 |
| v2a | 0,798 m | 0 | 0,798 m | 0 | 48/48 | 0 |
| v2b | 0,798 m | 0 | 0,798 m | 0 | 48/48 | 0 |
| **v2 final** | **0** | **0** | **0** | **0** | **0/48** | 0 |

A medida antiga (coluna 3) zerava já na v2a e escondia o corpo antecipado na boca; a crítica do coordenador estava correta e a v2 final zera a medida forte.

## Validação nativa focal (2 clientes reais, mesma sala; AltaA `high`, LeveB `low` + reduzir movimento)

Mesmo método da fable-native-v3 (cópia instrumentada só leitura, atributos de GPU por frame, vídeo). "Antes" = instrumentada da v3 (bridge congelado); "depois" = `instrumented-after/` com os dois arquivos finais (conferido por `cmp`). Input real: mouse, Dígito 2/3, Enter; queima-roupa obtida **esperando um inimigo real colar** (< 1,9 m), sólido obtido andando com W até travar; sem HP, NPC ou teleporte fabricados. Lock de GPU próprio, janelas cedidas pelo coordenador, sempre liberado. Zero erros de página/console em todas as execuções.

| Caso | Antes (congelado) | Depois (v2 final) |
| --- | --- | --- |
| Tiro distante livre, local `high` e remoto `low/reduced` (20/18 m e sólido a 9–17 m) | primeiro corpo a 0,40–0,51 m da boca (desenhado já no release, na boca); sem excesso; trilha contínua | primeiro corpo só após sair do cano, 0,44–0,51 m da boca; excesso 0 nas duas medidas; trilha sem vãos nem segmento para trás; idêntico local/remoto (`final-far-control`) |
| Queima-roupa por inimigo, 0,87–0,88 m, gelo **e** gravidade | D-1 original (v3): corpo **0,38 m local / 0,59 m remoto** além do contato | `final-pb-A`: **remoto (low/reduced) → `terminal-before-muzzle` nas duas skills, 0 frames com corpo em 173/439 frames**; local (high) → `blocked-socket`, corpo no trajeto autoritativo, excesso 0, trilha de 2 segmentos sem recuo |
| Queima-roupa com bridge ativo nas versões superseded | — | v2a: 0,051 m além do contato (remoto); v2b: **0,20–0,39 m por 3 frames — era o corpo do release na boca** (negativo que motivou a Opção A; `evidence/superseded-v2b/`) |
| Sólido à queima-roupa (andar até travar, 0,34–0,40 m) | 0 frames de corpo (projétil termina antes de qualquer corpo) | idem, 0 frames |

### Lacunas objetivas (última rodada autorizada; não proponho nova matriz)

- **LeveB como lançador local (low/reduced) em queima-roupa com o código final: não obtido** — morreu de verdade antes de um inimigo colar (`final-pb-B`, estado `dead`). LeveB como observador remoto foi obtido.
- **Local `high` pelo caminho `terminal-before-muzzle`: não obtido nativamente** — nas duas tentativas o socket local estava bloqueado (`blocked-socket`), caminho pré-existente e igualmente sem excesso. O caminho novo foi exercitado nativamente só no cliente remoto; em CPU está coberto nos 48 + 192 casos.
- A primeira captura curta da rodada final (`after-v2-final-A`) rendeu 1 cast útil por mortes; preservada, não usada como prova.
- Headless com GPU real; sem dispositivo físico; late join/reconexão em voo fora de escopo.

## Artefatos

`patches/` (patch v2, diff v1→v2 do bridge, diff das asserções da suíte), `candidate/` congelado + manifestos, `tools/` (CPU bridge, CPU wrapper, harness focal, analisador), `verify-cpu-v2.mjs`, `evidence/` (JSON de CPU, logs 192 positivo/negativo, `analysis-table.txt`, brutos por cast, vídeos `*.webm` por cliente de cada execução, superseded com código).
