# Revisão visual independente — primeiro incremento ARPG

Revisão das imagens produzidas pelos agentes em 18/09/2026; root não abriu nova sessão GPU nem alterou arquivos de runtime dos donos. **Esta evidência é anterior à direção `../skill-direction-v2.md` e não aprova as seis habilidades novas solicitadas depois.** Escopos abaixo permanecem separados. Hashes dos arquivos efetivamente inspecionados em `visual-review-artifacts.json`.

## HUD: pictogramas vazios — correção necessária

- Gameplay real: `output/playwright/2026-09-18T23-35-01-604Z-verify-arpg-browser/arpg-warrior-skill-2.png`. Duas esferas, contadores/recursos, barra inferior e cenário aparecem. Os pictogramas da arma básica e das três habilidades não aparecem: há fundos, teclas/custos e cooldowns, mas o desenho que deveria distinguir a ação está vazio. Slot pronto também está vazio, portanto não é apenas uma máscara de cooldown.
- Fixtures GUI: `output/playwright/2026-09-18T23-31-52-150Z-ui-arpg-verify/gui-fixture-dwarf-desktop.png` e `gui-fixture-mobile-393x852.png` mostram o mesmo defeito. A fixture remove scripts de gameplay e usa estado simulado; o fundo vazio é esperado e não prova falha do render de jogo.
- Em 23:37:53 e novamente **23:44:55 UTC**, `HEAD http://127.0.0.1:5173/assets/ui/arpg/icons.svg` retornou HTTP200, `Content-Type: application/octet-stream` e `X-Content-Type-Options: nosniff`. A fonte atual de `server.mjs` já contém o mapeamento `.svg: image/svg+xml`, mas o processo observado PID2591 é anterior. Cabe a Combat testar o backend isolado e reiniciar 5173 preservando ranking local/env. Esse header incorreto é uma causa observada no servidor vivo; a origem exata do vazio em cada captura isolada deve ser confirmada após o MIME correto, sem presumir que todas usaram o mesmo processo.
- Testes de contagem de eventos/DOM/layout não detectaram o desenho ausente. Revalidar pixels/pictogramas efetivos em desktop e mobile com MIME correto e novas skills. Se persistir, inspecionar `use`, viewBox, tamanho e estilo SVG; não reescrever ícones antes de separar causas.

## Tooltip em mobile

Na fixture393x852, tooltip de Disparo Incendiário ocupa a faixa dos dois joysticks acima da barra. `pointer-events:none` evita bloqueio direto de toque, mas não a oclusão visual. Rever permanência após toque e posicionamento para que o usuário continue vendo os controles/ameaças. Não chamar essa observação de falha funcional de input sem reprodução correspondente.

## Primeiro catálogo VFX (histórico, seleção inicial)

Sete PNGs inspecionados em `output/playwright/2026-09-18T23-32-34-351Z-class-skill-vfx/`:

| Arquivo | Observação visual |
| --- | --- |
| warrior_flame_cleave-cast-high.png | Halo/chama dourados pequenos em torno da mão da figura de teste. |
| warrior_frost_nova-impact-high.png | Cristais em círculo, centro aberto e contorno fino; permite ler a figura central. |
| warrior_thunder_judgment-impact-high.png | Descarga vertical branca fina e pequeno círculo no alvo; pouca massa visual nesta imagem. |
| dwarf_incendiary_burst-impact-high.png | Chama dourada em volta do alvo sem apagá-lo completamente. |
| dwarf_cryo_grenade-travel-high.png | Faixa fria curva sutil e pequeno corpo ciano do projétil da fixture. |
| dwarf_arcane_shot-travel-high.png | Rastro roxo helicoidal e pequeno corpo roxo criado pela fixture. |
| warrior_frost_nova-impact-low-reduced.png | Menos cristais, preservando contorno da área. |

O próprio `verification.json` identifica `syntheticFixture:true`, `sourceChanged:false`, `passed:true`, sem erros,39capturas e6playbacks isolados. Os p95~16.7–16.8ms são desta fixture, não desempenho do jogo. Reset sem draws e detach são provas locais de lifecycle, não aceitação global.

As figuras/cores básicas são distinguíveis no cenário simplificado. O teste cria corpo próprio de projétil; isso não prova a existência desse corpo na integração real low/reduced-motion. Trails finos/raio precisam revisão contra neblina, horda, iluminação e cenário final. O pedido novo exige efeitos substancialmente diferentes: buff persistente, dash/charge, fogo abundante, freeze e campo gravitacional. Não basta preservar estas imagens ou trocar nomes.

## Gameplay e limites da captura

O screenshot real do guerreiro mostra o HUD e o ambiente com ruínas, árvores, caminhos e props. Foi obtido tarde em relação ao segundo cast, quando seu efeito já terminou: não permite julgar antecipação/impacto da nova. Capturas do próximo candidato precisam acompanhar o vídeo/fases do efeito e movimento durante preparo. Nenhum score10/AAA ou aprovação JEF foi concedido por esta revisão.

Encaminhamento: findings ao Combat e GUI via filas nativas verificadas dos agentes Orca; atualização de direção v2 enviada aos sete agentes. Aceite de fila não comprova leitura ou correção implementada. Registros em `../agents.json`.

## Atualização — pictogramas corrigidos na fixture GUI

Root inspecionou `output/playwright/2026-09-18T23-47-29-673Z-ui-arpg-verify/gui-fixture-warrior-desktop.png` e `gui-fixture-mobile-375x667.png`: ícones de arma e habilidades agora estão visíveis em ambas as imagens. O report possui54 verificações, fontes estáveis e nenhum erro de página/console/request/HTTP. A cobertura inclui desenho SVG efetivo, corrigindo a lacuna dos primeiros testes. É confirmação visual limitada à fixture: core de gameplay interceptado e seleção anterior à v2.

No screenshot375x667, o tooltip ainda ocupa a faixa dos dois joysticks; isso permanece como oclusão visual, mesmo que as **skills** não sobreponham os joysticks e os alvos de toque tenham44px. O teste "skills clear of both joysticks" não cobre a interseção do tooltip. Cabe ao dono verificar supressão/posição de tooltip em toque no candidato v2. Hashes das duas imagens e report em `followup-artifacts.json`.
