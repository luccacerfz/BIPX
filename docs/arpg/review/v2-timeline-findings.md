# Seis skills v2 — observação independente no jogo

## Capturas reais, escopos separados

Root executou input real em partidas solo novas, sem spawn artificial, invulnerabilidade, concessão de recursos ou alteração de inimigos. Cada rodada copiou os arquivos runtime para diretório temporário independente e conferiu hashes antes/depois da cópia. Vídeos completos, eventos e estados por vítima foram preservados. Nenhuma aceitação AAA/global concedida.

1. `output/playwright/2026-09-19T00-12-04-692Z-skill-timeline-browser`: Chrome visível, três skills do guerreiro e gravidade completaram observação com fonte da cópia estável. Grito produziu buff real, mas a partida terminou em morte antes de comprovar a duração completa; dash registrou impacto e **2 cutEvents**; investida registrou impactos; gravidade manteve campo fixo e até **3 alvos com pull**. Fonte do checkout mudou enquanto a cópia rodava: resultado pertence à cópia, não automaticamente ao candidato seguinte.
2. Nessa primeira rodada, canhão e gelo falharam na pré-condição: já havia skills consumidas/recargas antes do comando planejado. Não havia log DOM desde navegação; causa não determinada. Não atribuir automaticamente ao jogo, servidor, usuário ou outro agente. Falhas mantidas no índice.
3. `output/playwright/2026-09-19T00-16-48-524Z-skill-timeline-browser`: repetição somente canhão/gelo, Chrome sem janela, **ANGLE Metal Apple M5 Pro / WebGL2** registrado. Fontes da cópia estáveis e checkout ainda igual ao final. Ambos iniciaram com sequence0 e tiveram cast/release/travel/impact reais. Histórico de teclas/pointer desde abertura está nos relatórios. Não é aparelho físico nem prova de desempenho. A passagem dessa rodada não explica retroativamente as entradas anteriores.

## Balanceamento de controle

A investida atingiu zumbis fracos, mas não houve alvo vivo observado com stun. Gelo repetido também teve impacto/dano, porém nenhum freeze persistente foi observado. Alvo inicial em torno de5HP; danos atuais com atributo2 são shield14 e gelo10, acima dessa vida. Gravidade inicial6 também pode eliminar fracos antes de agrupá-los, embora novos alvos tenham sido puxados na rodada. Combat deve calibrar dano de controle frente à vida inicial e demonstrar combinação gravidade→gelo/fogo. Não inventar freeze/stun em cadáveres para completar a apresentação. Cannon/dash podem continuar ataques de dano alto.

## Inspeção dos renders

Root abriu o PNG de release do grito e impacto de gravidade da primeira rodada: HUD duas esferas/slots/buff legíveis; área dourada e centro roxo reais presentes. A gravidade ainda é predominantemente uma espiral plana; direção de arte adicional permanece em `v2-vfx-art-direction.md`.

Screenshots seriais chegaram atrasados ao impacto: canhão observado331.6ms após observador, screenshot iniciado1433.4ms; gelo545.1ms, screenshot iniciado1199.7ms. Não aprovar ou reprovar explosão com o frame já vazio. Root decodificou7frames de cada WebM original, intervalo aproximado9.0–10.4s, usando ffmpeg sem composição/desenho. Inspecionou frames03/05 de ambos: canhão agora tem chamas preenchidas laranja/vermelhas (melhora perante anéis ocos da fixture anterior); projétil ciano e estilhaços/anel glacial estão visíveis. Não houve revisão de playback contínuo com áudio; sequência de frames não prova conforto temporal ou estética AAA. Vídeos25fps também não servem de benchmark.

Manifesto `v2-timeline-artifacts.json` vincula índices/vídeos/frames e resume telemetria sem substituir os relatórios completos. Testes de ciclo/status/rede dos donos continuam necessários; fonte nova exige revalidação pertinente. Servidor5173 do usuário não foi encerrado por esta captura.

## Atualização — controle após rebalanceamento

Nova cópia em `output/playwright/2026-09-19T00-23-50-859Z-skill-timeline-browser` repetiu apenas shield/gelo após mudança dos coeficientes para1.2/.8. Ambos completaram fases reais e fonte da cópia permaneceu estável; checkout evoluiu durante captura, portanto não é aprovação da nova edição VFX em andamento.

Investida deixou1vítima viva (~2.64HP) com stun observado por43amostras/2097.3ms. Gelo deixou2vítimas vivas (~3.44/3.46HP),60amostras cada/2941.8ms. VFX marcou1stunned/2frozen e zerou ao fim. Os PNGs de impacto foram inspecionados: estrelas sobre alvo atordoado e cristais nos dois congelados. Análise dos controllers por entityId e deslocamento em `v2-control-followup.json`.

Os corpos não ficaram absolutamente imóveis: deslocamento acumulado durante estados1.121m no stun e .099/1.814m no gelo. Isso não prova caminhada: solver de crowd ainda pode empurrar atores; revisar política/peso visual com Physics/Combat. Não chamar essas medições de locomoção normal nem de ausência completa de deslocamento. A leitura dos estados e relógios do controller é prova local de pausa de animação, não uma análise de deformação de todos os vértices. Falhas anteriores permanecem preservadas; este resultado resolve a falta de sobreviventes de controle na nova rodada.
