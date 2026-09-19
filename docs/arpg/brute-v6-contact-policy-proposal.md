# Brute v6 — proposta CPU para distância e pose móvel

**Não integrar o clip rígido como ataque universal.** A prova adicional mostra que corrigir somente distância1,82→1,89m não resolve: outra fase de Idle, Run ou direção do alvo muda a primeira superfície. Nenhum GLB, rig, ator, alcance, dano ou FSM foi alterado. O candidato handoff-01 e todas as provas anteriores continuam congelados.

## Medições concretas

[34casos CPU](../../output/brute-motion-v6/contact-followup-v1/envelope-cpu.json), ferramenta `tools/brute-motion-review-v6-contact-envelope.mjs`. Brute GLBs6ee3788b/6feed18b inteiros, duração1,45; Aldric5c1903/Lyradc0867 nas alturas reais2,70/2,55m. Mão inteira e fronteiras da região de skinR_Hand contra corpo e props; mesmos testes triângulo/triângulo e crossing próprio não coplanar do v6. Os tempos.65/.70/.75 são probes de revisão, não markers escolhidos.

| Alvo em.70s | Distância | Aldric | Lyra |
|---|---:|---|---|
| Idle0 original |1,89m|Escudo; gap.500mm,0crossings|Guarda corporal; gap.499mm,0crossings|
| Idle0 original |1,855m|Escudo;28pares cruzam|Guarda;29pares cruzam|
| Idle0 original |1,82m|Escudo;54pares cruzam|Guarda;43pares cruzam|
| Idle a25% do clip |1,89m|Escudo;45pares cruzam|Guarda afasta4,702mm|
| Run a25% do clip |1,89m|Corpo;63pares cruzam|Corpo;113pares cruzam|
| Run a50% do clip |1,89m|Corpo;65pares cruzam|Corpo;40pares cruzam|
| Idle0, yaw−15° |1,89m|Gap85,941mm|Gap101,377mm|
| Idle0, yaw+15° |1,89m|Escudo;91pares cruzam|Primeira superfície passa ao rifle;437pares no conjunto|

Idle0 usa exatamente a geometria congelada da fixture. As outras fases usam skinning dos **clips fonte reais**, sem comprimir ou inventar pose; não são replay do controller locomotion com crossfade/IK/história de suporte. Servem como contraexemplos geométricos, não como certificação de todas as poses runtime. Counts são pares de faces que cruzam, não profundidade/área de penetração; incluem costuras/triangulação e não indicam severidade linearmente.

O negativo1,82 permanece; o intermediário1,855 também cruza. Não há intervalo inteiro certificado em torno de1,89m. Nem o Idle animado pode ser assumido igual ao Idle0 usado no ajuste.

## Movimento sem reposicionar para acertar

[Replay CPU de contacts real](../../output/brute-motion-v6/contact-followup-v1/policy-cpu.json): `createCollisionWorld` vazio + `stepActor`, raios Brute1,18/player.64, estado inicial1,89m, seis passos1/60s com input6,5m/s. Raiz Brute fixa; jogador segue input e colisão, nunca a mão.

- Em direção ao Brute: primeiro passo para1,82001m pela colisão circular e permanece ali. É distância legal, justamente onde o clip rígido cruza a guarda.
- Afastando: primeiro passo1,99833m, já fora de1,90m; após.1s,2,54m.
- Strafe: primeiro passo1,89310m; segundo1,90238m, fora de alcance; após.1s,1,99865m.

Logo, o estado de preparo não pode conceder acerto futuro. Snapshot de posição a10Hz também não certifica o encaixe: a cota conservadora6,5m/s×.1s=.65m supera a folga autorada.5mm. É uma cota de pior direção, não previsão de deslocamento nem motivo para aumentar alcance/raio. A velocidade relevante precisa incluir a superfície animada da guarda, não apenas a translação da raiz.

## Proposta concreta, ainda sem autoria nova

1. **Manter1,45s e carga/passo/recuperação como base.** Não comprimir para.55s. Separar a forma do encontro do relógio de autoridade; .70s continua intenção, não marker.
2. **Autorizar futuramente uma família pequena de encontros do braço** para o mesmo gesto: limite próximo1,82 e distante1,89, por guarda, com raiz/pelvis/pernas preservadas e mão inteira respeitando a primeira superfície. Interpolação só depois de validar os intermediários — a interpolação linear de wrist isolado não garante que mão/antebraço/ombreira não atravessem. Esta entrega não cria esses endpoints nem novos GLBs.
3. **Adaptação visual limitada à região validada.** Se a guarda muda de superfície, sai do envelope de poses ou exige alcance/rotação fora da família, não perseguir o jogador com a mão e não deslocar atores. Precisa de gesto de erro/recolhimento também autorado e contínuo, no mesmo tempo, antes de uma promoção. O clip atual sozinho não oferece esse fallback comprovado.
4. **Core independente da malha.** Numa futura integração Combat, identidade mundo/monstro/cast/alvo e direção de preparo ficam estáveis. No marker que ainda será escolhido, revalidar posição atual, alcance legal do caller, direção e LOS; morte/remoção/freeze/stun antes dele cancelam. Ausência de snapshot novo não renova estado. Dano uma vez por sequência aceita; pose visual não aplica dano nem escolhe outro jogador silenciosamente. Reação do alvo só após evento confirmado.
5. **Não camuflar divergência visual/lógica.** Revalidar distância/LOS elimina o caso fora de alcance, mas não resolve penetração dentro dele. Até haver família/fallback visual aprovados, o lote não está pronto para trocar o Brute runtime. Um miss visual não pode ser usado para esconder um hit lógico confirmado; o contrato precisa prever o mesmo resultado nos dois caminhos.

O caller atual Brute usa dano imediato, duração visual.55s e cooldown.62s; `getMeleeTiming('brute')` retorna null. O server atual já usa o fallback integral1,90m após o patch16ac, sem multiplicador.84 para Brute. Esses valores não foram mudados. Uma futura fase ativa1,45s com cooldown.62s implica cadence efetiva diferente se o próximo ataque aguarda end; isso deve ser decidido explicitamente no lote Combat, não introduzido por um loader.

## API executável de diagnóstico

[`contact-policy-proposal.mjs`](../../output/brute-motion-v6/contact-followup-v1/contact-policy-proposal.mjs) exporta `assessBruteContactEvidence({source,target,prepared,paused,clearLOS,legalReach,minimumFacingDot,now,poseSampleTime,relativeSpeedBound,fit})`. Não depende de Three, assets ou servidor. `legalReach` vem do caller; `minimumFacingDot` é parâmetro proposto ainda não aprovado para Brute (teste usa.35 do helper existente, não novo valor live). `fit` é testemunha geométrica daquela pose/tempo, não capsule reach.

Retornos são pareceres: `reference-only`, `authoring-required`, `geometric-miss`, `miss`, `blocked`, `hold`, `cancel`, `unresolved`. **Nunca retorna hit ou chama áudio/VFX/dano/actor movement.** `reference-only` significa apenas proximidade naquele sample, não aceite. Não é FSM de produção nem resolve interpolação de rede. Importá-lo no runtime está fora desta entrega.

[`tools/brute-motion-review-v6-contact-policy.mjs`](../../tools/brute-motion-review-v6-contact-policy.mjs):15checks de fronteira/identidade/pausa/cancelamento/LOS/sample futuro/primeira superfície/imutabilidade, mais três trajetórias com contacts real. Perfil e snapshots fornecidos ao helper não são alterados. A geometria e política têm escopos separados; passar esses checks não promove arte ou autoridade.

## Proveniência e limites

Native anterior: Lyra dc metadataOPAQUE, CPU anterior e11; BIN igual conforme linhagem preservada. Esta CPU nova usa dc explicitamente. Não reaplica testes como se fossem evidência antiga. Runtime, 07, v3/v4/v5/v6, Lich/heróis/áudio e5173 permanecem fora da autoria.

Próxima prova autorizada é somente a câmera lateral/reversa em[contact-followup](brute-v6-contact-followup.md), depois Combat grito e Lich parede/Environment. Decisão de marker e promoção continuam pendentes, sem pedido de confirmação adicional para preparar essa prova.
