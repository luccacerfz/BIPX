# Diagnóstico focado das transições de apoio

Auditor independente ampliado com `--case=<classe>:<direção> --transition-detail`. Sem esses argumentos, mantém os oito casos e as métricas anteriores. Nenhuma alteração nos controllers, clips, rigs ou velocidade do jogo. A seleção de patch continua exigindo o mesmo vértice material, banda de piso de 8 mm, proximidade de 3 mm ao mínimo local e velocidade vertical até 0.05 m/s.

## Guerreiro em strafe: liberação descontínua

`output/qa/arpg-root-review/2026-09-19T00-38-58-989Z-sole-contact.json`, fonte estável. Reproduzir: `node docs/arpg/review/sole-contact-audit.mjs --case=warrior:strafe --transition-detail`.

- Movimento 6.5 m/s, gait `StrafeD`, playback 1.36597 e stride 1.0. Nenhum erro de alcance nessa execução.
- Aos 1.125, 2.150 e 3.175 s, o mesmo vértice 6 da `HeroBody`/pé direito passa de contato declarado para livre ainda a cerca de 2.3 mm do piso. Velocidades horizontais 16.065, 16.109 e 16.154 m/s. No último caso, deslocamento horizontal aproximadamente 13.46 cm em 1/120 s; vertical somente 0.331 mm. Não é troca do vértice mais baixo nem pé alto em fase aérea.
- Aterrissagens esquerdas correspondentes ficam em aproximadamente 0.473 m/s nesta seleção, indicando que o salto dominante deste caso ocorre ao liberar o apoio.

Inferência da fonte: `if (!contact) leg.locked = false` interrompe imediatamente a correção XZ do witness/anchor; `leg.target` volta ao alvo autorado no mesmo frame, quando a curva `sin²` de clearance ainda está quase zero. O padrão repetido é compatível com descarte brusco desse residual. Confirmar com instrumentação do residual antes de concluir causalidade definitiva.

Direção de correção para Animation: preservar continuidade da posição resolvida ao iniciar swing e dissipar o residual ao longo da fase aérea, mantendo os intervalos de apoio e rotações de pé/toe autorados. Não mascarar o salto excluindo transições da métrica, mudando o limiar ou marcando o pé como suspenso sem afastamento físico. Validar também mudanças de direção, start/stop, blending e cast; esta medição é reta/plano/CPU.

## Dwarf em ré rápida: limite de passada distinto

`output/qa/arpg-root-review/2026-09-19T00-39-13-584Z-sole-contact.json`, fonte estável. Reproduzir com `--case=dwarf:upgraded-backward --transition-detail`.

Em 9.1 m/s, `RunBackward` atinge os limites playback 2.2 e stride 1.06; mismatch declarado chega a 1.7221 m/s. Houve alcance excedido em até 9.323 cm e sola mínima de -1.564 cm. O patch de aterrissagem chega a 4.593 m/s. Esse caso não pode ser explicado apenas pela liberação brusca vista no strafe; precisa resolver a compatibilidade do take/velocidade/alcance. `RunBackwardFast` continua excluído pelo controller atual: não reativar sem rever a qualidade do take.

As duas execuções continuam `acceptedNoSliding:false`. PNG estático, toe bone parado ou ausência de amostras não substituem sola real, playback e validação local/remota.
