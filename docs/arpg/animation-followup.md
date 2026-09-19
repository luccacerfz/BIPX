# Animation — seguimento das revisões root

Estado atual: corte v3 promovido após corrigir a mão flutuante; [handoff final e prova death-only](animation-cut-v3-handoff.md). Fonte/GPU liberadas. Skills/locomoção v2 intactas; candidatos de continuidade somente em cópia isolada. Texto de corte abaixo registra a etapa anterior à promoção e não substitui o handoff final.

## Revisão de sola e retiming

Revisões lidas integralmente: `review/locomotion-and-contracts.md`, `review/sole-contact-audit.mjs`, `review/locomotion-followup.md`, `review/v2-death-cut-review.md`.

A revisão b958aca é anterior à correção de swing df93d75. Nova auditoria de8casos: `output/qa/arpg-root-review/2026-09-19T00-18-16-033Z-sole-contact.json`, fonte estável, acceptedNoSliding:false. Como o auditor ganhou hashes desde o primeiro relatório, reexecutei o baseline em cópia isolada com o auditor/dependências/GLBs atuais: `output/arpg-animation/contact-comparison-2026-09-19T00-22-17-013Z/comparison.json`. Só `src/assets/hero-locomotion.js` difere entre as cópias; runtime não foi modificado. Mesmos8casos confirmam melhora de swing: Lyraforward53.9%→12.3%, strafe49.8%→11.1%, ré45.2%→8.4% de pés junto ao piso sem apoio declarado. Amostra de patch liberado nos2frames passa a count0/p90null; não é p90zero nem aprovação. Apoio/transições/alcance/rede ainda pendentes conforme locomotion-followup.

Tempos v2 atuais do core e Animation são iguais. Main passa duration/impactAt/elapsed explícitos. Novo teste `tools/animation-retiming-cpu.mjs`, prova `output/arpg-animation/retiming-2026-09-19T00-20-49-880Z.json`:36casos de6skills ×3 pares duração/emissão ×local/remoto. Tempos do core, preparo curto/recuperação longa, preparo longo/recuperação curta, dt irregular e zero, pose de torso/arma comparada no rig real. Fonte estável, erro de relógio na emissão0; erro máximo da matriz da pose em recuperação7.55e-14. Sem escala dupla; básico/gesto não são provas de apoio.

## Corte v3 em avaliação

Antes preservado em `output/arpg-animation/death-cut-v3/before/`, incluindo controlador, pool, ferramentas e handoff/manifesto v2. Candidato acrescenta gravidade12m/s², impulso curto, tombamento das metades e apoio no piso antes do fade1.65s. Suporte é calculado dos vértices visíveis de cada metade e das interseções do corte; projeção convexa no eixo de tombamento permite limite inferior exato sem skinning integral por frame. Margem nominal12mm sobre groundY, sem alterar rig/geometria do original.

Tampas escuras estilizadas vêm da seção da malha na pose da morte. Pequenas descontinuidades das malhas são fechadas somente na tampa, até2% da altura; segmentos isolados menores5mm recebem acabamento de1.5mm. Registra contornos reparados/gap, sem chamar isso de remesh anatômico. Geometria das tampas é privada e descartada uma vez; meshes/texturas do personagem permanecem compartilhados.

`tools/animation-cut-fall-cpu.mjs`:16casos de4rigs ×2poses ×2orientações, incluindo groundY0/.4. Prova em `output/arpg-animation/death-cut-v3/candidate-cpu.json`: fonte estável; limite inferior medido dos vértices acima do piso+11.8mm; ambas metades apoiadas aos.85s; torso cai mais25cm antes do fade; originais preservados. Regressão existente status/pool/reuso passou na cópia isolada, em `candidate/output/arpg-animation/enemy-state-v2-cpu.json`.

Native comparativo em preparação/execução com `tools/animation-cut-preview.html` e `tools/animation-cut-native.mjs`: override explícito apenas no servidor efêmero da fixture. Runtime ainda não promovido. API e limite24 do pool preservados. Prova death-only em gameplay integrado e nova promoção dependem da janela coordenada; anti-slide permanece reprovado.


## Continuidade isolada após liberação do corte

[Candidato e regressão explícita](animation-locomotion-v3-candidate.md): preservação do witness reduz release do strafe a~1mm/frame nos mesmos3ciclos, mas casts móveis dwarf chegam a22.4cm de erro de alcance. Não promovido; runtime/coverage originais preservados.
