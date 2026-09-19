# Canhão — composição corrigida no staging, não promovida

**Confirmação normal02:27 PASS no gate existente65%.** Mínimos nas quatro ROIs originais11×11: high1 **65.289%**, high4 **76.860%**, low/reduced1 e4 **90.083%**. High1 tem margem de somente **0.289 ponto percentual**, 79dos121pixels, exatamente o mínimo inteiro exigido; perder um pixel reprovaria. Não extrapolar para câmera/horda/movimento variados, AAA ou gameplay. A continuidade cano→trajeto ainda bloqueia promoção.

[Plano/API/sete hashes](vfx-cannon-integration.md), [manifesto final](../../output/qa/vfx-cannon-wrapper-prepared-20260919.json), [confirmação11PNG](../../output/playwright/2026-09-19T02-27-19-472Z-cannon-wrapper-vfx-native/cannon-wrapper-report.json), [fatorial16PNG](../../output/playwright/2026-09-19T02-26-01-042Z-cannon-wrapper-vfx-native/cannon-wrapper-report.json). Ambas as rodadas têm fontes estáveis; nenhuma promoção. GPU própria liberada ao concluir02:27; sem CPU pesado próprio ativo.

## Diagnóstico solicitado pelo Root

Mesmo frame.86, câmera, alvos, pose e quatro ROIs. Reproduzida a sequência original de atualização da fixture; posição de contato comparada numericamente com02:15 (tolerância1e-5). Nenhum avanço da simulação entre variantes. Um renderer; esquerda mostra contexto gravidade+gelo, direita recebe fogo. Fatorial2×2×2×2: máscara original/candidata, contribuição do bloom, volume e brasas.

O controle de bloom existe somente numa cópia temporária do pipeline da fixture, com hashes de origem/instrumentação no report. Multiplica sua contribuição na composição por0/1; HDR, exposição, MSAA, extração/blur e estado do renderer permanecem iguais. Não usa a mudança para medium como atalho. Nenhuma edição no pipeline compartilhado, nenhum contrato novo necessário para a correção final. O jogo continua com bloom.

ROI central, onde ocorreu a reprovação:

Tabela derivada diretamente de `diagnosis[].occlusion[0]` do JSON02:26:01, preservado byte a byte; substitui a transcrição anterior.

| Máscara | Bloom | Volume | Brasas | Preservação |
| --- | --- | --- | --- | --- |
| Original | ligado | ligado | ligadas | 56/121 = 46.280992% |
| Original | ligado | ligado | desligadas | 64/121 = 52.892562% |
| Original | ligado | desligado | ligadas | 88/121 = 72.727273% |
| Original | ligado | desligado | desligadas | 93/121 = 76.859504% |
| Original | desligado | ligado | ligadas | 119/121 = 98.347107% |
| Original | desligado | ligado | desligadas | 121/121 = 100.000000% |
| Original | desligado | desligado | ligadas | 120/121 = 99.173554% |
| Original | desligado | desligado | desligadas | 121/121 = 100.000000% |
| Candidata | ligado | ligado | ligadas | 79/121 = 65.289256% |
| Candidata | ligado | ligado | desligadas | 80/121 = 66.115702% |
| Candidata | ligado | desligado | ligadas | 93/121 = 76.859504% |
| Candidata | ligado | desligado | desligadas | 93/121 = 76.859504% |
| Candidata | desligado | ligado | ligadas | 121/121 = 100.000000% |
| Candidata | desligado | ligado | desligadas | 121/121 = 100.000000% |
| Candidata | desligado | desligado | ligadas | 121/121 = 100.000000% |
| Candidata | desligado | desligado | desligadas | 121/121 = 100.000000% |

A tabela sustenta uma interação da emissão do fogo com a composição HDR/bloom e o contexto; **não sustenta atribuir a reprovação somente ao gelo/Horizon**. O gate mede diferença de cor contra a imagem de referência, não uma fração física de transparência; soma de pequenas diferenças pode cruzar o limiar em muitos pixels. O teste incremental96.694% da rodada inicial não substitui o gate do conjunto.

## Correção restrita à propriedade VFX

Duas expressões mudaram após o contrato/custo/ciclo02:15:

- Volume: atenuação máxima sobre oclusores altos95%→99.9%; transição em altura acima do chão.85–1.55m→.75–1.25m.
- Brasas:98%→99.9%, mesma transição.75–1.25m, para evitar somar emissão residual nos pixels já ocupados por silhuetas.

A altura é reconstruída do mesmo depth RGBA-packed usado pelo Horizon. Trata-se de uma heurística de geometria opaca elevada, não de uma máscara semântica de inimigos: props elevados também podem receber proteção. Fora dessa região, a emissão permanece igual. Não foram alterados temperatura, intensidade global, densidade/turbulência, contagem de brasas, perfil/padding, raio3.4, tempos de crescimento/cooling, dano ou vazão. Não há passe ou amostra adicional de textura. O manifesto verifica que, desfazendo essas duas expressões, controlador e shader voltam exatamente aos bytes02:15.

A confirmação normal usou o pipeline com bloom habilitado e nenhuma supressão diagnóstica:11PNG de fases.52/.74/.86/1.25/1.8 e coexistência1/4bursts high/low-reduced, corpo essencial e ambos consumidores no mesmo depth. Mínimo fogo isolado80.992% em.86; fases restantes amostradas100%. Os originais.74/.86/1.25/high4/low4 foram inspecionados: início ainda estreito, pico quente breve, pluma quebrada/ascendente e dissipação preservados. O feel do início exige animação/SFX/input reais; capturas estáticas não o resolvem. Low/reduced mantém a identidade, com turbulência menos detalhada.

## Escopo da prova técnica anterior

[Rodada02:15](../../output/playwright/2026-09-19T02-15-38-208Z-cannon-wrapper-vfx-native/cannon-wrapper-report.json): um prepass/uma textura para fogo+Horizon, gelo coexistente, pausa/câmera fora/retorno, miss sem impacto inventado, expiração/reset/dispose.71geometrias/49texturas estáveis após20reinícios. Parede é contato fornecido numa fixture com ruína real: remover apenas o cenário do depth altera2761pixels; isso prova efeito de oclusão, não colisão autoritativa do projétil.

GPU do predecessor02:15, frame completo1280×720 incluindo assets/HDR/depth,18queries úteis após6warmups: high1P957.224ms/high4P958.391ms; low/reduced1P954.254ms/4P955.254ms. Não são FPS, custo marginal ou mobile. Esses tempos não foram recapturados após a troca de constantes da máscara; workload não ganhou operações/passes, mas não afirmar medição de custo de bytes finais. CPU final02:27 wrapper18/18 e contrato compartilhado7/7 passaram com hashes atuais.

## Evidências rejeitadas preservadas

02:12 interrompeu lifecycle porque a fixture emitia um quinto tiro no passo zero após quatro bursts.02:15 corrigiu a fixture e passou tecnicamente, mas reprovou composição.02:17 máscara somente no volume ainda reprovou61.157%.02:21 produziu16PNG, porém toggle de brasas não restaurava visibilidade e houve erro de teardown da instrumentação; não é fatorial aprovado.02:22 confirmou a reprovação61.157%, revelando a diferença com o diagnóstico. Controle corrigido, brasas incluídas na proteção;02:26 repetiu o fatorial sem esses erros e02:27 confirmou sem modo diagnóstico. Diretórios e versões permanecem em `output/playwright/` e `iterations/`; nenhum limiar foi reduzido.

## Próximo gate antes de promover

[Origem core/adapter](review/cannon-origin-followup.md): a fixture artística começa no cano e não valida a separação1.587m para a origem real(-2,1.05,5). Próxima prova precisa usar core+adapter literais, parado/em movimento e alvos/parede próximos. Não deslocar autoridade1.05/dano/contato para favorecer o efeito.

Uma ligação visual entre socket e trajetória precisa de verificação de sólidos também no trecho de apresentação. Se o wrapper precisar receber um resolvedor visual de segmento do Combat/Physics, esse será um contrato proposto antes de editar main, seguido de candidato isolado e teste. Nenhum offset de dano ou curva através de parede foi implementado. Fonte atual permanece preparada para revisão, **não liberada para promoção automática**.
