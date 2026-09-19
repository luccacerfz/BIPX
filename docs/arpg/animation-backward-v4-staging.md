# Ré rápida Lyra — novo retarget em staging, não promover

Runtime permanece continuidade07952bfc, com o sidecar original e `RunBackwardFast` rejeitado ainda excluído. Este ensaio não altera velocidade do gameplay, rig/GLBs originais, solver, flags ou auditor root. Sem uso de GPU.

## Mudança concreta de referência

`tools/animation-backward-retarget.mjs` reconstrói `RunBackwardRetargetV2` diretamente do take Mixamo `RunAlternate` exportado de Aldric (sword and shield run 2), com referências avaliadas de `RunBackward` da Lyra. Não reutiliza as curvas de `RunBackwardFast`.

O default do GLB coloca Hips em Z≈.439579m no espaço fonte; animações avaliadas usam Y-up e Hips XZ≈0. O novo retarget começa na pose animada do alvo, alinha as direções de coxa/canela ao donor e preserva offsets/comprimentos animados da Lyra. Foot/Toe usam delta de rotação do bind convertido à mesma base Y-up. Máximo planar do quadril7.22e−8m; alteração adicional de posição local dos bones0; erro máximo de direção9.57e−7. O export original já tem variação local de até4.306e−5m contra o bind; foi preservada, não contada como deformação introduzida.

Saída principal: `output/arpg-animation/backward-v4/candidate/src/assets/dwarf-locomotion-clips.json`, SHA `d3cd29b3a56dedece8a96462ad32f10105de914fc1a0a7faeb69a54bbcc58861`. [Procedência, hashes e poses amostradas](../../output/arpg-animation/backward-v4/retarget.json). Todos os três GLBs lidos ficaram byte-idênticos. Staging parte do controller07952; nenhuma alteração nele.

## Auditor independente intacto

[Oito casos, fonte estável](../../output/arpg-animation/backward-v4/variants/donor-foot/output/qa/arpg-root-review/2026-09-19T01-31-41-437Z-sole-contact.json), mesmo `sole-contact-audit.mjs --transition-detail`. Comparação contra candidato07952 anterior:

| Lyra | Antes | Novo donor-foot |
| --- | ---: | ---: |
| Ré9.1: mismatch m/s |1.722138|≈0|
| Ré9.1: alcance excedido m |.093232|0|
| Ré9.1: mínimo sola m |−.015636|.002000|
| Ré9.1: P90 apoio m/s |.259328|.922169|
| Ré9.1: P90 transição m/s |3.882069|6.134007|
| Ré9.1: cobertura patch |23.889%|17.500%|
| Ré6.5: P90 apoio m/s |.137075|1.418485|
| Ré6.5: P90 transição m/s |1.946317|5.643988|
| Ré6.5: cobertura patch |31.528%|19.444%|

Rate da ré9.1 caiu de2.2 saturado para1.986561, stride1.06 mantido. O take resolve a capacidade de passada/alcance deste ciclo, **mas piora contato e aterrissagem**, e também é escolhido em6.5 pelo seletor atual. Por isso fica retido. Demais seis casos preservam os resultados anteriores. `acceptedNoSliding:false`; release-release sem amostras continua null, não pass.

## Variante de orientação do pé rejeitada

Ensaio `--target-foot` mantém a rotação mundial original dos pés/toes da Lyra, transferindo só direções da coxa/canela. Preservado em `output/arpg-animation/backward-v4/variants/target-foot/`, [auditor específico](../../output/arpg-animation/backward-v4/variants/target-foot/2026-09-19T01-36-37-372Z-sole-contact.json). Ré9.1: apoioP90.259553m/s, porém transição8.438562m/s, cobertura10.417% e mismatch.557521m/s. Alcance0 e sola.002m não compensam essas regressões. Fonte estável, não promovido; o staging principal voltou à variante donor-foot, sem apagar nenhuma prova.

## Integridade e limites

[18casts CPU](../../output/arpg-animation/backward-v4/variants/donor-foot/output/arpg-animation/skill-v2-cpu.json) passam protocolo/torso/finite, máximo alcance.153911m, igual ao baseline. Esses casts diagonais não aprovam cast especificamente em ré; essa lacuna permanece. [Controller CPU](../../output/arpg-animation/backward-v4/variants/donor-foot/output/hero-locomotion/controller-cpu.json): cinco checks de integridade/start-stop/turn/revive/pernas contínuas passam, sem aprovação de contato ou transientes físicos. As duas primeiras tentativas do harness falharam por diretórios/baseline ausentes no novo snapshot; corrigido apenas setup, sem alterar asserts.

Não houve captura nativa desta ré, nem aprovação de cintura/apoio por vídeo para este take. Próximo passo é explicar a velocidade material na aterrissagem e a relação driver/quadril renderizado, preservando máscara, métricas e torso. Só depois avaliar seleção por velocidade, ré em casts/start-stop-turn,30/60Hz e playback próximo/jogo. Não elevar cadence/stride ou recortar amostras para transformar este resultado em aprovação.

## Coordenação da fonte promovida

A melhoria localizada07952 já está no runtime em janela Combat01:29. Combat publicou freeze01:32 e adicionou `getActorMotionState()` somente leitura para medir local/remoto; suas provas integradas01:39/01:40 foram [revisadas por Animation](animation-locomotion-v3-integrated.md), sem repetir a suíte global. O protótipo de captura com wrappers, criado antes de existir esse getter, foi preservado **sem execução** em `output/arpg-animation/backward-v4/unexecuted-integration-prototype.mjs`; não é evidência nem dependência runtime.
