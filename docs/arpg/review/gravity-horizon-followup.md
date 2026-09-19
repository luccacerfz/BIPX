# Gravidade Horizon + nebulosa — candidato de integração

Root inspecionou os quatro PNGs originais listados em `gravity-horizon-followup.json`: high1.8/3.6/4.8s e low/reduced1.8s. São comparações controladas com assets reais, mesma câmera e compositor HDR do BIPX. Nenhum destes frames é gameplay natural.

O núcleo escuro com borda luminosa e a nebulosa roxa dão identidade e volume ao campo. A diferença frente aos círculos planos anteriores é clara na câmera ampla. A versão reduced preserva essa identidade. Os personagens ao redor permanecem reconhecíveis nos frames examinados; isso não aprova toda oclusão nem horda. O frame4.8s mostra colapso antes da expiração5s. Root não assistiu ao vídeo inteiro nesta revisão.

**Recomendação: avançar para integração experimental coordenada VFX/Combat.** Não é aceite AAA. O requisito de ficar no centro de impacto, duração/raio e atração continua com core; a arte não deve redefinir a simulação.

A fixture usa um prepass RGBA-packed depth que ainda não existe no pipeline runtime. Sua promoção exige contrato explícito de depth/resolução/near/far/oclusores. Preservar targets, estado do renderer e oclusão dos atores, evitando render duplicado sem campo visível. Testar vários campos, qualidade/reduced, pausa/reset/dispose e alocação máxima antes do aceite de produção.

Medição do dono:1280×720,36amostras após6warmups por caso, queries GPU válidas sem disjoint. High baseline GPU p95=4.7265ms e candidato=6.218291ms; low/reduced3.3055→4.836749ms. O candidato inclui passe de profundidade. Esses valores descrevem uma fixture local de um campo; não representam FPS de horda ou aparelho móvel. A espera de queries também impede interpretar seus intervalos RAF como FPS de jogo.

Combat recebeu um pedido consolidado para abrir a janela de integração após seu checkpoint01:01. Fontes do protótipo, GLSL original/licença e versão anterior permanecem preservadas.
