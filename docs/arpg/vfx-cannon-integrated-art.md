# Canhão integrado — revisão focal do material gravado

**Achado artístico confirmado nos quadros inspecionados:** a gravidade domina o centro compartilhado; o fogo aparece como uma pluma/crescente laranja pequeno acima dos alvos. Não foi encontrado um pico de explosão de fogo forte e separadamente legível nessas amostras. Isso não invalida os checks de eventos/depth/visibilidade, mas impede chamar o impacto artístico resolvido ou AAA.

[Report com hashes, PTS e telemetria extraída](../../output/qa/vfx-cannon-integrated-peak-20260919/review.json). Fonte: WebM real high da rodada Combat03:35, main7bde570f, SHA879677e0…566286. Foram decodificados23quadros adicionais em CPU,12 deles inspecionados individualmente na resolução original; também foram lidos os originais Root9.92/10.08/10.16/10.56. Nenhum replay/browser/GPU ou nova captura, nenhum arquivo runtime alterado. Amostragem não equivale a revisão contínua do vídeo.

Nos quadros PTS9.80–10.08 examinados, o núcleo preto/anel claro e gás violeta permanecem dominantes; números de dano já aparecem em9.84. Nos quadros pós-pausa selecionados, o laranja se separa parcialmente pela borda superior, ainda discreto. A pausa cobre parte da janela, portanto esses frames não estabelecem o máximo perceptual de todo o vídeo.

## Relógios e contato

Eventos simulados reais: cast8.244, release8.5441, impact8.6614. A maior escala de blast amostrada ocorre no frame de simulação8.79, `impactAge=.1505`, raio do volume1.29987, temperatura3500, opacidade.95 e `visible=true`. A pausa segura simulação8.94/idade.30; depois há dissipação progressiva até o volume ficar invisível. **Esses tempos não são os PTS do WebM.** Nem `visible`, nem o máximo da escala do shader prova um pico visual forte.

Contato canhão `(-2.249177,1.05,-.133824)` e centro gravidade `(-2.573671,.08,-.117350)` distam apenas **.324911m em XZ**. É uma sobreposição quase central, diferente da separação dos fixtures anteriores. Raio de dano3.4 e raio de campo5 permanecem autoritativos; não usar a escala interna do volume como novo raio de gameplay.

## Hipótese verificável e contrato proposto

A fonte atual envia volumes do fogo em `renderOrder=12`, core14, brasas15. Com um campo, o pool ordena Horizon24, nebula25, debris26 e sparks27. Ambos os raymarches leem depth opaco; não existe integração mútua das transparências. Logo, o campo posterior pode cobrir a chama anterior no mesmo centro. Essa observação estática é compatível com os frames, **não isola a causa**: proteção de torso e composição HDR/bloom também podem contribuir.

Após o checkpoint Combat, preparar somente cópia: fogo isolado, gravidade isolada, combinação atual e variação diagnóstica da ordem, nos mesmos contatos/poses/câmera e idades. Conservar máscara de atores/gate65, cores/intensidades globais, envelope térmico, raio3.4, tempos/eventos e um depth compartilhado. Não resolver ocultação simplesmente apagando a gravidade ou retirando a proteção de atores. Se for preciso alterar Horizon ou compositor/pipeline compartilhado, entregar contrato ao Combat antes da implementação conjunta. Não há patch runtime autorizado por este diagnóstico.

Para a captura focal já prevista pelo Combat: uma janela sem menu sobre o impacto, cobrindo antes do contato até aproximadamente.6s de idade simulada e registrando simultaneamente `impactAge`, esclarece a lacuna. Não requisitar outra suíte global. Main recebeu depois a correção focal de morte `afc7d5ac`; a prova deste documento continua atribuída à gravação7bde570f. Fonte VFX atual preservada, GPU desta frente livre.

## A/B focal autorizado e concluído04:04 — ordem contribui, variante rejeitada

[Report final/quatro PNGs](../../output/playwright/2026-09-19T04-04-44-230Z-cannon-concentric-vfx/report.json). [Pico amostrado high.1505](../../output/playwright/2026-09-19T04-04-44-230Z-cannon-concentric-vfx/high-0.1505.png), [high.30](../../output/playwright/2026-09-19T04-04-44-230Z-cannon-concentric-vfx/high-0.3.png), [high.50](../../output/playwright/2026-09-19T04-04-44-230Z-cannon-concentric-vfx/high-0.5.png), [low/reduced.1505](../../output/playwright/2026-09-19T04-04-44-230Z-cannon-concentric-vfx/low-reduced-0.1505.png). Os quatro originais foram inspecionados. Mesmos contatos quase concêntricos da gravação, idades e relógio do shader, poses congeladas/assets/câmera entre painéis, HDR+bloom e materiais intactos. Apenas visibilidade das contribuições e `renderOrder` mudam por painel. Fonte runtime VFX byte-idêntica; sem novo framework/pipeline/pass de depth ou suíte global.

**Limite de reprodução:** telemetria original não guarda matrizes de ossos/cadáveres nem matriz de câmera por frame. Usamos os dois alvos da última amostra antes da morte, assets reais em pose controlada e câmera ARPG estável48°/17m/20m,1440×900 por painel. Portanto é diagnóstico causal da composição nessa reconstrução, não replay exato do WebM nem revisão do gameplay pós-morte.

Fogo isolado tem massa quente claramente reconhecível. Na composição atual, o núcleo preto e a nebulosa cobrem a maior parte dessa massa. Mudar somente o fogo de ordens12/14/15 para44/46/47 faz o núcleo laranja reaparecer. **A ordem é uma contribuição causal demonstrada neste arranjo**; não é mais apenas inferência do código. Porém essa variante preenche o núcleo preto com laranja, perde a relação espacial entre volumes e não é uma solução selecionada.

Gate65 permanece reprovado nesta nova cena: Lyra recebe véu violeta mesmo na contribuição gravidade isolada. A/B não reduz bloom nem remove proteção. Valores derivados do JSON, fração de121pixels dentro do limiar RGB65:

| Idade/qualidade | Fogo só: Lyra | Gravidade só: Lyra | Atual: Lyra | Ordem alterada: Lyra | Menor dos dois inimigos: atual → alterada |
| --- | ---: | ---: | ---: | ---: | ---: |
| .1505/high | 100% | 38.017% | 38.017% | 38.017% | 98.347% →100% |
| .30/high | 100% | 26.446% | 26.446% | 26.446% | 99.174% →100% |
| .50/high | 100% | 26.446% | 26.446% | 26.446% | 97.521% →100% |
| .1505/low reduced | 100% | 30.579% | 30.579% | 30.579% | 100% →100% |

Esta separação controlada sustenta que o véu medido sobre Lyra já existe no campo sozinho **nestas poses**, sem atribuir toda falha de composição histórica à gravidade. O antigo79/121 e o native03:21 continuam cenas/gates independentes. `technicalPassed=true` significa zero erros/GL e um depth por painel; `artGate.allCombinedPassed=false` é o resultado artístico real, não aprovação.

**Contrato proposto ao Combat, ainda sem implementação:** manter `prepareSceneDepth/setSceneDepth` e a união de raízes/um prepass atuais. Antes de promover qualquer ordem nova, VFX precisa composição com profundidade entre núcleo/campo/chama: descritores limitados por campo ativo (centro, extensão do núcleo, envelope, câmera/frame), consumidos pelos materiais para distinguir chama à frente e atrás do núcleo, preservando máscara opaca. Não basta dar prioridade fixa ao fogo nem torná-lo aditivo. A proteção de Lyra na camada do gás é outro gate explícito. Se esse estudo requerer textura intermediária ou callback no compositor, especificar API/custo e obter acordo do dono antes de editar `cinematic-pipeline.js`/main. Até lá, shaders/pipeline live continuam congelados; somente este diagnóstico está entregue.

Histórico preservado: tentativa04:02 encontrou lock ocupado e não abriu GPU; após lock ausente,04:03 capturou com um erro de visibilidade do próprio harness entre painéis, invalidado em `invalidated-review.json`, sem atribuir defeito ao runtime.04:04 restaura as raízes antes de preparar cada consumer e esconde a camada completa de estados no painel fogo isolado. Somente a matriz curta corrigida foi repetida. Browser/servidor/lock desta rodada encerrados em finally;5173 intacto.
