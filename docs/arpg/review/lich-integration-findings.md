# Lich: candidato Mixamo e contrato de disparo

Auditoria independente em 2026-09-19 00:30 UTC. Resultado: `output/qa/arpg-root-review/2026-09-19T00-30-08-907Z-lich-compatibility.json`. Reprodutor: `node docs/arpg/review/lich-candidate-audit.mjs`. Nenhum arquivo de runtime foi alterado por esta revisão.

O Lich em runtime permanece byte a byte igual ao baseline (SHA256 `f6ddd47d97757b4acee76c056baa26c644ff19e2afa17fb5630b00108e832e44`). O candidato `/tmp/bipx-caster-motion/lich/artifacts/monster-gesture.glb` tem SHA256 `d47d9a13ab7d3df9b1df1018735d56075fdedeb32b266c3ffcb9d3ca3a576599` e clip Attack de 1.1666666 s/24 canais. Nodes, skins, meshes, materials, images, textures, samplers e o prefixo binário original foram preservados. Isso prova compatibilidade estrutural, não qualidade de movimento.

O candidato usa `bipxPrototypeMotion`, deliberadamente ignorado pelo loader atual. Renomeá-lo ingenuamente para `bipxMotion` ativa a ramificação genérica `retargetedRoles: Attack`, que aplica o recorte do Walker de 1/3 a 5/3 s. A guarda exata de `sliceClip` reproduziu `RangeError: Invalid clip window` com a duração real do candidato. Esta é uma falha de uma promoção hipotética; o runtime atual não está falhando assim.

Na fonte auditada, cliente e servidor ainda criam o projétil imediatamente. No cliente, `spawnEnemyProjectile` também inicia `animatedEnemies.attack(zombie, .65)`, sem preparação antes do disparo. A replicação não oferece a fase de cast remoto equivalente ao ataque melee. Trocar somente o GLB não atende à sincronização gesto/projétil.

Próxima integração, depois da janela corrente de acabamento das seis skills:

1. Animation: preservar o clip completo sob perfil explícito de Lich, sem alterar o recorte/phase attack do Walker; revisar gesto, mão e extremidades em playback. A proposta do staging é duração total de 1.10 s, release na fase .542857 (aproximadamente .597143 s) e âncora visual `L_Hand`; confirmar visualmente antes de fixar o marcador.
2. Combat: contrato de preparação, release e recuperação compartilhado entre offline/servidor, com sequência única e estado remoto. Congelamento/stun, morte ou remoção durante a preparação precisam ter política explícita de cancelamento e nunca deixar um disparo órfão. A autoridade do projétil/collision continua na simulação; âncora visual da mão não muda silenciosamente altura/volume de dano.
3. Validar o disparo no mesmo instante do gesto em partida real e dois clientes, incluindo interrupção, reconexão e ausência de duplicatas. Guardar hashes da fonte e mídia. O relatório binário acima permanece `accepted:false`.

Brute v3 continua rejeitado e não deve ser instalado junto com este candidato. A tarefa de refazer sua pose/locomoção permanece separada.

Em02:15:58, tarefa limitada foi entregue ao Astra SFX após a conclusão de sua frente de áudio: revisar este candidato/perfil somente em `output/lich-cast-v1`, `tools/lich-cast-review*` e `docs/arpg/lich-cast-asset-handoff.md`. O agente Animation permanece exclusivo nos heróis; o apoio não transfere ownership do controller/asset runtime. GPU serial depois do dono corrente, nenhum novo agente. Não há promoção nem novo marcador aceito por esta delegação.

Revisão posterior Root: handoff `../lich-cast-asset-handoff.md` conferido; pose original de release e folha de quadros do native02:28 inspecionadas, hashes em `lich-marker-followup.json`. Marcador.597143/L_Hand coerente na pose; base/pés não aprovados. SFX recebeu novo subtrabalho de proposta de estado puro somente em `output/lich-cast-v1/combat-proposal`, ferramentas próprias e handoff; nenhuma implementação de runtime ou transferência de ownership Combat. A futura integração continua exigindo autoridade/rede/input reais.


## Proposta de autoridade revisada por root —03:02

Li `docs/arpg/lich-cast-authority-proposal.md`, `caster-cast.mjs` SHA30657ee9321ce09fab9779603729e993581b4d56815f3d6c5eec68d086e8e18e e `caster-caller-boundary.mjs` SHAae93f85e31e4d82a7373a345da5daa7534bafc80bad17f4c7ea62243b7afeb68, em `output/lich-cast-v1/combat-proposal/`. Report final02:50:38.816 e delivery02:53 confirmam40grupos CPU/fonte estável e runtime intacto no escopo do dono.

A proposta é adequada para revisão e integração posterior por Combat: identidade pertence a mundo/monstro/sequência; direção travada no preparo, origem fresca no release, cooldown debitado uma vez e cancelamento antes/depois do marcador distintos. Snapshot extrapola somente pose e não fabrica disparo. A fronteira consome tick antes de novo preparo, evitando duas ações no mesmo passo. Leitura root não encontrou motivo para rejeitar essa API, mas não prova os futuros hooks.

A integração deve manter os pontos explícitos do handoff: estado antes de consumir evento, deduplicação real do stream+snapshot, captura de controle antes dos early returns, restante do passo para projétil criado no marcador e supressão do gesto.65s antigo somente nesse caminho. Diferenças atuais cliente/servidor de alcance/cooldown/spec continuam documentadas e não foram corrigidas silenciosamente. Não copiar referências congeladas sobre main/server atuais. Rede real, release visual integrado, dano, morte/reset/latejoin e gameplay continuam pendentes.
