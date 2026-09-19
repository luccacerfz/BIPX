# Astra6 — revisão inicial da integration-v3

**Aprovação focal CPU da montagem inicial: nenhum defeito prioritário encontrado nos seis componentes solicitados.** Canopy, loot-label-v2, Fable Option A, área, dash e Grok network v3 coexistem no snapshot verificado, sem perda identificada dos comportamentos testados ou dos imports. Esta revisão não promove arquivos e não aprova AAA, GPU, gameplay nativo, áudio, ranking ou produção.

Task `task_ecdbf53ca76a`, dispatch `ctx_b4869629e631`. **Ordenação/TTL de snapshots de Grok7 está fora da aprovação inicial**, conforme o preâmbulo; o coordenador fará a revisão incremental. A interpolação temporal não está neste candidato e não foi retomada. A negativa Astra5 e as fontes posteriores não avaliadas permanecem intactas.

## Identidade da versão

Li `output/qa/aaa-20260919/integration-v3/assembly.json` e copiei os **244 arquivos** para `output/qa/aaa-20260919/astra-integration-review-v1/snapshot/`. Hashes da origem antes/depois da cópia, da cópia e de `assembly.currentSources` coincidem. A conferência final não encontrou mudança no snapshot, na integration-v3 nem nos caminhos correspondentes do runtime vivo.

| Arquivo principal | SHA-256 aprovado neste escopo |
| --- | --- |
| `src/main.js` | `cb1e551738f1de27bac7979c3f72fcb157e76a3f99a1d5ec9b765e8973a6632d` |
| `server.mjs` | `bcbeb948a8b292559c9daed87a6a0e42caba8fde620efe0f53b2ee84b10a5131` |
| `src/combat/class-skills.mjs` | `058bda880930384a6a5baa210905ab2be52e38d3f88f435ed41824fc3872406d` |
| `src/vfx/class-skill-vfx.js` | `88835357241b2bb559c2a899ec487b15d94cfe8e339e28aaef812578ad77779b` |
| `src/vfx/projectile-origin-bridge.js` | `81fcaca6f9d293f6c7c085e173d7c2a162f70b852459398c3aa9e7e44425ad19` |

O manifesto de montagem ainda diz `frozen:false`, `runtimePromoted:false` e `assembly_pending_grok_fable_astra_loot`; isso é metadado de montagem, não evidência de perda dos patches: `currentSources` corresponde exatamente ao candidato efetivamente revisado. Esta aprovação acompanha os hashes, não futuras alterações desse diretório.

## Diferenças contra o runtime vivo

**16 caminhos diferentes: 11 modificados e 5 novos.** Os outros 228 arquivos do candidato são idênticos aos caminhos vivos. A comparação cobre o conjunto de entrega da montagem; não recomenda excluir arquivos vivos ausentes dele.

| Estado | Arquivos |
| --- | --- |
| Novos | `src/ui/world-label-layout.js`; `src/combat/network-move.mjs`; `src/render/environment-actor-focus.js`; `src/vfx/dash-vfx.js`; `src/vfx/projectile-origin-bridge.js` |
| Modificados — entrada/UI | `index.html`; `styles.css`; `src/main.js`; `src/ui/arpg-hud.js` |
| Modificados — autoridade | `server.mjs`; `src/combat/class-skills.mjs`; `src/progression/authority.mjs` |
| Modificados — render/VFX | `src/render/environment-cutaway.js`; `src/render/asset-dressing.js`; `src/vfx/class-skill-vfx.js`; `src/vfx/cannon-origin-bridge.js` |

Hashes completos de ambos os lados estão em `snapshot-manifest.json`; os 16 diffs legíveis estão em `evidence/live-*.diff`, dentro de `astra-integration-review-v1`.

## Evidência de coexistência

| Componente | Verificação na cópia combinada | Resultado |
| --- | --- | --- |
| Canopy | Os três módulos são byte-idênticos ao candidato Astra canopy; contrato de quatro atores, fade, viewport, remoção/reconexão e uniforms compartilhados de cor/depth | **8/8** |
| Loot-label-v2 | Módulo byte-idêntico ao candidato aceito; posições estáveis em 120 frames de bob/pulse, crowding de 30 drops, offscreen, descarte do leader e hide/resume; funções de update/remoção do main preservadas literalmente | **5/5** |
| Fable Option A | Presenter literal da integração + core real + buffers `aStyle`/`aOrigin`; dois projéteis, 12 cenários, quatro taxas e dois modos; ausência de corpo antes da boca, terminais e guardas; canhão comparado por 90 passos | **192/192**, autoridade e canhão invariantes |
| Dash | Presenter/mapeamento/remote mixer literais do main + Three hierarchy/mixer + wrapper/pool reais; local/remoto high/low-reduced, atualização entre eventos, cauda terminal, cancelamento, pausa e desconexão | **7/7** |
| Área | Seis skills equivalentes no baseline sem bônus; raio/vítimas por stacks, sólidos, boss, lanes, multiplicador congelado no cast, intent hostil, snapshots e HUD | **7 grupos passam** |
| Grok network v3 | Normalização literal do servidor rejeita posição forjada sem posição resolvida; preserva dois call sites; snapshots reconstroem raio sanitizado; orçamento de movimento real + colisão | **3 suítes passam** |
| Imports/montagem | Link do grafo principal por `vm.SourceTextModule`, sem avaliação; sintaxe de todos os JS/MJS do candidato; ordem do frame e comparações literais | **87 módulos, 122 imports, 98 módulos com sintaxe válida, 0 módulos executados no linker** |

Os harnesses existentes foram copiados para a pasta própria e adaptados apenas nos caminhos de import, saída e manifesto de integridade da nova cópia. `harness-provenance.json` contém origem, hashes e diffs dessas adaptações; as asserções de comportamento originais foram preservadas. A primeira adaptação excessivamente ampla gerou erros de caminho/label no harness e foi corrigida antes das execuções válidas; detalhes em `evidence/adapter-retry-note.txt`. Esses erros não foram classificados como defeitos do produto.

As suites são CPU e usam fixtures sintéticas; a suite Option A mantém os observadores de chamadas de trilha do contrato existente. Buffers/mixers reais e contratos CPU não substituem rasterização ou observação de uma partida. Nenhuma nota visual foi inferida desses resultados.

## Pontos de junção revisados

No `snapshot/src/main.js`, o frame executa `updatePowerups` (linha 6003), atualização multiplayer (6035), câmera (6039), mixer local (6046), sockets do dash (6048), canopy (6052), layout de loot (6057), VFX (6067) e render (6076). O layout roda depois da animação decorativa dos drops e antes do render, fora de `game.labelFrameReady`; não reaparece a sobrescrita de posição que motivou loot v2. A chamada do canopy preserva `skillAreas`, `remotePlayers.values()`, `camera` e `dt`.

As seis funções do presenter/tracking/mixer remoto do dash e quatro funções de update/remoção do loot foram comparadas literalmente com seus candidatos aceitos. O módulo `dash-vfx.js` e o bridge final Option A são byte-idênticos aos respectivos proprietários. A integração não contém `visualActive`, `pendingTo` ou `stepVisual`, portanto o risco de ressuscitar corpo por interpolação descrito em Astra5 não foi introduzido nesta montagem.

O `server.mjs` é exatamente Grok network v3 **mais** a atribuição de `areaMultiplier` derivada de `attackStats(client.progression)` após o spread do estado. Isso mantém a correção de posição resolvida e impede o cliente de sobrepor a área com seu estado. O core acrescenta a Fable área a serialização/restauração de casts ativos já existente; sete funções de cálculo/aplicação/evento/HUD permanecem idênticas às da Fable área. Os testes de snapshot confirmam a sanitização, inclusive valores hostis e legado.

O orçamento de movimento aceita 1,1 m em 220 ms, aceita **0 m em 100 pacotes no mesmo timestamp**, limita um intervalo de 1 s a 250 ms de crédito e para a posição em **X=0,50999** no teste de parede. O teste da normalização conserva a negativa v2 de X=40 m e confirma a versão combinada em X=0 sem posição resolvida ou X=1,1 com a posição resolvida fornecida pelo servidor.

## Artefatos e reprodução

Raiz: `output/qa/aaa-20260919/astra-integration-review-v1/`.

- `evidence/review-summary.json`: resultados e lista de arquivos alterados.
- `snapshot-manifest.json`, `assembly-snapshot.json`: identidade da entrega e do runtime de comparação.
- `evidence/assembly-check.json`: imports, ordem do frame, equivalência de funções e integridade final.
- `cpu-results.json`, `cpu-contract.json`, `cpu-integrated.json`: canopy, loot e dash.
- `cpu-2026-09-19T10-40-58-921Z.json`: os 192 casos Option A e regressão de canhão.
- `evidence/verify-area-cpu.json`, `cpu-calls.json`, `cpu-area-snapshot.json`, `cpu-dt.json`: área e rede.

Da raiz de artefatos: `node test-canopy.mjs`, `node test-loot.mjs`, `node test-pointblank.mjs`, `node tools/test-dash.mjs`, `node test-network-calls.mjs`, `node test-network-area.mjs`, `node test-network-dt.mjs`. Para área, executar `node ../test-area.mjs` com cwd `snapshot/`. Para a montagem, executar `node --experimental-vm-modules output/qa/aaa-20260919/astra-integration-review-v1/verify-assembly.mjs` da raiz do repositório.

**Handoff:** a montagem inicial pode seguir para a decisão de promoção local do coordenador com os hashes acima. A revisão incremental de ordenação/TTL continua pendente e separada; não é necessário aguardar outra tarefa para encerrar Astra6. Nenhum arquivo de runtime, integração ou candidato alheio foi editado, e nenhum servidor/GPU foi iniciado.
