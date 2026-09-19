# Pesquisa JEF (T4) — outros usos do JEF no BIPX e plano honesto de evidências para > 9,5

Autor: agente de pesquisa Fable 5.1 (trilha T4 do loop `aaa-loop`), 2026-09-19. Somente leitura do repositório; o único arquivo escrito é este. A API da TypeSafe **não foi chamada** (sem chave), nenhum segredo foi lido ou impresso, nenhum browser/GPU/commit.

"JEF" = o modelo **Jev** (`jev-1.13.0`) da TypeSafe, acessado pela System One API.

---

## 0. Resumo executivo

1. **O JEF só devolve respostas tipadas** (`choice`, `score`, `noul`) com probabilidades; não gera texto, não explica a nota, não vê imagem, não ouve áudio. Custa US$ 0,042 por milhão de tokens de entrada (saída grátis), responde tipicamente em ~100–300 ms e aceita até 64k tokens por request. Uma avaliação completa como a de hoje (9.847 tokens) custa ~US$ 0,0004. **Custo não é restrição; honestidade e desenho das perguntas são.**
2. A própria documentação lista as fraquezas que mais nos afetam: leitura literal, **ruim com números**, perde acurácia com `state` grande e cheio de detalhe irrelevante, é **influenciável por texto que "argumenta a favor da própria classificação"**, e os níveis do Score têm calibração numérica fraca. O nosso avaliador atual bate em quase todas: 1 `state` gigante para 14 perguntas, instruções com até ~25 exigências por pergunta, prosa comprimida ("Historical04:00…"), e um limiar fino (9,5 vs 10) em cima de uma média ponderada.
3. **Melhor "outro uso" do JEF agora: transformá-lo de juiz de nota única em verificador de requisitos atômicos** (um `noul` por exigência da rubrica) + lint de evidência + canários anti-bajulação + ledger. Isso dá ao orquestrador a lista exata do que falta por dimensão e fecha as brechas de "gaming". (Uso **c**, recomendação nº 1.)
4. Recomendação nº 2: **lint de cópia/design** das cartas, habilidades e rótulos (barato, pega defeitos reais do tipo N-04/F-04 — achei vários no código atual). Nº 3: **laboratório de balanceamento** com bots WebSocket + metas numéricas em código + JEF julgando a *narrativa* da run (não os números).
5. **Diretor de IA com JEF não é prioridade**: telemetria é numérica (ponto fraco do Jev) e a regra nº 1 da TypeSafe é "use código quando puder". Um diretor determinístico resolve o mesmo problema; o JEF entraria depois, como camada consultiva atrás de flag. O próprio blog da TypeSafe admite sobre o demo de Doom: *"A non-AI doom bot could play better"*.
6. **Coach de fim de run é viável** mesmo sem geração de texto: `choice` escolhe a causa da morte e `noul` decide quais dicas *pré-escritas* em pt-BR mostrar. Valor médio, esforço médio; depende do mesmo módulo de telemetria do laboratório.
7. **> 9,5 em uma escala de 10 níveis (0–9) significa score > 8,55**, isto é, **P(nível 9) > 0,55 + P(nível ≤ 7)**. O limiar gravado hoje (`>= 10`) exigiria P(nível 9) ≈ 1,00 — na prática inalcançável e ainda cria incentivo perverso para apagar ressalvas honestas. O pedido novo do dono (> 9,5) precisa ser refletido em `quality-rubric.json`, `quality-gates.md` e `verify-evaluator-contract.mjs` **com aval explícito dele**.
8. **Dimensões bloqueadas em evidência humana/física:** `mobile` (bloqueio total), `audio` (bloqueio total), `performance` (parte mobile), `art_direction` e `combat_feel` (aceite perceptivo). `game_design`, `animation`, `vfx` e `ui_ux` pedem um aceite humano leve. `multiplayer`, `accessibility` e `reliability` são 100 % produzíveis por agentes.
9. **Bloqueios de produto, não de evidência:** `animation` tem defeito aberto (`acceptedNoSliding=false` após v4–v15); nenhuma redação de evidência leva isso a nível 9 honestamente. Idem para os P1 de ritmo (N-01/N-02/N-04) até T1/T2 entregarem.
10. **Checklist do dono proposto: 3 sessões de ~10 min** (celular iPhone + Android, escuta com fones, "olho e mão" no desktop), com formulário de respostas curtas que o orquestrador transcreve *verbatim* como `source: "owner"`.

---

## 1. O que a API realmente oferece (fatos com URL)

Método: `WebFetch` nas páginas pedidas + download do índice oficial `https://docs.typesafe.ai/llms.txt` e de ~45 páginas em Markdown (a doc serve `.md` em cada rota). **Todas responderam HTTP 200; nenhuma página ficou inacessível.** Citações em inglês são literais.

### 1.1 Contrato

- Endpoint único de avaliação: `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer <API_KEY>`. Corpo: `state` (string | objeto | array), `model`, `questions` (mapa id → pergunta). Resposta: `model`, `answers` (mesmos ids), `usage {input_tokens, output_tokens}`. — https://docs.typesafe.ai/api
- Existe também `GET /v1/models` (lista aliases). — https://docs.typesafe.ai/models
- Erros: `401`, `422` (corpo inválido), `429` (rate limit), `529` (sobrecarga); recomendação de backoff exponencial; os SDKs já fazem. — https://docs.typesafe.ai/api
- O id da pergunta **não é enviado ao modelo**: *"The key is not sent to the underlying model and is not used in inference."* Logo, todo o sentido tem de estar em `instructions`. — https://docs.typesafe.ai/api
- O `tools/evaluate-jev.mjs` já usa o formato v1 correto (o endpoint antigo `/preview/evaluation` foi substituído; a `confidence` tem cálculo novo). — https://docs.typesafe.ai/migrating-to-v1

### 1.2 Primitivas (só existem três)

| Tipo | Pergunta | Devolve | Limites/observações |
| --- | --- | --- | --- |
| `choice` | qual opção? | `choice`, `probabilities` (mapa), `confidence` | até **255 opções**; recomendam incluir `other`/`none`. https://docs.typesafe.ai/primitives/choice |
| `score` | qual nível? | `score` (média ponderada pelos níveis), `legend`, `probabilities`, `confidence` | **2 a 10 níveis**; *"Every level is evaluated separately. The model doesn't see a level's number or its neighbours"*; *"Describe situations, not degrees"*; *"Keep each Score question to one dimension."* https://docs.typesafe.ai/primitives/score |
| `noul` | é verdade? | `noul` (0–1) | sem `confidence`; `criteria {true,false}` opcionais. https://docs.typesafe.ai/primitives/noul |

- `instructions` e cada item de `criteria` aceitam string, objeto ou array (estrutura com `what`, `examples`, `not_for`…). — https://docs.typesafe.ai/primitives/advanced
- Perguntas do mesmo request são **independentes e paralelas**; a resposta de uma não vira contexto da outra; dá para referenciar campos do `state` com caminho entre crases (`` `ticket.messages[0].text` ``). — https://docs.typesafe.ai/primitives
- **Não há geração de texto nem explicação:** *"System One models do not write replies, produce code, or generate explanations of their reasoning."* — https://docs.typesafe.ai/concepts/system-one ; *"`jev-1.13` is not trained to generate text."* — https://docs.typesafe.ai/model-jaggedness/jev-1.13
- **Só texto:** *"Jev accepts text only. State must be a string, JSON object, or array of text values. Images, audio, and video are not supported (yet)."* — https://docs.typesafe.ai/concepts/state

### 1.3 Modelo, limites, preço, latência

| Item | Fato | Fonte |
| --- | --- | --- |
| Modelo | `jev-1.13.0`; aliases `jev-latest` e `jev-preview` apontam para ele hoje. Recomendam **fixar o ID versionado** quando há limiares calibrados (já fazemos). | https://docs.typesafe.ai/models |
| Preço | **US$ 42 / Btok = US$ 0,042 / Mtok de entrada; saída grátis.** O blog admite que não consegue provar que o preço não é subsidiado. | https://docs.typesafe.ai/models ; https://typesafe.ai/blog/introducing-system-one-models-and-jev |
| Rate limit | 250.000 tokens/s e 1.200 requests/min; *"Rate limits are adjusting dynamically… can change without notice"*. O blog descreve o acesso como early access, com desenvolvedores saindo de uma waitlist. | https://docs.typesafe.ai/models ; https://typesafe.ai/blog/introducing-system-one-models-and-jev |
| Contexto | 64k tokens por request (state + todas as perguntas); 32k para `state` + a pergunta mais longa (~150.000 caracteres em inglês). | https://docs.typesafe.ai/models ; https://docs.typesafe.ai/primitives |
| Latência | *"Most queries complete in about 100 ms"*; *"real-time speeds (150ms)"*; blog: *"End-to-end response time is 70ms-500ms"*, medido *"from our laptops on the West Coast (this is where our service is currently based)"* — bom para o servidor no Render (Oregon); do Brasil, somar o RTT intercontinental. Cookbook: artigo de ~54.000 caracteres + 13 perguntas = **0,27 s e US$ 0,000497** em 1 chamada (vs 2,71 s e US$ 0,006090 em 13 chamadas). | https://docs.typesafe.ai/concepts/how-to-build-with-system-one ; https://docs.typesafe.ai/concepts/use-case-map ; https://docs.typesafe.ai/cookbooks/parallel_questions |
| Idioma | Inglês é o idioma primário; outros "currently have lower accuracy". **Evidência para o JEF deve continuar em inglês; texto do jogo (pt-BR) é avaliado com menos acurácia.** | https://docs.typesafe.ai/models |
| Dados | *"Jev is not trained on customer requests or responses."* Não há fine-tuning por cliente. ZDR só enterprise; DPA/MCA/Privacy em https://docs.typesafe.ai/legal | https://docs.typesafe.ai/models |

Referência de custo do nosso uso real: o diagnóstico `jef-diagnostic-v1` consumiu 9.847 tokens de entrada → ~US$ 0,00041.

### 1.4 Determinismo e confiança

- `confidence` (0–1) é derivada do formato da distribuição; só em `choice` e `score`. Padrão recomendado: três faixas (agir / cautela / não agir) com limiares proporcionais ao risco. *"Higher confidence does not establish which answer is correct."* — https://docs.typesafe.ai/confidence ; https://docs.typesafe.ai/primitives/score
- Calibração é estatística de grupo, **não garantia por resposta**. — https://docs.typesafe.ai/concepts/system-one
- **Não há parâmetro de seed/temperatura documentado.** Medições oficiais: a maioria das respostas repetiu com desvio-padrão 0,0 em 5 execuções; alguns `noul` variaram ~0,005–0,008; em outro cookbook o desvio médio por pergunta foi 0,0102 e um `noul` oscilou 0,43–0,53 cruzando o limiar 0,5 — por isso recomendam uma **faixa "incerto" (0,30–0,70) para revisão humana**. — https://docs.typesafe.ai/cookbooks/parallel_questions ; https://docs.typesafe.ai/cookbooks/consistency_noul_cookbook
- Não espere invariantes lógicas entre perguntas (`P(x) + P(não x)` pode dar 1,19; `noul` e `choice` sim/não divergem). — https://docs.typesafe.ai/model-jaggedness/jev-1.13

### 1.5 SDKs e ferramentas

- JS/TS: `npm install @typesafe-ai/sdk` (Node ≥ 20; v0.6.0 de 2026-09-15). Timeout padrão 10 s por tentativa, 2 retries, repete 408/429/5xx, respeita `Retry-After`. **`dangerouslyAllowBrowser` é `false` por padrão** ("exposing the API key to page users"). — https://docs.typesafe.ai/sdk/javascript ; https://docs.typesafe.ai/sdk/javascript/api/interfaces/TypeSafeClientConfig ; https://docs.typesafe.ai/sdk/javascript/api/interfaces/RetryPolicy
- Python: `pip install typesafe-sdk`. — https://docs.typesafe.ai/introduction/quickstart
- **Atenção BIPX:** o `render.yaml` tem `buildCommand: ""` (produção não roda `npm install`) e o projeto não tem dependências de runtime. Para qualquer uso no servidor, usar `fetch` nativo (como o `evaluate-jev.mjs` já faz), não o SDK.
- Playground para testar perguntas à mão: https://console.typesafe.ai/playground. Skill oficial para agentes (Claude Code): `claude plugin marketplace add typesafe-ai/skills` + `claude plugin install typesafe@typesafe-ai` — é alteração de configuração do dono; fica como sugestão. A skill recomenda: *"Put the constants (questions and thresholds) in a single place so they're easy to review. Agents aren't great at writing questions."* — https://docs.typesafe.ai/agent-skill
- Padrões oficiais: speculative fan-out, confidence-gated routing, composite scoring, intent routing. — https://docs.typesafe.ai/patterns
- Casos de uso oficiais para **Gaming**: *"Evaluate player reports, in-game chat, reviews… Moderate chat and detect abuse… Annotate content and score frustration or engagement. Detect churn signals…"*; também "Semantic code linting… Run these checks in CI". — https://docs.typesafe.ai/concepts/use-case-map

### 1.6 Fraquezas documentadas (página "Jev 1.13 jaggedness", revisada em 2026-09-17)

https://docs.typesafe.ai/model-jaggedness/jev-1.13 — as que importam para nós:

| Fraqueza | Citação | Consequência para o BIPX |
| --- | --- | --- |
| Leitura literal | *"answers the question you wrote, not the one you meant"* | Instruções precisam declarar a condição exata; nada de subentendidos. |
| Números | *"Jev is not a calculator"*; conta mal; *"will perform better on semantic representations than numeric"* | Telemetria e métricas: **comparar em código**; mandar ao JEF rótulos/baldes ("caindo rápido"), não séries numéricas. |
| Matemática com Score | *"Please do not use score outputs… to compute the exact magnitude… You can use the expectation to check if it passes a particular threshold, but `jev-1.13`'s score levels are weak in numerical calibration."* | 9,4 vs 9,6 não é diferença significativa. Usar o limiar + critério em probabilidades + margem. |
| Indireção | dupla negação e múltiplos saltos custam acurácia | `evidence_complete` atual é uma pergunta de ~45 palavras com várias condições negativas encadeadas ("without relying on…") — quebrar em atômicas. |
| State grande | *"Accuracy falls as the state grows with content unrelated to the decision… Jev suffers from context rot"* | Hoje cada uma das 12 perguntas vê a evidência das 12 dimensões + blobs de coordenadas. Separar por dimensão. |
| Conteúdo adversarial | *"text that argues for its own classification, can move the answer"* | **Prosa elogiosa pode subir a nota.** Precisamos de lint + canários (seção 3.4). |
| Instrução × critérios contraditórios | piora | Manter `instructions` e `criteria` alinhados. |
| Geração | não gera texto | Coach = frases prontas escolhidas por `choice`/`noul`. |

### 1.7 O que **não** encontrei na documentação pública (não assumir que existe)

Streaming; endpoint batch/assíncrono ou webhooks (o "batching" é colocar muitas perguntas num request); seed/temperatura; justificativas/explicações; fine-tuning; entrada de imagem/áudio; produto de "evals" ou "agents" (só padrões e cookbooks; o blog fala de "workflow evals" como metodologia interna); SLA de latência; chave de idempotência; limite de nº de perguntas além do orçamento de tokens. Fontes secundárias citam o Jev 1.13 listado no OpenRouter (https://openrouter.ai/typesafe/jev-1.13) — **não verificado**, não contar com isso.

### 1.8 Implicações diretas

- Dá para fazer **centenas de perguntas atômicas por candidato** quase de graça. O gargalo é a qualidade das perguntas e a honestidade da evidência.
- Como o JEF não explica notas, **a única forma de obter "o porquê" é decompor**: cada exigência vira um `noul`; a lista ordenada de probabilidades baixas *é* o relatório de lacunas.
- Qualquer uso em runtime precisa ser **assíncrono, com timeout curto, fallback determinístico e circuito aberto** (rate limit "dinâmico", early access, Render free com cold start).

---

## 2. Parte A — outras formas de usar o JEF

### 2.0 Princípios comuns

**Quando usar:** julgamento semântico rápido, repetível e barato sobre texto/estado estruturado, cujo resultado o código consome (roteamento, verificação, lint, ranking). **Quando não usar:** tudo que código calcula exatamente (contagens, limiares numéricos, comparações de tempo), decisões multi-passo, geração de texto. A TypeSafe diz isso literalmente: *"Use code when you can… Keep deterministic work in code. It is reliable and cheap."* (https://docs.typesafe.ai/concepts/how-to-build-with-system-one)

**Segurança da chave (vale para todos os usos):**

- A chave vive **só** em ambiente de servidor/ferramenta: `TYPESAFE_API_KEY` no `.env` local (o `server.mjs` já tem `loadLocalEnv()`; `.env` está no `.gitignore` e no `.vercelignore`; o servidor devolve 404 para segmentos iniciados por ponto e só serve `src|vendor|assets|public|models|textures|audio`) e como variável de ambiente no Render. **Nunca** no bundle estático da Vercel, nunca em `src/` (que é público nos dois hosts), nunca em `window.__zombieNightDebug`.
- Código servidor-only novo deve ficar **fora de `src/`**: sugiro `server/` (adicionar `server` ao `.vercelignore`, pois a Vercel publica tudo que não está ignorado) e `tools/lib/` para uso de desenvolvimento.
- **Isolar QA da chave:** `tools/quality-isolated-server.mjs` faz `env: {...process.env, …}` e zera só o Supabase. Com recursos JEF no servidor, é obrigatório passar também `TYPESAFE_API_KEY: ''` (e/ou exigir flag explícita `BIPX_JEF_RUNTIME=1`), senão as suítes passam a chamar a API, gastam cota e ficam não determinísticas.
- **Nada de texto livre de jogador no `state`** de decisões (nome, futuro chat): é vetor de injeção. Onde o texto do jogador *é* o objeto avaliado (moderação), ele vai isolado num campo e as perguntas são sobre esse campo.
- Reaproveitar o `redact()` do `evaluate-jev.mjs` em todo log; registrar `latencyMs`, `usage` e `response.model`.
- **Higiene da chave atual:** o runner do loop (`scratchpad/jef-run.sh`) extrai a chave por `grep` de um transcript de sessão Codex em disco. Verifiquei (contagem apenas, valor nunca impresso) que o script não contém a chave e que não há token `apikey_…` versionado no repositório. Mesmo assim, chave colada em chat fica em texto puro em `~/.codex/sessions`. Recomendo ao dono **rotacionar** em https://console.typesafe.ai/keys e guardar a nova no Keychain do macOS (`security add-generic-password`), com o runner lendo via `security find-generic-password -w`.

**Módulo cliente comum sugerido:** `tools/lib/jef-client.mjs` (e cópia servidor em `server/jef-client.mjs`): `askJef({state, questions, timeoutMs, retries})` com backoff para 408/429/5xx/529, `AbortSignal.timeout`, modelo fixo `jev-1.13.0`, redaction, medição de latência, e modo `mock` (o padrão de mock por `--import data:` do `verify-evaluator-contract.mjs` já serve).

---

### 2.1 (c) Gate de qualidade v2: lint de evidência + requisitos atômicos + canários + deltas — **RECOMENDAÇÃO Nº 1**

- **O que melhora:** o próprio loop do pedido B. Troca "uma nota opaca por dimensão" por uma **matriz de requisitos** (um `noul` por exigência da rubrica) que diz exatamente o que falta, e fecha as brechas de gaming (seção 3.4).
- **Onde encaixa:** novo `tools/jef-gate.mjs` (mantém `tools/evaluate-jev.mjs` intacto como histórico), `tools/lib/jef-client.mjs`, `tools/lib/evidence-lint.mjs`; `docs/quality-rubric.json` ganha `requiredScenarios` por dimensão (itemização do texto atual, sem criar nem remover exigência — ver 3.2); `tools/verify-evaluator-contract.mjs` ganha cenários novos; scripts `jef:lint` e `jef:gate` no `package.json`. Não existe CI (`.github/` ausente): o gate roda no loop local; o passo de lint não precisa de chave e pode virar GitHub Action depois.
- **Dados enviados:** por dimensão, um request com `state = {candidate, dimension, observations[], open_defects[], tests[]}` só daquela dimensão (texto limpo em inglês, observações estruturadas) e perguntas: o `score` atual + 6–12 `noul` de requisito + `noul` de lint ("alguma observação afirma qualidade sem medição ou comportamento observado?") + `evidence_complete`/`major_defect_absent` **por dimensão**. Mais 2 requests canário (3.4-C). Exemplo no Apêndice A1.
- **Passos em código, antes de gastar JEF:** existência e SHA-256 de cada artefato citado; artefato gerado a partir do mesmo manifesto de candidato; ponteiros numéricos (`{"claim":"p95Ms","value":8.3,"artifact":"…json","pointer":"/measurements/…/p95Ms"}`) conferidos **em código** (o Jev é ruim de número); cobertura calculada pelo código a partir de `requiredScenarios` (não mais autodeclarada); cenários `human`/`device` exigem `source: "owner"`; diff de defeitos contra a avaliação anterior (defeito não some, só fecha com artefato); ledger anti-reconsulta.
- **Verificação de citação (padrão do cookbook https://docs.typesafe.ai/cookbooks/citation_check):** para afirmações não numéricas, `choice {supports, contradicts, not_addressed}` entre a observação e um trecho selecionado do artefato; `confidence < 0,8` → revisão.
- **Latência/custo:** 12 requests paralelos (~3–4k tokens cada) + canários ≈ 80k tokens ≈ **US$ 0,0035 por avaliação**, poucos segundos. Falhas: 429/529 → backoff; qualquer request falho → relatório `evaluation_error`, nunca "passou".
- **Saída:** `report.json` + `delta.md`: por dimensão, score/10, P(nível ≥ 8), confiança, matriz de requisitos ordenada do pior para o melhor, quais lacunas são só-do-dono, e delta contra a última entrada do ledger **com a mesma `rubricSha256`** (deltas entre rubricas diferentes não são comparáveis — a baseline de 18/09 tinha 10 dimensões e deu 4,7–7,2; a de 19/09, 12 dimensões e evidência mais franca, deu 0,1–4,8 com o jogo *melhor*).
- **Esforço:** S–M (1 a 1,5 dia de agente), sem tocar no runtime.

### 2.2 (d) Lint de cópia e design: cartas, habilidades, rótulos e aria-labels — **RECOMENDAÇÃO Nº 2**

- **O que melhora:** clareza e consistência do texto que o jogador lê; pega divergência texto × mecânica (o defeito N-04 "+Área promete explosões que não entrega à Lyra" e o F-04 "idioma inconsistente" são exatamente dessa classe). Alimenta `ui_ux`, `game_design` e `accessibility` (rótulos significativos). É o caso de uso oficial "semantic linting in CI".
- **Achados reais que um lint desses pegaria hoje** (li o código): `soulMagnet` diz "A cada 18s" mas a recarga cai com pilhas (`max(7.5, 18 - (n-1)*4)`) e o raio (18 + 7n m) não é citado; `cuttingMoon` diz "Level-up solta uma onda…" (inglês) e omite raio/dano; `ironBlood` usa "stack"; `slayerPact` usa "boss"; `lastBreath` usa "run"; `hunterEye` não dá número (são +8 % por pilha, teto 42 %) enquanto `ironBlood` dá; `sealRitual` (hoje bloqueada junto com `autoWeapon` em `available()`) descreve "ataques automáticos" — volta a importar quando o T3 reativar o arsenal.
- **Onde encaixa:** novo `tools/jef-copy-lint.mjs`. Pré-requisito pequeno: o texto das cartas vive em `upgradeDefinitions` dentro de `src/main.js` (módulo de browser de 12,9k linhas, não importável em Node). Mover cópia + efeitos mecânicos para um módulo compartilhado (o T2 já prevê `src/progression/skill-upgrades.mjs`; exportar `{id, label, description, classId, effects:[{stat, op, value, unit}]}`), importado por `main.js`, `authority.mjs` e pela ferramenta. As habilidades já estão em `getClassSkills()` (`src/combat/class-skills.mjs`) com `description` ao lado de `cost/cooldown/radius/stun/freeze`. Rótulos de UI: extrair `aria-label`/textos de `index.html` e `src/ui/arpg-hud.js`.
- **Dados enviados:** um request por carta/habilidade: `state = {card:{label_pt, description_pt, rarity, class}, mechanics:{effects em inglês}, glossary:{Fervor, Foco, atordoar, congelar…}, sibling_labels[]}` e ~10 perguntas: `states_magnitude`, `contradicts_mechanics`, `omits_effect`, `mixed_language`, `uses_glossary_terms`, `duplicates_sibling` (nouls); `clarity`, `tone_consistency` (scores); `primary_fantasy` (choice: ofensa/defesa/mobilidade/economia/utilidade → o código confere a distribuição por classe). Exemplo no Apêndice A2.
- **Ressalva de idioma:** pt-BR tem acurácia menor. Mitigar: mecânica e glossário em inglês; faixa 0,30–0,70 = "revisão humana", só falhar o lint com `contradicts_mechanics ≥ 0,7`.
- **Latência/custo:** ~40 itens × ~700 tokens ≈ US$ 0,0012 por execução; segundos. Falha de API → lint "inconclusivo", não bloqueia build.
- **Honestidade:** um agente LLM revisando 30 cartas uma vez faz igual ou melhor. O ganho do JEF é ser **lint repetível, numérico e barato** a cada commit enquanto Upgrades 2.0 (T2) e Relíquias (T3) adicionam dezenas de textos.
- **Esforço:** S (0,5 a 1 dia).

### 2.3 (b) Laboratório de balanceamento offline — **RECOMENDAÇÃO Nº 3 (em dois passos)**

- **O que melhora:** pedidos 2 e 4 do dono (upgrades melhores, heróis mais fortes) e os P1 de ritmo já medidos: N-01 (onda 1 cerca antes do primeiro poder: 7 inimigos aos 0:04, 24–30 aos 0:20; 3 de 7 runs acabam ≤ 0:24), N-02 (Lyra presa), N-04 (cartas não conversam com skills), N-05 (recurso não restringe). Gera evidência de "wave pacing" para `game_design`.
- **Onde encaixa:**
  - `src/progression/run-telemetry.mjs` (novo, puro, compartilhado): acumuladores por run — dano recebido por tipo de monstro e por janela, abates/min, casts aceitos/rejeitados por skill, ofertas/escolhas de carta com vida no momento, % do tempo com vida < 30 %, % do tempo com as 3 skills em recarga, % do tempo com recurso cheio, tempo sem abate, pico de inimigos. `summarize()` devolve métricas numéricas, **baldes semânticos** e uma **linha do tempo em inglês**.
  - Bots **WebSocket em Node puro** (`tools/lib/ws-bot.mjs`) contra o servidor autoritativo isolado (`localServer()` com a chave zerada): sem GPU, sem lock, paralelizável. O servidor roda em tempo real (`setInterval(updateRoomWorlds, 50)`), então 240 runs de 3 min em 8 processos ≈ 90 min. O `tools/verify-natural-runs.mjs` (browser, entrada real) continua sendo a prova "natural" para evidência; o laboratório é para busca.
  - Overrides de parâmetros: hoje são constantes em `server.mjs` (`serverMonsterProfiles`, `getServerSpawnInterval`, `startServerNextWave`, `getServerDifficultyScale`, `serverCharacterProfiles`) e o solo duplica em `main.js` (`startNextWave`, `getZombieSpawnInterval`). Precisa de um objeto `balance` lido de `BIPX_BALANCE_OVERRIDES` **somente** com `NODE_ENV !== 'production'` (coordenar com T1, que mexe nessa área e cria `src/combat/hero-power.mjs`).
- **Divisão de trabalho (importante):** metas **numéricas ficam em código** (ex.: P(morrer antes da 1ª carta) ≤ 10 % para o bot ingênuo; 1º nível entre 10–25 s; participação da carta mais escolhida ≤ 45 %; tempo com recurso cheio ≤ 25 %). O JEF julga a **leitura qualitativa da narrativa** com composite scoring (https://docs.typesafe.ai/patterns/composite-scoring): `early_fairness`, `power_growth`, `pacing_variety`, `death_attribution`, `build_choice_meaning` (scores de 4–5 níveis situacionais), pesos no código. Exemplo no Apêndice A3.
- **Latência/custo:** ~2,1k tokens por run → 240 runs ≈ US$ 0,02. O custo real é tempo de simulação.
- **Riscos:** bot ≠ humano (o próprio `fable-natural.md` alerta); overfitting à política do bot → usar 2 políticas (ingênua e competente) e 3 sementes; `Math.random` no servidor não é semeável → medianas. O JEF aqui é **objetivo suave e alarme de regressão**, nunca substituto das metas numéricas nem do playtest do dono nas 2–3 melhores configurações.
- **Esforço:** passo 1 (telemetria + bots + metas numéricas + juiz de narrativa sobre runs existentes) M, 1–1,5 dia; passo 2 (overrides + busca aleatória/successive halving em ≤ 8 parâmetros) +1–2 dias.
- Extensão futura, se o dono rotular ~30 runs ("divertida/frustrante/entediante"): usar respostas do JEF como features de um modelo clássico (https://docs.typesafe.ai/cookbooks/autoresearch_feature_discovery).

### 2.4 (e) Coach de fim de run (voltado ao jogador)

- **O que melhora:** a tela de morte (F-03 a chamou de "pobre") e o onboarding — o jogador que morre em 20 s entende o que o matou e o que tentar.
- **Adaptação obrigatória:** a System One **não devolve texto livre**. Desenho: `choice main_cause` sobre ~10 causas pré-definidas (+ `none_clear`), um `noul` por dica aplicável (~12 dicas), um `score` de progresso para o tom. O cliente mostra **frases prontas em pt-BR** indexadas pelo id. Exemplo no Apêndice A4.
- **Onde encaixa:** servidor: acumular com `run-telemetry.mjs` em `damageServerPlayer()`, `rewardServerKill()`, `handleServerSkill()` e no ramo `chooseUpgrade` de `handleClientMessage()`; quando `receiveDamage` leva a `state === 'dead'`, disparar `coachAdvise(summary)` em *fire-and-forget* (timeout 1,5 s, sem retry) e enviar `{type:'coachTip', runId, cause, tips[]}`. Cliente: `endGame()` em `src/main.js` já monta `messageCopy`; acrescentar um bloco `aria-live` para a dica. Solo/offline não tem servidor autoritativo: `POST /api/coach` com resumo **só de enums/baldes** validado por schema estrito, limite por IP (ex.: 6/min), CORS restrito à origem da Vercel (o padrão de `writeCorsHeaders` já existe).
- **Fallback determinístico obrigatório:** regras simples (maior fonte de dano, morreu sem carta, skills nunca usadas) escolhem a dica se o JEF falhar/expirar/sem chave. `confidence < 0,6` → dica genérica.
- **Latência/custo:** ~700 tokens por morte ≈ US$ 0,00003; ~100–300 ms + RTT; a tela de morte já tem guarda de 600 ms. Render free dorme: no solo o primeiro POST pode estourar o timeout → fallback.
- **Segurança:** nenhum texto do jogador no `state` (nome fora); schema de enums impede injeção e limita custo de abuso.
- **Esforço:** M (1,5–2 dias), reaproveitando a telemetria de 2.3. Valor médio; mexe pouco nas notas do JEF.

### 2.5 (a) Diretor de IA no servidor

- **Ideia:** a cada ~15 s por sala, resumir telemetria dos últimos 20–30 s e ajustar o ritmo de spawn dentro de limites seguros.
- **Avaliação franca:** as entradas são numéricas (ponto fraco documentado do Jev); depois que o código as converte em baldes, uma tabela de regras faz o mesmo trabalho de forma determinística, testável e gratuita. O blog da TypeSafe, sobre o demo de Doom (10 consultas/s, ~US$ 7/h): *"A non-AI doom bot could play better."* O problema N-01 é de rampa estática, que o T1 já está tratando. **Recomendo construir primeiro o diretor determinístico (se a rampa estática não bastar) e tratar o JEF como camada consultiva experimental, atrás de flag, em salas privadas.**
- **Se for feito, desenho seguro:**
  - Módulo puro `server/director.mjs`; chamado em `updateRoomWorld()`; aplica um multiplicador `pacing ∈ [0,75; 1,25]` **apenas** em `getServerSpawnInterval(world)` e em `world.nextWaveDelay` (respiros). **Nunca** altera dano, vida, XP, pontuação ou o total de `zombiesToSpawn` da onda — preserva a comparabilidade do ranking. Variação máxima de 0,05 por atualização.
  - Sinal base determinístico (pressão × tédio a partir de limiares). JEF opcional soma no máximo ±0,10: scores `pressure` e `boredom` (5 níveis situacionais) e nouls `imminent_death`, `snowballing`, sobre baldes do jogador **mais pressionado** da sala.
  - Assíncrono; descartar resposta com mais de 3 s ou se `epoch`/`wave` mudaram (a skill oficial pede: "check freshness before applying a result to a changed situation"); timeout 1,5 s; circuito aberto por 5 min após 3 falhas; desligado por padrão e **sempre desligado nas suítes de QA**.
  - Solo roda no browser: só o diretor determinístico (sem chave no cliente).
- **Custo:** ~600 tokens × 240 chamadas/h ≈ US$ 0,006/h por sala. **Esforço:** M–L (2–3 dias com testes CPU de clamps/slew/fallback). **Risco:** o mais alto da lista (simulação autoritativa, justiça em grupo, ranking).

### 2.6 (g) Moderação de nomes do ranking público (ideia extra)

- **O que melhora:** `sanitizePlayerName()` só remove `<>` e corta em 16 caracteres; o nome vai para `/api/leaderboard`, público. É o caso "Gaming" oficial da TypeSafe (moderação).
- **Onde encaixa:** `server.mjs` em `joinMultiplayerRoom()`/mensagem `profile`/`getOrCreatePlayerRecord()`: aceitar o nome na sala, mas só publicá-lo no ranking após checagem assíncrona; enquanto pendente/indisponível, exibir "Jogador N". Bateria no padrão guardrails (https://docs.typesafe.ai/cookbooks/llm_guardrails): nouls `hate_or_slur`, `sexual`, `harassment_or_threat`, `impersonates_staff` + score de severidade; lista local de bloqueio como primeira linha e fallback; faixa 0,3–0,7 → oculto até revisão. O nome vai isolado em `state.player_name` e é o *objeto* da pergunta.
- **Custo:** ~250 tokens por nome. **Esforço:** S (0,5 dia). **Valor:** médio-baixo hoje, cresce com a base de jogadores; vale fazer antes de qualquer divulgação.

### 2.7 (f) Triagem de relatos de bug/telemetria

- Não existe canal de relato no jogo hoje e há poucos jogadores. Quando houver um botão "Reportar problema" (`POST /api/report`), o padrão oficial de triagem serve: `choice` de categoria, `score` de severidade e de qualidade do relato, `noul` de abuso, tudo com o texto do jogador isolado e limite de taxa. Para erros de console das execuções de QA, agrupar por stack/mensagem **em código** é melhor. **Valor baixo agora; esforço S–M.** Revisitar após lançamento.

### 2.8 Outras ideias rápidas (não prioritárias)

- **Sugestão de carta durante a run** ("Oráculo"): `choice` entre as 3 cartas ofertadas dado build + perfil de dano recente. Mesmo risco/encaixe do coach; decisão de design discutível.
- **Roteador de notas do dono:** o dono dita notas livres em pt-BR após a sessão no celular e o JEF classifica por dimensão/severidade. O orquestrador LLM faz isso melhor em português; não vale o esforço.
- **Verificação de relatórios de agentes** ("Universal Verification" do mapa de casos de uso): já incorporada ao gate v2 como checagem de citação.

### 2.9 Ranking valor × esforço

| # | Uso | Valor | Esforço | Risco | Veredito |
| --- | --- | --- | --- | --- | --- |
| 1 | (c) Gate v2: lint + requisitos atômicos + canários + ledger + deltas | muito alto (desbloqueia e protege o pedido B) | S–M | nenhum no runtime | **construir agora** |
| 2 | (d) Lint de cópia/design/rótulos | médio-alto (T2/T3 estão criando texto agora) | S | nenhum | **construir agora** |
| 3 | (b) Laboratório de balanceamento, passo 1 | alto (pedidos 2 e 4; N-01/02/04/05) | M | baixo (só ferramentas) | **construir agora**; passo 2 depois |
| 4 | (e) Coach de fim de run | médio | M | baixo-médio (endpoint público) | depois do nº 3 (mesma telemetria) |
| 5 | (g) Moderação de nomes | médio-baixo hoje | S | baixo | antes de divulgar o jogo |
| 6 | (a) Diretor com JEF | médio-baixo vs diretor determinístico | M–L | alto | diretor determinístico primeiro; JEF só experimental |
| 7 | (f) Triagem de bugs | baixo hoje | S–M | baixo | pós-lançamento |

**Top 3 — design mínimo:**

1. **`tools/jef-gate.mjs`** — (i) `evidence-lint` em código: arquivos/hashes/mesmo candidato, ponteiros numéricos, cobertura por `requiredScenarios`, `source: owner` nos cenários humanos, diff de defeitos, ledger; (ii) 12 requests por dimensão com score + nouls de requisito + checagem de citação; (iii) 2 canários; (iv) regra de aprovação em código: cobertura ∧ score/10 > 9,5 ∧ P(nível ≥ 8) ≥ 0,95 ∧ todos os nouls de requisito ≥ 0,9 ∧ `evidence_complete_dim` e `major_defect_absent_dim` ≥ 0,95 ∧ canários válidos ∧ testes passam ∧ `openDefects` vazio; (v) `report.json` + `delta.md`. Perguntas e limiares num único arquivo revisável (`tools/lib/jef-questions.mjs`).
2. **`tools/jef-copy-lint.mjs`** — importa cópia+mecânica de um módulo compartilhado e `getClassSkills()`; 1 request por item com ~10 perguntas; relatório Markdown ordenado por `contradicts_mechanics`; sai com código ≠ 0 só em contradição provável.
3. **`src/progression/run-telemetry.mjs` + `tools/lib/ws-bot.mjs` + `tools/balance-lab.mjs`** — telemetria pura compartilhada; bots WS contra servidor isolado com a chave zerada; metas numéricas em código; juiz de narrativa JEF com composite scoring; saída `balance-report.json` por configuração. O mesmo `run-telemetry.mjs` alimenta depois o coach e um eventual diretor.

---

## 3. Parte B — plano honesto de evidências para todas as dimensões > 9,5

### 3.0 A matemática do alvo e o que o diagnóstico mostra

- A rubrica tem 10 níveis (índices 0–9); `score/10 = 10 × score ÷ 9`. **"> 9,5" ⇔ score > 8,55.** Com massa só nos níveis 8 e 9, isso é **P(9) > 0,55**; cada ponto de probabilidade no nível 7 ou abaixo exige compensação (P(9) > 0,55 + P(7) + 2·P(6)…).
- O arquivo `docs/quality-rubric.json` ainda diz `{">=", 10}` e `quality-gates.md` diz "exactly 10". Isso exige P(9) ≈ 1,00 (no nosso relatório as probabilidades vêm com duas casas): qualquer ressalva honesta ("não testado em X") desloca massa para o nível 8 ("only minor imperfections") e reprova. **O alvo 10 incentiva apagar ressalvas; o alvo > 9,5 tolera ~45 % de massa no nível 8 e permite declarar imperfeições menores.** O pedido novo do dono é > 9,5 (item 5 do `LOOP-STATE.md`), mas o `goal-production-20260919.md` diz "não baixar o limiar": é preciso **aval explícito do dono** e então alinhar os três pontos (rubrica, `quality-gates.md`, asserções de `verify-evaluator-contract.mjs`) num único commit.
- O nível 9 diz: *"exceptionally refined and consistently verified in every required scenario, including edge cases and sustained use, with no material defect or missing evidence."* Ou seja, para **todas** as dimensões: (a) todo cenário exigido documentado com método e resultado no **mesmo candidato**; (b) casos de borda; (c) uso prolongado; (d) zero defeito material aberto; (e) zero lacuna declarada.
- Diagnóstico `jef-diagnostic-v1` (09:50 UTC): notas preliminares 0,1–4,8, todas `coverage: pending`, `evidence_complete` 0,03, `major_defect_absent` 0,03, confianças 0,63–0,97. `mobile` 0,07 e `audio` 0,10 com confiança ~0,97: o juiz está certo e seguro — **não há evidência física nem de escuta**. Havia 5 defeitos abertos naquele estado (A2-01 P1, A2-02 P2, ANIM-01, NET-01, RELEASE-01), e `openDefects` não vazio já reprova em código. Segundo o `fable-closeout.md`, o v5 publicado depois integrou a correção da copa (A2-01), os rótulos de loot (A2-02) e o Render voltou a responder (RELEASE-01) — mas nada disso foi reavaliado ainda; ANIM-01 e NET-01 seguem abertos.
- O JEF **só lê o que o revisor escreveu**. Nas dimensões perceptivas (arte, áudio, feel), a nota é função das palavras do revisor. Por isso: revisor independente do implementador, questionário estruturado com respostas enumeradas (não prosa livre) e o dono como auditor final dessas dimensões.
- **Recomendação de calibração antes de perseguir a nota:** com a chave que o orquestrador já tem, rodar em pasta separada (`output/qa/aaa-loop/jef-calibration/`, claramente rotulado como sintético, nunca como nota do jogo) dois estados sintéticos por dimensão: (1) "evidência ideal" completa e plausível; (2) "prosa elogiosa sem medição". Se (1) não passa de 9,5 com a redação atual dos níveis, o alvo é inalcançável por construção e a rubrica precisa de ajuste *antes* de semanas de trabalho; se (2) tira nota alta, o juiz é bajulável e os canários viram obrigatórios. Isso não viola "não reconsultar candidato idêntico" porque não é candidato.

### 3.1 Quadro-resumo

Legenda de quem produz: **A** = agentes/automação; **V** = agente com visão inspecionando frames (rotular `inspector: vision-agent`); **D** = aparelho físico nas mãos do dono (medição pode ser automática); **H** = percepção humana do dono.

| Dimensão | JEF hoje (/10, preliminar) | Produção da evidência | Bloqueio principal |
| --- | --- | --- | --- |
| game_design | 4,6 | A + H leve | N-01/N-02/N-04 abertos; nenhuma run passou da onda 2; aceite humano de dificuldade |
| animation | 3,1 | A + V + H leve | **defeito de produto**: `acceptedNoSliding=false` (v4–v15 não promovidos) |
| art_direction | 3,7 | V + **H** | aceite perceptivo; lista de pendências de arte; arte em celular físico |
| vfx | 4,2 | A + V + H leve | corte de cadáver não confirmado; sobrevivente do dash; leitura em combate denso; novo escopo T3 |
| combat_feel | 4,6 | A + **H** | "feel" é humano; falta latência input→resposta medida |
| ui_ux | 4,8 | A + V + H leve | fluxos no candidato novo (Upgrades 2.0/Relíquias); HUD em multiplayer; cartas por toque |
| mobile | 0,1 | **D + H (só o dono)** | zero sessão física iOS/Android |
| audio | 0,1 | A (sinal) + **H (só o dono)** | zero escuta; timeout intermitente de áudio do Aldric sem causa |
| performance | 0,9 | A (desktop) + **D** (celular) | nenhuma série sustentada no candidato atual; nada físico |
| multiplayer | 3,5 | A | late join `snapshotOnly` isolado; morte/wipe simultâneos; 3–4 clientes sustentados; rede adversa |
| accessibility | 4,0 | A + V (H opcional) | contraste medido, zoom 200 %, reduced-motion no WebGL, pistas não-cor/não-áudio |
| reliability | 4,4 | A | `verify:all` num único candidato congelado; soak; restart repetido; persistência |

### 3.2 Detalhe por dimensão

Itens "o nível 9 exige" são a itemização fiel do texto de `docs/quality-rubric.json` + tabela de `docs/quality-gates.md` (servem de `requiredScenarios` do gate v2). "Já existe" refere-se a `docs/arpg/aaa-20260919/*.md`. Quase tudo que existe está preso a **candidatos ancestrais**; nível 9 pede o mesmo candidato.

#### 1) game_design — Game design and class identity
- **Exige:** GD1 jogo natural com Aldric (espada + 3 skills) e Lyra (rifle + 3 skills), exatamente os seis IDs; GD2 custos, regeneração, recargas, alcance e controle de grupo com significado; GD3 decisões distintas por classe; GD4 preparo/impacto/recuperação legíveis; GD5 contra-jogo dos inimigos; GD6 ritmo de ondas; GD7 upgrades/recompensas compatíveis; GD8 autoridade do servidor e rejeição de cast forjado; GD9 preservação de XP/drops/grupo/late join/reconexão/wipe/ranking local; GD10 as seis funções v2 canônicas; GD11 modificadores/expiração, todo alvo válido em área, resistência de chefes, uma morte/recompensa por vítima do dash, limpeza/reconstrução de status. A rubrica avisa: contagem de features e demos isoladas não provam design.
- **Já existe:** CPU 16 casos (IDs, custos, recargas, paredes, chefes, centro fixo, dano por vítima); WS 2 cenários de classe + 11 mensagens inválidas (`integration-regression-v1`); +Área coerente com skills (`fable-area.md`, 7 grupos); piloto natural 180 s por classe com N-01…N-05 medidos (`fable-natural.md`); auditoria de design S-01…S-03 (`fable.md`); smoke de produção com dois Chrome (`fable-closeout.md`).
- **Falta:** runs naturais além da onda 2 (chefes, elites, cartas raras+, economia tardia, fim das pilhas S-02); fechar N-01/N-02/N-04 (T1/T2) e re-medir; documentar contra-jogo por tipo de inimigo; GD9 inteiro no candidato atual com Upgrades 2.0 autoritativo; evidência das Relíquias (T3) dentro da identidade de classe.
- **Só o dono:** aceite de dificuldade/ritmo (o próprio goal diz que piloto automático "fundamenta investigação, não nota de dificuldade humana") — coberto pela Sessão 3.

#### 2) animation — Animation, locomotion and contact
- **Exige:** AN1 playback nativo inspecionado; AN2 contato/deslize de pé medido em espaço de mundo para walk/run/start/stop/turn/strafe e ataques, em várias velocidades; AN3 atores locais e remotos (heróis e inimigos); AN4 passada coerente com o deslocamento real; AN5 empunhadura estável; AN6 peso e transições naturais; AN7 contato com o chão e deformação finita; AN8 timing correto do impacto; pernas seguem andando durante cast. Limites verticais, passada nominal e testes só-CPU não bastam.
- **Já existe:** estudo independente de contato de sola com `acceptedNoSliding=false`; série backward v4–v15 e Brute v4–v8 em staging (`docs/arpg/animation-*.md`, `brute-motion-*.md`); matriz nativa do dash com 428/428 frames de ponta alinhada, erro < 1e-6 m (`astra-dash-native-v2.md`); strafe/stop remoto interpolado.
- **Falta:** **uma solução de locomoção que passe na métrica independente de sola em toda a matriz de marcha** (é defeito aberto ANIM-01, não lacuna de redação); matriz nativa local/remoto por velocidade; continuidade nas transições de contato; timing de impacto por ataque. A frente de Animação (Codex) volta em 26/09.
- **Só o dono:** olhar um clipe lado a lado de 60–90 s e responder "vejo pé deslizando?" (Sessão 3). Agente com visão faz a primeira passada.

#### 3) art_direction — Art direction
- **Exige:** AR1 cenas reais renderizadas e inspecionadas; AR2 coerência de luz/material; AR3 composição; AR4 silhuetas de heróis e inimigos; AR5 ausência de clipping visível; AR6 em desktop/mobile e combate calmo/denso; inimigos e pickups legíveis, sem choque de placeholder; vídeo de jogo sustentado e momentos extremos.
- **Já existe:** correção focal da copa que escondia o guerreiro remoto (`astra-canopy.md`, antes/depois revisado); layout de rótulos de loot v2 (`astra-loot-labels.md`); stills nativos inspecionados pelo root; crítica visual T5 em andamento (`aaa-loop/visual-critique.md`).
- **Falta:** matriz sistemática de cenas no candidato atual (desktop high / mobile low × calmo / denso × 4–6 locais); auditoria de clipping; fechar pendências já registradas (grito "fino/geométrico", cortes difíceis de ler, dither/repetição das copas, apresentação do Lich, orbe primitiva, corte do cadáver); arte vista em celular físico.
- **Só o dono:** aceite perceptivo. "AAA" com o pipeline atual de assets é julgamento que nenhum agente pode assinar. Folha de contato com 12 capturas + olhar no celular (Sessões 1 e 3).

#### 4) vfx — VFX integration and readability
- **Exige:** VX1 toda família de efeito aplicável das fontes Samurai/HandCast/LinearAbility com gatilho real ou exclusão justificada; VX2 shader/material corretos; VX3 legibilidade temporal em combate denso; VX4 limpeza de recursos; VX5 os seis IDs nas fases preparo/disparo/viagem/contato/status/fim; VX6 aura do grito, corte contínuo do dash, colisão/stun do escudo, fogo abundante do canhão, gelo persistente e fluxo gravitacional roxo sincronizados com colisão e animação reais; VX7 rótulo fixture × natural e contato × erro/expiração; VX8 essenciais em low/reduced motion; VX9 corte estilizado de cadáver só em abate confirmado de dash.
- **Já existe:** matriz nativa do dash 12/12 (high e low/reduced, miss/obstáculo/5 mortes); ponte de origem gelo/gravidade (192 cenários CPU + nativo v3); reconstrução de late join (CPU 6 casos + nativo v4); point-blank Opção A 192/192; ciclo de vida sem novos UUIDs de GPU após aquecimento; inventário de fontes (`docs/vfx-reference.md`, `docs/arpg/vfx-handoff.md`).
- **Falta:** confirmação visual do corte de cadáver; sobrevivente atingido pelo dash; esteira do dash "discreta" em escala de jogo; hierarquia canhão × gravidade sobrepostos; leitura em combate denso natural por skill; matriz low/reduced das seis no candidato atual; escopo novo do T3 (VFX das Relíquias/armas automáticas).
- **Só o dono:** 6 clipes de 10 s (um por skill, combate denso) com S/N "entendi o que aconteceu?" (Sessão 3).

#### 5) combat_feel — Combat feel
- **Exige:** CF1 entrada e playback naturais de mover/mirar/atirar/dano/recuperação nas famílias de arma; CF2 impactos e perigos legíveis; CF3 resposta; CF4 os dois básicos + seis skills; CF5 rejeição por recurso/recarga; CF6 contatos no chão e bloqueio por obstáculo; CF7 timing de cast/impacto sincronizado local/remoto; direção de dano visível, escalada, feedback útil em combate denso.
- **Já existe:** gravações com input real (erros, paradas em parede, 5 abates de dash); regressões CPU/WS; sessões naturais; erro remoto máx. 1,16 m sob jitter declarado 20–220 ms (`grok-native-v4.md`).
- **Falta:** **latência input→primeiro frame de resposta medida** (teclado, mouse e toque); auditoria de feedback de acerto por arma (flash, hit-stop, empurrão, som); indicador de direção de dano; sobrevivente do dash; vistas não obstruídas de contato/recuperação.
- **Só o dono:** o "feel". 5 min por classe no desktop + perguntas (Sessão 3). Sem isso o texto honesto continua dizendo "human feel review pending" e o JEF não sai do nível 6–7.

#### 6) ui_ux — User interface and flow
- **Exige:** UI1 menu, login, ranking, HUD, upgrades, opções, pausa, morte e restart com hierarquia, legibilidade e controles funcionais; UI2 navegação por teclado e ponteiro; UI3 HUD inferior ARPG (orbe de vida à esquerda, recurso à direita, exatamente três skills, indicador da arma básica); UI4 custo/prontidão/recarga autoritativos; UI5 toque e 1/2/3, precedência das cartas, sem cast ao digitar/em diálogos; UI6 duração real do buff, ícones v2, nenhum rótulo antigo nem prontidão simulada.
- **Já existe:** correções F-01…F-04 e status das cartas (`fable-fixes.md`, `fable-natural.md`); percurso completo por teclado e 6 perfis de toque emulado (`fable-mobile-v3.md`); polimento de toque (× 44 px, custo 11 px) (`fable-touch-polish.md`); rótulos de loot v2.
- **Falta:** repetir tudo no candidato com Upgrades 2.0/Relíquias (UI nova); ranking; HUD/oferta/`aria-busy`/reconexão em multiplayer (D-04); cartas por toque (nunca ocorreram nos perfis de toque: o herói morria antes); `<select>` de qualidade por teclado; P2 pendentes (tooltip repetindo descrição, diálogo em paisagem com rolagem).
- **Só o dono:** legibilidade real no celular (coberta pela Sessão 1).

#### 7) mobile — Mobile play
- **Exige:** MB1 movimento por toque + disparo simultâneo reais; MB2 áreas seguras e UI em compacto/retrato/paisagem; **MB3 gameplay em iOS físico; MB4 gameplay em Android físico**; alvos confortáveis, orientação estável, cancelamento de toque, evidência térmica. "Desktop viewport emulation alone is incomplete."
- **Já existe:** toque emulado com multi-toque CDP de 3 dedos em 390×844 e 844×390 (`fable-mobile-v3.md`); Safari no **iOS Simulator** (`docs/arpg/gui-ios-safari-v1.md`); script `verify:webkit`. Nada disso é aparelho físico.
- **Falta:** tudo que é físico: notch/home indicator, teclado virtual no campo de nome, conforto e latência do toque, girar no meio da run, bloquear/desbloquear a tela, destravamento de áudio no iOS, queda de FPS/aquecimento em 5–10 min.
- **Só o dono:** dimensão inteira (Sessão 1, iPhone **e** Android). Se não houver Android disponível, a dimensão não chega honestamente ao nível 9 pela letra da rubrica; mudar essa exigência é decisão do dono, documentada, não do orquestrador. (Um Android físico plugado poderia ser dirigido por automação, mas ainda depende do aparelho do dono e não substitui o conforto humano.)

#### 8) audio — Audio experience
- **Exige:** AU1 saída capturada; observações de escuta sobre AU2 distinção de eventos, AU3 volume/mix, AU4 pistas espaciais, AU5 clipping, AU6 fadiga em combate prolongado, AU7 destravamento, mute e persistência; em jogo calmo, combate pesado, dano/morte e opções.
- **Já existe:** PCM estéreo do compressor final (pico 0,379 e 0,402; cauda ~1e-9 após mute); sinais das seis skills; pausa e mute persistente; reconexão 31/31 (`coordinator-audio.md`); checagens técnicas anteriores (`docs/audio-review.md`, que já dizia "Perceptual listening is pending").
- **Falta:** **qualquer escuta**; causa do timeout intermitente do áudio de cast do Aldric (defeito aberto); métricas de sinal melhores que agentes podem produzir: loudness integrada/true-peak, distinção espectral entre cues, contagem de roubo de vozes e loudness ao longo de 3 min de combate denso.
- **Só o dono:** escuta com fones + alto-falante do celular (Sessão 2). Os agentes deste loop não recebem áudio como entrada; só medem o sinal.

#### 9) performance — Performance
- **Exige:** PF1 hardware/navegador declarados; PF2 percentis de frame-time sustentados em jogo natural; PF3 estresse denso (níveis 6 e 16); PF4 orçamentos de memória/recursos; PF5 perto de 60 fps: p95 ≤ 20 ms desktop e ≤ 25 ms mobile, sem frames longos recorrentes; PF6 comportamento em celular físico.
- **Já existe (ancestral):** runs naturais de 60 s em M5 Pro/Chrome: ~142 FPS, p95 8,3 ms, um long task de 180 ms; A/B de densidade; traço de alocação de GPU limitado; solver de 120 corpos 1,54 ms/frame. O `state.json` atual declara: nenhuma série sustentada no candidato atual.
- **Falta:** série ≥ 10 min natural + estresse lv6/lv16 no candidato atual em Chrome visível com Metal (não headless/GPU por software); heap JS e geometrias/texturas ao longo do tempo; causa do outlier de 180 ms; custo do tick do servidor com 4 jogadores + 220 monstros; **FPS e térmica em celular físico**.
- **Só o dono:** parte mobile, junto com a Sessão 1 (`?perf=1` já existe em `src/main.js`; o gravador `?qa=` proposto em 3.3 reduz a anotar quase nada).

#### 10) multiplayer — Multiplayer behavior
- **Exige:** MP1 ≥ 2 browsers reais compartilhando inimigos, projéteis e recompensas autoritativos; MP2 late join; MP3 reconexão/desconexão; MP4 morte/wipe (simultâneos); MP5 jogo concorrente; dano/recompensa justos e reconciliação de estado.
- **Já existe:** a base mais forte do projeto: orçamento de movimento v3 (16/16 WS), ordem de snapshots (CPU), late join nativo v4 (parcial), reconexão nativa 31/31, regressões de spoof/lock/cooldown/replay, smoke de produção com dois Chrome reais (zero erros; a asserção do script marcou `passed:false` porque a Lyra morreu aos 7 s).
- **Falta:** late join com observador **sem eventos anteriores** (`snapshotOnly` isolado — o v4 abriu o WS antes do cast); morte/wipe simultâneos em browsers; 3–4 clientes por ≥ 10 min; perda/jitter com fluidez visual; ofertas autoritativas de Upgrades 2.0 entre clientes; smoke de produção passando a própria asserção após novo deploy.
- **Só o dono:** nada obrigatório.

#### 11) accessibility — Accessibility
- **Exige:** AC1 controles e opções só por teclado; AC2 foco visível e restaurado; AC3 rótulos significativos; AC4 contraste; AC5 zoom/legibilidade; AC6 reduced motion que realmente suprime movimento; AC7 pistas redundantes não-cor e não-áudio no gameplay.
- **Já existe:** percurso por teclado menu→run→pausa→morte→restart, foco restaurado, `aria-live`, orbes `role="meter"`, reduced motion sem animações CSS e dash low/reduced preservando o arco (`fable.md`, `fable-mobile-v3.md`); nota semântica S-04 (abas com `aria-pressed`).
- **Falta:** contraste **medido** (custo de skill em 11 px sobre fundo pintado, tooltips, resumo de morte); zoom 200 %; reduced motion no WebGL/VFX avaliado visualmente (tremor, flashes); auditoria de pistas não-cor (tipos de elite, gelo/stun, telegraphs) e não-áudio (chefe surgindo, vida baixa); `<select>` por teclado.
- **Só o dono:** nada obrigatório pela letra da rubrica. Leitor de tela real não é exigido no texto, mas as evidências antigas o listam como lacuna — e lacuna declarada derruba a nota. Decisão de política: ou o dono faz 5 min de VoiceOver, ou o item sai de `requiredMissing` com justificativa explícita ("fora dos cenários exigidos pela rubrica; não testado").

#### 12) reliability — Reliability
- **Exige:** RL1 todas as suítes no mesmo candidato-fonte; RL2 logs de runtime/recursos limpos; RL3 restart repetido; RL4 persistência de opções; RL5 jogo longo; RL6 recuperação de ciclo de vida sem corromper estado.
- **Já existe:** 4 suítes no candidato atual (16 + 2 + 14 + 11 checks), pacote v5 verificado (`node --check` 95/95, smoke), 6 ciclos de lifecycle sem vazamento de GPU, blur/resume por teclado.
- **Falta:** `npm run verify:all` inteiro em **um** candidato congelado com fingerprint estável; soak (bot 30–60 min no desktop; 4 bots WS por horas medindo memória e tempo de tick); restart ×20; persistência após reload; aba em segundo plano; tempestade de reconexão; causa do timeout de áudio do Aldric; falha histórica 12/13 da suíte de progressão resolvida ou explicada. Observação registrada no fechamento: `window.__zombieNightDebug` segue exposto em produção.
- **Só o dono:** nada.

### 3.3 O que agentes **não** produzem, e o menor checklist do dono

Não produzível por software neste ambiente: (1) gameplay em iPhone/Android físicos; (2) escuta; (3) conforto/latência percebida do toque; (4) aceite perceptivo de arte, VFX, animação e "feel". Agentes podem **preparar** tudo em volta: URL de preview do candidato congelado + QR code, folha de contato e clipes, formulário, e — sugestão pequena — um modo `?qa=<código>` (módulo isolado carregado só com a flag) que grava no aparelho percentis de frame-time, long tasks, trocas de orientação, `env(safe-area-inset-*)`, UA, string do renderer WebGL e estado do `AudioContext`, com um botão "Copiar relatório QA". O `<código>` emitido pelo orquestrador amarra o relatório àquela sessão. Sem esse modo, `?perf=1` (já existente) basta para anotar o FPS.

**Sessão 1 — Celular (≈10 min por aparelho; iPhone/Safari e um Android/Chrome)**

1. Anotar modelo, versão do sistema e navegador. Volume em 50 %, modo silencioso desligado.
2. Abrir o link em **retrato**. Menu → campo de nome: o teclado virtual cobre o botão? a página dá zoom sozinha? → Aldric → jogar.
3. Jogar 3 min: polegar esquerdo move **enquanto** o direito ataca; usar as 3 habilidades; escolher ao menos 1 carta por toque. Anotar o FPS do overlay perto de 1:00, 2:30 e 4:00.
4. Girar para **paisagem no meio da run** e jogar mais 2 min. Algo ficou sob o notch, a barra inferior ou os cantos?
5. Bloquear a tela por 10 s e desbloquear: pausou? voltou sem travar? o som voltou?
6. Pausa → opções → som desliga/liga → "reduzir movimento" → voltar.
7. Morrer, ler o resumo, "Tentar de novo" com a Lyra por 2 min.
8. Ao final: o aparelho está frio, morno ou quente? FPS final? Colar o relatório QA, se existir.

Perguntas (S / N / parcial + uma frase): o som tocou no primeiro toque? moveu e atacou ao mesmo tempo sem falha? algum botão difícil de acertar? conseguiu ler custo e recarga das skills? algo cortado ou sobreposto em retrato? e em paisagem? a rotação quebrou alguma coisa? algum travamento perceptível? as cartas por toque funcionaram e deu tempo de ler? o som no alto-falante do celular distorce?

**Sessão 2 — Escuta (≈10 min, desktop com fones)**

1 min calmo → 3 min de combate denso → cada habilidade 3× (6 skills) → tomar dano e morrer → mute/unmute → recarregar a página (mute e volume persistiram?).

Perguntas: de olhos fechados, distingue golpe de espada, tiro e cada uma das 6 skills? (listar as que confundem); algum som estoura ou distorce?; algo cansa ou irrita após 3 min?; o equilíbrio ambiente × efeitos está bom (1–5)?; dá para perceber de que lado vem o perigo/chefe?; dano recebido e vida baixa são audíveis no meio da horda?; algum som faltando ou atrasado em relação à animação? (o timeout intermitente do Aldric pode aparecer aqui).

**Sessão 3 — Olho e mão (≈10 min, desktop)**

- 5 min jogando (Aldric 2:30, Lyra 2:30). Perguntas: o herói responde na hora ao comando (1–5)?; os golpes têm peso/impacto (1–5)?; no meio da horda você entende o que está te acertando?; a dificuldade dos primeiros 60 s é justa?; as cartas mudam de verdade como você joga?; as duas classes pedem decisões diferentes?
- 5 min com o pacote dos agentes: folha de contato com 12 capturas (arte: algo parece placeholder? clipping? silhuetas claras no combate denso?), 6 clipes de 10 s (VFX: entendi cada skill? vejo o corte do cadáver?), 1 clipe lado a lado de locomoção (vejo pés deslizando? a arma "flutua" na mão?).

**Regras de registro:** as respostas vão para `docs/arpg/aaa-loop/owner-sessions/<data>-<aparelho>.md` escritas ou ditadas pelo dono; o orquestrador as transcreve **literalmente** para a evidência com `source: "owner"`, aparelho, data e candidato; nenhum agente cria ou edita arquivos nessa pasta. Todo "N" ou nota ≤ 3 vira defeito aberto. Antes de aceitar qualquer nota do JEF em `mobile`, `audio`, `art_direction` e `combat_feel`, o dono lê o texto enviado dessas quatro dimensões (5 min): nelas o JEF está apenas lendo as palavras dele. **Tempo total: ~30–40 min por candidato final** (não por tick; fazer só quando os agentes julgarem o candidato pronto).

### 3.4 Como a avaliação atual pode ser "gamed" — e como mantê-la honesta

| # | Brecha no fluxo atual | Por que é real | Contramedida |
| --- | --- | --- | --- |
| A | `coverage: "complete"` é **autodeclarada** no JSON; o código só exige arrays não vazios | todo o caminho para > 9,5 passa por esse campo | cobertura calculada em código a partir de `requiredScenarios` com artefato verificado |
| B | Prosa elogiosa / eco do vocabulário da rubrica | doc oficial: *"text that argues for its own classification, can move the answer"* | lint determinístico (lista de termos proibidos: exceptional, refined, polished, flawless, AAA…; adjetivo avaliativo sem número) + observações estruturadas `{scenario, method, result, limits, artifact}` |
| C | Juiz bajulável sem ninguém perceber | sem controle negativo, nota alta pode ser artefato de redação | **canários por avaliação**: estado "elogioso sem medição" tem de ficar ≤ 5/9 e estado "defeito conhecido" tem de dar `major_defect_absent` < 0,5; senão a avaliação é inválida |
| D | Omissão: não citar defeito/lacuna sobe a nota | 18/09 (menos franca) 4,7–7,2 vs 19/09 (mais franca) 0,1–4,8 com o jogo melhor | defeitos em ledger: só saem com artefato de fechamento; `requiredMissing` derivado do lint, não escrito à mão |
| E | Reconsulta com redação diferente até passar | a política existe só em texto; a ferramenta não impede | ledger append-only por `candidateManifestSha256` + conjunto de hashes de artefatos; conjunto igual → recusa ("reescrever não é evidência nova") |
| F | Rubrica editável | só o hash é gravado | `rubricSha256` aprovada pelo dono fixada no ledger; qualquer mudança exige nova aprovação e re-baseline dos canários |
| G | Artefatos citados nunca são abertos | caminho pode não existir, ser de outro candidato, ou o número citado não bater | verificação de existência/hash/candidato e ponteiros numéricos em código |
| H | `tests` autorrelatado (`every(status === 'passed')`) | basta listar só os que passaram | ler a saída real de `run-quality-suite.mjs` do mesmo manifesto |
| I | Evidência humana escrita por agente | conflito de interesse direto nas 4 dimensões perceptivas | `source: "owner"` obrigatório nos cenários D/H; pasta do dono; leitura final do dono |
| J | Mesmo agente implementa e atesta | viés de confirmação | campos `implementer` e `reviewer` distintos; revisor não participa da correção |
| K | Uma pergunta de Score com até ~25 exigências e um `evidence_complete` com condições negativas encadeadas | anti-padrão documentado ("Hiding several judgments inside one question"; indireção) → confiança 0,63–0,87 | nouls atômicos por requisito |
| L | State único com as 12 dimensões + blobs (coordenadas, arrays de waypoints) | "context rot" documentado | um request por dimensão, só campos necessários, caminhos entre crases |
| M | Texto comprimido ("Historical04:00", "notasaceitasnull") e mistura de idiomas | leitor literal, inglês primário | inglês simples, um fato por observação, números acompanhados de balde semântico |
| N | Limiar fino sobre média de calibração fraca | doc: níveis do Score têm calibração numérica fraca | aprovar com margem: score/10 > 9,5 **e** P(nível ≥ 8) ≥ 0,95 |

### 3.5 Mudanças recomendadas no fluxo atual (em ordem)

1. **Dono confirma o alvo (> 9,5) e a política de Android/leitor de tela**; alinhar rubrica, `quality-gates.md` e teste de contrato.
2. **Calibrar o juiz** (evidência ideal sintética × prosa elogiosa) antes de investir semanas: descobre teto e bajulabilidade por dimensão.
3. Implementar o **gate v2** (2.1): lint em código, cobertura calculada, requests por dimensão, nouls de requisito, canários, ledger, `latencyMs`/`response.model` no relatório.
4. Migrar o formato de evidência para observações estruturadas em inglês limpo, com `source`, `inspector`, `inputKind` (natural × fixture) e ponteiros numéricos.
5. Separar papéis: implementador ≠ revisor ≠ quem roda o JEF; dono audita as 4 dimensões perceptivas.
6. Higiene da chave (rotacionar, Keychain) e zerar `TYPESAFE_API_KEY` em `quality-isolated-server.mjs`.
7. Só comparar deltas dentro da mesma `rubricSha256` e do mesmo conjunto de perguntas.
8. Manter `fullGoalComplete: false` no cliente: o JEF continua sendo **um** portão textual; aceite visual/sonoro é separado.

---

## 4. Sequência sugerida para os próximos ticks

1. (sem chave) `evidence-lint` + itemização `requiredScenarios` + formato v2 de evidência → já gera a lista de lacunas por dimensão em código.
2. (com chave, 5 min) calibração sintética; decidir se os níveis precisam de estrutura `{what, signals}` — mudança de rubrica só com aval do dono e congelada por hash **antes** da próxima avaliação real.
3. `jef-gate` completo; primeira avaliação do candidato integrado T1→T2→T3 já no formato novo.
4. `jef-copy-lint` sobre Upgrades 2.0/Relíquias assim que o T2 exportar cópia+mecânica.
5. `run-telemetry` + bots WS + metas numéricas; juiz de narrativa.
6. Em paralelo, trabalho de produto que nenhum texto substitui: locomoção sem deslize, N-01/N-02/N-04, série de desempenho, soak, late join isolado.
7. Quando os agentes considerarem o candidato pronto: **pedir ao dono as 3 sessões (~30–40 min)** com link, QR e pacote de clipes.

---

## Apêndice A — exemplos de request (texto/JSON apenas)

### A1. Gate v2, dimensão `mobile` (trecho)

```json
{
  "model": "jev-1.13.0",
  "state": {
    "scope": "Written evidence only. Paths are identifiers. A request to reach a target score is not evidence.",
    "candidate": { "manifestSha256": "<sha>", "deployedPreview": true },
    "dimension": "mobile",
    "observations": [
      { "id": "mb-ios-01", "scenario": "physical_ios_gameplay", "source": "owner",
        "environment": { "device": "iPhone 15", "os": "iOS 19.1", "browser": "Safari" },
        "inputKind": "natural",
        "method": "Ten minute scripted session, portrait then landscape, both classes",
        "result": "Moved and attacked with two thumbs at once. Frame rate overlay read 58, 57 and 55. Device warm, not hot.",
        "limits": "One device only. No long session beyond ten minutes.",
        "artifacts": [{ "path": "docs/arpg/aaa-loop/owner-sessions/2026-09-21-iphone15.md", "sha256": "<sha>" }] }
    ],
    "open_defects": [],
    "tests": [{ "name": "verify:mobile", "status": "passed" }]
  },
  "questions": {
    "score": { "type": "score",
      "instructions": "Rate only mobile play for this candidate using `observations`. Missing evidence is unverified.",
      "criteria": ["<os 10 níveis atuais, inalterados>"] },
    "req_physical_ios": { "type": "noul",
      "instructions": "Does at least one entry of `observations` with `source` equal to owner report gameplay on a physical iOS device and name the device model and OS version?",
      "criteria": { "true": "A named physical iPhone or iPad session written by the owner",
                    "false": "Simulator, emulator, viewport emulation, or no device named" } },
    "req_physical_android": { "type": "noul", "instructions": "Same condition for a physical Android device." },
    "req_touch_move_and_fire": { "type": "noul",
      "instructions": "Does `observations` report moving and attacking at the same time with real touch input?" },
    "req_orientations_safe_area": { "type": "noul",
      "instructions": "Does `observations` report portrait, landscape and compact layouts with safe areas checked on a physical device?" },
    "req_thermal_sustained": { "type": "noul",
      "instructions": "Does `observations` report frame rate and device temperature after at least five minutes of continuous play on a physical device?" },
    "lint_unbacked_praise": { "type": "noul",
      "instructions": "Does any `observations[].result` assert quality without a measurement or a directly observed behaviour?" }
  }
}
```

### A2. Lint de cópia, uma carta real (`soulMagnet`)

```json
{
  "model": "jev-1.13.0",
  "state": {
    "card": { "id": "soulMagnet", "label_pt": "Ímã de Almas", "rarity": "rare", "class": "both",
              "description_pt": "A cada 18s puxa cristais de XP próximos para você." },
    "mechanics": { "effects": [
      "Every 18 seconds at one stack, 14 seconds at two stacks, pulls experience crystals to the player",
      "Pull radius is 25 meters at one stack and 32 meters at two stacks" ] },
    "glossary": { "experience": "XP", "stack": "pilha", "boss": "chefe", "run": "partida" }
  },
  "questions": {
    "contradicts_mechanics": { "type": "noul",
      "instructions": "Does `card.description_pt` promise an effect or a number that `mechanics.effects` does not support?" },
    "omits_effect": { "type": "noul",
      "instructions": "Does `mechanics.effects` list a player relevant effect or number that `card.description_pt` does not mention?" },
    "mixed_language": { "type": "noul",
      "instructions": "Does `card.description_pt` use an English word where `glossary` gives a Portuguese term?" },
    "clarity": { "type": "score",
      "instructions": "How well would a new player understand what changes after reading `card.description_pt`?",
      "criteria": ["Cannot tell what the card does",
                   "Knows the general effect but not when or how much",
                   "Knows the effect and either the timing or the amount",
                   "Knows the effect, the timing and the amount"] }
  }
}
```

### A3. Juiz de narrativa de run (laboratório)

```json
{
  "model": "jev-1.13.0",
  "state": {
    "class": "warrior", "pilot": "naive automatic policy, not a human",
    "timeline": [
      "0:04 seven enemies alive, health full",
      "0:12 eighteen enemies alive, player surrounded, health three quarters",
      "0:20 twenty six enemies alive, health critical, all three skills on cooldown",
      "0:24 player died at level one before any upgrade was offered"
    ],
    "buckets": { "time_to_first_upgrade": "never", "time_below_30_percent_health": "most of the run",
                 "resource_was_limiting": "no", "main_damage_source": "basic zombies in melee" }
  },
  "questions": {
    "early_fairness": { "type": "score",
      "instructions": "How fair do the first thirty seconds in `timeline` read for a new player?",
      "criteria": ["Player is overwhelmed before receiving any tool",
                   "Player survives only by luck or perfect play",
                   "Pressure is high but the player has tools to answer it",
                   "Pressure builds gradually and each threat arrives after a tool to handle it"] },
    "death_attribution": { "type": "score",
      "instructions": "How clearly does `timeline` show what killed the player and what could have prevented it?",
      "criteria": ["No identifiable cause", "Cause identifiable, no available counter",
                   "Cause identifiable and one counter was available", "Cause and several counters are evident"] }
  }
}
```

### A4. Coach de fim de run (respostas viram frases prontas em pt-BR)

```json
{
  "model": "jev-1.13.0",
  "state": { "class": "dwarf", "survival": "short, under one minute", "level_reached": "two",
             "main_damage_source": "runners in melee", "skills_used": { "frost": "never", "gravity": "once", "cannon": "often" },
             "upgrades_taken": ["pickup radius"], "movement": "mostly standing still", "health_trend_before_death": "fell fast while surrounded" },
  "questions": {
    "main_cause": { "type": "choice", "instructions": "What most likely caused this death?",
      "criteria": { "surrounded_no_escape": "Encircled with no mobility or crowd control used",
                    "ignored_crowd_control": "Had freeze, stun or pull available and did not use it",
                    "weak_build": "Took upgrades that add no damage or survival",
                    "stood_still": "Did not reposition while enemies closed in",
                    "boss_burst": "Killed mainly by a boss or elite",
                    "none_clear": "No clear single cause" } },
    "tip_use_frost_when_surrounded": { "type": "noul",
      "instructions": "Would using the freezing shot when surrounded have clearly helped in this run?" }
  }
}
```

Cliente: `main_cause = ignored_crowd_control` com `confidence ≥ 0,6` → exibe a frase pronta "Você morreu cercada com o Disparo Glacial livre. Congele a horda e abra distância." Caso contrário, dica genérica determinística.

---

## Apêndice B — Fontes

Documentação oficial (todas HTTP 200 em 2026-09-19): [índice llms.txt](https://docs.typesafe.ai/llms.txt) · [API](https://docs.typesafe.ai/api) · [Models](https://docs.typesafe.ai/models) · [State](https://docs.typesafe.ai/concepts/state) · [System One](https://docs.typesafe.ai/concepts/system-one) · [How to build](https://docs.typesafe.ai/concepts/how-to-build-with-system-one) · [Use-case map](https://docs.typesafe.ai/concepts/use-case-map) · [Primitives](https://docs.typesafe.ai/primitives) · [Choice](https://docs.typesafe.ai/primitives/choice) · [Score](https://docs.typesafe.ai/primitives/score) · [Noul](https://docs.typesafe.ai/primitives/noul) · [Advanced structure](https://docs.typesafe.ai/primitives/advanced) · [Confidence](https://docs.typesafe.ai/confidence) · [Patterns](https://docs.typesafe.ai/patterns) · [Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13) · [Parallel questions](https://docs.typesafe.ai/cookbooks/parallel_questions) · [Self-consistency nouls](https://docs.typesafe.ai/cookbooks/consistency_noul_cookbook) · [Citation check](https://docs.typesafe.ai/cookbooks/citation_check) · [Guardrails](https://docs.typesafe.ai/cookbooks/llm_guardrails) · [Autoresearch](https://docs.typesafe.ai/cookbooks/autoresearch_feature_discovery) · [JS SDK](https://docs.typesafe.ai/sdk/javascript) · [Agent skill](https://docs.typesafe.ai/agent-skill) · [Migrating to v1](https://docs.typesafe.ai/migrating-to-v1) · [Legal](https://docs.typesafe.ai/legal) · [AI primer](https://docs.typesafe.ai/introduction/machine-learning-primer)

Blog oficial: [Introducing System One Models & Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev). Skill pública: [SKILL.md](https://github.com/typesafe-ai/skills/blob/main/skills/typesafe-ai/SKILL.md). Secundária, não verificada: [OpenRouter — Jev 1.13](https://openrouter.ai/typesafe/jev-1.13).

## Apêndice C — Arquivos do repositório consultados

`tools/evaluate-jev.mjs`, `tools/verify-evaluator-contract.mjs`, `tools/verify-natural-runs.mjs`, `tools/quality-isolated-server.mjs`, `docs/quality-rubric.json`, `docs/quality-gates.md`, `docs/quality-evidence.template.json`, `docs/quality-evidence.arpg-visual-polish.json`, `docs/jef-*.md`, `docs/audio-review.md`, `output/qa/aaa-20260919/jef-diagnostic-v1/{state,report}.json`, `docs/arpg/aaa-loop/LOOP-STATE.md`, `docs/arpg/goal-production-20260919.md`, `docs/arpg/gui-ios-safari-v1.md`, os 28 relatórios de `docs/arpg/aaa-20260919/` (títulos e seções de todos; leitura integral de `fable-closeout`, `orchestration-status`, `fable-natural`, `fable-mobile-v3`, `coordinator-audio`, `coordinator-review-v3` e trechos de `fable`, `grok`, `grok-native-v4`, `astra-dash-native-v2`, `astra-integration-promotion`, `fable-touch-polish`), `server.mjs`, `src/progression/authority.mjs`, `src/combat/class-skills.mjs`, `src/ui/arpg-hud.js`, `src/main.js` (`upgradeDefinitions`, `endGame`, `startNextWave`, `getZombieSpawnInterval`, `?perf=1`), `render.yaml`, `vercel.json`, `.vercelignore`, `.gitignore` (de `.env` só os **nomes** das variáveis foram lidos).
