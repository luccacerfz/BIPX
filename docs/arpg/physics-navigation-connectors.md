# Physics — conexão inicial da grade

**PROMOVIDO E CONGELADO,02:41UTC.** Combat autorizou explicitamente somente navigation após revisar diff/provas. Baseline `4c236c22` conferido e arquivado; `src/physics/navigation.mjs` agora é **911e0ea2e29bf4b937e8a9174b897d9bc8b197bab0de681e4c9a4f50af6d65d0**, byte-idêntico ao candidato abaixo. Recibo: `output/physics/navigation-connectors-20260919/promotion/receipt.json`. Contacts290a, layout143, main/server/helper permaneceram byte-idênticos na operação. Nenhum restart5173/GPU/custo adicional.

**Gate pós-promoção:** `node tools/verify-arpg-layout.mjs` → **7/7 PASS/sourceStable**, `output/qa/arpg-environment-integrated-20260919/2026-09-19T02-41-20-210Z/layout-integration.json`. Fonte liberada para QA CPU/browser de Combat. API congelada; nenhuma próxima escrita runtime prevista. As seções abaixo preservam diagnóstico e proposta isolada que fundamentaram a promoção; density912c continua sem promoção.

**Checkpoint isolado anterior à promoção:** contacts `290a3f35` e navigation `4c236c22` preservados. Candidato de navigation **911e0ea2e29bf4b937e8a9174b897d9bc8b197bab0de681e4c9a4f50af6d65d0**, em `output/physics/navigation-connectors-20260919/candidate/navigation.mjs`. Layout real **143**, hash `8e756fe4022c7916074220d44c0ff605aa8fdc9d80fdf6c61d8a03fb475fc8a7`. Sem GPU, main/server/helper ou arte alterados; servidor5173 preservado.

## Causa reproduzida

No achado de [Combat](combat-environment-findings.md), boss raio1.72 sai de `(23.635399692273165,15.943486465505979)` em direção a `(15.80896918313038,8.612477431631392)`. Baseline retorna `no-route/visited:1`, tanto com768 quanto4096. Os nove pontos do primeiro anel1.25m têm sweep bloqueado por `rocks-3` ou `rocks-4`; dois destinos são livres, mas o segmento até eles cruza uma rocha. A falta de conexão inicial encerra A* antes de explorar o corredor.

O ponto `(26.25,15)` no segundo anel é livre e possui conexão contínua com raio1.72. Logo não é necessário mover rochas, estreitar corpo, relocacionar caminhada ou ampliar maxVisited para resolver este caso.

## Patch e contrato

`output/physics/navigation-connectors-20260919/navigation-start-connectors.patch` aplica somente sobre navigation `4c236c22`; aplicação e SHA conferidos em cópia descartável. Acrescenta seis linhas lógicas, com reindentação do loop existente.

- Se o início não enfileirou nenhum dos nove conectores normais, avaliar o perímetro do segundo anel: no máximo16 destinos adicionais, uma única vez/plano. Ordem dx/dz e heap determinísticos.
- Cada destino e ligação usa os mesmos `moveActor(delta0)` e `sweepStatic(kind:'actor',radius real)`, além de bounds/altura existentes. Nenhuma aresta é aceita por mera proximidade.
- Se algum conector normal existe, o caminho segue exatamente a busca anterior. Nós posteriores mantêm oito vizinhos; maxVisited768, clamp16–4096, cooldown, API/retorno e `allowPlanning` intactos. Budget4 por tick continua responsabilidade do caller, sem novas invocações ao planner.
- Waypoints são intenção; movimento continua em `stepActor` no raio/dt reais. Não há teleporte nem uso de `findFreePosition` na caminhada.

Limite explícito: não é planner completo de espaço contínuo. Um corredor cuja entrada exige curva antes de alcançar qualquer ponto desses dois anéis ainda pode retornar no-route. O fallback não aumenta a busca quando o primeiro anel conecta uma componente que depois se revela sem saída. Estes casos não foram mascarados por fallback ilimitado.

## Prova CPU

`output/physics/navigation-connectors-20260919/2026-09-19T02-37-54-787Z-navigation.json`: **6/6**, fontes estáveis.

- Rota com31 nós, sete waypoints e conector inicial `(26.25,15)`; 100 repetições idênticas. `maxVisited:16` retorna `budget/visited:16`.
- Boss chega ao alcance2.72m em5.833s/5.850s/5.900s a60/20/10Hz, com um plano. Máximo por tick .055/.165/.330m; todos os1409 segmentos aceitos auditados por sweep. dt2s reproduz dt.1, sem salto.
- 300 pares determinísticos nos layouts138/143:299 resultados byte-idênticos. Única diferença adicional: baseline `no-route/visited:1`, candidato encontra rota em406 nós. Toda rota encontrada foi validada segmento a segmento.
- Caixa realmente fechada continua no-route; posição inválida continua invalid-start; `allowPlanning:false` não planeja nem move.
- 400 amostras alternadas após60 aquecimentos: baseline que falha mediana/P95/max **.094625/.104958/.254375ms**; candidato que encontra rota **.648375/.769375/1.136875ms**. Custo inclui verificação dos conectores e A* inteiro. Auditor/asserts ficam fora do timer. Comparação de custo de falha vs sucesso, sem alegação de ganho/FPS ou limite absoluto de tempo.

Cópia do gate Combat, apenas imports/saída/hashes ajustados ao staging: `output/physics/navigation-connectors-20260919/layout-qa/2026-09-19T02-37-44-371Z/layout-integration.json`, **7/7**, fontes estáveis. Inclui143/delta,84spawns (21boss), alturas das vigas/porta,84 dash/charge bloqueados+2livres, seis casts/LOS,12 perseguições entre crypt/garden/maintenance e pull em três conjuntos. O caso maintenance reverso boss passa em5.85s. Arquivo original `tools/verify-arpg-layout.mjs` intacto.

Comandos reproduzíveis da raiz:

```sh
node output/physics/navigation-connectors-20260919/verify.mjs
node output/physics/navigation-connectors-20260919/layout-verify.mjs
```

## Integração proposta a Combat / Environment

Congelar este candidato para revisão. **Nenhuma mudança main/server/helper é necessária**; após coordenação, o dono Physics pode promover apenas navigation pelo hash aprovado, e Combat repetir gate do layout + cliente/servidor. Arte143 pode permanecer onde está. Esta entrega CPU não aprova navegação global/horda/browser.

O candidato density912c é independente e continua isolado; sua prova anterior corresponde ao layout138. Nova comparação nativa requer baseline/candidato no mesmo layout143 e coordenaçãoGPU após VFX/Combat. Não misturar a correção de rota com o A/B de custo dos contatos.
