# Lich — revisão independente do recorte parede de 06:43

Decisão Root em 2026-09-19: **reter o candidato, sem promoção por enquanto**. O report original permanece preservado. Seu PASS precisa ser interpretado pelo caminho realmente executado.

Fonte: `output/lich-cast-launch-bridge-v2/native-wall/2026-09-19T06-43-26-343Z/{report.json,observation.json}`. Root inspecionou os originais flight0, flight4, flight8 e terminal e as nove amostras de apresentação. Main candidato d9e6fed4, servidor eb80b8a6; o rebase mantém os dez arquivos não-main idênticos à v1.

O teste prova um cast real liberado, remoção posterior do caster sem apagar imediatamente o projétil, colisão lógica na burial-rail-2, HP200 preservado e limpeza final de bridge/presentation/trail. Contato lógico z18.55, raio.36, y1.05. Isso é evidência útil.

**Não prova que a ponte visual foi cortada pela barreira.** Todas as nove amostras têm bridge enabled, fallback null, conservativeWall null e resetTrail false. A última posição visual é z16.983359, com entrada interpolada z17.135665 e progresso1.084665. A remoção autoritativa acontece antes de se observar a apresentação alcançar a barreira. O nome do check “hand bridge clipped by existing low rail” excede a evidência.

Além disso, as primeiras cinco amostras entre2856.8 e3004.8ms mantêm a mesma posição: visual(-16.483187,1.875518,15.843275), entrada de apresentação(-16.2,1.437341,16.051). A pausa de aproximadamente148ms e o desaparecimento distante da barreira merecem diagnóstico da interpolação/rede/caller. Não atribuir a causa à ponte sem comparação causal; a posição denominada authority pelo presenter não é necessariamente o estado lógico atual do servidor.

Próximo trabalho autorizado: corrigir a descrição do resultado, preparar em CPU um caso com obstáculo real em que o próprio segmento/offset visual encontre a barreira e exercite fallback/resetTrail, e executar apenas esse recorte após as janelas Environment e Brute já combinadas. Publicar amostra do ramo exercitado e imagem correspondente, mantendo invariantes lógicas e fontes. Não repetir o clear cast de dois clientes nem ampliar a matriz. A prova clara anterior e este teste de lifecycle continuam válidos em seus escopos; nenhum deles aprova AAA ou todo o multiplayer.
