# HUD — seleção da direção de ícones pintados

Root revisou a prancha original de seis ícones/estados48/64px, screenshot portrait Lyra pronto e screenshot desktop Aldric em recarga. Paths/hashes em `gui-painted-followup.json`. Prancha é sintética; screenshots são do browser com CSS do candidato injetado apenas na QA, ainda sem promoção de runtime.

As seis silhuetas têm identidade clara: busto dourado, lâmina, escudo, canhão laranja, cristal e singularidade roxa. Na prancha, a pintura continua reconhecível durante cooldown; recarga/custo em apoios escuros preservam contraste. No portrait, os três ícones e as duas esferas cabem sem cruzar os joysticks. No desktop, grito permanece identificável após cast.

Direção artística selecionada para integração. Os mestres1254×1254/14.85MB não devem ser usados como orçamento final mobile. GUI fará derivados otimizados, preservando originais e verificando diferença visual no tamanho real. Nenhum novo evento/input/contrato de recursos precisa mudar. Compatibilidade high contrast/reduced, foco, touch e24/28/34 versus28/32/38 permanecem requisitos do HUD existente.

Esta revisão não aprova toda acessibilidade/dispositivo físico nem nota AAA. Integrar em janela coordenada com Combat, conferir carregamento/formatos/bytes/ícones das duas classes e a captura integrada com novas fontes.

## Promoção posterior

GUI promoveu seis WebP256px/143958bytes e CSS correspondente na janela Combat, mantendo os mestres intactos. `output/playwright/2026-09-19T01-29-21-727Z-ui-arpg-painted-verify` passou34checks; root viu o portrait de segundo toque e, depois, seis capturas gameplay01:35/01:39 com arte já integrada. Ver `integrated-art-followup.json`. O campo productionPromoted:false do JSON inicial descreve apenas aquela seleção anterior, preservada como histórico.
