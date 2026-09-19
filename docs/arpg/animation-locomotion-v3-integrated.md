# Continuidade07952 — prova integrada e limites

Fonte promovida em01:30:35 na janela Combat01:29: `src/assets/hero-locomotion.js` SHA `07952bfc2e36dfed257a9f6f27dd582981c89a8dd2c791a92c1c1724be65f2b5`. df93 preservado, sem mudança de takes/GLBs/flags. [Recibo](../../output/arpg-animation/locomotion-v3/promotion/promotion.json).

Combat executou a captura integrada real após freeze01:32; Animation conferiu os registros e PNGs, sem repetir GPU/suíte. [Análise reproduzível desta frente](../../output/arpg-animation/locomotion-v3/promotion/integrated-proof.json) vincula cinco relatórios de telemetria, todos source-stable e com todos os hashes registrados iguais aos arquivos atuais durante a análise. Nenhum wrapper/instrumentação de biblioteca foi aplicado: o jogo fornece `getActorMotionState()` somente leitura.

## Deslocamento pós-colisão

[Physics gameplay01:40:30](../../output/playwright/2026-09-19T01-40-30-052Z-physics-gameplay/physics-gameplay.json), ambas classes pass, input real em mundo natural. Mantendo W contra o gradil emZ=−8.27, os últimos seis registros de cada classe mostram `gait:'Idle'` e posição estável. Portanto intenção de andar bloqueada não mantém corrida visual.

Movimento tangencial posterior: Aldric avança1.404m emX comΔZ=0 e `StrafeD`; Lyra1.403m comΔZ=0 e `StrafeA`. Dash e charge do guerreiro também foram bloqueados pelo gradil. Nenhum HP/posição/velocidade/tempo foi injetado. Essa parte é offline; não afirmar colisão de parede remota a partir dela.

## Atores remotos

[Rede01:39:04](../../output/playwright/2026-09-19T01-39-04-801Z-verify-arpg-network/arpg-network.json), dois browsers reais:188amostras por personagem em strafe/stop. Cada `motion.x/z` coincide exatamente com a posição da malha remota interpolada. Movimento observado seguido por desaceleração a.197244m/s Aldric e.197056m/s Lyra ao término da janela. Esse limite não prova Idle completo posterior, mas comprova desaceleração do sampler remoto.

Os seis IDs de cast foram confirmados nos dois clientes; reconnect e terceiro latejoin passaram no mesmo relatório. Mais que duas classes/renderings não é benchmark de horda, mobile ou soak. Nenhum novo cast/corte/API foi alterado nesta promoção.

## Novo achado concreto: apoio remoto ainda falha

No mover guerreiro `423c1898-73a0-4c17-9c2f-f73f43e1f07a`, amostra39 do relatório de rede: `StrafeC`, velocidade4.615688m/s, pé direito `contact:true/locked:true`, erro de alcance.400868m e probe mínimo emY=.256174m. Amostras37/38 já mostram crescimento do erro. O sampler está ligado ao deslocamento correto, mas o solver mantém um apoio inviável durante esse transiente de arrancada/mudança de marcha. **Não há aprovação física/visual desse trecho.**

Lyra remota chega a.044228m de alcance excedido na amostra36, `Run`, pé esquerdo liberado. Esses são diagnósticos de witnesses do controlador, não o auditor independente de todos os vértices da sola. Não houve replay pareado df93 com os mesmos tempos/yaw; portanto não atribuir regressão à correção de release07952 nem afirmar que ela resolveu esses casos. Preservar a fonte congelada nesta janela; próximo ajuste deve ocorrer em staging e ter prova própria de start/stop/turn/casts.

## Inspeção e reprodução

Inspecionados quatro PNGs atuais: Aldric parado no gradil, Lyra tangencial no gradil e os dois screenshots de ator remoto após strafe. Há sobreposição de personagens e oclusão por árvores; o dwarf remoto fica amplamente encoberto em um deles. Não são revisão contínua do vídeo, leitura completa de grip/cintura ou nova aprovação artística. Vídeos originais permanecem nas pastas de captura Combat acima.

```sh
node tools/animation-integration-audit.mjs \
  output/playwright/2026-09-19T01-39-04-801Z-verify-arpg-network \
  output/playwright/2026-09-19T01-40-30-052Z-physics-gameplay \
  output/arpg-animation/locomotion-v3/promotion/integrated-proof.json
```

O analisador confere fonte atual, flags de estabilidade, sampler/posição, desaceleração remota, Idle bloqueado e retomada tangencial; conserva máximos físicos sem aprová-los. Se qualquer fonte mudar, deve recusar vincular a nova fonte a essas capturas.

Integração pós-colisão/remoto comprovada nesse escopo; `acceptedNoSliding:false`, AAA pendente. [Ré rápida separada](animation-backward-v4-staging.md) permanece retida por regressão de contato. Nenhuma reserva GPU própria foi criada nesta revisão; servidor5173/PID97873 preservado.
