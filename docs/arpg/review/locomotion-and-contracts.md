# Revisão independente: sola, poses e critérios ARPG

Revisão root em 2026-09-18T23:27:03.222691+00:00. Alterações de runtime pertencem aos sete agentes Astra; esta revisão não as modifica.

## Achado prioritário para Animação: arraste fora do apoio declarado

O verificador anterior só mede velocidade de vértices quando `contact.contact` é verdadeiro em ambos os frames (`tools/hero-locomotion-contact-surface.mjs`). A correção de solo do runtime, por outro lado, também desloca para cima os pés liberados (`src/assets/hero-locomotion.js`, região do comentário "including the released swing"). Isso torna possível uma bota ficar rente ao chão e se mover rapidamente sem entrar na métrica de apoio.

Executei `node docs/arpg/review/sole-contact-audit.mjs`: oito casos, duas classes, 120 Hz, 1 s de aquecimento + 3 s medidas. O loader mantém geometria/skin/ações e remove apenas referências de imagem em memória. O diagnóstico é CPU, plano constante e sem input real; não é gameplay nem aprovação visual. Fonte estável: **True**, hashes do controlador, loaders, sidecars, GLBs, Three e verificador no JSON.

Seleção independente: mesmo vértice de material em frames consecutivos, até 8 mm do piso, até 3 mm do ponto mais baixo de sua sola e velocidade vertical até 0,05 m/s. Nenhuma flag do controlador exclui amostras. Valores são critérios de diagnóstico, não limites novos de aceitação. Percentis são por amostra de vértice; cobertura de frames e contagem acompanham o resultado para não tratar uma amostra esparsa como aprovação.

| Classe / movimento | P90 no apoio declarado (m/s) | P90 com pé liberado nos dois frames (m/s) | Amostras de vértice liberado | Pés junto ao piso sem apoio declarado |
| --- | ---: | ---: | ---: | ---: |
| warrior / forward (6.5 m/s) | 0.394 | 2.714 | 6 | 5.7% |
| warrior / strafe (6.5 m/s) | 0.295 | 24.635 | 244 | 31.0% |
| warrior / backward (6.5 m/s) | 0.598 | 20.775 | 621 | 45.1% |
| warrior / upgraded-backward (9.1 m/s) | 0.573 | 28.328 | 617 | 44.4% |
| dwarf / forward (6.5 m/s) | 0.209 | 20.970 | 648 | 53.9% |
| dwarf / strafe (6.5 m/s) | 0.313 | 18.117 | 922 | 49.8% |
| dwarf / backward (6.5 m/s) | 0.136 | 16.338 | 586 | 45.2% |
| dwarf / upgraded-backward (9.1 m/s) | 0.259 | 20.266 | 558 | 45.3% |

O caso Aldric forward tem só seis amostras de vértice liberado: não generalizar seu P90. Nos demais casos há centenas. As transições de contato foram medidas separadamente, portanto os valores altos da coluna de pé liberado não são somente a troca da flag. Isso demonstra movimento horizontal de pontos de sola junto ao piso fora da medição anterior. Confirmar perceptualmente a gravidade em câmera de jogo; não chamar todo movimento de ponto durante heel/toe roll de deslizamento de apoio.

**Próxima correção concreta:** preservar a folga da sola no swing antes de aplicar ajuste ao piso; auditar referência de altura da perna e quadril/driver de pose para evitar que a correção vertical converta swing em arraste. Não esconder o problema trocando `contact` ou diminuindo cobertura. Medir apoio, swing e transição separadamente; manter cintura/torso/arma coesos e joelho dentro do alcance.

Evidência: [2026-09-18T23-25-18-929Z-sole-contact.json](../../../output/qa/arpg-root-review/2026-09-18T23-25-18-929Z-sole-contact.json). Os dois JSONs desta pasta de output preservam a primeira análise e a divisão adicional de transições. `acceptedNoSliding:false` em ambos.

## Revisão visual nativa, escopo limitado

Inspecionei as duas contact sheets de 36 poses em `output/playwright/hero-locomotion-handoff-native/` e o `report.json`. Elas vêm de captura Chrome Metal de asset fixture, não de partida. As seis fontes listadas no manifesto nativo coincidem com a árvore no instante da revisão; o manifesto antigo não inclui todos os GLBs/renderer, portanto não estendo essa correspondência ao candidato global.

- Lyra: cintura/tronco permanecem coesos nas poses forward/strafe/backward com tiro. Rifle e braços continuam conectados nas vistas disponíveis; ausência da antiga faixa esticada é visível. Microcontato dos dedos não foi inspecionado em macro.
- Aldric: espada/escudo seguem o corpo, poses de corrida e ataque distinguíveis e pernas alternam em frames diferentes. Strafe tem cruzamento de pés; precisa revisão temporal de equilíbrio, não aprovação por still.
- Folga da bota no swing é visualmente pequena em várias poses de Lyra. Esta observação é consistente com o diagnóstico, mas contact sheets isoladas não medem velocidade no chão nem substituem playback completo.
- Não avaliado nesta revisão: novo cast, câmera de jogo atual, jogadores remotos, novos gestos, start/stop dedicados, áudio ou física de obstáculos.

## Critérios e testes ainda presos ao requisito antigo

No instante desta inspeção, `docs/quality-rubric.json` ainda dizia sword-only/rifle-only em game_design; `docs/quality-gates.md` enumerava dez dimensões e nove armas no verificador VFX; `tools/verify-natural-runs.mjs` não pressionava1/2/3 e proibia qualquer projétil do guerreiro. Combat deve atualizar esses contratos para espada/rifle básicos + três casts intencionais por classe. Preservar os testes de autoridade/dano/cooldown/recursos, não remover asserções sem substituição.

A primeira tentativa de avisar Combat pelo terminal retornou `agent_prompt_stalled`; isso não prova recebimento, falha do agente ou encerramento. Esta revisão é a entrega durável do achado.

O novo HUD e os seis casts continuam exigindo cenários de recurso insuficiente, cooldown, menu/foco, tecla repetida, toque simultâneo, morte/restart, troca de classe, confirmação remota/latejoin/reconnect, mitigação de efeitos sob reduced-motion e leitura de ameaças. O relatório JEF anterior não é aprovação dessas novas funções.


## Integração entre frentes: divergências detectadas

- **Teclas duplicadas:** Combat publicou que 1/2/3 pertencem a Combat; GUI publicou que captura teclado e emite `bipx:skill-request`. Escolher um só emissor. Direção recomendada: GUI possui teclado/mouse/toque, Combat só consome intenção e valida autoridade. Preservar precedência do upgrade. Teste de uma tecla deve observar exatamente uma intenção/cast/custo, sem key-repeat nem cast através de diálogo.
- **Janela de emissão:** Combat e Animation publicaram durações/impactAt distintos. Passar explicitamente os valores autoritativos ao visual e retimear o gesto para a janela de emissão, especialmente granada/rifle e julgamento. `impactAt` de visual significa release do projétil; impacto posterior é contato da simulação. Não sincronizar dano pela pose de chegada do pacote nem aplicar escala de tempo duas vezes.
- **Arco e altura:** Physics declara que sweep usa Y de from/to, VFX recebe trajetória real e Environment groundY=0. Cryo precisa varrer sua trajetória real em subsegmentos e decidir colisão pela altura consistente com os props; não usar só endpoint XZ, nem permitir dano através de caixa por diferença visual/gameplay.
- **Centro de área vs contatos:** VFX prevê um radial por cast e contatos únicos de cone/pierce; SFX prevê um impacto por cast. Enviar `contactId` estável para visuais e deduplicar áudio separadamente, evitando múltiplas novas/explosões ou coro de impactos por alvo.
- **Reconexão/apresentação:** Reenviar estado/cooldowns é necessário, mas não deve repetir som ready/impacto ou resetar animação de cast concluído. Usar ID/idade do evento e elapsed do visual. Efeito de viagem não permite inferir hit pelo sumiço de snapshot.

## Disponibilidade física, sem confundir inventário com teste

`xcrun devicectl list devices --timeout 10` observou iPhone17Pro pareado e disponível. Nenhuma sessão Safari física foi executada nesta revisão; disponibilidade não aprova mobile. `adb` não foi encontrado no PATH, portanto não há prova de Android conectado. Planejar navegação de build local no iPhone somente após fonte estável e rota de acesso ao servidor combinada com Combat (5173 hoje responde em127.0.0.1, não é acessível diretamente pelo telefone viaLAN).


## Encaminhamento confirmado

As tentativas Orca send retornaram stalled. Sem reiniciar/interromper workers, o CLI nativo `codex queue` forneceu um UUID para cada título; confirmei cwd e prompt inicial de role nos dois registros exatos. Depois, enfileirei por UUID: Animação `01a0b6db-1e2e-7f40-922e-93d66386b852`, Combat `01a0b6dc-3d69-7d81-8464-a15fd249b271`. Recibos confirmam **enfileiramento**, não leitura/implementação. Sessões/recibos estão em agents.json. Nenhuma nova sessão foi aberta por esse encaminhamento.
