# Revisão independente das primeiras seis skills

Estado intermediário da implementação; achados destinados ao dono Combat. Fixture CPU, sem browser/GPU/rede. Fonte estável durante a reprodução; hash de class-skills, main/server, wrapperVFX e deste auditor no JSON.

## Origem de emissão presa ao início do cast

`beginSkill` copia x/z do ator no aceite. `advanceSkills` não recebe a posição atual do ator; usa aquela origem para emitir. `updatePlayer` permite movimento durante o preparo, e `updateClassSkills`/`updateServerSkills` não fornecem uma origem posterior. Isso separa arma/personagem da origem real da magia.

| Skill | Primeiro evento após preparo | Personagem X | Origem/centro X | Separação |
| --- | --- | ---: | ---: | ---: |
| dwarf_incendiary_burst | travel @ 0.183s | 1.192m | 0.000m | 1.192m |
| dwarf_cryo_grenade | travel @ 0.300s | 1.950m | 0.000m | 1.950m |
| dwarf_arcane_shot | travel @ 0.417s | 2.708m | 0.000m | 2.708m |
| warrior_frost_nova | impact @ 0.350s | 2.275m | 0.000m | 2.275m |

Caso: x=z=0 no aceite, caminhar no eixo+X a6.5m/s durante windup, step1/60s, sem obstáculos. Nova pessoal deve acompanhar a posição de detonação do caster. Disparo/granada devem nascer na arma/mão no release; alvo explicitamente escolhido para área pode continuar fixo. Não resolver só deslocando o VFX: origem de colisão/dano e apresentação precisam concordar em cliente e servidor.

Recomendação: receber referência autoritativa atual do ator no update, capturar origem válida no instante de release e mantê-la então fixa durante voo. Definir como mira/target lock respondem ao movimento para cada tipo, e limitar alvo a partir da origem de release se o alcance é relativo ao personagem. Nos remotos, a apresentação deve seguir evento/elapsed sem redefinir autoridade pela pose renderizada.

## Rastro passa do último alvo perfurado

Sete alvos emlinha a X1.0,1.4,...3.4, raio.05; arcane pierce6, dt.1. Seis hits acontecem corretamente e cast é removido, mas travel foi emitido antes de limitar o segmento ao sexto contato: endpoint X3.8, último centro de impacto X3.0. O rastro avança0.8m além do centro, ainda mais além da superfície. É um defeito de apresentação reproduzido, não dano no sétimo alvo.

Recomendação: calcular os contatos e o limite de perfuração antes de publicar o último segmento; cortar em t do contato terminal e emitir impacto no ponto de contato verdadeiro. Manter tie-break de parede e casos de dtalto/círculo já sobreposto.

## Contratos a verificar no render integrado

- O wrapper VFX documenta cast como release, mas Combat emite cast no aceite e inicia a animação nesse evento. Definir preparação versus emissão explicitamente para não disparar VFX completo0.18–0.65s antes da arma. A nova de impacto já vem depois; corte sem vítima também precisa arco/feedback de execução sem fabricar hit.
- `class-skill-vfx.js` suprime travel sob reduced-motion e diz que o projétil é desenhado pelo gameplay. Na integração inspecionada, as skills avançam em classSkillState e apresentam eventos; não identifiquei mesh própria das três viagens. Confirmar corpo legível de projétil/granada em reduced-motion/low, e não depender apenas de partículas de rastro. Este ponto é uma hipótese de inspeção estática, exige prova nativa.

Evidência: [2026-09-18T23-33-42-777Z-class-skill.json](../../../output/qa/arpg-root-review/2026-09-18T23-33-42-777Z-class-skill.json). Reprodução: `node docs/arpg/review/class-skill-audit.mjs`. Os JSONs possuem `accepted:false`; nenhuma aprovação global/JEF decorre desta revisão.
