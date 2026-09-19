# Goal ativo: qualidade AAA, multiplayer e produção

O usuário atribuiu a orquestração à sessão `01a0b8c0-c642-7ee3-9f38-5f7234f855fb`: melhorar o BIPX, avaliar com JEF até 10/10, comprovar multiplayer fluido e publicar o candidato validado na produção Vercel. O goal permanece ativo até todos os requisitos estarem comprovados. A autorização de publicação substitui a proibição histórica de deploy; não autoriza apagar fontes, rankings ou trabalho local.

Run Orca: `run_f726ad723cdd`. Terminal de coordenação: `term_2c92353e-2d09-430c-88cf-cfeeaeb6f924`. Astra high, Fable 5.1 high e Grok 4.6 high são os modelos selecionados. Não usar Gemini. A sessão Astra anterior é especialista/integrador; esta sessão é o coordenador principal. Os sete donos de arquivos anteriores continuam preservados até entrega ou redistribuição explícita.

## Aceitação

Manter os 12 critérios de `docs/quality-gates.md`: design/classes, animação/contato, arte, VFX, combate, UI/fluxo, mobile, áudio, desempenho, multiplayer, acessibilidade e confiabilidade. JEF recebe observações textuais honestas de evidências revisadas; não afirmar que ele viu/ouviu imagens/vídeos. Não transformar lacunas em nota 10, baixar o limiar, ignorar falhas ou reconsultar candidato idêntico para obter nota favorável.

As seis habilidades v2 de `docs/arpg/skill-direction-v2.md` continuam vigentes. Locomoção sem sliding exige medição de sola e playback nativo; multiplayer exige ao menos dois clientes reais, continuidade entre snapshots, late join/reconnect e condições adversas declaradas. Produção exige fonte/artifacto identificável, endpoint público funcional e dois clientes jogando após a publicação.

Preservar originais e fontes WIP; sem reset/clean/commit/merge/push não solicitados. Servidor 5173 e ranking local continuam disponíveis. GPU é serializada pelo lock atômico `/tmp/bipx-arpg-gpu.lock`, sem liberar lock de outro dono. Guardar evidências em subpastas por tarefa, com hashes e escopo. Não executar suítes globais enquanto módulos relevantes estiverem em edição concorrente.

## Tarefa Fable: auditoria de design e experiência

A mensagem inicial ao Fable chegou truncada; nenhum relatório foi produzido por aquela tentativa. Esta atribuição é completa e substitui a mensagem incompleta.

Ler este documento, `docs/quality-gates.md`, `docs/arpg/aaa-review-20260919.md`, `docs/arpg/skill-direction-v2.md` e os handoffs GUI/Combat. Verificar game design, identidade das duas classes, progressão/recompensas, ritmo/dificuldade, HUD, entrada/menus/upgrade/morte/restart, keyboard/focus/labels/reduced motion, controles mobile e legibilidade. Inspecionar a fonte atual e exercitar cenários focais quando disponíveis; medições sem interação real não aprovam usabilidade. Não repetir uma bateria global inalterada.

Entregar `docs/arpg/aaa-20260919/fable.md`: achados P0/P1/P2 com impacto no jogador, reprodução, arquivo/linha, hash do candidato e evidência. Separar defeito reproduzido, suspeita estática e requisito pendente. Para os achados mais importantes, preparar propostas/patches isolados em `output/qa/aaa-20260919/fable/`, sem alterar `src/`, `index.html`, `styles.css` ou outros arquivos dos donos atuais. Informar claramente quando não houver defeitos reproduzidos; não inventá-los.

O coordenador revisará e atribuirá a implementação necessária. Cumprir o preâmbulo Orca vigente da tarefa; não reutilizar IDs antigos. Usar `ask` para bloqueios concretos e entregar `worker_done` ao concluir. Como recuperação de comunicação, `codex queue --thread 01a0b8c0-c642-7ee3-9f38-5f7234f855fb --message TEXTO` chega ao coordenador, sem `--json`.

## Tarefa Fable 2: corrigir experiência em candidato isolado

A auditoria foi recebida. Implementar F-01 a F-04 em `output/qa/aaa-20260919/fable-fixes-v1/candidate/`, copiando a fonte atual e mantendo manifesto de hashes antes/depois. Nenhuma alteração no runtime vivo. Reservar GPU somente durante browser e respeitar outros donos. Manter cartas em tempo real e vida/recurso visíveis; não mudar autoridade ou balanceamento. Corrigir foco sem impedir navegação de teclado nos diálogos, campos ou menus. Espaço em controles de UI deve manter semântica de ativação quando apropriado; testar navegação por Tab e retorno ao jogo, além de WASD/dígitos após clique no som.

Implementar resumo de morte com dados existentes e foco inicial explícito, restaurar identidade do menu e corrigir textos divergentes, sem novos sistemas. Reexecutar sondas focais desktop/mobile sobre o candidato, registrar novo before/after e verificar ausência de alterações nos arquivos vivos. Entregar patches aplicáveis, relatório `docs/arpg/aaa-20260919/fable-fixes.md`, hashes, evidência real e limitações com worker_done. Não repetir auditoria global. Progressão de skills S-01 fica para tarefa separada após esta entrega.

## Próximas frentes

## Tarefa Grok 2: reconexão e autoridade de movimento

A auditoria Grok foi recebida. Implementar correções dos achados P0 disconnect e P1 snapshot/active e teto de movimento em candidato isolado `output/qa/aaa-20260919/grok-network-v1/candidate/`, copiado da fonte atual e com hashes antes/depois. Não editar runtime vivo nem reiniciar 5173. Não aplicar propostas sem analisar o fluxo completo: estado desconectado deve continuar ou expirar segundo tempo autoritativo definido, sem congelar buff/projétil na ausência; identidade e recompensas devem permanecer coerentes; snapshot de cliente nunca autoriza hits/Set enviados pelo cliente. Clamp de locomoção deve considerar velocidade real da classe, buffs e frame/packet timing, preservando dash/charge autoritativos e usando correção explícita quando necessário. Não inventar teto 12 m/s sem derivá-lo dos contratos vigentes.

Reproduzir os bugs e a correção com servidor real isolado e dois clientes WebSocket, cobrindo desconexão no buff/campo/projétil, retomada na graça e após expiração, late join, payload adulterado, rede irregular e movimento legítimo das classes. Preparar patches com hashes e relatório `docs/arpg/aaa-20260919/grok-network-fixes.md`. Browser/GPU fica em etapa seguinte coordenada; testes de protocolo não aprovam fluidez visual. O status HUD da gravidade e solver crowd ficam para tarefas separadas. Entregar worker_done e preservar todas as evidências negativas.

## Tarefa Astra: revisão independente do dash e handoff

Coordenação atual nesta Run; não retomar a coordenação global da sessão antiga. Fable corrige UI em candidato isolado, Grok corrige rede em candidato isolado, coordenador prepara release e serviço público. Entregar `docs/arpg/aaa-20260919/astra-status.md` com ownership atual, deltas e localização do loader JEF (nunca seu valor). A execução padrão deve bastar; se um comando exigir aprovação, não aprovar automaticamente nem escalar: registrar impedimento e pedir ao coordenador o resultado da leitura necessária.

Revisar independentemente `output/qa/aaa-20260919/dash-segment-v1`: correção do segmento remoto, manifesto, negativo preservado, CPU integrado 7/7 e nova captura nativa `native-2026-09-19T08-58-17-805Z/report.json`. Dois Chrome reais enviaram um Digit2 confiável; local/remoto geraram 8 segmentos, 19 frames de ponta entre eventos e 5 frames de cauda; 11 eventos autoritativos idênticos, sem erros de console e fontes estáveis. Isto é evidência focal, não aprovação artística nem global. Inspecionar vídeo/frames reais e fonte literal; verificar que o novo gate falha quando não há ponta (o anterior aceitava lista vazia). Cobrir ausência de movimento, corte por teleporte, quality low/reduced motion e arte/silhueta se a evidência existente não basta. GPU só com lock próprio.

Entregar `docs/arpg/aaa-20260919/astra-dash-review.md` com aceite/rejeição técnica e artística separados, lacunas objetivas, hashes e patch final pronto para integração se aprovado. Não alterar runtime vivo: haverá integração única pelo coordenador dos candidatos revisados. Não submeter JEF repetindo evidência idêntica nem declarar 10 sem cobertura. Encerrar tarefa com worker_done.

## Tarefa Fable 3: semântica das cartas e jogo natural

Recebi e revisei os patches F-01 a F-04. O rótulo +Cadência está aprovado como tradução consistente; não muda a regra. Preservar v1 e preparar v2 isolada: corrigir o status falso "Em pausa" quando apenas há cartas abertas, mantendo habilidades indisponíveis e seleção 1/2/3; tornar a formatação numérica coerente com pt-BR. Verificar pontualmente cartas e pausa verdadeira, foco e atribuição das teclas. Não editar fonte viva.

Depois jogar naturalmente as duas classes no candidato por pelo menos 120 s ativos por classe (reiniciar se morrer), usando movimento, mira, ataque básico, as três habilidades e escolhas de upgrade reais. Não criar XP, dano, inimigos, recursos ou invulnerabilidade por fixture. Capturar vídeo real e registrar o que conseguiu testar: mortes, tempo sobrevivido, abates, escolhas e dificuldades. Avaliar se as cartas realmente beneficiam a classe/habilidades e apontar defeitos reproduzidos de ritmo ou progressão; não implementar novo sistema ainda. GPU com lock próprio e janela serializada; coordenador executa apenas um smoke curto de pacote antes. Entregar patches v2 e `docs/arpg/aaa-20260919/fable-natural.md` com hashes/limites; worker_done ao concluir.

## Tarefa Grok 3: fechar as lacunas da revisão de rede

Não aprovo v1 para integrar ainda. O review independente `output/qa/aaa-20260919/coordinator-review/network-dt-negative.json` usa normalizer literal e stepActor real em mundo vazio: pedido legítimo de 1,1 m após 220 ms avança só 0,5 m porque stepActor limita dt a 0,1; 100 mensagens no mesmo timestamp avançam 13,54 m porque minDt=1/60 renova crédito por pacote. Preservar v1. Corrigir em v2 isolada com orçamento de deslocamento por tempo autoritativo, acumulador limitado para jitter e sem crédito grátis por mensagem. No caminho de colisão, consumir o orçamento físico completo ou reportar/reconciliar o tempo descartado; não alterar o solver vivo.

Provar os casos com servidor WebSocket real (burst agrupado, long gap, 20/60/120 Hz, diagonal, parada/reinício, buffs/upgrades, dash/charge). A asserção de movimento legítimo deve conferir a distância correta e ausência de correções indevidas, não apenas >0,2 e <3. Além disso, o snapshot active foi apenas exposto: main.js syncPersistentSkillPresentation ainda lê somente buff/fields. Registrar essa lacuna de apresentação para o integrador; não declarar o projétil de late join visualmente corrigido. Verificar relógios de buff/campo durante ausência de TODOS os clientes, expiração natural, nenhum replay de dano/recompensa, e retomar dentro da graça. Entregar v2 com relatório e worker_done, sem editar runtime vivo/GPU.

## Tarefa Astra 2: evidência visual do dash e teste mais estrito

Revisão anterior recebida e verificada pelo coordenador; não repetir o handoff. Preservar dash-segment-v1 e resultados. Em pasta nova `output/qa/aaa-20260919/astra-dash-native-v2/`, fortalecer o harness: exigir ponta em todos os frames travel vivos de ambos os clientes, e registrar keydown/keyup confiáveis desde addInitScript anterior aos listeners da UI, filtrando pela janela do cast. Testar o negativo removendo pontas locais e remotas. Não alterar runtime vivo nem enfraquecer limiares.

Capturar a matriz focal que faltou usando `output/qa/aaa-20260919/integration-v1/candidate/` (manifesto próprio, dash revisado + Fable UX v2, CPU integrado 7/7). Reutilizar/adaptar harness do dash-segment-v1 sem sobrescrever seus resultados. Com lock próprio de GPU: high e low/reduced, dois clientes reais, contatos reais e miss/obstáculo; incluir sobrevivente e morte se for possível obter por jogo natural. Movimento/mira/ataques/habilidades por input real, sem invulnerabilidade/XP/dano simulados. Se algum caso exigir fixture, separar e rotular claramente, sem apresentá-lo como natural. Inspecionar vídeos e escala de jogo: esteira, leitura da lâmina/corpo, contato, expiração e distinção da investida. Entregar `docs/arpg/aaa-20260919/astra-dash-native-v2.md` com medições e aceite/rejeição por cenário, registrar honestamente qualquer caso não alcançado. Nenhum deploy/JEF; integração da fonte segue no coordenador. Encerrar com worker_done usando somente o novo preâmbulo.

## Tarefa Fable 4: +Área coerente com as habilidades

Entregas v2 e jogo natural recebidas; fonte integrada pelo coordenador em integration-v1, ainda sem promoção viva. Implementar em candidato isolado novo a conexão do upgrade +Área com as áreas anunciadas das skills (Canhão/Glacial/Núcleo; examinar coerência da faixa de Escudo/Corte sem alterar a distância autoritativa percorrida). Manter seis IDs, custos, controles e identidade. Usar multiplicador de progressão confiável, congelado no cast; nunca aceitar raio/multiplicador enviados no payload do cliente. Manter física de projétil, range, paredes, resistências de chefes, centro fixo do campo, uma recompensa por vítima e cleanup.

Eventos/status, HUD/descrição e VFX devem mostrar o raio efetivo. Baseline sem upgrades permanece equivalente. Cobrir offline/servidor com métricas de raio/atingidos e sólidos, snapshots coerentes, expiração e payload adulterado; não afirmar VFX/horda verificados sem render. Grok altera snapshots active em candidato separado: coordenar o campo novo de raio por mensagem para merge posterior, sem editar o candidato dele nem runtime vivo. Basear o novo candidato em integration-v1. Entregar patch incremental e relatório `docs/arpg/aaa-20260919/fable-area.md`. Não alterar a rampa inicial nesta tarefa; as partidas naturais com piloto automático fundamentam investigação, não nota de dificuldade humana. Encerrar com worker_done.

Grok já executa auditoria técnica de física, autoridade, multiplayer, confiabilidade e desempenho, com saída `docs/arpg/aaa-20260919/grok.md`. A próxima tarefa formal deve partir dos achados reais, preservando o trabalho em curso. Astra entrega o estado dos candidatos e donos em `docs/arpg/aaa-20260919/astra-status.md`. O coordenador prepara o artefato de release e verifica os serviços atuais em paralelo, sem publicação antecipada.
