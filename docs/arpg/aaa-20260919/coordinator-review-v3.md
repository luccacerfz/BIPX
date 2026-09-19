# Revisão da integração v3

Em montagem, sem promoção ao runtime e sem aceite AAA. As observações abaixo orientam correções concretas dos candidatos; não substituem as capturas finais.

## Copas — aceite focal

Patch Astra3 revisado e aplicado ao candidato `integration-v3`, derivado de `latejoin-projectile-v1`. Os três módulos de render aplicados são idênticos ao candidato Astra; o main conserva o wiring de late join. O coordenador inspecionou os PNG high antes/depois de `astra-canopy-v1/native-focus-2026-09-19T09-49-50-336Z`: corpo e espada antes ocultos ficam visíveis. Árvores próximas e sombra permanecem. A pequena copa que cobre o ator pode ser recortada por inteiro, conforme o projeto do corredor. Aceite restrito à oclusão observada; performance máxima e avaliação artística global não estão aprovadas.

## Projéteis pointblank — v2a não encerrava D-1

A guarda de distância completa antes de decompor a posição do muzzle corrige a regressão da primeira proposta: emissores alinhados a 100 m e deslocamentos combinados maiores que 3 m voltam ao caminho autoritativo. O canhão conserva seu comportamento sem o opt-in.

Entretanto, o teste inicial de `fable-pointblank-v2/tools/verify-bridge-v2-cpu.mjs` calculava excesso sobre `max(terminalAt, 1.4)`. Zero nessa medida não equivale a zero sobre o contato. No exemplo de muzzle a 1,4 m e contato a 0,99 m, o corpo pode permanecer 0,41 m além do contato enquanto aguarda a autoridade. O coordenador rejeitou uma conclusão de fechamento integral baseada nesse limite. Fable deve preservar v2a/capturas, medir contato e limite do muzzle separadamente, incluir o corpo no release e validar a ocultação do corpo enquanto a trajetória ainda não atingiu a boca. O flash de disparo e o corpo em voo são elementos distintos.

## Late join — v4 parcial

Grok v4 identificou corretamente que `world.seq` só muda em acontecimentos do mundo, não a cada broadcast. Permitir a mesma sequência corrige a ausência de refresh, mas aceitar um snapshot antigo com sequência igual ainda permite recuo ou remoção indevida. `world.serverTime` já existe e deve ordenar a apresentação, com duplicatas incapazes de prolongar a vida.

O nativo v4 abriu o WebSocket do observador antes do cast e registrou cast/release. Ele mostra um corpo renderizado, mas não isola reconstrução por snapshot de recepção de eventos vivos. O próximo teste precisa observar `snapshotOnly` real e entrada sem cast/release anteriores.

O hook de áudio v4 foi instalado condicionalmente sobre `audioManager.samples` no fim do main. Antes do gesto de usuário esse banco pode ser nulo, deixando o contador sempre zero. Zero sem instalação comprovada e controle positivo não aprova ausência de replay. Grok recebeu a correção; o novo roteiro do coordenador usa diretamente os contadores reais do banco após controle positivo de release.

## Interpolação temporal — revisão antes de GPU

Na primeira implementação temporal Grok6, a chegada ao endpoint mudava a direção para +Z, mesmo em disparos para −Z. Além disso, trocar o destino antes de alcançar o anterior podia criar uma corda que pula vértices já verificados pela ponte, e a trilha ainda era desenhada inteira no evento antes de o corpo percorrê-la. Foram solicitados: preservar a orientação em repouso, seguir segmentos confirmados sem cortar o caminho ou realizar sweep seguro, e vincular trilha à posição efetivamente apresentada. Nenhuma aprovação baseada somente na redução do salto linear.

## Loot e áudio

O coordenador implementou loot-label-v1; Astra4 encontrou sobrescrita da posição nos frames sem `labelFrameReady` e prepara v2 com estabilidade e associação visual ao item. V1 permanece como negativo, sem promoção.

`audio-native-v1/run.mjs` prepara duas suítes sobre cópia identificada por hashes: sinal PCM real das seis skills e desconexão/resume com dois clientes. O teste de grace segue a nova autoridade: cliente desconectado silencia, peer mantém campo vigente, resume preserva identidade/sequence/recurso/tempo restante sem repetir eventos instantâneos. Ainda não executado neste registro. Captura de sinal não constitui escuta nem evidência de dispositivo físico.
