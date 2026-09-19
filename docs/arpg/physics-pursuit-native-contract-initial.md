# Physics — integração nativa pursuit terminal, somente cópia

Status: preparação autorizada por Root em `review/physics-pursuit-terminal-followup.json`; nenhuma captura iniciou. Contrato/proposta publicado antes de qualquer alteração de snapshot.

Combinação exclusiva: cópia do jogo live atual mainafc7d5ac/server29bb/contacts912c, arte/CSS Surface/GUI atuais; trocar somente layout pelo candidato a5f4, navigation pelo e46cc e aplicar `output/physics/pursuit-terminal-20260919/main-bloodcow-adapter.patch` à cópia. Não importar Lich, outros candidatos ou snapshot antigo de main. Manifesto completo e diferenças serão arquivados.

Ownership Physics: novos `tools/physics-pursuit-native-*`, `output/physics/pursuit-native-20260919/`, evidências em `output/playwright/`, este documento. Nenhum arquivo live, processo5173, multiplayer, dano/range/raio/speed será alterado. O adapter offline é a API selecionada em `physics-pursuit-terminal.md`; source e46cc congelada.

Captura proposta (~2 min após preparação): jogo real Chrome/render/assets atuais, duas fixtures de starts conhecidas norte/sul com player(18.933,14.268), runtime normal segue até melee. Depois input WASD real para afastar o player e observar invalidação/replanejamento/novo ataque. Seeds/starts/preparo são fixture identificada, não partida natural. Somente setup pode posicionar entidades; durante observação não há waypoint/posição/dt injetados. Instrumentação somente leitura envolve callers para registrar ticks, planos, danos, posição, LOS e frames; auditoria geométrica fica fora do timer de custo.

Custo separado: pequeno caso de quatro bosses chamando planejamento no mesmo tick. Medir updateZombies e chamadas de pursuit, incluindo trabalho real index/crowd, fora da serialização/auditoria. Discriminar carga forçada de planejamento de gameplay espontâneo. Nenhuma matriz72/density400/global ou GPU concorrente.

Coordenação: aguardar confirmação de janela Combat/VFX/Animation antes de adquirir atomicamente `/tmp/bipx-arpg-gpu.lock`. Servidor efêmero próprio sobre snapshot com ledger próprio/Supabase off, browser e lock encerrados em finally com conferência de token. Prova histórica CPU fornece negativos de colisão/LOS/sem rota; ampliar apenas se a integração produzir defeito novo. Nenhuma promoção automática após o resultado.
