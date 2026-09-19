# Direção vigente das seis habilidades — pedido explícito do usuário

Atualização de 18/09/2026, recebida após a primeira integração ARPG. **Este documento substitui integralmente a seleção inicial das seis skills no README/prompts/handoffs anteriores.** Preservar versões e evidências antigas como histórico, sem promovê-las como validação desta seleção. Continuam sete agentes Astra, propriedade exclusiva de arquivos, GPU sequencial, três slots por classe, HUD de duas esferas, Mixamo, ElevenLabs, referências GH e avaliação real JEF. Servidor 5173 permanece disponível.

## Contrato canônico v2

IDs novos evitam que uma nova semântica se esconda sob nomes antigos. Todos os donos devem migrar suas tabelas/API/fixtures para estes IDs; Combat coordena a migração cliente/servidor/UI. IDs antigos não viram uma segunda barra nem skills extras. Preservar ataque básico de espada/rifle.

| Classe/slot | ID canônico | Nome de trabalho | Comportamento solicitado |
| --- | --- | --- | --- |
| warrior/0 | `warrior_war_cry` | Grito de Guerra | Grito que dá buff real ao guerreiro, com gesto forte, onda de pressão e aura/status de duração visível. |
| warrior/1 | `warrior_cleaving_dash` | Corte Devastador | Dash na direção dos inimigos com corte de espada; inimigos mortos pelo golpe recebem apresentação de corte ao meio. |
| warrior/2 | `warrior_shield_charge` | Investida de Escudo | Corrida com escudo à frente, impacto de peso e stun em todos os inimigos atingidos na faixa/área de colisão. |
| dwarf/0 | `dwarf_explosive_cannon` | Canhão Infernal | Tiro de canhão de fogo explosivo, grande massa de fogo no disparo e explosão, dano em área. |
| dwarf/1 | `dwarf_frost_shot` | Disparo Glacial | Tiro de gelo que congela todos os inimigos dentro da área de impacto, com formação/quebra de gelo legíveis. |
| dwarf/2 | `dwarf_gravity_shot` | Núcleo Gravitacional | Tiro roxo que deixa um centro gravitacional no ponto de impacto; campo persistente puxa inimigos próximos para o centro. |

"Todos" significa todos dentro da área/faixa efetiva apresentada; nunca um único alvo com partículas sugerindo controle em área. Descrever e testar duração/alcance/limites. Combat calibra números e publica cedo o contrato de status e fases. Buff, freeze, stun e atração são estados reais autoritativos, replicados com duração restante e limpos em morte/reset/reconexão. Resistências de bosses, se necessárias, devem ser explícitas e visíveis; não fingir stun/freeze que não existe.

## Direção de animação, VFX e som

- Grito: antecipação com peito/braços/cabeça, explosão de voz e onda de choque no release, energia que permanece no personagem durante o buff; ícone/tempo confirmam o estado. Evitar trocar apenas a cor da antiga nova.
- Dash: baixar centro de massa, espada preparada, aceleração corporal e rastro cortante contínuo, contato por alvo e recuperação firme. A faixa visual segue o caminho realmente percorrido. Corte ao meio é apresentação de morte estilizada: implementar divisão/clipping de cadáver ou fragmentação compatível com o asset, sem destruir rig vivo, duplicar recompensas ou cortar sobreviventes ao meio. Se uma técnica não for viável ainda, registrar a lacuna, não afirmar que foi concluída.
- Escudo: escudo protege a silhueta durante a corrida, passada/impulso e parada pesados, impactos por contato e sinal inequívoco de stun sobre cada alvo afetado. Não atravessar paredes nem deixar personagem patinar numa pose idle.
- Canhão: carga térmica no cano, flare de disparo, projétil com núcleo persistente, chama/turbulência/brasas e explosão de camadas com fogo abundante. Preservar contorno de personagens/ameaças e área de dano legível; evitar bola opaca que cobre toda a ação.
- Gelo: carga fria, projétil legível, explosão cristalina e anel de alcance; gelo persistente nos inimigos realmente congelados, desaceleração/parada de animação correspondente e quebra/degelo ao terminar.
- Gravidade: preparo roxo, projétil visível, núcleo no impacto, órbitas e fluxo espiral dirigidos para o centro, partículas/debris atraídos e colapso ao terminar. Distinguir atração de mera pulsação decorativa. O centro fica onde foi deixado, não acompanha o personagem.
- SFX ElevenLabs: voz/grito e energia de buff; whoosh/corte de dash e mortes; corrida/metal/impacto de escudo/stun; canhão/flameburst; congelamento/fratura; tiro roxo/loop de sucção/colapso. Reutilizar assets adequados antes de gerar; preservar originais e recibos do provider. Prioridade/mix evita seis sons simultâneos saturando.
- Preparação, release, viagem/deslocamento, impacto, duração de status/campo e término são fases distintas com castId estável. Core, animação, VFX e SFX devem compartilhar timing e geometria; não disparar efeito de impacto ao apertar a tecla.
- Usar concretamente as três fontes GH já fixadas no README. "Triple AAA" é direção de qualidade, não nota automática: detalhes, peso, silhuetas, transições, materiais, composição e integração devem ser revistos em playback de gameplay. Low/reduced-motion preservam projétil, área/estado e telegraph essenciais.

## Responsabilidades da revisão

Combat: nova simulação das seis skills, status/buffs, movimento dash/charge, hit único por vítima quando aplicável, autoridade/replicação/reconnect, eventos e teste real. Corrigir também origem congelada durante preparo descrita em `review/class-skill-findings.md`; o antigo teste de perfuração é histórico quando arcane shot sair.

Physics: fornecer ao Combat sweep/resolução para dash/charge, atração com obstáculos e separação estável de horda, sem tunneling/teleporte ou acúmulo infinito no centro. Buff/stun/freeze não alteram diretamente física por eventos da UI.

Animation: takes Mixamo/acervo compatíveis para grito, dash e escudo; dwarf com rifle/recuo/carga. Manter integridade do corpo/props, contato em corrida e bugs da auditoria independente de sola como pendência. Stun/freeze precisam afetar o visual dos inimigos.

VFX: novas famílias por skill, área/tempo idênticos ao core, projéteis essenciais em low/reduced-motion, corte de cadáver alinhado à autoridade de morte via contrato com Animation/Combat. Preservar arquivos fora de sua propriedade: proposta/API ao dono, sem edição cruzada.

SFX: alinhar catálogo/calls/loops às fases novas, cancelar loops em reset/fim/morte, deduplicar impactos e status persistentes; geração real ElevenLabs quando necessário.

GUI: ícones e textos correspondentes aos seis IDs novos, cooldown/recurso e buff/status legíveis. Corrigir pictogramas vazios da revisão atual; header SVG do servidor antigo é uma causa observada e Combat é dono do restart. Tooltips de toque não devem tapar ambos os joysticks.

Environment: preservar riqueza e passagens/colliders; revisar leitura do fogo/gelo/campo roxo no cenário e espaço suficiente para dash/charge. Sem necessidade de refazer os exports já corretos.

## Provas de aceitação deste incremento

1. Cada skill executada por input real nas duas classes, em movimento e parada, com custo/cooldown válidos, preparo/release/impacto alinhados; não basta fixture isolada.
2. Buff aumenta atributo real e expira; dash/charge resolvem parede/obstáculo/frame longo; stun/freeze alcançam todos os alvos válidos da área e expiram; campo gravitacional fica no impacto, puxa de verdade, respeita colisões e encerra corretamente.
3. Corte ao meio só nos inimigos mortos pelo dash, uma morte/XP/drop por vítima; nenhuma degradação dos rigs vivos ou de outras mortes.
4. Multiplayer local/latejoin/reconnect têm os mesmos estados/tempos; cliente não concede buff/dano/pull pela UI. Servidor 5173 é atualizado por Combat somente após teste isolado e continua ligado.
5. Playback e capturas em fonte estável mostram todas as fases e convivência com horda/environment/HUD; fixtures identificadas. Rever qualidade alta e low/reduced-motion, carga de partículas, áudio e frame times. Não capturar só 1s após o efeito desaparecer.
6. Avaliação real JEF do novo candidato com observações humanas honestas; JEF textual não viu/ouviu arquivos. Evidência ausente é pendente. Meta AAA/10 permanece objetivo até ser sustentada por provas.
