# Astra · VFX & Arsenal — contrato de integração

Estado: implementação em curso; ainda sem prova das seis skills no gameplay. Propriedade assumida em 18/09/2026: `src/vfx/`, ferramentas `*vfx*` e este documento. HEAD confirmado `9124df5657474e9ad0a82634a53b987c75d70e9b`; porta 5173 observada ligada, PID 2591. WIP compartilhado preservado. `main.js`, servidor e package pertencem ao Combat.

## API estável publicada antes da integração

```js
import { createClassSkillVfx } from './vfx/class-skill-vfx.js';
const classSkillVfx = createClassSkillVfx({
  THREE, scene, quality: qualityManager.level,
  reducedMotion: presentationPreferences.reducedMotion,
  combatVfx, elementalVfx, // compartilhar as instâncias já existentes
});
classSkillVfx.emit({ skillId, phase, origin, direction, target, castId,
  radius, groundY, contactId });
classSkillVfx.update(dt); // dt=0 congela; time opcional é ignorado
classSkillVfx.setQuality(level);
classSkillVfx.setReducedMotion(value);
classSkillVfx.reset();
classSkillVfx.getStats();
classSkillVfx.dispose();
```

- IDs: os seis IDs exatos do README. `phase`: `cast`, `travel`, `impact`.
- Pontos em mundo, `{x,y,z}`, y opcional (1.2 m para arma/contato). `direction` é vetor de mira, sem exigência de normalização.
- `cast`: `origin` é arma/mão no instante de release autorizado. Não disparar por intenção rejeitada/cooldown. `target` opcional não causa impacto antecipado.
- `travel`: `origin` = posição anterior, `target` = posição atual real. `castId` string/number estável por projétil; não reutilizar o mesmo ID para projéteis simultâneos. Não enviar trajetória prevista; arco criogênico vem do combate. Segmentos estacionários ou saltos >8 m não geram rastro.
- `impact`: `target` obrigatório = contato confirmado. Expiração, remoção de snapshot e miss não são contatos. `origin` pode ser a origem do golpe/raio. Para nova centrada, target é o centro da detonação autorizada; não repetir o efeito radial por inimigo. Para contatos de perfuração/cone, enviar os contatos reais; `contactId` opcional identifica cada vítima/contact event, permitindo deduplicar retransmissão sem perder múltiplos alvos.
- `radius` opcional representa raio visual/área confirmada, em metros; não decide dano. A nova usa esse valor para o anel de alcance, invariável com qualidade/reduced motion. `groundY` opcional é a superfície local, evitando marcas enterradas em plataformas.
- Instâncias emprestadas continuam atualizadas/configuradas/resetadas/descartadas pelo dono original. O wrapper nunca atualiza duas vezes nem descarta recursos emprestados. Sem injeção, cria instâncias próprias sem ambiente para fixture.
- `getStats()` expõe fases por skill, rejeições, deduplicação, deslocamento amostrado, slots/budgets e estatísticas dos pools. Payloads são apresentação, nunca fonte de dano/recursos/cooldown.

## Integração requerida ao Combat

Criar o wrapper após combat/elemental; chamar emit nos eventos autorizados; passar qualidade/preferências e update/reset; expor `getClassSkillVfxStats` no debug existente. Não remover a integração dos projéteis inimigos. Para casts alinhados à pose, usar transform de arma/mão da API de Animation no instante da janela de emissão.

Evidências, hashes e limites serão acrescentados após implementação e testes. A avaliação global/JEF e a integração do candidato pertencem ao Combat.
