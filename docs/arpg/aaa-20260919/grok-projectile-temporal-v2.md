# Grok 8 — temporal-v2 seguro sobre integration-v4

Tarefa `task_e2e314840974`, dispatch `ctx_9929a0a67813`. **Sem GPU.** `grok-projectile-temporal-v1` (`b8e562c2…`) e `grok-snapshot-order-v1` (`61fe50f7…`) **não editados**. Candidato novo a partir de `integration-v4/candidate` (244 fontes, main `f0600b67…`, wrapper base `636dd452…`).

## Freeze

`output/qa/aaa-20260919/grok-projectile-temporal-v2/candidate/` — **não alterar depois deste relatório**; revisão nova exige v3.

| Arquivo | SHA-256 |
| --- | --- |
| v2 `class-skill-vfx.js` | `d3c7f68f22176d160a94250c2ff8629847f70619caf382334c030b842757dbfa` |
| v2 / v4 `src/main.js` | `f0600b67823f3f7e0517c7af6a4f7304ccb031639bda84d1bbf1653c773b9a21` |
| bridge Fable Option A | `81fcaca6f9d293f6c7c085e173d7c2a162f70b852459398c3aa9e7e44425ad19` |
| integration-v4 wrapper (base) | `636dd4523a394bf6d8b6193338ed5a84a2c4ee499fa5865703dbd2f4db8c3e74` |
| temporal-v1 congelado | `b8e562c2228ba8ffcd086fc15131c6cba008c06ff31b7745b66712c2fb62fc8c` |
| order-only congelado | `61fe50f7d109901a3156a67fd51b339a1cc02a2dc39ed8f1f971e6ef50443925` |
| vivo `src/main.js` | `d9e6fed48d8609acbd495f9a1c747bbe8e6b9d3cc00447aa75e4896b156b6d3b` |

Patch incremental vs integration-v4: `output/qa/aaa-20260919/grok-projectile-temporal-v2/patches/class-skill-vfx.js.diff` `809cb529…` (só o wrapper). Main/server/autoridade intactos.

## Combinação

Interpolation **em cima** da Option A já presente: release com `forward>0` chama `hidePresentation` (cancela `visualActive`, fila, trilha). `mapped.hideBody` idem. Retomada só no primeiro trecho visível após a boca; nada da fase oculta é drenado. Terminal oculta e não ressuscita.

Overflow da fila (≥8): **invalida/oculta** e o próximo evento recomeça nesse trecho, sem descartar vértice e ligar diagonal.

`stepVisual` **para no vértice no frame** (não consome o segmento seguinte no mesmo update). Trilha por trecho; chave nova na curva para a cadência da pool não cordar o canto.

Heading no endpoint conserva `visualHeading` (−Z). Snapshot-only não emite trilha.

## CPU

Reutilizei os 8 casos Astra (`docs/arpg/aaa-20260919/astra-projectile-temporal-review.md`, testemunhos de curva/overflow) contra **este** candidato, pools reais, sem spies:

`verify-geometric.mjs` → `evidence/geometric-results.json` — **8/8 passed** (heading, burst-corner, queue-overflow, straight-burst-terminal × gelo/gravidade). `frameChordCrosses=false`, `trailCrossings=0`.

`pointblank-combined.mjs` — **8/8** (2 skills × reduced × 0,99/2 m). `sourceStable: true`.

Adendo Grok7 TTL (fonte order **não** mudou): `grok-snapshot-order-v1/verify-ttl-cpu.mjs`. Gelo/gravidade visíveis após 0,3 s até o remaining original. Canhão: watchdog `lastTravel<=0.3` em `cannon-vfx.js` (clear ~0,55); **não** alterado.

## Limites

Sem GPU. Ordem/TTL continua no wrapper v4 (`syncProjectiles` já estava). Não mexi live/5173/ranking. Nova revisão deste interpolador = nova versão de candidato.
