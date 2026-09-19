# Dash guerreiro — art1 isolado

## Resultado07:13:56 — GPU liberada, art1 retido para refinamento

[Relatório nativo](../../output/vfx-dash-art-v1/native-2026-09-19T07-13-48-249Z/report.json), [revisão dos6originais](../../output/vfx-dash-art-v1/native-2026-09-19T07-13-48-249Z/art-review.json), [recibo](../../output/vfx-dash-art-v1/native-receipt.json). Cinco pares high.12/.30/.50/.83 e low-reduced.30, playback pareado registrado e um input real separados. Zero errosGL/console, fonte candidata estável,121/121 em cada uma das5ROIs de torso nos5frames. Gate local65 passa; não é robustez de horda nem seleção artística/custoGPU.

**Não promover art1.** Repetição de crescents removida, mas arco/esteira/sparks ficam fracos na câmera ARPG. .50 possui2contatos reais/10sparks, cuja contagem não prova peso artístico. .12 já não tem preparo ativo (life.12 expirou), portanto não julga os instantes anteriores. Decay.83 já limpo. O portal azul é cenário. Nenhuma alegaçãoAAA ou playback contínuo revisado.

Input real confirmou received→drawn socket máximo.251301742m, média.167138772m em23frames; min.046746779m. [Proposta Combat pós-mixer](vfx-dash-post-mixer-contract.md), somente apresentação, preservando histórico/clocks/autoridade. Remoto não medido. Esta é prova local separada da fixture artística.

[Integridade posterior estrita](../../output/vfx-dash-art-v1/native-2026-09-19T07-13-48-249Z/integrity-post-audit.json):39/39, exatamente3deltas autorizadosLich (main d9e/servereb80/animated-enemiesf11) contra recibo de promoção +36originais iguais;234arquivos da cópia renderizada conferidos. O pedido de novo recibo pre-capture chegou após o término; não existiu esse recibo contemporâneo. O runner usado tinha assertVFX-only e foi preservado, assim como report/live-before. Conferência posterior não prova ausência de escrita transitória duranteGPU. Runner futuro corrigido para recibo39antes e igualdade39depois, sem afrouxarassert. Nenhuma recaptura para rebatizar procedência.

[Paridadeebb8→d9e](../../output/vfx-dash-art-v1/native-2026-09-19T07-13-48-249Z/main-order-parity.json) confirma presentClassSkill e trecho mixer→VFXupdate iguais. Título da imagem “live atual” refere-se ao parent congeladoebb8; live já temLichd9e. Não usar esta captura para validarLich. Combat/Environment avisados por msg_d0256c7d37ba/msg_ed12e0ba2b89; token/browser/HTTP próprios encerrados07:13:56,5173intocado. Nenhuma próxima reservaGPU.


## Escopo e estado07:14UTC

Propriedade VFX. Candidato em `output/vfx-dash-art-v1/`; nenhuma promoção ou escrita em main/core/Animation. Root autorizou a janela após encerramento Combat07:05:47/confirmado07:08:53 e Animation07:00. Native em andamento com token próprio; cinco pares ARPG/Aldric5c e um playback sintético, seguidos por um input real local para medir socket. Não repetir física/global/seis skills. Fonte congelada main **ebb8c9b2**,234 arquivos; integração Combat Lichd9e no live é assimetria explícita, sem rebase desta prova.

## Defeito observado e melhoria causal

[Revisão da baseline](../../output/vfx-dash-art-v1/baseline-review.json) preserva originais, hashes e limites. Gameplay03:35 estável e frames00:12 mostram crescents independentes da lâmina; a implementação ainda emite slash a cada2.2m high/2.8m low/3.2m reduced, além dos glyphs de release/contato. O trecho steel travel é byte-idêntico entre a fonte histórica e o live atual. Os frames extraídos do WebM têm PTS, não idade exata do cast; recorte tardio é apenas recuperação/contexto. A fixture00:38 com boneco não é aceite artístico.

Art1 troca os stamps por um arco principal e uma esteira contínua entre sockets recebidos. Preparação curta concentra no emissor; impacto direcional somente para cada contato confirmado, preservando dedup do wrapper. Nenhum hit/morte/cadáver/SFX novo. Clocks .22/.36/.78, alcance8m e raio.85 permanecem do core.

Fontes reais MIT pinadas e originais/licenças preservadas em [sources.json](../../output/vfx-dash-art-v1/sources.json): Samurai BladeImpact (drag direcional), HandCast VoidSlash/VoidSpine (corpo/borda luminosa), Linear NeonTrail/PathTrail (núcleo/borda, taper e histórico). Não é ampliação do antigo anel.

## Arquivos/API e custo estrutural

Somente dois arquivos candidatos: `dash-vfx.js` **09915fd5ab6ea453751f7eef46547702e0585a7dfc35bd7932a5fc108565f994**, `class-skill-vfx.js` **3652081a78a997673adf47b2431a8fca61b30cdf6d87b73809dec10919082947**. [Freeze/patch](../../output/vfx-dash-art-v1/freeze-manifest.json) preserva todos os pais. API externa emit/update/reset/dispose/quality/reduced permanece; stats inclui dash. Uma malha instanciada,576 slots máximos,32,256bytes de atributos, sem novo RT/prepass. Isso não é medida de tempoGPU.

Zero-length terminal/miss mantém gesto curto sem impacto; resetTrail/teleport descontinuam esteira. Reduced conserva arco/corpo, encurta histórico e reduz sparks. Não toca corpse cut da Animation. Grito/composição selecionados permanecem byte-idênticos exceto integração de chamadas no wrapper.

## Validação e lacuna de apresentação

[CPU6](../../output/vfx-dash-art-v1/cpu-report.json) passou: replay histórico, core10/60Hz high/low-reduced com autoridade idêntica, extremos recebidos, terminal/miss, dedup/pausa/reset/dispose e ausência de novo depth. Sintaxe passou. CPU só demonstra endpoint==payload.

Root identificou ordem `updateClassSkills`→`presentClassSkill`→`heroVisual.update`; o socket recebido precede mixer do frame. Não há lag nativo confirmado ainda. A fixture reproduz essa ordem e registra socket após mixer; o input real acrescenta observador somente leitura após render e mede received/drawn por travel fresco. Remoto não será medido neste recorte. Se confirmar desvio, propor ao Combat apresentação pós-mixer mínima, sem alterar core/timers/eventos nem mover a esteira histórica. Shader/arte e esta medição são escopos separados. Sem seleção final/AAA antecipada.
