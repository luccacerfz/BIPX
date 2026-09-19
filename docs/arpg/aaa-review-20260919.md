# Retomada e revisão AAA com Astra, Fable e Grok

Pedido vigente: continuar o goal original da sessão `01a0b6a0-2a5d-7822-8f7d-0a6824912952`, mantendo Fable 5.1 high e Astra high, usando **Grok 4.6 high** e **sem Gemini**. Esta instrução posterior substitui a seleção inicial de Grok 4.7 e Gemini Pro. A revisão AAA complementa o goal de implementação, animação, VFX, game design e validação JEF; não o reduz a um relatório.

Este documento registra a distribuição de trabalho; não é um aceite de qualidade. Valem os 12 critérios de `docs/quality-gates.md`, com evidência ausente marcada como pendente e avaliação real JEF separada da revisão visual/sonora. O servidor do usuário respondeu HTTP 200 em `http://localhost:5173/?offline=1` nesta retomada.

| Modelo solicitado | Terminal Orca | Escopo |
| --- | --- | --- |
| Fable 5.1 high | `term_7d6c7989-3c4c-4e58-983e-f6385eb014cd` | Game design, progressão, identidade das classes, HUD, fluxo, acessibilidade e usabilidade mobile |
| Grok 4.6 high | `term_40612a7e-27f9-419c-bfa7-c8eab9c021fa` | Física, autoridade de combate, multiplayer, confiabilidade, desempenho e ciclo de recursos |
| Astra high | `term_b2bae5c8-4bb5-4ca7-b5b6-615c6edce8dc` | Sessão original retomada; consolidar os achados, coordenar donos existentes, melhorias, evidências e JEF |

Os IDs de lançamento vigentes são `claude-fable-5-1`, `grok-4.6` e `gpt-6-astra`, todos com esforço high. O terminal Gemini foi fechado sem tarefa executada. Direção de arte, ambiente, animação/contato, VFX e áudio permanecem sob Astra e os donos originais. O terminal Grok anterior, ocioso, foi substituído pelo novo lançamento 4.6 high.

## Trabalho e limites de edição

As sete frentes existentes e suas propriedades em `docs/arpg/README.md` permanecem. Fable e Grok são responsáveis por relatórios independentes em `docs/arpg/aaa-20260919/{fable,grok}.md`, com ferramentas e candidatos somente em `output/qa/aaa-20260919/<modelo>/`. Não editar arquivos de runtime já pertencentes a outros agentes, nem substituir candidatos não aprovados. Astra consolida e encaminha correções ao dono correspondente, continuando o goal original integral.

Revisar primeiro `docs/quality-gates.md`, `docs/arpg/skill-direction-v2.md` e os handoffs atuais de cada domínio. Cada achado deve ter prioridade, impacto no jogador, passos para reproduzir, arquivo/linha ou evidência visual, candidato/hash e ação concreta. Separar achado reproduzido, suspeita estática e lacuna de evidência. Não atribuir nota máxima a critérios não exercitados.

Cobrir as 12 dimensões: game design/classes; animação/locomoção/contato; arte; VFX; sensação de combate; UI/fluxo; mobile; áudio; desempenho; multiplayer; acessibilidade; confiabilidade. Os casts atuais são grito/buff, dash cortante, investida de escudo, canhão de fogo, congelamento e campo gravitacional; espada e rifle permanecem ataques básicos.

Preservar localhost:5173, abas do usuário, ranking local, fontes e originais. Sem commit, merge, push, deploy, reset, clean ou exposição de credenciais. Testes GPU usam a reserva atômica `/tmp/bipx-arpg-gpu.lock` e somente o próprio dono libera seu lock. Não rodar suítes globais em fontes concorrentes; CPU e inspeção podem continuar durante a espera. Nenhuma nova instalação ou atualização é necessária para a revisão.

## Pendências recuperadas a revalidar

- Dash art2: segmento remoto inexistente no reprodutor anterior; revisar correção e alinhamento pós-mixer antes de promoção.
- Gelo/gravidade: descontinuidade visual de lançamento entre boca do rifle e corpo do projétil; preservar autoridade, bloqueio por sólidos e campo fixo.
- Locomoção: aceitação antideslizamento ainda não comprovada; Brute e candidatos rejeitados continuam separados.
- Copas/oclusão: candidatos isolados e legibilidade do combate ainda precisam de revisão atual.
- Qualidade sonora, dispositivos físicos e sessões prolongadas não estão aprovados apenas por testes técnicos anteriores.

Essas pendências vieram da sessão e dos relatórios recuperados. Devem ser verificadas contra os arquivos atuais antes de serem consideradas defeitos ainda presentes.

## Histórico da abertura inicial

- Fable: a tela do Claude confirmou **Fable 5.1 with high effort / Claude Max**. Tarefa de revisão enviada ao terminal indicado.
- Astra: a tela confirmou **gpt-6-astra high** na sessão original. O goal pausado foi retomado; houve novo `task_started` em 2026-09-19T08:25:46Z. Ampliação e coordenação encaminhadas também por `codex queue`, recibo `01a0b8c8-ec65-7a13-af8e-a6278dbf7755`. O resultado AAA permanece em andamento.
- Grok: tentativa explícita com `grok-4.7 --reasoning-effort high` retornou **unknown model id**, exit 1. Conta oferece 4.6 e 4.5. Frente aguardando modelo disponível ou resposta do usuário sobre fallback; nenhum fallback executado.
- Gemini: o lançamento com Pro na CLI 0.55.1 foi bloqueado no login: **This client is no longer supported for Gemini Code Assist for individuals**. A CLI atualizou-se automaticamente para 0.60.0 durante a inicialização; a nova tentativa com essa versão retornou o mesmo erro. Terminal aberto aguardando autenticação compatível; tarefa preservada abaixo, ainda não enviada ao modelo. Nenhuma chave Gemini/Google/Vertex está presente no ambiente do coordenador. Não pedir nem registrar segredos em mensagens.

## Briefs e redistribuição atual

**Grok:** revisar fonte atual de física, colisões, sweeps/projéteis, autoridade das seis habilidades, deduplicação, recompensas, desconexão/reconexão/late join, recursos e frame pacing. Reproduzir os defeitos mais importantes com testes isolados, preservando falhas históricas. Relatar impacto, prioridade, arquivo/linha, cenário, hash e proposta. Não alterar autoridade para encobrir um defeito de apresentação. Saída `docs/arpg/aaa-20260919/grok.md` e artefatos exclusivamente na pasta própria.

**Astra e donos de arte/animação/VFX/SFX, sem Gemini:** revisar direção de arte, composição, materiais/luz, ambiente e oclusão, silhuetas de horda, animação/contato/arma, VFX das seis habilidades em conjunto e áudio quando houver capacidade de ouvir a evidência. Inspecionar capturas nativas e vídeos existentes; distinguir fixture de gameplay natural e observação visual de inferência estática. Revalidar candidatos atuais e implementar melhorias concretas priorizadas conforme a propriedade existente. Não afirmar ausência de sliding por foot markers, nem qualidade sonora por waveform.

## Recibo da instrução posterior

Gemini fechado por solicitação explícita (`ptyKilled: true`). Grok anterior ocioso fechado e novo terminal criado com `grok --model grok-4.6 --reasoning-effort high --no-subagents --no-plan`. A sessão original Astra recebeu a nova instrução e redistribuição por `codex queue`, recibo `01a0b8cf-a4a4-7d20-9d20-d721eb42d27a`. O servidor continuou respondendo HTTP 200. Não criar goal concorrente nem aguardar autenticação Gemini.
