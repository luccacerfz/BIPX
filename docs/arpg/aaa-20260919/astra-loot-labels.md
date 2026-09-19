# Astra 4 — revisão independente dos rótulos de loot

**Aceite focal: aprovado para integrar o ajuste de loot.** Entrega isolada `loot-label-v2`, derivada da v1 congelada; patch final incremental sobre `latejoin-projectile-v1/candidate`. Runtime vivo, porta 5173, ranking, candidatos de outros agentes e evidência negativa A2-02 preservados. Task `task_9125ea44c176`, dispatch `ctx_0ed9924cf649`.

## Revisão e correção

A v1 não estava pronta para integração: `updatePowerups` repõe a posição original do rótulo em cada frame, enquanto o layout só rodava com `game.labelFrameReady`. Assim, os frames intermediários voltavam a colocar o texto sobre o corpo. Outra fonte de oscilação era escolher novamente a posição mais próxima a cada atualização, incluindo a oscilação vertical do objeto e seu pulso de raridade. A ordenação por distância da câmera também podia trocar a prioridade de drops vizinhos.

A v2 corrige a frequência e a ordem final da escrita no `main`: o layout executa em cada frame jogando, depois das atualizações de drops/rede/câmera e antes do render. Fora do jogo, oculta os rótulos e limpa as linhas sem alterar os itens. Mantém uma posição deslocada enquanto ela continua livre, usa altura-base estável e reserva o tamanho máximo do pulso original de raridade. A seleção de slots considera também as bordas dos obstáculos: a grade fixa da v1 podia ocultar um rótulo apesar de haver uma posição livre dentro do limite de 110 px.

A proteção inclui jogador local e remotos vivos, usando uma região conservadora de corpo/arma (raio 2 m, altura 3,2 m, margens em pixels). Drops têm prioridade estável por criação da malha, sem disputa oscilante por distância. Rótulos cujo ponto de origem sai do viewport não são puxados para dentro da tela. Em lotação, o texto pode ser ocultado; o modelo e o raio de coleta continuam inalterados.

Rótulos deslocados ganham uma linha discreta até o item, preservando a associação espacial. Geometria/material da linha são criados apenas quando necessários e descartados ao remover o drop. Nome, conteúdo, cor de raridade, ícone, pulso, escala, textura, pickup e progressão continuam nos sistemas existentes. O ajuste contém somente `src/main.js` e `src/ui/world-label-layout.js`; não incorpora canopy nem outras frentes à base recebida.

## Artefatos para integração

- [Candidato completo](../../../output/qa/aaa-20260919/loot-label-v2/candidate/).
- [Patch final sobre latejoin-projectile-v1](../../../output/qa/aaa-20260919/loot-label-v2/loot-label-final.patch).
- [Manifesto do candidato](../../../output/qa/aaa-20260919/loot-label-v2/candidate-manifest.json) e [verificação de preservação/aplicação](../../../output/qa/aaa-20260919/loot-label-v2/source-check.json).
- [Contrato CPU](../../../output/qa/aaa-20260919/loot-label-v2/cpu-contract.json), com fixture sintética explicitamente identificada.

A aplicação do patch em diretório temporário reproduziu os dois arquivos finais byte a byte. Verificados sem mudanças: 1.072 arquivos da fonte viva, 243 da v1 recebida e 242 da base latejoin. Não houve commit, merge, push, deploy ou JEF.

## Verificação realizada

Cinco contratos CPU exercitam os módulos reais e Three.js real: 120 frames de bob/pulso sem deslocar o texto nem modificar propriedades do pickup; 30 drops agrupados com redução do texto e preservação dos objetos; origem fora da tela; descarte de geometria/material; ocultação e retomada. São casos sintéticos de contrato, não gameplay nem prova visual de raridades obtidas naturalmente.

A primeira matriz nativa usa Chrome real, servidor privado e dois clientes com entradas reais: atiradora obtém loot por seis abates e guerreiro permanece na sessão. O observador anexado apenas lê atributos após `cinematicPipeline.render`; não cria drops, altera saúde, move atores por setters ou modifica a progressão. Vídeos e JSON completos estão em [native-2026-09-19T10-13-29-683Z/report.json](../../../output/qa/aaa-20260919/loot-label-v2/native-2026-09-19T10-13-29-683Z/report.json).

| Sessão | Loot natural | Resposta autoritativa de coleta | Console |
|---|---|---|---|
| Base high | Munição reforçada, comum | `ok: true`, `kind: weapon` | sem erros |
| Base low/reduced | Munição reforçada, comum | `ok: true`, `kind: weapon` | sem erros |
| v2 high | Munição reforçada, comum | `ok: true`, `kind: weapon` | sem erros |
| v2 low/reduced | Munição reforçada, comum | `ok: true`, `kind: weapon` | sem erros |

O texto/raridade permanecem os originais, inclusive “+40% dano”. Nas primeiras sessões da v2, 529 amostras renderizadas mantiveram o rótulo visível fora das regiões protegidas; 382 ocorreram em frames sem `labelFrameReady`, com erro máximo de posição abaixo de 5×10⁻¹³ px contra a posição resolvida pelo layout. Essa medição verifica os retângulos conservadores, não uma máscara de pixels da arma animada.

[Base high: texto sobre a ação](../../../output/qa/aaa-20260919/loot-label-v2/native-2026-09-19T10-13-29-683Z/before-high-stable-label-caster.png) e [v2 low/reduced: texto abaixo da região de corpo/arma](../../../output/qa/aaa-20260919/loot-label-v2/native-2026-09-19T10-13-29-683Z/after-low-stable-label-caster.png) foram inspecionados em 1440×900. O primeiro roteiro teve cobertura parcial em base low e v2 high: o caminho atravessou o raio de coleta antes do PNG de proximidade. Esses registros e pickups são válidos, mas os PNG sem item não contam como prova visual da posição próxima ao ator. O ajuste de aproximação radial pertence somente ao harness.

## Complemento final próximo aos atores

A única rodada complementar, autorizada pela coordenação depois dos locks existentes, está em [native-safe-2026-09-19T10-20-13-431Z/report.json](../../../output/qa/aaa-20260919/loot-label-v2/native-safe-2026-09-19T10-20-13-431Z/report.json). Concluída em aproximadamente 45 s, nas duas qualidades, sem alterar o candidato ou criar loot artificialmente. Chrome/servidores encerrados e lock próprio liberado; coordenação avisada antes do fechamento deste relatório para iniciar áudio.

A aproximação radial manteve o jogador fora do raio de coleta. O guerreiro remoto caminhou até o drop pertencente ao jogador local; a câmera do dono demonstra que o texto evita também o corpo/arma do companheiro. Depois o dono aproximou-se, permaneceu junto aos dois e coletou normalmente.

| Perfil | Remoto junto ao item | Local + remoto próximos |
|---|---|---|
| High | [PNG: remoto a 0,18 m](../../../output/qa/aaa-20260919/loot-label-v2/native-safe-2026-09-19T10-20-13-431Z/after-high-remote-label-caster.png) | [PNG: local a 2,17 m, remoto a 0,16 m](../../../output/qa/aaa-20260919/loot-label-v2/native-safe-2026-09-19T10-20-13-431Z/after-high-near-label-caster.png) |
| Low/reduced | [PNG: remoto a 0,18 m](../../../output/qa/aaa-20260919/loot-label-v2/native-safe-2026-09-19T10-20-13-431Z/after-low-remote-label-caster.png) | [PNG: local a 2,09 m, remoto a 0,18 m](../../../output/qa/aaa-20260919/loot-label-v2/native-safe-2026-09-19T10-20-13-431Z/after-low-near-label-caster.png) |

Os quatro PNG foram inspecionados em 1440×900. High mantém o texto acima da região do companheiro; low o coloca abaixo dos pés. A linha associa o texto ao item, cujo círculo/modelo continuam no lugar; o gesto da arma não recebe o texto. O drop aparece na visão do dono, enquanto a segunda câmera documenta o outro cliente da sessão, respeitando a apresentação individual de progressão já existente.

Resultado acumulado em [native-checks.json](../../../output/qa/aaa-20260919/loot-label-v2/native-checks.json): **6 coletas aceitas** (2 base, 4 v2), **1.566 amostras visíveis da v2**, incluindo **1.134 entre atualizações de rótulos**, **zero interseções com as regiões protegidas**, erro de posicionamento menor que 5×10⁻¹³ px e **zero erros de console**. Após cada coleta, o ID do drop sai da lista e não resta linha visível. Qualidade efetiva, reduced motion e eventos de teclado confiáveis foram conferidos. Os 12 vídeos originais das seis sessões ficam mapeados em `groups[].clients[].video` nos dois relatórios nativos.

Também foram extraídos diretamente do vídeo high anterior [um frame em 13,6 s](../../../output/qa/aaa-20260919/loot-label-v2/native-2026-09-19T10-13-29-683Z/review-frames/after-high-13_6.png) e [12 frames a 10 Hz desde 13,1 s](../../../output/qa/aaa-20260919/loot-label-v2/native-2026-09-19T10-13-29-683Z/review-frames/after-high-shift.jpg). São frames nativos, não reconstruções; os timestamps são do vídeo, não equivalência exata com `performance.now` do trace.

As duas tentativas intermediárias `native-safe-...10-15-17...` e `...10-18-34...` registram recusa por lock ocupado. Nenhuma abriu Chrome nem removeu lock alheio. Não contam como sessões de gameplay ou falhas de render.

## Limites e negativos

A2-02 incluía também nomes de jogadores e cartas de evolução. Esta entrega trata exclusivamente do texto de loot; não reposiciona nomes nem muda o momento das cartas. A geometria protegida é conservadora, sem garantia universal para todas as armas, zooms e poses. Raridades épica/lendária e aglomeração de 30 itens foram exercitadas em CPU, não obtidas no gameplay nativo desta entrega. A interface de opções em multiplayer manteve `paused: false`, portanto não constitui prova de pausa offline. Offscreen e hide/resume têm cobertura CPU.

Preservar como negativos históricos [caster A2-02](../../../output/qa/aaa-20260919/astra-dash-native-v2/native-2026-09-19T09-28-55-357Z/low-reduced-contact-attempt-3-caster.png) e [observer A2-02](../../../output/qa/aaa-20260919/astra-dash-native-v2/native-2026-09-19T09-28-55-357Z/low-reduced-contact-attempt-3-observer.png), além dos vídeos originais. O aceite focal deste ajuste não representa avaliação artística global acima de 9,5 ou aprovação de produção.

## Reexecutar e limites de integração

`node output/qa/aaa-20260919/loot-label-v2/contract-check.mjs` executa os cinco contratos CPU; `python3 output/qa/aaa-20260919/loot-label-v2/verify-delivery.py` confere fontes, patch, negativos, atributos nativos e coletas desta entrega. O patch deve ser combinado pelo coordenador com o candidato global, mantendo a ordem do layout imediatamente antes das demais etapas finais de render. Não aplicar como substituição completa do `main` de outras frentes.

Os hashes completos de `main` e helper estão no manifesto. Todos os 291 artefatos históricos elegíveis do manifesto Astra 2 foram verificados intactos; os novos registros, scripts, PNG, vídeos e relatório estão listados em `artifact-manifest.json`.
