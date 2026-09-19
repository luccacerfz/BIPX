# Proposta Physics — freeze/stun sob contato de horda

Atualização posterior ao pedido Root: a correção isolada do avanço da horda foi implementada e medida em [physics-crowd-candidate.md](physics-crowd-candidate.md). Resolve a reprodução de compressão abaixo em entrada válida, sem promover runtime; preserva este diagnóstico histórico, o limite de recuperação de packs inicialmente sobrepostos e o custo de horda como ressalvas explícitas.

2026-09-19,00:56 UTC. Resposta ao pedido de Combat após `review/v2-control-followup.json`. **Proposta CPU, ainda não integrada nem aprovada em gameplay.** Nenhum runtime/ferramenta congelada alterado, nenhuma GPU usada, main/server preservados. Servidor5173 observado vivo PID97873. Ownership confirmado no checkout `main`, HEAD `9124df5657474e9ad0a82634a53b987c75d70e9b`.

## Decisão proposta

Usar **massa inversa zero para freeze/stun somente na separação ordinária**, com uma passagem prévia limitada para recuperar overlaps entre controlados/jogadores. Conservar massa inversa1 nos monstros enviados ao pull explícito. Não manter uma âncora de posição histórica: fixar a posição que o corpo tem **depois** do campo naquele passo. Assim o campo desloca controlados e o crowd não desfaz esse movimento. Ao vencer o timer, volta a massa ordinária1 sem reposicionamento.

Não recomendo só reduzir massa: `.01` ainda permite deslizamento acumulado sob pressão. Tampouco recomendo fixar todos sem recuperação: dois controlados já sobrepostos não conseguem separar-se. A implementação de referência `policySeparate(...,'anchor-recover',dt)` está no artefato CPU abaixo; não é um novo export runtime.

### Integração concreta para o dono Combat

1. Um helper comum de política pode morar em `src/combat/`, consumindo o `separateActors` atual. Entrada: `(collisionWorld, bodies, dt)`, cada corpo com id/x/z/radius, `freezeTimer`, `stunTimer`; jogadores com `inverseMass:0`. Usar timers reais de Combat. UI/VFX não atribuem massas.
2. Antes da separação geral, formar **cópias somente dos controlados + jogadores fixos**. Nesta passagem, controlados têm `inverseMass:1` e jogadores0. Resolver com `iterations:2`, `maxCorrection:.2`, `maxTotalCorrection:.2*min(max(dt,0),.1)`. Não executar se delta não finito/zero ou orçamento menor que `.001`, que é o piso aceito pela API. Copiar apenas x/z de volta às cópias gerais. Outros perseguidores não participam desta recuperação e não podem usá-la para arrastar o controlado.
3. Separar todos usando os parâmetros ordinários atuais (`iterations:2,maxTotalCorrection:.2`), com `inverseMass:0` nos controlados e jogadores,1 nos outros monstros. O orçamento especial de recuperação é **.2m/s por controlado**, máximo.02m/passo; não aplicar esse orçamento lento a toda a horda. Toda correção continua passando por `moveActor` e cenário/bounds.
4. Em `updateServerMonsters`, as cópias já carregam timers via spread; trocar a chamada ordinária pelo helper. Em `resolveEnemyCrowding`, incluir os timers no mapping e passar `dt` desde `updateZombies`. No retorno, copiar somente x/z como os hooks fazem hoje. **Não gravar `inverseMass` em monster/zombie nem usar Object.assign com o corpo inteiro**, pois isso vazaria a massa fixa para o campo.
5. Nos dois callbacks `pullTargets`, explicitar `inverseMass:1` nas cópias dos monstros, depois do spread: `{...t,inverseMass:1,pullScale:t.boss?.35:1}`. Jogadores continuam0. Manter `pullActors` e a ordem campo→status/IA→crowd. O teste executou o hook atual, que já usa massa móvel quando o estado não foi contaminado; o override explícito protege essa fronteira.
6. Não alterar timers, pausa de animação/ataques, resistência de boss, campo ou replicação por causa da massa. Snapshots continuam posições finais. Não reancorar em posição de início de freeze/stun nem desfazer a atração na atualização seguinte.

Essa proposta permite pequena correção física quando já existe overlap controlado/controlado ou controlado/jogador; não promete imobilidade matemática em geometria inválida. O limite de recuperação pressupõe início válido contra sólidos, garantido pelo fluxo de spawn/movimento atual. Configuração impossível continua sinalizada, sem teleporte.

## Evidência e comparações

Reprodução: `node output/physics/control-policy-proposal-20260919.mjs`.

Relatório final: `output/physics/2026-09-19T00-55-53-708Z-control-policy-proposal.json`. **8 verificações CPU passaram; sourceStable:true; acceptedForProduction:false.** As verificações incluem medições de um stress que expõe limitação, portanto o número8 não significa aprovação geral de horda.

O auditor extrai literalmente `updateServerMonsters`, status, seleção de alvo e skills/getPlayingClients; injeta apenas o solver ordinário hipotético na VM. Usa Physics/navigation/skills/altura/layout reais. Transportes e sinks de dano são stubs. Para cliente, extrai `resolveEnemyCrowding` e injeta os timers que o mapping proposto precisará fornecer. **Não é runtime já integrado**, nem captura nativa/rede.

| Política | Alvo controlado + 1 perseguidor,1s/20Hz | Alvo + 9 perseguidores,3s/20Hz |
|---|---:|---:|
| Atual, inverseMass1 | 1.4295m | 7.2087m |
| inverseMass.05 | .1361m | não medido |
| inverseMass.01 | .0283m | .1218m |
| Massa fixa + recuperação limitada | 0m | 0m |

Valores são distância XZ acumulada em fixtures sintéticas, não os deslocamentos da captura Root. Freeze/stun produziram os mesmos resultados no caso de dois corpos. Dez corpos,10/20/60Hz: a proposta manteve o controlado em0m; massa.01 acumulou.1290/.1218/.1850m.

- Overlap inicial controlado/controlado de.20m e controlado/jogador de.22m: trava simples conserva esses valores; recuperação limitada convergiu para.001m em até2s, passo máximo.01m a20Hz. Jogador ficou imóvel.
- Recuperação junto à grade real `burial-rail-0` e borda circular55: passo máximo.01m, penetração final entre corpos.001m, sem atravessar sólidos/bounds.
- Expiração:0m antes do fim do freeze; depois retomou3.465m de perseguição, passo máximo.165m. Nenhuma massa escrita no estado autoritativo e nenhum retorno à posição antiga.
- Hooks de crowd cliente/Node, mesmos três corpos e política hipotética,1s: diferença máxima0m.
- **Campo real no cemitério,12 corpos ainda controlados:** centro(-15.5,-8.61) derivado do sweep do projétil na grade; distância média3.182847→2.028392m em3s. Passo máximo.075m, penetração máxima entre corpos6.66e-16m, correção ordinária pós-pull0m; sólidos/bounds válidos a cada passo. Mesma atração do checkpoint integrado anterior: massa fixa ordinária não anulou o campo.
- Pull separado preservou jogador0 e resistência.35: passos normal.225m/boss.07875m no mesmo delta.05s. Delta0 não realizou recuperação, entradas imutáveis.

## Achado adicional: compressão de horda em delta100ms

**Não promover a proposta como correção completa de crowd/frame longo.** A fixture de10corpos perseguindo através de um alvo controlado,3s a10Hz, começa sem overlaps. Com os hooks atuais, a penetração máxima entre controlado e perseguidor chegou a **1.325m**; com a trava proposta, **1.320m**. O corpo controlado fica parado, mas vizinhos podem comprimir-se profundamente. A20/60Hz, a mesma proposta atingiu.050/.076m transitórios e terminou em.001m. São casos CPU adversariais, não reprodução atribuída ao vídeo Root.

`stepActor` subdivide movimento contra estáticos; a separação dinâmica roda só depois. `maxTotalCorrection:.2` não acompanha necessariamente deslocamento/pressão produzidos por todo o passo. Alternativa testada de apenas `iterations:4` e orçamento `max(.2,2*maxSpeed*dt)` foi **rejeitada**: ainda.893m transitórios a10Hz e.905m a20Hz, apesar de terminar em.001m. Portanto não recomendo aumentar cegamente iterações/orçamento, nem esconder o pico usando só posição final.

Para fechar esse gate numa próxima janela de escrita: reproduzir esta fixture e aplicar contato dinâmico durante o avanço (ou subpassos do ciclo inteiro movimento→crowd, com orçamento de navegação preservado). Não basta outro subpasso interno de `stepActor`, não restaurar o solver antigo e não usar `findFreePosition` na caminhada. Isso requer mudança concreta coordenada com Combat; **não foi feita durante o freeze/captura atual**. Também medir pares dinâmicos, custo com horda e passagem após expiração antes de aceitação global. A proposta de controle/pull acima continua útil, mas este limite fica explícito.

## Proveniência e liberação

- Physics contacts `d63d1cb1bbcf1b22b524ae948b1588f62a2d3dd34e0c073231ff29cb6c1a8da3`; navigation `4c236c22b7e6d1a3df8d4b0069ae60a2814b29fbd2de3e9ebd88375906c6bbf1`.
- main `01c8ed4e1c6e7c6152259444ed20fc9ceb4a44f90df9da36776f33e5b6503a7b`; server `71de8e868757d00aa1003dc074a4a89a69b1a5a8483001dbbd3e515656dd9b7e`; core `a863e12f3c26cf629ad7051d64f40bb855f2a87d8e3e1510aad1f8c000e96e63`; layout `987487e1fedd025da3615d3cc07ce9b5621e778d39c21939f9ac53dc6bbe577c`.
- Script de proposta SHA256 `a22a14a24868d7bda75a6ce7a958c61bddc18289166aad470eb95bce035eb3cd`; relatório final `816d8550b9d453439f889bef9dc5efacc1bdc71efd063ea642816c05228433f3`.
- Execução00:52 com stub `sendJson` ausente foi falha do harness; preservada, corrigida apenas no artefato CPU. Resultados00:53/00:54 também preservados. Nenhum runtime foi corrigido ou alterado para obter os resultados.
- API/runtime Physics seguem congelados nos hashes publicados; não há novas escritas runtime programadas nesta janela nem reserva GPU própria. Resposta entregue por este documento e handoff: Combat confirmou a fila cheia e coordenação pelos reports às00:47. Sem reenviar submissões repetidas, interrupt, agentes extras ou restart5173.
