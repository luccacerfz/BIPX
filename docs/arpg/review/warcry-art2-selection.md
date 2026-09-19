# Grito art2 — seleção incremental

Root, 19/09/2026, após captura nativa 05:49. Direção selecionada para integração limitada; acabamento AAA e aceitação global continuam pendentes.

Revistos os quatro PNGs originais de `output/vfx-warcry-art-v1/art2/native-2026-09-19T05-49-07-327Z`: preparação .22, release .48, buff 1.8 e release low/reduced. Também cinco frames extraídos do WebM original em `output/qa/arpg-root-review/warcry-art2-20260919`, incluindo tempos lógicos .633 e .833 indicados na própria captura. Revisão amostrada, não playback contínuo nem gameplay natural. O PNG extraído em PTS2.9 existe mas não foi inspecionado nesta seleção.

Preparação tem concentração dourada perceptível no tronco/arma. O release ganha uma frente radial no chão, mais coerente que os fragmentos isolados anteriores; a comparação .633 mostra sua extensão e .833 sua dissipação. Corpo/ameaças continuam reconhecíveis nessas poses. Buff sustentado permanece sutil, próximo da baseline; plumas ainda parecem ornamentais e a poeira é fraca. O círculo azul é cenário, não contribuição deste grito.

Fonte selecionada: `warcry-vfx.js` SHA256 `111e989bfc793fe392ae263a812b2a43e639e4f39bdd49364a99e8f97779e7c8`, wrapper `e0675bb091e00008f9eb4e554e01197efcb45a8c7a428c83c30f9dc1e5eefd76`. Aldric5c OPAQUE nos dois lados; depth corporal um draw. Report técnico estável/sem erros e mínimo preservado informado .91735 no gate .65; não equivale a legibilidade universal. Core/buff8s/release.38 preservados.

Combat/VFX podem preparar integração mínima após cast real parado e em movimento, origem/socket, pausa/expiry e custo limitado do prepass que o grito passa a solicitar. Não copiar wrapper histórico sobre composição nova. Não há autorização aqui para ignorar falhas dessas verificações. Não repetir matriz global antes do lote.

Próxima iteração artística em cópia: aura com ritmo e assimetria aderente a ombros/arma, término legível e poeira granular curta. Preservar centro corporal limpo, alcance/duração e bloom global. A promoção incremental não encerra o requisito AAA do usuário.

## Bloqueio localizado de integração — preparação em movimento

Reprodução Root06:02:49: `output/qa/arpg-root-review/warcry-moving-prepare-20260919/reproduce.mjs` e `report.json`. Core real a863, pool selecionado111e, mainc0fbc estáveis. Ator declarado a6.5m/s, socket idealizado amostrado somente nos eventos existentes: aos.3667s a origem visual permanece0 enquanto ator está2.3833m adiante; release.3833 reposiciona corretamente. Controle parado sem atraso. O core emite cast/release/status, sem atualização intermediária da preparação. Nenhum render/input/rig real foi reproduzido neste teste CPU.

A seleção artística permanece, mas a promoção precisa corrigir essa descontinuidade antes do cast nativo em movimento. Combat/VFX devem fornecer atualização somente de apresentação para root/emissor atuais local/remoto enquanto prepara, preservando releaseOrigin da onda, clocks/deduplicação/autoridade. Não reenviar cast/release para mover a arte. Isso não autoriza congelar o personagem ou mudar o alcance/core para ocultar o defeito.

## Preparação móvel corrigida — integração selecionada 2026-09-19T06:34:13.599373+00:00

Root leu o diff pool111e→2cd4, API/wrappercdbdf764, mainaf0c→ebb8c9b2 e os8checks do caller. Pool só reposiciona um cast existente em preparo, não cria evento/clocks/status, mantém releaseOrigin independente. Caller registra cast aceito, consulta root/socket depois do mixer, limpa por release/end/morte/reset/disconnect e mantém TTL limitado. Aldric tem weapon e não muzzle; a ordem de fallback não muda seu socket entre fases.

Novo nativo `output/vfx-warcry-art-v1/art2-follow/native-2026-09-19T06-31-25-728Z/report.json`: input real de menu/teclado, fontes/mainebb8c9b2 e9VFX selecionados servidos, Aldric5cOPAQUE, sem setters de gameplay. Três casos passam: parado high, movimento high, movimento low/reduced. Deslocamento durante preparo2.2737/2.28085m; erro de root/socket0, onda sem deriva0. Um cast, release e end por caso; buff8s, pausa congela relógio/remaining e expiração encerra apresentação.

Root viu quatro originais: moving-prepare/release/buff e moving-reduced-release. Faixas douradas acompanham corpo, onda legível no lançamento, aura permanece no corpo ao atravessar a copa. O stipple da árvore ainda é problema de Environment, não uma melhora atribuída ao grito. Sustain/poeira continuam discretos; esses stills e telemetria não concedem revisão contínua de áudio/vídeo nem AAA.

Um único prepass nos frames visíveis. Medição apenas desse passe,4warmups+12amostras: mediana parado.33025ms, móvel.304437ms, low/reduced.4664165ms; máximos.575041/.951916/.520583, nenhum disjoint. Não é delta global de FPS nem custo total do efeito; modos foram execuções diferentes.

**Autorizar integração agora do main mínimo mais9VFX combinados**, preservando GUIboss/server16ac/Environment153/GLBs atuais. Aplicar hashes selecionados e conferir todos os deltas/HTTP; não copiar snapshot inteiro. Nova avaliação real JEF do checkpoint integrado deve registrar estes ganhos e as limitações, sem reatribuir antigos testes globais. Sem repetir os três casts ou benchmarks inalterados.

Integração efetiva06:35:08: main ebb8c9b2 e9VFX,228fontes. Root conferiu10HTTP200 com bytes/hashes exatos e228fontes sem drift em 2026-09-19T06:36:26.487174+00:00. Recibo independente: `output/qa/arpg-root-review/warcry-gravity-promotion-20260919.json`. ServidorPID5973 sem restart; root5173HTTP200.

JEF real pós-integração06:38:03.458UTC: HTTP200, jev-1.13.0, evidenceSHA13710eec, `requires_further_work`. As12notas aceitas continuam pendentes; há escores preliminares textuais, sem avaliação visual/sonora direta. Caminho `output/qa/arpg-warcry-composition-checkpoint-20260919/jef.json`. Não encerra o goal.
