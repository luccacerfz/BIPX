# Astra 2 — matriz nativa do dash e gate estrito

**Resultado: harness fortalecido; 12/12 execuções de dash passam tecnicamente, com 428/428 frames vivos de travel contendo ponta alinhada nos dois clientes. Arte final não aprovada: oclusão remota por copa e sobreposição de rótulos/cartas impedem leitura completa em cenários reais.** Miss, obstáculos, contatos letais e comparação com escudo foram capturados sem fixture. Sobrevivente atingido especificamente pelo dash não foi obtido.

Task `task_8645f1d896a7`, dispatch `ctx_9e8587e8cba3`, Run `run_f726ad723cdd`. Coordenação global preservada. Não alterei runtime vivo, integration-v1, fontes/evidências anteriores, servidor 5173 nem ranking local. Sem JEF/deploy.

## Fonte e reprodução

Base: `output/qa/aaa-20260919/integration-v1/candidate/`. Main SHA256 `dd23e1b5590852b7077551d31dd4ded2a3e88515e1da282ac02ed3a86e0ccc20`; pool `0d8efb4ad3f087ca9e8f670289ec3cb692a53f76ea8704dde55e0faf33faa212`; wrapper `08d5abfe3d69563eb0be90101ddd90753b66e1b57deac528813ba777d5bfe1a5`. Manifesto próprio: `output/qa/aaa-20260919/astra-dash-native-v2/source-manifest.json` com todas as fontes, hashes de harness/observer/gate e verificação dos 239 arquivos vivos e 240 arquivos do candidato/snapshot. Nenhuma divergência. Evidências originais de dash-segment-v1 conferidas contra os hashes anteriores e preservadas.

Captura: `output/qa/aaa-20260919/astra-dash-native-v2/native-2026-09-19T09-28-55-357Z/`; `report.json` SHA256 `33f98402aac52621913fe0574128ca00b583dd8af2f625ab7e140af7dd1267cd`. Chrome `153.0.8010.48`, WebGL/ANGLE Metal, headless, viewport 1440×900, dois contextos reais com servidor WebSocket efêmero. Qualidade high/reduced=false e low/reduced=true verificadas na API de apresentação de ambos; reduced foi configurado pela preferência de mídia antes da navegação. Não equivale a hardware mobile. Lock GPU próprio adquirido atomicamente e liberado pelo token; browser/contextos e servidor próprios encerrados no finally.

Comandos desde a raiz do repo:

```sh
node output/qa/aaa-20260919/astra-dash-native-v2/test-strict-gate.mjs
BIPX_EVIDENCE_DIR=output/qa/aaa-20260919/astra-dash-native-v2/telemetry node output/qa/aaa-20260919/astra-dash-native-v2/capture-matrix.mjs
node output/qa/aaa-20260919/astra-dash-native-v2/verify-captured-matrix.mjs output/qa/aaa-20260919/astra-dash-native-v2/native-2026-09-19T09-28-55-357Z/report.json
```

O script exato usado na captura positiva está preservado em `capture-matrix-recorded.mjs`; após a captura, `capture-matrix.mjs` recebeu somente retorno de processo não zero quando a matriz termina com gate técnico reprovado (os negativos já eram registrados individualmente). Não houve repetição do candidato para alterar o resultado. A captura cria novo diretório com timestamp, verifica fontes antes/depois e falha se o lock pertence a outro dono. Usa snapshot próprio byte-idêntico; a rota main recebe somente o observador adicional registrado por hash. Os wrappers encaminham as funções originais uma vez e leem dados após render. Nenhuma alteração de dano, XP, recursos, invulnerabilidade, inimigos ou posição foi usada. Percepção por getters de posição/alvos/colliders e atuação por mouse, WASD, Space, Digit2/3 e escolha real de cartas. É jogo natural controlado por piloto automatizado, não avaliação humana de dificuldade.

## Novo contrato do harness

- `strict-gate.mjs:8-10`: cada frame com `following && motionPhase==='travel'` exige ponta finita e erro menor que **0,00001 m**. A mesma regra vale para caster e observer, inclusive entre eventos e cauda terminal; uma única ponta ausente reprova. Preparo/release anterior ao travel e registros já expirados não são rotulados como travel vivo.
- Também exige frames entre eventos e cauda em ambos, expiração observada, alinhamento de arco/pool, um cast/slot por janela e igualdade literal dos eventos autoritativos recebidos. Nenhum limiar foi reduzido.
- `capture-matrix.mjs` instala `context.addInitScript` antes de `goto`, ouvindo keydown/keyup em captura antes dos listeners da UI. Cada cast arma sua própria janela de `performance.now`; só os inputs dentro dela são verificados. As 12 janelas contêm exatamente um keydown e um keyup Digit2 confiáveis, na ordem correta.
- `test-strict-gate.mjs`: **10 controles CPU**; o relatório histórico passa somente na parte de ponta e reprova no contrato completo de input, pois não contém keydown. Controles sintéticos de teclado são explicitamente sintéticos, nunca apresentados como captura.
- `verify-captured-matrix.mjs`: **12 positivos nativos + 48 negativos esperados** sobre cópias da matriz nova. Cada cenário reprova ao remover uma ponta local, uma remota, keydown ou keyup. `fresh-negative-controls.json` preserva o resultado; nenhum dado original foi adulterado.
- A tentativa inicial de escrever uma regra de inatividade usando somente motionPhase detectou como travel um registro já eliminado do pool; a regra foi corrigida antes da captura para considerar `released`, preservando a semântica do gate anterior e a exigência nova sobre todo travel vivo. Isso não foi uma falha de runtime.

## Matriz observada

L/R = caster local / observer remoto. Todos os cenários abaixo tiveram **5/5 frames de cauda terminal**, input completo confiável, zero erros de console, eventos autoritativos iguais e expiração observada. O erro máximo de ponta de toda a matriz foi **9,520816e-7 m**, abaixo do limiar inalterado. Os totais são frames de medição focal, não amostragem de desempenho.

| Qualidade | Cenário | Percurso autoritativo m | Pontas L/R | Entre eventos L/R | Contatos do dash | Técnica | Arte / limite |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| high | miss | 8.000000 | 27/27 | 19/19 | nenhum | PASSA | Aceite focal do arco/corpo e expiração; esteira discreta |
| high | obstacle | 1.315483 | 8/8 | 6/6 | nenhum | PASSA | Aceite focal da parada; sem contato com inimigo |
| high | contact-attempt-1 | 8.000000 | 24/25 | 16/17 | 8 morto | PASSA | Local legível; remoto REJEITADO por copa (A2-01) |
| high | contact-attempt-2 | 0.678394 | 9/9 | 7/7 | nenhum | PASSA | Parcial: sobreposição com poste, árvore e horda |
| high | contact-attempt-3 | 8.000000 | 27/27 | 19/19 | nenhum | PASSA | Corpo/lâmina legíveis no frame; miss não prova contato |
| high | contact-attempt-4 | 5.965644 | 20/20 | 14/14 | nenhum | PASSA | Corpo/lâmina legíveis no frame; contatos do dash ausentes |
| low-reduced | miss | 8.000000 | 27/27 | 19/19 | nenhum | PASSA | Aceite focal de arco/expiração; esteira discreta |
| low-reduced | obstacle | 1.428781 | 8/8 | 6/6 | nenhum | PASSA | Aceite focal da parada; sem contato com inimigo |
| low-reduced | contact-attempt-1 | 8.000000 | 17/17 | 11/11 | 9 morto | PASSA | Arco/corpo legíveis; corte do cadáver não confirmado visualmente |
| low-reduced | contact-attempt-2 | 5.508330 | 14/17 | 9/11 | 6 morto | PASSA | REJEITADO para leitura completa: cartas cobrem parte do combate |
| low-reduced | contact-attempt-3 | 8.000000 | 26/26 | 18/18 | 16 morto, 23 morto | PASSA | REJEITADO para leitura completa: loot/nomes sobre o gesto (A2-02) |
| low-reduced | contact-attempt-4 | 0.000014 | 5/5 | 4/4 | nenhum | PASSA | Bloqueio quase imóvel sem esteira longa; leitura local do corpo aceita |

As tentativas sem impacto **não** foram contadas como contatos nem como sobreviventes. O último low/reduced avançou apenas 0,000014 m antes do bloqueio; não houve faixa longa inventada. O obstáculo dedicado mirou o collider real em aproximadamente `(2,471; -7,305)` depois do miss inicial, sendo interrompido após 1,315 m/high e 1,429 m/low. O cenário inicial percorreu 8 m nas duas qualidades sem impacto.

Contatos letais de dash: high alvo **8**; low/reduced alvos **9**, **6**, **16** e **23**, todos com `killed:true` no evento autoritativo replicado. Isso prova morte pelo dash nestes casos, mas não certifica por si só divisão visual do cadáver. Nenhum `killed:false` de dash ocorreu. A investida usada para comparação atingiu **3 sobreviventes em high** e **1 em low/reduced**; são contatos do escudo e não preenchem a lacuna de sobrevivente do dash.

A comparação de escudo teve confirmação de eventos, screenshot e sequência visual, porém não recebeu o gate de pontas do dash (não aplicável). Seu volume/contorno branco frontal e gesto com escudo distinguem-se do arco fino azul/branco preso à lâmina do dash, nos dois modos. Aceite focal dessa distinção, sem aprovação de timing de stun/área global.

Partidas no encerramento: high 35,53 s de relógio de run, 17 abates totais, nível 3, 142 de vida, até 20 alvos observados; low/reduced 40,67 s, 19 abates totais, nível 3, 67 de vida, até 22 alvos. Abates totais incluem ataques básicos/cooperação e não devem ser atribuídos integralmente ao dash. São recortes curtos, não partidas prolongadas nem teste de adversidade de rede.

## Inspeção artística e achados

Inspecionei os quatro vídeos por sequências de frames extraídas em CPU: 16 filmstrips cobrindo miss, obstáculo, primeiro contato e escudo, nas duas vistas e qualidades. Conferi screenshots em 1440×900 dos contatos posteriores e detalhes da oclusão. Os PNGs em `review-frames/<cenário>/` mantêm resolução nativa; mosaicos JPG estão reduzidos para navegação. A amostragem de 10 Hz não é playback integral de todo frame, nem prova de fluidez/performance; os WebM completos permanecem disponíveis. Não ouvi áudio.

**A2-01 — P1 visual reproduzido: copa encobre o guerreiro remoto e a lâmina no contato high.** A screenshot `high-contact-attempt-1-observer.png` mostra o nome “Astra caster” sobre a copa, com o corpo/arma ocultos; a sequência `review-frames/high-contact-attempt-1-observer.jpg` conserva vários frames consecutivos do desaparecimento na copa. Enquanto isso, a vista local mostra o corpo e o trace mede ponta alinhada. Reprodução: após miss/obstáculo e aproximação natural, caster parte de `(1,117; -10,097)` mirando `(4,534; -16,146)`; observar pelo segundo cliente, que segue atrás. Rejeito o aceite artístico remoto nesse cenário. Encaminhar a Environment/integração a cobertura de oclusão de atores remotos relevantes, preservando profundidade e sem alterar colisores; não diagnostiquei nem corrigi a implementação nesta tarefa.

**A2-02 — P2 visual reproduzido: rótulos/loot se sobrepõem ao gesto em low/reduced.** Em `low-reduced-contact-attempt-3-caster.png` e `-observer.png`, o rótulo “Lâmina encantada” e nomes ocupam a região de corpo/arma durante o combate. Em `low-reduced-contact-attempt-2-caster.png`, uma evolução legítima abre cartas durante a execução e cobre parte inferior da ação; as esferas seguem visíveis. Não é reintrodução do bug de vida escondida nem prova de falha de autoridade, mas limita a avaliação do contato e da recuperação. Encaminhar a GUI/integração opções de posicionamento/oclusão de rótulos e análise do momento das cartas, mantendo a regra autorizada de cartas em tempo real.

**Esteira e lâmina:** o arco curto acompanha a arma; o torso/escudo ficam identificáveis em campo aberto, high e low/reduced. A esteira é fina/discreta em escala de jogo, principalmente vista de trás sobre as pedras e junto ao anel do jogador. Não houve nova evidência de segmento remoto ausente ou extensão indefinida; expiração e bloqueios são coerentes. A legibilidade de um rastro cortante contínuo como direção de arte permanece parcial, sem nota 10 ou aceite final. Não atribuí círculos preexistentes no chão, swings básicos ou dano de outros ataques ao dash.

**Corte de cadáver:** mortes autoritativas foram obtidas, porém não identifiquei separação inequívoca do cadáver nos recortes observados, com sobreposição de horda/nomes e efeito curto. Registrar como requisito visual pendente, não como implementação comprovadamente ausente. A simulação de cinco mortes não substitui essa observação.

## Vídeos e próximo handoff

- high / caster: [page@07b2c3b9f584b49456647ab21a007c00.webm](../../../output/qa/aaa-20260919/astra-dash-native-v2/native-2026-09-19T09-28-55-357Z/page@07b2c3b9f584b49456647ab21a007c00.webm) — SHA256 `9cb6337bd56d1a17d9122ac4a3d8d61cff0e8e45144c17f202ebe0556a5b4015`
- high / observer: [page@fdd52741cbfc03cc96e8742cbb517c5b.webm](../../../output/qa/aaa-20260919/astra-dash-native-v2/native-2026-09-19T09-28-55-357Z/page@fdd52741cbfc03cc96e8742cbb517c5b.webm) — SHA256 `f3a94614f2fb0c31d0eddee932780943070e316458024289fe073b53e6208f24`
- low-reduced / caster: [page@b2e83d5b2724b9c222f5c9f706dd57e0.webm](../../../output/qa/aaa-20260919/astra-dash-native-v2/native-2026-09-19T09-28-55-357Z/page@b2e83d5b2724b9c222f5c9f706dd57e0.webm) — SHA256 `031671df8e86dc96a22b693d92df7feb352a3b52b7cc21f9ed973220a2281977`
- low-reduced / observer: [page@dc8500523973816d209bf244464dba1c.webm](../../../output/qa/aaa-20260919/astra-dash-native-v2/native-2026-09-19T09-28-55-357Z/page@dc8500523973816d209bf244464dba1c.webm) — SHA256 `3f682a0aecb8afe0c6f3b6e7c2b9677a0bba6a28dceb9694a57c4b0211fb7595`

`matrix-summary.json` reúne medições sem as estruturas grandes; os JSONs de cada cenário conservam antes/depois, alvos, inputs, eventos, buffers e gate. `source-manifest.json` e `artifact-manifest.json` identificam fontes e evidências.

Entrego o harness fortalecido para futuras integrações. Não há patch de runtime nesta tarefa. Próximos passos do coordenador: atribuir A2-01/A2-02 aos donos, obter sobrevivente atingido por dash quando houver alvo natural adequado e revisar morte/corte/recuperação em sequência legível após corrigir oclusão. Preservar esta matriz positiva técnica e negativa artística. Não repetir JEF idêntico; publicação e avaliação global continuam fora desta entrega.
