# Canhão volumétrico — segunda direção selecionada

Root inspecionou seis originais01:53:40: início/expansão/dissipação/fim, low-reduced e quatro explosões. A mudança remove a cúpula sustentada; o núcleo clareia brevemente e se rompe/sube em uma pluma irregular que desaparece. Os atores continuam visíveis nos frames, embora quatro núcleos juntos ainda produzam concentração luminosa. Leitura mínima do patch de torso:77.686%, sem baixar o gate65%. Trajeto contínuo selecionado na revisão anterior.

Direção selecionada para preparar integração; ainda não é AAA nem gameplay integrado. O frame0.74 tem pouco volume logo no primeiro instante, seguido pelo pico.86; sensação de impacto deve ser revisada com animação/áudio/input reais. O alcance visual da explosão deve permanecer legível junto do raio efetivo3.4, sem sugerir dano persistente onde existe apenas dissipação. Não alterar gameplay para favorecer VFX.

CPU e fixture do dono passaram com fontes estáveis. GPU integrada da fixture1280×720,18queries úteis/caso: high1impact P95~7.174ms,4impact~7.980ms; low/reduced1~3.925ms,4~4.307ms. Esses valores não são custo marginal, FPS nem prova de mobile. Não extrapolar quatro explosões para carga ilimitada.

Integração coordenada após janela Physics, preservando seis famílias e esgotamento/reset/pausa/remoto/low-reduced. Wrapper do canhão e Horizon precisam compartilhar UM pedido de depth: união de raízes excluídas/consumidores visíveis, publicação da mesma textura atual e invalidação/restauração corretas, inclusive coexistência. Captura real deve incluir canhão contra inimigos vivos, colisão com parede/miss, junto de gravidade/gelo e cleanup. Primeiro candidato rejeitado permanece em cannon-volume-followup.*.
