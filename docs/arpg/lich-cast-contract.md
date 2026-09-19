# Lich — contrato proposto para a próxima etapa

Proposta Combat após `review/lich-integration-findings.md`; **não ativa no runtime e não integra o aceite das seis skills**. Animation deve confirmar o marcador no playback antes da implementação. GLB staged e Brute rejeitado não foram promovidos por Combat. Ownership preservado.

## Perfil visual explícito

Animation mantém o Attack inteiro do Lich1.1666666s sob perfil exclusivo; não ativa o slice Walker1/3→5/3s. Proposta retimada: duração1.10s, release.597143s (fase.542857), recuperação até1.10s, socket visual L_Hand. Perfil deve informar identificador estável, duração/release e socket; ausência de perfil mantém asset/ataque atual, não recorta implicitamente. Tempos ainda aguardam confirmação visual do dono.

## Autoridade e ciclo propostos

Combat implementará um estado compartilhado browser/Node, separado do melee: `{castId,sequence,phase,elapsed,duration,releaseAt,direction,released,cancelReason}`. CastId combina run/monstro/sequência; exatamente um release por aceite. Mira fica travada na preparação para permitir esquiva; origem é amostrada novamente no release, caso o corpo tenha sido deslocado. Intervalo/dano/range do perfil atual serão preservados até balanceamento explícito.

Preparação requer alvo vivo e linha livre. Freeze/stun/morte/remoção antes do release cancelam definitivamente o cast e seu projétil pendente; descongelar não libera disparo órfão. No release, revalidar ator/alvo e linha livre. Projetil já emitido continua pela simulação normal, mesmo se o emissor morrer depois; colisão/dano são autoridade e nunca derivados de VFX/socket. Animação pode usar L_Hand, mas altura/raio de colisão existentes continuam explícitos e separados.

Servidor publica prepare/release/cancel/end com castId e tempo; snapshots de monstros incluem fase/idade/restante. Cliente remoto retima pose por idade e não repete emissão antiga ao latejoin/reconnect. Dedup por castId+fase. O mesmo estado puro roda offline; main/server mantêm integração e Animation mantém controller/perfil/asset. O contrato do Walker não muda.

## Prova requerida antes de promover

CPU: clip completo/perfil correto, fronteiras de release, dt longo, pausa, cancelamento em cada fase, uma emissão e cleanup. Protocolo: dois clientes, snapshot em preparação, latejoin/reconnect, cancelamento replicado e nenhum release duplicado. Gameplay: gesto/mão e projétil sincronizados em partida real, parede durante preparo, freeze/stun antes/depois do release, morte/removal e recuperação. Capturas de fonte estável e hashes; fixture estrutural não será promovida a aceite artístico.
