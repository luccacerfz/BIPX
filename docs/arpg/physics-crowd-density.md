# Physics — custo de horda densa, candidato isolado

## Promoção autorizada — 03:27 UTC

**Contacts912c promovido e congelado; fonte liberada a Combat.** Aceite explícito [Root](review/crowd-density-native-followup.md) e [janela Combat](combat-density-integration.md) conferidos após encerramento VFX/Environment. Baseline290a arquivado antes da troca atômica; runtime agora **912c00fe18457ac0951812d31a6215bbff1cb01b05e9fae619e8aa2cbe4db6d4**, exato candidato aprovado. [Recibo](../../output/physics/crowd-density-promotion-20260919/2026-09-19T03-27-06-354812Z/receipt.json), cópias290a/912c, aprovações e manifestos215 antes/depois preservados no mesmo diretório.

Única fonte alterada: `src/physics/contacts.mjs`. Mainf4dfc154/server29bb/layout143/nav911e0/styles8ede/arte permaneceram iguais. Sintaxe do candidato/runtime e importação/API pública passaram; oito exports inalterados, sem novos hooks. Lock de janela adquirido atomicamente e liberado ao terminar. Servidor5173 PID18430 e hash do ledger preservados; nenhum restart ou novo A/B. Combat fará QA integrada isolada/source binding e restart coordenado. O backend em execução ainda precisa desse restart para carregar o novo módulo.

Os custos e a paridade abaixo continuam sendo evidência do A/B anterior em main455; não são um novo teste do mainf4 nem resolvem camping/natural/mobile/soak/rede/AAA. Nenhuma próxima escrita runtime Physics prevista. As seções abaixo conservam os estados históricos, inclusive o marco pré-promoção.

## Entrega atual143 — A/B nativo concluído, sem promoção

**Seis capturas PASS,215 fontes estáveis e idênticas ao freeze GUI de Combat.** Evidência: `output/playwright/2026-09-19T03-09-55-010Z-native/density-native143.json`; pacote/harness/QA em `output/physics/crowd-density-native-143-20260919/`. GPU adquirida atomicamente após liberação explícita Combat/Animation e liberada em finally. Browser e servidor efêmero próprios encerrados; servidor5173 preservado. **Contacts runtime continua290a; candidato912c não promovido.**

As duas variantes usaram, por bytes, o mesmo main **455addd3b7d9b22e82852ca74426327f8f9748b65f50d0c4d9c15cf6a8a11af4**, styles **8ede8bb92ae3a92e3a8b5d80e4d3701bf2c49e7b6e562b732286f4d5ed015fc0**, layout143 **8e756fe4022c7916074220d44c0ff605aa8fdc9d80fdf6c61d8a03fb475fc8a7** e navigation **911e0ea2e29bf4b937e8a9174b897d9bc8b197bab0de681e4c9a4f50af6d65d0**. O diretório `served-common/` arquiva os módulos/UI usados; assets/vendor foram verificados por hash antes/depois. Só a resposta HTTP de contacts varia290a↔912c. Main recebe o mesmo apêndice de fixture/medição, sem alterar o corpo de updateZombies; todos os hashes servidos estão nos reports.

### Resultado nativo

Chrome real, visible/headlessfalse, high1280×720, GPU Apple observada na telemetria.120/400 walkers, velocidade3.3, mesmo spawn determinístico no mapa143, controles iniciais freeze/stun6s, saúde elevada, tiros básicos/spawns novos desativados pela fixture. `perfStressImmortal=false`; IA, movimento, index/update, crowd, ataques inimigos, apresentação e render reais continuam ativos. Não é partida natural.

| Atores | Execução | P95 updateZombies | P95 frame | FPS / throughput | Passos totais/medidos |
|---|---|---:|---:|---:|---:|
|120|Baseline290a livre|3.100ms|7.800ms|142.58 FPS|1631/1426|
|120|912c mesmos passos|1.500ms|7.700ms|142.87 throughput|1631/1426|
|120|912c livre|1.600ms|7.900ms|142.48 FPS|1631/1426|
|400|Baseline290a livre|17.500ms|21.000ms|66.01 FPS|790/661|
|400|912c mesmos passos|6.900ms|10.600ms|116.01 throughput|790/661|
|400|912c livre|5.900ms|9.800ms|117.80 FPS|1359/1179|

Baseline400 **reprova P95<=20ms**; candidato400 livre passa os limites originais57FPS/P95<=20, nesta fixture curta. A leitura causal com **os mesmos passos** reduz P95CPU120 em51.61% e400 em60.57%. A medição livre do candidato tem cadência/dt próprios; não alegar que seus1359 passos são a mesma trajetória dos790 do baseline.

Livre: aproximadamente10s medidos depois de1.5s de aquecimento (intervalos9.994–10.001s). Reprodução pareada: mesmos1631/790 dt, fases de renderer, contagem e planos, com **estado completo inicial/final de atores e vida do player exatamente igual no Chrome**, sem tolerância. Os790 passos de400 simulam11.4854s em ambas as variantes; o trecho medido do candidato é executado em5.6893s de parede. Seus116.01 são throughput de reprodução, **não uma partida natural em velocidade de relógio**. A execução livre117.80FPS é a prova nativa separada.

Timer envolve a função real completa: criação do índice dinâmico por tick, atualizações imediatas, status, steering, navegação, sweeps, crowd e efeitos chamados pelo update. Não há peersO(N²), análise geométrica, tracing, hashing ou serialização de atores dentro do timer. Registros leves dt/fase/count/plans ficam após o timer; screenshots e comparação de estados ficam fora do intervalo. O índice estático do candidato é criado uma vez no carregamento do mundo, fora da janela de custo por frame; não anunciar estes números como latência de inicialização.

Todos os casos mantiveram contagem exata, índice descartado ao fim, controles expirados pelo tick real, max4 planos/tick, zero invisíveis e overlap final0. Dois PNGs400 finais foram inspecionados: horda/ambiente/HUD renderizados. Capturas e vídeos completos preservados; isso não é revisão de animação/áudio/AAA.

### Prova CPU separada e limites

Geometria dependente do143:9/9 conforme checkpoint abaixo. Replay literal CPU atualizado usa o main servido455addd3, dados iniciais/damage reais, dt e fase de renderer **gravados**, e cadência real de ensure/rebuildSpatialGrid antes/depois do update. `2026-09-19T03-13-30-817Z-replay-audit143.json`: **2/2/sourceStable**,2421 frames pareados exatos, **2426530 segmentos** com hashes iguais e pico transitório0, controle0m, max4 planos/tick.120:627446 segmentos/3299 planos;400:1799084 segmentos/3058 planos. Auditor analítico pesado executado somente depois de liberar GPU, separado de todas as medições nativas.

Checagem adicional Node↔Chrome: mesmas estruturas/estados discretos, mas não bit-idêntica numericamente. Máximo absoluto final120 **4.440892e-16** em yaw;400 **2.087896e-7** em yaw. O report conserva essas diferenças sem usá-las como tolerância para o A/B: **CPU baseline/candidato e browser baseline/candidato continuam exatos dentro de cada engine**. Primeira tentativa exigiu igualdade também entre engines e falhou; script/report03:11:53/log preservados. A versão final separa esse diagnóstico de interoperabilidade dos gates A/B e geométricos, sem mudança de runtime ou afrouxamento de contato.

Limites: uma rodada nativa serial, ordem baseline→matched→free por população, sem alternância/replicações estatísticas. Não é mobile, soak, rede ou natural60s; não fecha o cenário original dwarf0XP/P9520.9. A prova138 anterior continua histórica. O [diagnóstico inverso de camping](physics-navigation-pocket.md) é outra frente, com72 cenários reais de caller/raio; não integra planner novo nem altera a geometria deste A/B.

**Handoff a Combat/Root:** candidato912c liberado para revisão do novo gate nativo e decisão coordenada; API/patch anteriores intactos. Nenhuma próxima escrita runtime prevista e nenhuma reservaGPU retida. Não promover automaticamente a partir deste report.

**Retomada143,02:54UTC — preparado, GPU pendente de coordenação.** Novo pacote `output/physics/crowd-density-native-143-20260919/` conserva baseline290a/candidato912c, ambos navigation911e0ea2/layout143. Gate geométrico atual9/9: layout7/7 (`layout-qa/2026-09-19T02-53-16-569Z/`) e comparação estática2/2 (`2026-09-19T02-53-16-690Z-geometry143.json`), fontes estáveis. Foram6135 sweeps e2500 movimentos/11448segmentos exatos; matrizes independentes da geometria não repetidas.

Janela solicitada a Combat por mailboxOrca `msg_1c6147c5ec3c` após recusa da filaCodex lotada; Animation recebeu a ordem de sequência existente, sem interrupt. Captura prevista somente depois de ambos liberarem e sob lock próprio atômico. Nenhuma promoção de contacts ou restart5173.

Harness `native.mjs` reutiliza Playwright/telemetria/servidor efêmero do projeto. Fixa por bytes os mesmos módulos do cliente; única variante servida é contacts. Para120/400: baseline nativo livre11.5s, candidato reproduzindo exatamente a sequência baseline de dt/fase de renderer e candidato livre11.5s. Livre mede10s após1.5s de aquecimento; replay usa os mesmos índices de passos de aquecimento/medição e reporta separadamente throughput de reprodução. IA, index/update, movimento, crowd e render reais continuam ativos, velocidade3.3, saúde alta e controles iniciais6s declarados como fixture. Sem auditoria geométrica/serialização de estado dentro do timer. Estado completo de atores inicial/final e sequência de dt/fase/planos serão comparados fora da medição; replayCPU de todos os segmentos será evidência separada. Não confundir throughput pareado com FPS natural/mobile/soak. Estes são critérios preparados, ainda não resultados nativos.

**Candidato contacts912c pronto para A/B nativo coordenado; não promovido.** Arquivo `output/physics/crowd-density-20260919/candidate/contacts.mjs`, SHA256 **912c00fe18457ac0951812d31a6215bbff1cb01b05e9fae619e8aa2cbe4db6d4**. Runtime permanece **290a3f35b23e00ff86dcb5dad6911c5e8dfbda0b517cba4e7a63a02b69f07a80**. Main/server/helper intocados. API/imports inalterados.

**Escopo histórico explícito:** toda medição abaixo usa snapshot138, layout `987487e1fedd025da3615d3cc07ce9b5621e778d39c21939f9ac53dc6bbe577c`. Environment promoveu143 depois; não estender esta prova ao cenário atual. Root aceitou o diff para próxima comparação, [sem autorizar promoção](review/crowd-density-followup.md). Prioridade seguinte passou ao [conector inicial de navegação143](physics-navigation-connectors.md); nenhuma GPU solicitada/usada nesta etapa.

## Perfil causal

Replay CPU reconstrói entradas nativas de `output/playwright/2026-09-19T02-13-41-998Z-verify-crowd-gameplay/crowd-gameplay.json` e extrai literalmente `updateZombies`/hooks da fonte main `10bc061d`. Perf usa índice real por tick e updates imediatos; não materializa `peers()` fora de auditoria. O número antigo01:58 com cópiasO(N²) não é baseline desta comparação.

Perfil V8 de400: `sweepStatic`29.63% e `deepest`21.84% do self time amostrado (**51.47%**); ambos repetem scan de138 sólidos durante iterações de movimento/contato. `pairs`4.10%, query dinâmica4.08%, GC2.90%, sweepBodies2.86%. Perfis e agregação em `baseline-400.cpuprofile`, `candidate-400.cpuprofile` e `profile-summary.json`.

Tempos diagnósticos agregados de759ticks: index build118.27ms/update171.91ms; movimento3755.18ms; navegação1849.81ms; crowd1059.18ms; steering262.13ms. Query dinâmica465.46ms está contida no movimento: não somar como etapa independente. Movimento médio cresce1.974ms/tick (0–2s)→9.267ms (9–12s), enquanto crowd1.422→1.280 e build.162→.150. Convergência da horda, expiração de controles aos6s e dt variável coexistem; não atribuir isoladamente toda a curva à densidade.

Contagens diagnósticas idênticas A/B:759 índices/crowd,257991 movimentos/updates,257583 chamadas de navegação,1785389 queries,16943519 vizinhos retornados,2836 planos/máximo4 por tick,49 eventos de dano. Instrumentação usada apenas para diagnóstico, desligada no replay cronometrado.

## Mudança pequena

Patch `contacts-static-index.patch`:42 adições/3 remoções sobre290a, aplicado/verificado apenas em cópia própria. WeakMap privado indexa os mundos imutáveis produzidos pela API, cell8m, uma vez na construção. Consulta estática deduplica e ordena pelos ordinais originais; preserva ordem de empate e todos os testes exatos AABB/altura/flags/forma.

Mundos estrangeiros, menos de16 sólidos, índice maior4096 entradas, coordenadas de célula fora de inteiros seguros ou consulta maior16 células usam scan integral. Cache privado da última região, sem alteração da interface pública. Mudam apenas os candidatos de `sweepStatic`/`deepest`; raios, corpos, contatos, narrow phase, dt, subpassos, navegação, ordem, massas e controles continuam iguais.

Perfis diagnósticos precederam guards finais de inteiros seguros; `profile-candidate-contacts.mjs`/`profile-replay.mjs` preservam aquela versão. Números comparativos e QA abaixo usam **912c final**, não o candidato diagnóstico.

## Replay pareado inclusivo

`2026-09-19T02-27-26-437Z-paired-replay.json`: quatro ensaios, ordem alternada A/B; **9648 frames com estado idêntico**, fonte estável. Sem profiler, auditoria ou arrayspeers no timer. Custo inclui índice/update, IA/steering, navegação, sweep e crowd literais. Snapshot de atores e comparação de estados ficam fora do timer.

| Atores | Amostras medidas | P50 CPU baseline→candidato | P95 CPU baseline→candidato | Máximo CPU baseline→candidato | Redução P95 |
|---|---:|---:|---:|---:|---:|
|120|5696|2.358→1.403ms|2.978208→1.762125ms|5.393→3.115ms|40.83%|
|400|2472|9.382→5.576ms|15.768125→7.948583ms|22.924→10.138ms|49.59%|

Incluindo todos os frames de aquecimento e criação do mundo:120 total15205.107→9132.930ms;400 total31464.943→17387.764ms. Construção por ensaio120 baseline [.156416,.143791,.344250,.102250]ms/candidato [.150416,.135417,.168042,.127958];400 baseline [.110833,.137292,.149375,.150167]/candidato [.107667,.131416,.124333,.134709]. O relatório retém distribuição/raw por ensaio e aquecimento; não inferir ganho da variação mínima de init.

Limites: reconstrução usa posições iniciais e sequência completa de dt nativos, mas renderer.frame e navigationTick começam em0 porque a fase inicial não foi gravada. Usa Vector3 real e funções literais; saídas de apresentação/dano são sinks, sem render/áudio/rede. É equivalência entre duas execuções CPU com mesmas entradas, não replay exato de todos os estados nativos e **não é FPS**.

## Geometria e regressões

**55 grupos PASS**, fontes estáveis: geometria5 + solver22 + v2 12 + hooks/crowd16. `2026-09-19T02-29-08-095Z-geometry.json` verifica12270 sweeps estáticos exatos,2500 movimentos/steps e10539 segmentos,18 fallbacks, e replays integrais120/400. Nestes, **2428642 segmentos com hashes iguais e pico transitório0**, posições iniciais válidas, deslocamento controlado0 e máximo4 planos/tick. Auditoria analítica de segmento independente do índice; não esconde pico pela posição final.

Regressões preservam freeze/stun10corpos/3s/10–20–60Hz, pull explícito, resistência boss.35, paredes/bounds, expiração sem rewind, spawn/indexupdates. Recuperação de entradas já inválidas mantém limite declarado anterior: pack .300 inicial, pico .7210067955 e final .001; máximo passo .34605756. Não prometer pico0 para inicialização inválida.

Cópias byte-idênticas dos três reports e sua procedência ficam em `qa-reports/`. A ferramenta isolada de integração herdou saída `output/qa/arpg-crowd-integrated-20260919/2026-09-19T02-29-08-071Z/`; esse relatório é **staging912c/layout138**, não validação do runtime290a. Original preservado. Perf daquele medidor foi desabilitado; o novo custo vem do replay literal acima.

## Próximo gate e propriedade

Baseline nativo histórico continua400 P95frame21.6ms/P95CPU18ms, reprova orçamento20ms apesar de61.75fps médios. CPU912c não resolve esse gate por declaração. Próximo A/B nativo deverá fixar ambiente comum143 (ou138 explicitamente histórico), conservar atores/dt/controles/IA e incluir custo real de índices, com GPU serial coordenada. Confirmar cantos/porta/vigas143 antes de qualquer promoção; navegação isolada atual não substitui QA de contacts912c nesse layout.

Não houve GPU, restart5173, novo agente ou edição de runtime nesta frente. Baselines, candidato anteriorbce8ee0, otimização290a e evidências anteriores preservados. Combat mantém main/server/helper; nenhuma integração API adicional necessária para912c. Manifest e patch publicados no diretório do candidato.
