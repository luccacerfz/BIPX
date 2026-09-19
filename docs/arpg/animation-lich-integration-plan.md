# Lich — plano Animation/Combat, perfil próprio em staging

**Plano e pacote preparados; nenhum runtime promovido.** Depois do cortev3 já integrado/frozen e fora da janela atual das seis skills. [Revisão root](review/lich-integration-findings.md), [asset/marker SFX](lich-cast-asset-handoff.md), [proposta de autoridade SFX revisada pelo root](lich-cast-authority-proposal.md) incorporados. Não renomear `bipxPrototypeMotion` para `bipxMotion`, não instalar Brutev3 rejeitado, não alterar Walker. Heróis/anti-slide permanecem uma frente separada, v7retida.

## Fonte concreta disponível

[Pacote próprio Animation](../../output/arpg-animation/lich-profile-plan/preparation.json), criado sem escrever no staging SFX. [Preparador reproduzível](../../tools/animation-lich-plan.mjs), somente Node/CPU. Recusa sobrescrever o diretório de saída.

| Item | SHA256 / parâmetro |
|---|---|
| GLB Mixamo staged, preservado |d47d9a13ab7d3df9b1df1018735d56075fdedeb32b266c3ffcb9d3ca3a576599|
| Sidecar novo,24canais Attack inteiros |8194b98979ef767d79d6a7fd5d20b2b733ce5a363d07d5825f464176b917fce5|
| Perfil SFX copiado sem alteração |4c21be8e7f9d50b9ec1677bb82eada81c5748edbbacc6b0ce67c729ccea4c820|
| Lich GLB runtime preservado |f6ddd47d97757b4acee76c056baa26c644ff19e2afa17fb5630b00108e832e44|
| Walker GLB runtime preservado |91c975ebfef06f38239a7e5f3258c8ac545340dc217b625f6488fe01cc745b2c|
| Brute GLB runtime preservado |d1d58b1ae86045d9fa39dba9b4e87a0bd6d1a66b347d74624cf8095ce208c02a|
| Base loader / pool |e9aba8f3 / e73ad4f9, completos no manifesto|

`lich-cast-clips.json` tem84.804bytes e contém a serialização exata do Attack do GLB auditado, não outro retarget nem reexport. Round-trip verifica cada tempo, valor e interpolação dos24tracks. Normalização explícita do perfil, extraída do loader SFX já revisto, aplicada ao GLB candidato e ao rig original+sidecar produz **diferença máxima zero** nas matrizes dos41ossos e socket em oito tempos, incluindo release e extremidades. Fonte estável; nenhum GLB/metadado original modificado.

Isso prova compatibilidade CPU do pacote, **não implementação dos futuros hooks**, fallback de pool/visor, desempenho, contato, playback ou rede. O pacote não é importado por nenhum módulo runtime. O campo histórico `status` do perfil SFX permanece intacto para conservar seu hash; o estado de revisão vigente está nos handoffs/manifestos.

## Perfil e seleção por instância

ID `lich-mixamo-cast-v1`; take fonte Attack índice3 inteiro,1.1666666269302368s; duração visual1.10s; release fase19/35=.5428571428571428, **.5971428571428572s**; socket real **L_Hand**. Marcador já conferido visualmente por SFX, root e Animation na prova02:28; não fixar uma posição XYZ no mundo. A mudança de altura3m da fixture para2.8m do caster modifica o socket espacial, não a fase. Usar sua matriz mundial atual para apresentação.

**Achado de integração:** `animated-enemies.js` mapeia tanto `caster` quanto `visor` para `id:'lich'`. A proposta SFX `id==='lich'` é adequada à fixture, porém seria abrangente demais no pool. Não ativar implicitamente o cast novo para Visor.

Proposta revisável do loader, ainda não implementada:

```js
library.create('lich', {
  parent, height, phase,
  castProfileId: zombie.type === 'caster' ? 'lich-mixamo-cast-v1' : null,
});
```

Manter o GLB runtime intacto e os cinco clips normalizados atuais como padrão. Preparar um segundo conjunto de clips apenas de animação para o perfil: substituir Attack pelo sidecar completo, compartilhar o rig/geometria/texturas originais. O caster opt-in usa esse conjunto; Visor usa o conjunto original e sua semântica atual. Não duplicar o GLB inteiro nem carregar outro rig renderizado.

A normalização de Attack com esse perfil deve pular **somente para esse perfil** o crop genérico e a remoção localXZ de Hip, mantendo a estabilização Root do loader SFX. A coluna localZ do Hip desse rig contém movimento vertical; não a achatar inadvertidamente. Walker continua slice1/3→5/3s, duração visual.88/releasePhase.523 e phase attack próprios. Brute segue o asset atual. Sem perfil, não há crop Lich nem fallback para uma janela que ultrapasse1.167s. Perfil/clip divergentes devem gerar erro de carregamento explícito na preparação do candidato, não truncar silenciosamente.

## Contrato de apresentação com Combat

Authority type é **caster**; `lich` é o asset. Combat mantém a proposta de estado puro `{worldEpoch,actorId,sequence,revision,cast}` e os eventos prepare/release/cancel/end. A projeção já proposta devolve `{cast,events:[]}`; não fabrica disparos ao cruzar o marcador por extrapolação. Animation não importa o core de combate nem possui cooldown/dano/colisão.

Proposta de fronteira para revisão Combat — **campos/métodos abaixo ainda não disponíveis no runtime**:

- Combat guarda a última projeção aceita em `zombie.casterCastVisual`, separada do snapshot autoritativo. Payload visual destacado: `{id:cast.castId,sequence,elapsed,duration,impactPhase:releaseAt/duration,active:cast.visualActive,cancelReason,paused}`. `null` significa ausência/limpeza explícita. Apenas `type==='caster'` consome esse campo.
- O pool aplica esse payload em `controller.update(dt,{...motion,...control,attack:visual,paused})`, inclusive no caminho `dt===0`. Walker continua recebendo `meleeAttack`; não reutilizar esse campo como envelope genérico de caster.
- Controller reaproveita `cast/syncAttack/cancelCast`, idade monotônica e dedup do candidato SFX. Terminal/cancelado não reinicia; terminal recebido pela primeira vez registra identidade sem exibir preparo. `cancelReason` deve ser preservado ao mapear o terminal. Freeze/stun cancelam cast e seguram pose; sair do controle não retoma disparo cancelado. Pausa geral segura idade; morte prevalece.
- Getter proposto `animatedEnemies.getCastEmitter(zombie,{castId})` retorna `null` quando não há controller/perfil/cast correspondente, ou `{profileId,castId,socket:'L_Hand',position:{x,y,z},elapsed}`. Só lê a pose atual; não avança o mixer nem cria disparo. Combat precisa sincronizar a idade antes de amostrar o release. Fallback de apresentação para caster fora do pool é explícito, sem criar atores acima do orçamento. Posição da mão **não substitui** origem/altura/raio autoritativos.
- Reentrada no pool aplica a idade atual, sem replay de início. Reciclagem/reset limpa dedup apenas quando muda a identidade da entidade. Snapshot terminal/epoch anterior deve ser descartado pelo integrador Combat antes de chegar ao pool. Perda de LOD não cancela a autoridade.
- Na morte cortada, preservar a pose realmente apresentada antes de criar as cópias do corte; limpar/cancelar o controller após a captura/recycle. Não trocar para Idle antes de congelar o corpse. Combat cancela o estado autoritativo antes da remoção; projétil já emitido continua vivo. Corte e recompensas não são repetidos por snapshot.

Pontos obrigatórios Combat da proposta revisada: estado persistido antes de consumir eventos; um release/eventId; direção travada no preparo; origem fresca no release; controles capturados antes de expirar/early return; cooldown debitado uma vez; projétil novo usa só `remainderAfterRelease` no primeiro passo. Suprimir o gesto legado.65s dentro de spawn **somente no novo caminho preparado**. Preservar as diferenças atuais de alcance/cooldown/spec offline/servidor, sem rebalanceamento implícito. Stream+snapshot deduplicados, latejoin/reconnect sem emissão histórica.

## Lote futuro e gates

1. Animation rebaseia um diff mínimo sobre loader/pool **atuais na janela acordada**, acrescenta perfil+sidecar e seleção por instância. Não copiar o loader SFX completo nem referências main/server. Runtime continua congelado enquanto Combat fecha combos/natural/rede das seis skills.
2. Combat aplica autoridade/callers/transporte em seu escopo na mesma cópia de integração, consumindo a API visual acordada. Não promover só o GLB/gesto enquanto o projétil ainda nasce imediatamente.
3. CPU: novo perfil inteiro e limites exatos; zero-fade/idade remota sem T-pose; cancelamento antes/depois; dt0/longo; reset/pool/LOD; mesma pose do corpse; emissão única no caller real. **Regressões obrigatórias Walker e Brute** comparando crop/timing/clips/rig, e **Visor sem opt-in** usando Attack antigo. Validação do pacote nesta entrega não substitui esses testes futuros.
4. Depois de CPU/protocolo estáveis: GPU serial, câmera próxima e ARPG do caster real, prepare/release/recovery, freeze/stun/morte/LOS. Dois clientes, latejoin/reconnect e projétil/dano reais, com castId e hashes. Não misturar essa captura com v7 dos heróis ou aprovação no-slide.
5. Somente depois de janela e prova integrada, decidir promoção do lote coerente. Preservar antes e artefatos SFX/root; Brutev3 rejeitado nunca entra por arrasto.

**Readiness para Combat:** perfil/take e pacote CPU prontos para revisão. Escolha recomendada: opt-in por `caster`, GLB runtime mantido e sidecar de animação próprio. Pool/loader/autoridade ainda não integrados; não bloquear a captura final atual esperando este incremento futuro. Fonte do cortev3 permanece e37398db e heróis07952. Nenhum lockGPU, servidor, runtime ou arquivo SFX operado nesta preparação.
