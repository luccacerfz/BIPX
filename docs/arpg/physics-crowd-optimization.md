# Otimização isolada do candidato de contatos — 19/09/2026

**Candidato CPU liberado para revisão de Combat, sem promoção runtime.** Em A/B com 400 atores/60 Hz, o P95 completo passou de **12.456 para 7.492 ms: redução 39.9%**. Índice, atualizações, IA, sweeps e crowd entram no tempo. API, raios, deltas, atores e frequência da IA foram preservados. O candidato anterior `bce8ee0` e seus 16 checks/evidências continuam byte-idênticos.

Pacote: `output/physics/crowd-optimized-20260919/`. Novo `contacts.mjs`: **`290a3f35b23e00ff86dcb5dad6911c5e8dfbda0b517cba4e7a63a02b69f07a80`**. `contacts-optimization.patch` contém **13 adições/2 remoções**, somente em `createActorIndex`. `control-policy.mjs` e `navigation.mjs` são cópias byte-idênticas às do candidato anterior.

## Hotspots medidos antes da alteração

O perfil V8 do bce8ee0, 400 atores/60 Hz, mostrou `query` com 32.80% do tempo amostrado próprio e `compareId` com 8.46%. A reconstrução de Set/lista/ordenação era repetida durante os slides do mesmo ator. No trecho instrumentado de 3 s ocorreram 432.155 consultas, 6.633.665 vizinhos retornados e 61.560 chamadas de movimento/navegação: a contagem permaneceu **exatamente igual** depois da alteração.

Construir180 índices levou 27.17 ms no diagnóstico; atualizar 61.560 entradas, 33.94 ms; o movimento acumulou 1147.18 ms. Isso orientou a alteração para a consulta repetida, em vez de trocar solver, diminuir iterações ou reduzir atores. Perfis `.cpuprofile`, resumos e `*-profile-measurements.json` estão no pacote. Após o cache, participação própria amostrada de `query` caiu para 12.36% e de `compareId` para 2.26%. Esses perfis incluem instrumentação/warm-up e servem para localizar custo; **o ganho entregue vem do A/B separado abaixo**.

## Alteração e contrato pequeno de integração

`query(minX,minZ,maxX,maxZ)` memoriza a última lista ordenada para o mesmo retângulo de **células**. Dentro desse retângulo, a lista candidata é a mesma; cada sweep continua testando o AABB exato do segmento, altura, raio, contato e desempate por id. `remove` invalida o cache; todo `update` passa por `remove`, inclusive atualização na mesma célula. Cada query retorna um novo array com `slice`, preservando a independência das listas retornadas. O índice conserva a cópia anterior de um corpo quando este é atualizado. Cache limitado a uma entrada, sem crescimento histórico.

Para Combat, **nenhuma nova chamada ou opção**. Permanece integralmente o [contrato do candidato anterior](physics-crowd-candidate.md): índice atual por tick, depois de pull/spawn; `update` após cada deslocamento aceito, antes do próximo ator; `remove` em morte; IDs estáveis; reconstrução após crowd; jogadores fixos no crowd; pull explícito móvel com boss .35. Dados de corpos continuam atualizados pelo método `update`. Não passar o índice de horda ao dash/charge, cuja semântica do core permanece.

O patch incremental tem como base exata **bce8ee0bce3ce4ee9a7c97bfac026d4d1a62b511f0b76535f153be8a39e0e42f**. Ele deve ser incorporado ao candidato de movimento/crowd já encaminhado, na janela do dono. O runtime atual d63d1c ainda não possui aquela integração; **este delta sozinho não substitui o trabalho anterior**. `git apply --check` passou numa cópia descartável da base; aplicação somente nessa cópia produziu o hash290a3f35 exato. Nenhuma aplicação em `src/physics`, main ou server.

## Comparação de custo completo

Relatório `output/physics/crowd-optimized-20260919/2026-09-19T01-42-05-550Z-paired-cost.json`: seis repetições de 3 s por linha, warm-up nas duas variantes com 400 atores, ordem A/B alternada por frame/repetição. Hook `updateServerMonsters` extraído literalmente do snapshot de Combat. Mesmas posições iniciais, raios .78/jogador .64, velocidade3.3, status, dt .1/.05/1/60, bounds 55, subpassos e limite4 plans/tick. Tracing/profiler desligados. Construção e atualização do índice **dentro** do cronômetro, inclusive a materialização redundante de peers do adaptador anterior, igual nas duas variantes. Igualdade de estados conferida fora do tempo medido.

| Atores | Hz | Mediana base → nova (ms) | P95 base → nova (ms) | Redução P95 | Máximo base → novo (ms) |
|---|---:|---:|---:|---:|---:|
| 10 | 10 | .152 → .110 | .235 → .161 | 31.6% | .540 → .366 |
| 10 | 20 | .097 → .082 | .124 → .103 | 16.6% | .321 → .340 |
| 10 | 60 | .060 → .060 | .078 → .082 | **-4.0%** | .301 → .348 |
| 120 | 10 | 9.282 → 3.822 | 10.326 → 4.299 | 58.4% | 12.591 → 4.531 |
| 120 | 20 | 7.113 → 3.194 | 8.647 → 4.138 | 52.1% | 18.560 → 8.007 |
| 120 | 60 | 2.818 → 1.738 | 3.328 → 2.121 | 36.3% | 5.938 → 2.670 |
| 400 | 10 | 48.045 → 19.489 | 50.943 → 21.037 | 58.7% | 53.847 → 21.956 |
| 400 | 20 | 26.628 → 12.141 | 28.684 → 13.165 | 54.1% | 32.481 → 16.068 |
| 400 | 60 | 11.392 → 6.693 | 12.456 → 7.492 | 39.9% | 17.809 → 15.429 |

A matriz anterior foi mantida, acrescentando20 Hz para 120/400. **4.860 frames com estado completo idêntico** entre base e otimização, incluindo timers e navegação; hashes e amostras brutas no relatório. Grade aberta do benchmark produz0 buscas de rota efetivas, mas chama a mesma navegação para todos os atores móveis. O orçamento real ativo está coberto no cenário de mapa abaixo.

Há pequena piora absoluta de .003167 ms no P95 de 10 atores/60 Hz, registrada sem seleção de amostras. O valor histórico11.657 ms do candidato anterior é preservado em seu report; não foi usado como denominador do ganho, pois foi medido em outra execução. Esta comparação usa ambos os candidatos na mesma execução. Node/VM local, CPU compartilhada, sem exclusividade; tempos não são uma garantia de FPS. Não inclui render, áudio, transporte ou dano real. Mesmo otimizado, 400 atores/60 Hz ainda consomem7.49 ms P95 e tiveram pico15.43 ms.

## Paridade e picos transitórios

`2026-09-19T01-43-54-772Z-optimization-safety.json`, dentro do pacote: **6/6**, fonte estável. O auditor calcula a menor distância analítica de cada segmento aos corpos na posição vigente, sem usar o índice candidato. Segmentos de comprimento zero também entram no hash/contagem; como não mudam estado, a distância já foi coberta na entrada ou no último segmento móvel. Entradas são verificadas livres antes de simular; cada movimento e correção subsequente entra no trace. O hash do trace inteiro foi **idêntico** entre versões em cada linha.

| Cenário400 atores/3 s | Segmentos registrados | Pico transitório | Maior passo por frame | Movimento sob controle | Planos efetivos / máximo por tick |
|---|---:|---:|---:|---:|---:|
| Grade aberta, 10 Hz | 410.784 | 0 m | .330 m | 0 m | 0 / 0 |
| Grade aberta, 20 Hz | 410.379 | 0 m | .165 m | 0 m | 0 / 0 |
| Grade aberta, 60 Hz | 432.155 | 0 m | .055 m | 0 m | 0 / 0 |
| Mapa real138 colliders, 10 Hz | 30.829 | 0 m | .330 m | 0 m | **120 / 4** |

O mapa real contém freeze e stun, 400 corpos válidos, bounds 55 e nenhuma transposição de sólido detectada nas conferências de posição. Preserva30 ticks com 4 planos em cada tick. O maior segmento aceito foi .055 m nas quatro linhas. Não houve redução de atores, delta, frequência, iterações de slide ou quantidade de IA. Outro teste fez2.100 movimentos com 70 corpos de raios/alturas mistos, inclusiveboss1.72, no layout real: contatos e 7.856 segmentos exatamente iguais. Invalidação por update/remoção/inserção, limites negativos de células, IDs lexicais, snapshots antigos e independência dos arrays também passaram.

Regressões copiadas para o pacote e vinculadas aos snapshots, sem editar ferramentas originais:

- **16/16** candidato completo: `output/physics/2026-09-19T01-43-31-449Z-crowd-optimized-regression.json`.
- **22/22** solver: `output/physics/2026-09-19T01-43-54-765Z-cpu/physics-cpu.json`.
- **12/12** v2: `output/physics/2026-09-19T01-43-54-763Z-v2-cpu/physics-v2.json`.
- **16/16** hooks cliente/Node: `output/physics/2026-09-19T01-43-54-790Z-integration/physics-integration.json`.

Todas as fontes de cada execução ficaram estáveis. Freeze/stun10 corpos/3 s nas três frequências mantiveram pico0; expiração retomou movimento sem rewind. Boss1.72 manteve controle e expiração; pull .35 preservado. Campo real de 12 controlados: distância média3.182847→2.028392 m, passo máximo .075 m e pico1.55e-15 m, apenas erro numérico; crowd ordinário após pull0 m. Dash/charge, LOS, spawn e frame longo continuam cobertos pelas mesmas regressões.

**Recuperação declarada permanece igual:** pack inicialmente inválido de 80 corpos com overlap .300 m alcança pico transitório **.721006796 m**, termina em .001000002 m e tem passo máximo .346057565 m. O cache não modifica a recuperação nem apaga esse pico. Não extrapolar zero das entradas válidas para packs já comprimidos. Fornecer atores ao spawn e exigir `found:true` continua parte do contrato anterior; não fazer busca de spawn durante caminhada para mascarar penetração.

## Proveniência, reprodução e liberação

`start-manifest.json` fixa snapshots de main/server/core/alturas/layout anteriores à análise; `manifest.json` registra hashes finais, preservação da base/evidências, patch e resultados. Main congelado para QA: `cce6025daafbf9fa5462e4899613dfed181b6a3b5f24abe9426c1ee877a245bd`; server `71de8e868757d00aa1003dc074a4a89a69b1a5a8483001dbbd3e515656dd9b7e`; core `a863e12f3c26cf629ad7051d64f40bb855f2a87d8e3e1510aad1f8c000e96e63`; layout `987487e1fedd025da3615d3cc07ce9b5621e778d39c21939f9ac53dc6bbe577c`. A prova vale para os snapshots, sem promoção automática a edições posteriores de Combat.

Reproduzir a partir da raiz, **sem rodar benchmarks em paralelo**:

```sh
node output/physics/crowd-optimized-20260919/compare.mjs
node output/physics/crowd-optimized-20260919/optimization-verify.mjs
node output/physics/crowd-optimized-20260919/verify.mjs
node output/physics/crowd-optimized-20260919/physics-verify.mjs
node output/physics/crowd-optimized-20260919/physics-v2-verify.mjs
node output/physics/crowd-optimized-20260919/physics-integration.mjs
```

Runtime Physics continua **d63d1cb1bbcf1b22b524ae948b1588f62a2d3dd34e0c073231ff29cb6c1a8da3**, navigation 4c236c22. Main/server não foram editados. Porta5173 foi reconferida viva, PID97873; nenhum restart. Nenhuma GPU, agente, browser ou nova mensagem à fila cheia. Entrega durável aqui e no [handoff](physics-handoff.md); fontes isoladas liberadas, sem próximas escritas runtime. Integração, gameplay/rede e desempenho global continuam com Combat em sua janela.
