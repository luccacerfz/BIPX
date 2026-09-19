# BIPX — candidato de 18/09/2026 às 19:08 UTC

**29/29 suítes passaram; existem defeitos conhecidos. Nota 10 não foi estabelecida.** Nenhuma nota foi atribuída nesta auditoria, e todas as dimensões continuam com cobertura parcial.

[Manifesto](../output/playwright/2026-09-18T19-08-58-555Z-quality-suite/suite.json): execução de 2026-09-18T19:08:58.555Z até 2026-09-18T19:18:12.847Z, com 114 arquivos de produção e verificadores inalterados. Main `579f0bb35ec48f040da669830609531c0ea2a56ac65993ff5d5e7d0b16fd427b`; servidor `deb4d89fed0454beda52d35d12e00e5f23868cf7f2adaaabfd4359e8f244ef83`. Baseline anterior de 18:06 preservada.

Chrome 153 em modo headless, WebGL2/ANGLE Metal Apple M5 Pro; Chrome do usuário continuou aberto. WebKit também passou três cenários neste Mac. Viewport compacto é emulação, não aparelho físico.

Duas partidas naturais de 100 s usaram teclado/cliques reais e leitura do estado, sem spawn, XP, saúde ou pontuação injetados. Aldric chegou a 21 kills por vida, cinco melhorias e quatro mortes/restarts. Lyra chegou a 55 kills, wave 2/nível 5, oito melhorias e uma morte/restart. Médias: 59,8224 e 59,7024 FPS; p95: 16,8 ms. Seis frames ultrapassaram 50 ms, com máximo de 183,3 ms. Nenhum coincidiu com captura de tela; todos coincidiram com longtasks. A pausa inesperada histórica não reapareceu e continua sem causa comprovada.

[Trace diagnóstico separado](quality-trace-20260918T190858.json) reproduziu um frame de 100 ms. O trabalho de 98,665 ms ficou no render, com 83,526 ms amostrados em `WebGLProgram.onFirstUse/getUniforms` e esperas síncronas de GPU. Não houve sobreposição de GC ou screenshot nesse caso. O profiling acrescenta overhead e não substitui o benchmark; não atribui automaticamente todos os picos anteriores à mesma causa.

| Fixture estática | Inimigos | FPS médio | p95 ms | Pior ms |
| --- | ---: | ---: | ---: | ---: |
| desktop | 94 | 60 | 16.8 | 16.8 |
| mobile | 94 | 59.8 | 16.8 | 49.9 |
| desktop-lv16 | 362 | 59.8 | 16.7 | 66.7 |
| iphone17-lv16 | 362 | 60 | 16.7 | 16.8 |

Fixtures de desempenho congelam o combate. Não provam desempenho de horda ativa, hardware móvel ou estabilidade térmica. Integridade medida: zero ameaças invisíveis. Vinte trocas de personagem mantiveram 67 geometrias/27 texturas; três restarts, 68/28.

Reconexão passou preservação de identidade/progresso, janela real de 30 s, estado antigo, morte terminal, replay de recompensa/ACK, takeover e `startRun` idempotente. As mortes de teste usam IPC privado para chamar o dano real do servidor; não existe comando público de teste. Colisão integrada do rifle passou nove casos; melee passou 15 casos solo e 13 de servidor. Esses testes não cobrem os exploits de progressão abaixo.

[Achados reproduzidos](quality-findings-20260918T190858.json) e [revisão visual](quality-review-20260918T190858.json):

- Cliente sem XP pode declarar nível/build, HP 600 e multiplicadores máximos de ataque; POST de sessão solo aceita pontuação inventada e repetida.
- Colisão de projétil inimigo ignora um cruzamento tangencial. Prova CPU usa função extraída da fonte e destino de dano simulado; não é gameplay.
- Botão multiplayer local redireciona para produção remota, saindo do candidato e do armazenamento local do personagem. Testes com URL direta não cobrem esse caminho.
- Persistem travamentos de compilação/inicialização gráfica, canvas compacto suave, árvores ocultando grupos, poses estáticas distantes, texto “Solo Solo” e rótulo de drop cortado.

A revisão confirma o LVL landscape legível e os antigos cilindros substituídos por LODs texturizados. A horda densa é uma fixture explícita. Áudio: 13 samples decodificados, PCM de 15.872 s com pico -7.615 dBFS; percepção auditiva e hardware continuam pendentes. Os 36 relatórios de navegador registram zero erros de página/console/HTTP/request; preservam uma advertência esperada do capturador PCM de teste.

Faltam aparelho físico, escuta/revisão humana de feel, todos os gatilhos naturais de VFX, acessibilidade abrangente, combate denso prolongado e soak. Lich/Brute em staging não fazem parte desta fonte. [Evidência estruturada](quality-candidate-20260918T190858.json) separa testes, observações, falhas e pendências.
