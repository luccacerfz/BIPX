# Physics — pursuit terminal integrado em cópia e verificado nativamente

**Prova bounded concluída; sem promoção.** Chrome real, jogo completo, assets/render/RAF/input reais. As duas origens fixas chegaram e aplicaram dano melee; o jogador móvel provocou nova rota e também recebeu dano. Snapshot de226arquivos estável durante toda a captura, somente layouta5f4/navigatione46cc/adapterBloodCow diferem da cópia live inicial. Contacts912c real direto/transitivo. Nenhum Lich importado, nenhuma edição live ou restart5173 por Physics.

[Recibo final, hashes e limites](../../output/physics/pursuit-native-20260919/receipt.json) · [manifesto226 antes/depois](../../output/physics/pursuit-native-20260919/manifest.json) · [dados nativos originais](../../output/playwright/2026-09-19T04-52-58-805Z-physics-pursuit-native/report.json) · [auditoria posterior exata](../../output/playwright/2026-09-19T04-52-58-805Z-physics-pursuit-native/post-capture-audit.json) · [contrato inicial preservado](physics-pursuit-native-contract-initial.md).

**Atenção ao resultado do harness original:** `report.json` conserva `passed:false`. Norte/sul/custo passaram; a asserção móvel aplicava o limite da velocidade voluntária ao deslocamento total, incluindo crowd. A auditoria posterior reproduz todos os1746ticks com erro de posição zero, separa as contribuições e passa sem alterar limites, dados ou runtime. A falha original não foi apagada/reclassificada no arquivo. A aprovação bounded desta frente depende dos dois documentos juntos, não de um campo original alterado. O runner foi corrigido para exigir esse replay nas próximas execuções; sua versão usada nesta captura também está arquivada. Nenhuma repetição nativa foi necessária.

## Captura e escopo exatos

Preparação pelo menu real, classe warrior, qualidade high, Chrome headed1440×900. Fixtures identificadas usam o player `(18.933,14.268)` e BloodCow criado por `spawnZombie` real. Ao preparar o caso, somente posicionamento inicial, seed e supressão de ondas/traps incidentais são controlados; gameplay subsequente usa dt real de RAF. Não há invulnerabilidade, waypoint/dt/posição injetados na perseguição, alteração de dano, range, raio, velocidade ou multiplayer.

O spawn real gerou velocidade **3.073231175 m/s**, dano **28.1052**, vida743.04; seus valores foram mantidos. Player200HP, raio.64, velocidade6.5; boss raio1.72, alcance melee real3.10, LOSY.9. Os tempos não são equivalentes aos da fixture CPU de velocidade-base2.55: aquela evidência permanece separada.

| Fixture nativa | Primeiro dano real | Planos / máximo nós | Resultado |
| --- | --- | --- | --- |
| Norte `(16.56428861789936,8.359204549834535)` | **2.8472 s** | 1 /14 | Vida200→171.8948; distância3.087360; LOS livre |
| Sul efetivo `(16.847589032244333,18.323203398288207)` | **6.6675 s** | 4 /74 | Vida200→171.8948; distância3.085799; LOS livre |
| Norte com WASD | **1.5071 s**, durante input | 3 /14 | Player desloca5.047841 m; nova rota, dano e contato reais |

O sul é a posição efetiva histórica já corrigida para corpo1.72, não a solicitação inválida anterior. O spawn nativo manteve ambas as posições dentro de1e-6 m; nenhuma nova relocação na caminhada.

Na fase móvel foram enviados `W`450ms, `W+A`420ms e `A`300ms pelo teclado do browser, após observar o início da aproximação. O movimento foi parcialmente limitado pelos props existentes. O target inicial mudou para `(18.2096307,13.9218354)` e a rota foi refeita em1.1599s/2nós; novo plano em1.6252s/1nó para `(15.9535814,12.6587889)`. A primeira mudança é menor que o gatilho antigo de1.5m, mas invalida o terminal/LOS anterior: a API de região tem efeito observável. O jogador se moveu na direção de aproximação do boss; isto prova adaptação a esse input curto, não perseguição evasiva prolongada.

[Vídeo norte](../../output/playwright/2026-09-19T04-52-58-805Z-physics-pursuit-native/north-fixed.webm) · [vídeo sul](../../output/playwright/2026-09-19T04-52-58-805Z-physics-pursuit-native/south-fixed.webm) · [vídeo WASD](../../output/playwright/2026-09-19T04-52-58-805Z-physics-pursuit-native/north-moving.webm).

Inspecionados em resolução original: [hit norte](../../output/playwright/2026-09-19T04-52-58-805Z-physics-pursuit-native/north-fixed-melee.png), [hit sul](../../output/playwright/2026-09-19T04-52-58-805Z-physics-pursuit-native/south-fixed-melee.png) e [player móvel](../../output/playwright/2026-09-19T04-52-58-805Z-physics-pursuit-native/north-moving-player-moved.png). Boss e jogador visíveis, feedback vermelho−29 e contato na entrada da manutenção. Os dois PNGs imediatos de hit ainda mostram200 no snapshotHUD; a leitura de vida real já é171.8948 e a imagem móvel posterior mostra172. Render legado do BloodCow preservado; nenhuma aprovação artística ou novo gesto/rig. Integridade das três fixtures:1boss visível/0invisíveis/0ameaças invisíveis, zero errosJS/HTTP registrados. Vídeos preservados, sem alegar revisão manual de cada frame.

## Colisão, movimento e falha da primeira auditoria

A auditoria posterior usa os dt e as posições de jogador capturados no Chrome, com os mesmos `getPursuitDirection`, `createActorIndex`, `stepActor` e `separateControlledActors` do snapshot. Resultado: **1746ticks reproduzidos com erro máximo0**,1620segmentos de avanço/correção varridos livres de sólidos; poses estáticas válidas, budget≤4 e dano dentro de range/LOS.

Norte/sul fixos não tiveram correção de crowd. No WASD, o movimento do player entra inicialmente até **.0378709315 m** no boss; o caller atual resolve isso depois. Houve40ticks com correção de crowd, máximo **.0192737421 m** por tick; overlap final≤**.001000000000002 m**, a tolerância.001 já existente. Excesso máximo da locomoção voluntária sobre `speed*dt`:2.5e-15 m. Não se aumentou velocidade nem limite do solver. Não alegar zero overlap transitório quando o input do jogador cria contato antes da fase de separação.

A asserção original de velocidade total confundia essas fases e falhou corretamente como detector de diferença, mas não demonstrava violação da locomoção. [Runner executado, preservado](../../output/playwright/2026-09-19T04-52-58-805Z-physics-pursuit-native/runner-original.mjs), [auditor reprodutível](../../tools/physics-pursuit-native-audit.mjs). Os controles CPU anteriores de parede/LOS/barreira baixa/recinto fechado continuam como base e não foram repetidos.

## Custo pequeno de quatro planos no mesmo tick

[Dados e64ensaios](../../output/playwright/2026-09-19T04-52-58-805Z-physics-pursuit-native/four-plans-cost.json). Quatro BloodCows de spawn real no mesmo layouta5f4, alvo original.32ensaios independentes por versão, alternando baseline/candidato; os quatro primeiros por versão são aquecimento,28medidos. Estados dos atores são restaurados entre ensaios para provocar exatamente4planos por tick. Essa restauração é exclusiva da fixture de custo, não ocorre na perseguição acima. Duas posições solicitadas são corrigidas pelo spawn real; posições efetivas e parâmetros estão no JSON.

O mesmo `updateZombies` real, dt1/60, inclui construção do índice e crowd. Sem trace/serialização/auditoria geométrica no timer; o wrapper de navegação registra quatro chamadas e seu custo está incluído. Baseline usa nav911e0 sem região efetiva; candidato usa e46cc. O main é a mesma cópia com adapter, cuja opção é ignorada pelo nav antigo.

| CPU nativo, ms | Baseline | Candidato |
| --- | --- | --- |
| updateZombies mediana |44.1|4.5|
| updateZombies P95 |46.9|5.0|
| updateZombies máximo |47.5|5.3|
| Navegação agregada P95 |46.5|4.8|

Todos os ensaios planejaram exatamente4 e limparam o índice no finally. Baseline esgota768nós por ator; candidato visita281/300/358/391 e no máximo10conectores terminais. **É ganho do trabalho total neste caso; não isola o overhead da nova API a igual número de nós, não mede FPS e não estabelece teto de5ms para768nós+256conectores.** Nenhuma medição de400atores/horda, suite global ou nova matriz72.

## Fontes, propriedade e encerramento

Combinação testada: main adapter **c0fbc03b** sobre live **afc7d5ac**, navigation **e46cc63f**, layout **a5f46359**, contacts **912c00fe**, server **29bbf681**. Hashes completos no recibo; somente os três deltas selecionados em226arquivos. Fonte nativa e live ficaram estáveis durante captura. No fechamento posterior, outro dono promoveu apenas AldricGLB **0e5da9d8→5c1903a0**; nossa cópia continua0e5d. Esta evidência não é retroativamente uma captura do GLB OPAQUE novo. Main/server/Physics/layout atuais continuam iguais aos observados na preparação.

Contrato publicado antes do snapshot e recebido por Combat via Orca, `msg_72fc250e0292`; janela confirmada em `msg_00effae8b4e1`, após VFX e antes do Lich. O aviso por terminal sem interrupt retornou `agent_prompt_stalled`, portanto não foi usado como recibo de entrega; a resposta Orca de Combat confirmou a coordenação. [Recibo da janela](../../output/physics/pursuit-native-20260919/gpu-window.json). Lock foi adquirido atomicamente; browser, servidor efêmero com ledger próprio/Supabase off e token encerrados em finally. Liberação enviada a Combat `msg_21b39a8c1666` e VFX `msg_a8f96280f2e4`. Nenhuma nova GPU Physics prevista.

Arquivos exclusivos novos: `tools/physics-pursuit-native-prepare.py`, `physics-pursuit-native-fixture.js`, `physics-pursuit-native-run.mjs`, `physics-pursuit-native-audit.mjs`; snapshot/evidências/documentos próprios. Preparador recusa sobrescrever o snapshot existente. Nenhum arquivo de Combat/Environment/Animation foi editado, nenhum Lich incorporado, nenhuma promoção ou restart do servidor5173. Integração live continua dependente da revisão e dos donos; multiplayer e sua política melee permanecem intactos.
