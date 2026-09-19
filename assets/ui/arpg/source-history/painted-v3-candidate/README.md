# Painted v3 — candidato artístico GUI isolado

Seis imagens originais geradas por `image_gen` integrado; prompts e caminhos de procedência em `provenance.json`. Originais do provider e sprites SVG anteriores preservados. Não há import deste diretório no jogo ativo. `source-history` é excluído do fingerprint da aplicação pelo verificador compartilhado; hashes próprios do candidato são registrados separadamente.

Direção: busto/radiação âmbar; lâmina diagonal em aço; escudo maciço; canhão/fogo laranja; cristal ciano; singularidade roxa. Luz forte, planos de material e massas de silhueta substituem o contorno fino. Nenhuma marca/arte de franquia foi usada como referência.

`candidate.css` exige ancestral `.arpg-art-v3`. Não modifica a estrutura/eventos do HUD, esferas, teclas, custos ou autoridade. Pinturas cobrem a área dos seis SVG de skill, que permanecem no DOM. Máscara de recarga cai de alpha87% para30%, sem opacidade adicional40% sobre a arte. Recarga/custo permanecem em apoios escuros, nos cantos inferiores, deixando o centro livre. Estado sem recurso tem brilho/saturação menores e sinal×/custo avermelhado; aria-disabled/foco acessível são preservados. Não há animação nova.

## Revisão

Resultado visual: candidato revisado na prancha inteira e em capturas desktop/mobile/landscape. Bustos, lâmina, escudo, canhão, cristal e anel mantêm massas distintas a48px; cooldown/recurso ficam sinalizados sem apagar a identidade. Julgamento é desta proposta local, sem nota automática AAA.

Prova [art-candidate.json](../../../../../output/playwright/2026-09-19T01-14-13-538Z-ui-arpg-art-candidate/art-candidate.json):19 checks passaram, fonte global estável, fontes GUI ativas intactas e zero page/console/HTTP/request errors. [Prancha](../../../../../output/playwright/2026-09-19T01-14-13-538Z-ui-arpg-art-candidate/art-state-board.png), [mobile real](../../../../../output/playwright/2026-09-19T01-14-13-538Z-ui-arpg-art-candidate/art-candidate-dwarf-ready.png), [cooldown real](../../../../../output/playwright/2026-09-19T01-14-13-538Z-ui-arpg-art-candidate/art-candidate-dwarf-cooldown.png). Um cast real por classe na sessão QA; resource insuficiente e matriz completa são sintéticos. Chrome/Metal; mobile é emulação, não aparelho. GPU própria e backend efêmero encerrados;5173 PID97873 observado ativo, sem intervenção deste runner.

- `board.html`: prancha de estados sintéticos, seis linhas, ready/cooldown/recurso insuficiente, comparação atual48px e candidato64/48px. Custos/CD lidos do módulo do core. Não é screenshot de gameplay.
- `node tools/ui-arpg-art-candidate.mjs`: reserva GPU atomicamente e usa servidor/backend efêmeros com ranking isolado; não toca5173. Captura prancha e jogo real desktop/393×852/landscape, CSS injetado somente no navegador de QA, um cast real por classe, cooldown, foco e reduced-motion. Fecha só seus recursos. Respeitar prioridade VFX/Animation antes de rodar.
- Sem alteração/promessa de promoção runtime. Promoção deve acontecer em janela acordada: copiar assets selecionados para fora de source-history, carregar CSS escopado e habilitar classe ancestral; repetir QA do candidato integrado.

## Peso e limites

Os seis PNGs mestres têm1254×1254 e totalizam14.85MB decimais (~14.17MiB). São fontes para julgamento artístico, não orçamento aprovado de download/mobile. A promoção exige exportação otimizada (por exemplo128–256px WebP/PNG), validação visual contra estes mestres e medição de decode/download. Nenhuma imagem foi redimensionada ou retocada silenciosamente. Não presumir aprovação AAA, física, VFX, rede, JEF ou dispositivo a partir desta prancha.
