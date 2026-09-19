# Dash art1 — revisão independente e próximo candidato

**Art1 não selecionado para o live.** Root inspecionou os originais high .12/.30/.50, low/reduced .30 e o input real em `output/vfx-dash-art-v1/native-2026-09-19T07-13-48-249Z/`. O arco único elimina os crescents independentes, mas corpo, borda, esteira e faíscas perdem força na escala ARPG. Em .50 o efeito é quase invisível junto aos inimigos. A legibilidade dos atores passa no recorte, mas isso não transforma um golpe apagado em melhoria artística.

O frame .12 já está após o término do preparo de .12; não prova ausência em toda a preparação. .83 é limpeza esperada, não falha de impacto. A cena pareada usa ator/rig/core reais, porém continua fixture controlada. Root não revisou o vídeo inteiro nem atribuiu qualidade AAA a contagens de partículas ou ROI.

O input real separado confirma atraso espacial: 23 travel frames, máximo **.251301742 m**, média **.167138772 m**, entre emissor recebido antes do mixer e espada desenhada. O teste anterior de igualdade ao payload não podia detectar esse erro. A paridade do trecho relevante entre ebb8 congelado e d9e live está documentada pelo dono; isso não estende a captura ao comportamento novo do Lich nem ao remoto.

## Próxima implementação autorizada

VFX continua autonomamente em nova cópia art2, preservando art1: arco principal com corpo/borda legíveis, preparação efetiva antes de .12, esteira contínua subordinada e impacto direcional que leia na câmera do jogo apenas para contato confirmado. Não restaurar stamps por distância, alterar dano/alcance ou esconder atores com um volume branco. O ganho deve ser percebido em high e low/reduced.

Contrato `../vfx-dash-post-mixer-contract.md` aceito para implementação em staging. VFX possui pool/wrapper; Combat possui mapa e flush no main atual d9e. Corrigir somente o arco vivo e a extremidade atual após mixers; conservar histórico mundial e contatos autoritativos. Conforme refinamento07:34, terminal normal acompanha a pose somente durante a cauda visual já existente de.09s, até APIfalse, sem prolongar timestamps/life; cancel/reset/disconnect encerram acompanhamento. Isso substitui a primeira hipótese de resolver terminal uma única vez, que poderia deixar a ponta atrás da pose interpolada enquanto o arco ainda existe. RetiredID impede recriação por evento atrasado, preservando apenas o registro terminal já vivo. Não repetir cast, SFX, travel/hit ou alterar clocks. GPU posterior coordenada com Environment/Combat, com prova local e remota da nova extremidade e comparação artística focal; nenhuma promoção automática.

**Complemento de integração remota:** `updateRemotePlayers` interpola root e atualiza mixer em todos os frames por `updateMultiplayer`, independentemente de ter chegado um evento travel novo. Resolver só uma pendência no frame do pacote pode manter o arco/ponta atrasados nos frames intermediários. O candidato deve medir também esses frames. Enquanto a apresentação de travel estiver realmente ativa, manter o arco e a ponta atual seguindo a pose desenhada, com começo/histórico fixos; isso é transformação de apresentação, não autorização para criar eventos/hits novos. Se o contrato de API pendente-only não cobrir esse caso, ajustar o contrato em cópia antes da prova remota. Expiração, end normal recebido antes do fim da interpolação e cancelamento devem ter comportamento explícito, sem seguir a espada indefinidamente.

## Integridade e limite temporal

Root reconciliou independentemente os39arquivos: 36 originais intactos, três deltas Lich exatos conforme recibo07:10 (main d9e, server eb80, animated-enemies f11). O relatório bruto continua igual ao hash da auditoria do dono. Recibo em `output/qa/arpg-root-review/dash-art1-review-20260919.json`.

Essa conferência é posterior à captura. O pedido de recibo inicial atualizado chegou ao dono após o teste; o runner antigo só bloqueava drift VFX. Não afirmar que existiu preflight39 contemporâneo nem inferir ausência de escrita transitória. Originais e runner anterior ficam preservados; runner futuro deve comparar os39antes/depois sem tolerância genérica. Não repetir GPU apenas para rebatizar a procedência.
