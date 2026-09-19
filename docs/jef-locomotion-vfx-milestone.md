# JEF — marco de locomoção e VFX, 18/09/2026

Consulta real TypeSafe Jev 1.13.0, **HTTP 200**, resultado **requires_further_work**. Esta avaliação cobre o marco capturado às 22:57 UTC, antes da correção da deformação da cintura. O objetivo permanece ativo.

JEF recebe texto; não viu os PNGs nem reproduziu os vídeos. As notas são preliminares sobre as observações enviadas, com cobertura parcial. Nenhuma nota foi aceita. A escala nativa 0–9 foi convertida linearmente para 0–10; os valores abaixo são arredondados apenas para leitura, não para aprovação.

| Dimensão | Preliminar /10 | Aceitação |
|---|---:|---|
| Game design and class identity | 3.91 | Pendente |
| Animation, locomotion and contact | 3.47 | Pendente |
| Art direction | 3.60 | Pendente |
| VFX integration and readability | 4.39 | Pendente |
| Combat feel | 4.18 | Pendente |
| User interface and flow | 4.27 | Pendente |
| Mobile play | 0.01 | Pendente |
| Audio experience | 0.02 | Pendente |
| Performance | 3.37 | Pendente |
| Multiplayer behavior | 1.08 | Pendente |
| Accessibility | 4.24 | Pendente |
| Reliability | 4.62 | Pendente |

## Por que o candidato não foi aprovado

- Oito sequências de teclado por personagem passaram nos diagnósticos do controlador, com fonte estável e sem erros. Porém, a sola deformada continuou deslizando: P90 de 0,333–0,889 m/s em Aldric e 0,465–1,234 m/s em Lyra. O marcador do osso quase imóvel não representa toda a bota.
- A captura próxima de Lyra revelou alongamento severo na cintura durante movimento e tiro. O candidato de mistura de poses foi rejeitado. A correção posterior preserva quadril e tronco, mas pertence a outra iteração e exige nova captura.
- O Run real do Orc e os efeitos derivados dos dois repositórios são avanços concretos. Contato completo, apresentação multiplayer, famílias restantes, gameplay prolongado, áudio e aparelhos físicos ainda têm lacunas.
- A ausência de evidência móvel/áudio nesta rodada não é uma avaliação completa do produto anterior. Esta rodada não reaproveita aprovações históricas como prova da fonte nova.

## Evidência e continuidade

- [Estado enviado](quality-evidence.locomotion-vfx-milestone.json).
- [Resposta integral](../output/qa/locomotion-vfx-milestone-20260918/jef.json).
- [Manifesto da fonte capturada](../output/qa/locomotion-vfx-milestone-20260918/source-manifest.json).
- [Solas antes da correção](../output/qa/locomotion-vfx-milestone-20260918/hero-surface-before-correction.json).
- [Diagnóstico no jogo](../output/playwright/2026-09-18T22-57-07-094Z-verify-locomotion-game/locomotion-game.json).
- [Deformação reprovada em captura nativa](../output/playwright/hero-locomotion-first-native/dwarf-after-backward.png).

As correções posteriores devem manter seus próprios hashes e evidências; esta avaliação não as aprova automaticamente. O servidor local continua em http://localhost:5173/?offline=1 para teste iterativo.
