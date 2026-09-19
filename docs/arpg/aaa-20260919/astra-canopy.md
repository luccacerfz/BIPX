# Astra 3 — abertura de copa para companheiros

**Aceite focal: aprovado no candidato isolado `astra-canopy-v1`.** A oclusão A2-01 foi reproduzida na base `integration-v2/candidate` e corrigida em capturas nativas high e low/reduced: o observador passa a ver corpo e espada do companheiro através da copa relevante. Não houve promoção ao runtime vivo, alteração de GUI/VFX de habilidades ou edição de `latejoin-projectile-v1`; aprovação global de produção permanece com a coordenação.

Task `task_6ac0b71f82d6`, dispatch `ctx_65c90e718d42`, 2026-09-19. GPU utilizada depois de Fable5, com aquisição atômica e liberação apenas do próprio lock; browsers e servidores privados encerrados. Coordenação recebeu aviso de GPU liberada.

## Entrega e aplicação

- Candidato: [astra-canopy-v1/candidate](../../../output/qa/aaa-20260919/astra-canopy-v1/candidate/).
- [Patch incremental](../../../output/qa/aaa-20260919/astra-canopy-v1/canopy-incremental.patch), contra **integration-v2**, não contra a fonte viva.
- [Manifesto de fontes, hashes e preservação](../../../output/qa/aaa-20260919/astra-canopy-v1/source-manifest.json).
- [CPU 8/8](../../../output/qa/aaa-20260919/astra-canopy-v1/cpu-results.json) e [asserções nativas 12/12](../../../output/qa/aaa-20260919/astra-canopy-v1/native-assertions.json).

`git apply --check` e aplicação em diretório temporário passaram; os quatro resultados aplicados coincidem byte a byte com o candidato. O manifesto verifica **1.072 arquivos da fonte viva** e **242 da base congelada** sem mudanças. As únicas diferenças entre candidato e base são:

| Arquivo | Mudança |
|---|---|
| `src/main.js:6049` | Passa o iterador dos jogadores remotos, câmera e `dt` à atualização do ambiente. |
| `src/render/asset-dressing.js:121` | Atualiza quatro uniformes de posição/raio e intensidade; expõe diagnóstico em `canopyActorFocus`. |
| `src/render/environment-actor-focus.js:3` | Seleciona e acompanha companheiros vivos, visíveis, próximos e dentro da câmera; gerencia entrada/saída gradual. |
| `src/render/environment-cutaway.js:37` | Acrescenta os corredores de companheiros somente ao recorte de cedros, compartilhado com profundidade de cena. |

Hash de `src/main.js` da base: `f489ab2d0076374fb3ac045b59f376186937130a204be446e9312f30e887e02e`; candidato: `ccfa901e976a2381729c73040c6fc470362e1d8f7e90b0a35c2587e7cc6bf17e`. Os demais hashes completos estão no manifesto. Ao combinar com o trabalho de late join, preservar a única mudança desta entrega no chamador de `worldVisuals.update`; esta entrega não incorpora nem testa aquele candidato.

## Decisão técnica

A base já protegia o jogador local, dez ameaças próximas e quatro áreas de habilidade. Companheiros não eram enviados ao recorte. Acrescentá-los à lista de ameaças disputaria espaço com a horda; foi criada uma reserva independente de **quatro atores**, mantendo os limites anteriores.

A seleção usa a posição **renderizada** do companheiro, estado `playing`, saúde positiva, malha visível, distância horizontal máxima de 26 m e projeção dentro do viewport com pequena margem para corpo/arma (`|x| <= 1.08`, `|y| <= 1.12`, profundidade válida). Prioriza os mais próximos, com desempate estável por ID. O alvo fica a 1,2 m acima da raiz e usa raio de 2,5 m escalado pela perspectiva.

Entrada e saída variam a intensidade em aproximadamente 180 ms de tempo de atualização. A posição acompanha diretamente a raiz interpolada: suavizá-la novamente criaria atraso durante o dash. Na saída, conserva a última posição até fechar; só então libera o espaço. Remoção/reconexão não reaproveita uma abertura ativa em outro ponto. Menu/pausa limpa os espaços imediatamente, seguindo o desligamento de recorte já existente.

O novo corredor é exclusivo dos cedros. Materiais de cor e profundidade recebem os mesmos objetos de uniformes e o mesmo shader de recorte; materiais de sombra não recebem o novo hook. Geometria, transformações, colliders, layouts, estilos de material, sombras, limites de ameaças/áreas e recorte local permanecem estruturalmente inalterados. Uma copa pequena pode desaparecer quase inteira no corredor de um ator; as árvores fora dos corredores permanecem visíveis. Não se desativa o grupo da floresta nem sua sombra.

## Evidência visual antes/depois

Sessão principal: [native-focus-2026-09-19T09-49-50-336Z/report.json](../../../output/qa/aaa-20260919/astra-canopy-v1/native-focus-2026-09-19T09-49-50-336Z/report.json). Chrome nativo, dois clientes reais por execução, servidor privado e entradas de teclado/mouse reais; o único código anexado ao `main` é um getter de observação. Não há teleporte, alteração de saúde, invulnerabilidade, inimigos fabricados ou quadros sintéticos.

O roteiro reconstrói o **corredor espacial** do `high-contact-attempt-1-observer`: partida perto de `(1.117, -10.097)`, dash em direção a `(4.534, -16.146)` e companheiro perto de `(4.5, -17)`, observado por outro jogador perto de `(0, -5.5)`. Os inimigos, relógios e pequenas diferenças de posição continuam naturais; não é replay pixel a pixel do combate histórico nem uma nova validação de dano do dash.

| Qualidade | Base: companheiro encoberto | Candidato: corpo/arma revelados |
|---|---|---|
| High | [Antes](../../../output/qa/aaa-20260919/astra-canopy-v1/native-focus-2026-09-19T09-49-50-336Z/before-high-canopy-corridor-observer.png) | [Depois](../../../output/qa/aaa-20260919/astra-canopy-v1/native-focus-2026-09-19T09-49-50-336Z/after-high-canopy-corridor-observer.png) |
| Low + reduced | [Antes](../../../output/qa/aaa-20260919/astra-canopy-v1/native-focus-2026-09-19T09-49-50-336Z/before-low-canopy-corridor-observer.png) | [Depois](../../../output/qa/aaa-20260919/astra-canopy-v1/native-focus-2026-09-19T09-49-50-336Z/after-low-canopy-corridor-observer.png) |

PNG originais em 1440×900 foram inspecionados. Nas duas bases aparece o nome sobre a copa, sem leitura do corpo; no candidato o corpo e a arma reaparecem. O jogador local continua legível, a composição vizinha permanece e high conserva a sombra da árvore recortada. Há também capturas `pre-dash`, `dash`, `post-dash` e visão do caster em cada grupo.

Oito vídeos originais da sessão principal estão mapeados em `groups[].videos` no JSON. [Prancha high após](../../../output/qa/aaa-20260919/astra-canopy-v1/native-focus-2026-09-19T09-49-50-336Z/review-frames/after-high-observer.jpg) e [low após](../../../output/qa/aaa-20260919/astra-canopy-v1/native-focus-2026-09-19T09-49-50-336Z/review-frames/after-low-observer.jpg) mostram a travessia e a recomposição da copa ao mudar de corredor. São 16 frames nativos extraídos com ffmpeg, 2 Hz a partir de 3 s, em ordem esquerda→direita/cima→baixo; a prancha serve para localizar momentos, não para medir os 180 ms de transição. A progressão temporal da intensidade é verificada em CPU.

## Limpeza, reconexão e cobertura

[Lifecycle nativo](../../../output/qa/aaa-20260919/astra-canopy-v1/native-lifecycle-2026-09-19T09-52-18-848Z/report.json), high e low/reduced, comprova com o observador vivo:

- Recarregar o caster fecha o alvo anterior quando ele retorna ao menu.
- Entrar novamente pelo fluxo real de seleção cria outro ID e abre o novo alvo; o ID antigo não permanece nos espaços.
- Fechar o cliente remove o ator e zera todos os espaços do observador.

[Saída do viewport](../../../output/qa/aaa-20260919/astra-canopy-v1/native-viewport-2026-09-19T09-53-30-561Z/report.json), high e low/reduced: ambos os atores vivos, conectados e com 200 HP; o remoto permanece a cerca de 18,4 m, mas sua projeção vertical chega a aproximadamente **−2,13 NDC**, fora da câmera. Todos os espaços fecham e perdem o ID. Isso distingue filtragem pelo viewport de filtragem por distância ou morte.

As oito verificações CPU importam os módulos reais do candidato e Three.js real: entrada gradual/seguimento sem atraso, saída do viewport, remoção/reconexão, máximo de quatro alvos, exclusão de mortos/ocultos/inválidos/distantes/atrás da câmera, limpeza por pausa/menu, ausência de salto de espaço e contrato cor/profundidade versus materiais legados. As doze asserções nativas checam qualidades/reduced/console, seguimento exato da raiz remota no corredor, reconexão, remoção e saída da câmera. Todas passaram; nenhum erro de console nos quatro conjuntos de capturas.

## Negativos preservados e limites do aceite

**291 artefatos anteriores** (PNG, vídeos, JSON e frames) foram comparados com o manifesto Astra 2 e continuam com os hashes originais, incluindo [A2-01 negativo histórico](../../../output/qa/aaa-20260919/astra-dash-native-v2/native-2026-09-19T09-28-55-357Z/high-contact-attempt-1-observer.png). Nenhum foi substituído pelo resultado novo.

A primeira captura exploratória, `native-2026-09-19T09-48-28-645Z`, também está preservada: o ajuste da mira durante a acomodação da câmera produziu endpoints diferentes. Na sessão principal, os primeiros rótulos `viewport-exit` ainda eram **atores dentro da câmera** e o observador morreu antes de algumas etapas tardias de reconnect/removal; esses registros não contam como aprovação desses critérios. As sessões dedicadas acima corrigem a cobertura, sem editar os negativos.

O aceite é focal para oclusão de companheiros no cenário e perfis registrados. Não cobre quatro companheiros simultâneos em GPU (o limite foi exercitado em CPU com 30 entradas), reconexão com o mesmo ID por resume token, todos os modelos/armas/câmeras, custo GPU sob horda máxima ou uma nota artística global acima de 9,5. Os recortes existentes de inimigos e áreas continuam podendo afetar outras copas; o PNG low mostra esse comportamento herdado. O recorte mantém o estilo de borda já presente na base; não foi redesenhado nesta tarefa. Regressões de GUI e sobreposição de rótulos A2-02 permanecem fora do escopo.

## Reexecutar

Na raiz BIPX:

```sh
node output/qa/aaa-20260919/astra-canopy-v1/test-canopy.mjs
python3 output/qa/aaa-20260919/astra-canopy-v1/verify-delivery.py
```

Os scripts `capture-focus.mjs`, `capture-lifecycle.mjs` e `capture-viewport.mjs` usam lock de GPU e produzem pastas novas por timestamp. Executá-los somente na vez atribuída pela coordenação, com `BIPX_EVIDENCE_DIR=output/qa/aaa-20260919/astra-canopy-v1`; o primeiro servidor usa a base congelada e os demais usam o candidato isolado. A verificação de entrega aponta explicitamente para os conjuntos desta execução, preservando sua proveniência.
