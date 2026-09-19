# Continuidade de apoio — correção localizada promovida

**Promovido em2026-09-19T01:30:35Z**, após revisão independente root01:22 e janela explícita Combat01:29. Runtime `src/assets/hero-locomotion.js` é o candidato exato SHA `07952bfc2e36dfed257a9f6f27dd582981c89a8dd2c791a92c1c1724be65f2b5`. [Recibo da promoção e hashes protegidos](../../output/arpg-animation/locomotion-v3/promotion/promotion.json). Apenas esse arquivo mudou; df93 está preservado, skills v2/corte v3/takes/GLBs/flags intactos. Fontes congeladas para prova integrada pós-colisão/remoto de Combat; GPU não reservada pela Animation. No-slide/AAA continuam reprovados/pendentes. O staging separado da ré rápida fica em `output/arpg-animation/backward-v4/candidate`, sem promoção.

## Correção concreta e preservação

Mantém o mesmo vértice material no primeiro frame de release e dissipa a correção horizontal por curva quintic durante swing. A nova limitação geométrica restringe somente o residual adicional: ele não pode exigir mais alcance que o alvo autorado já exigia, preservando rotações de pé/toe e intervalos de contato. Aplicada antes do ajuste de pelvis e na correção do witness de release. `carryReachFraction` registra quando o limite intervém; `recentFootReleases` registra residual inicial/resolvido e vértice. API externa não mudou.

Nenhum contacto/threshold/probe/take/GLB foi alterado. O auditor root permaneceu intacto. Antes df93, residual só de tornozelo4bca1b e witness sem limite4c4526 estão preservados em `before/`; este último com relatório/handoff em `before/witness-unbounded/`.

## Auditor independente, oito casos

[Relatório01:07:16](../../output/arpg-animation/locomotion-v3/candidate/output/qa/arpg-root-review/2026-09-19T01-07-16-788Z-sole-contact.json), fonte estável. Comando no snapshot candidato: `node docs/arpg/review/sole-contact-audit.mjs --transition-detail`. Mesmo auditor e mesma seleção de sola deformada. `acceptedNoSliding:false`.

| Caso strafe6.5 | P90 transição antes→candidato | Amostras | P90 apoio declarado |
| --- | --- | --- | --- |
| Aldric |16.154→.47313m/s|15→15|.29515m/s preservado|
| Lyra |11.007→.93695m/s|6→6|.31373m/s preservado|

Nos3releases especificados pelo root, HeroBody/vértice6/direito aos1.125/2.150/3.175s:0.1250/0.1278/0.1306m/s (~1.04–1.09mm/frame, contra13.46cm no pior antes). Aterrissagens permanecem na métrica. Count0/p90null em release-release continua ausência de amostra, jamais aprovação.

Lyra ré9.1 inalterada na causa principal: mismatch~1.722m/s, reach.093232m, sola mínima−.015636m, P90 transição3.88207m/s. Rate2.2/stride1.06 ainda saturados; RunBackwardFast rejeitado continua excluído.

## Casts v2 e integridade

[18casos no candidato](../../output/arpg-animation/locomotion-v3/candidate/output/arpg-animation/skill-v2-cpu.json): maior delta de alcance contra a [fonte df93 reconfirmada](../../output/arpg-animation/v2-reconfirmation/skills-cpu.json) é0. A regressão anterior de.22408m voltou ao máximo original.15391m. Isso preserva o baseline, não resolve seu alcance excessivo. Torso/protocolo/matrizes finitas passam.

[Controller CPU](../../output/arpg-animation/locomotion-v3/candidate/output/hero-locomotion/controller-cpu.json):5gates passam, incluindo torso, transições finitas, revive/Idle, Run real e pernas durante básico. Não são gates de no-slide.

## Playback A/B nativo e novos limites expostos

[Report completo](../../output/playwright/arpg-animation-contact-v3/report.json) e [medidas pareadas](../../output/playwright/arpg-animation-contact-v3/measurements.json):5cenários,10PNG,5WebM,3.025passos pareados a120Hz. Chrome/Metal, quarter-speed nas marchas e half-speed na sequência de arrancada/curva/cast/parada. Fonte estável, zero erros browser/GL, flags de contato idênticas em todos os passos. Matrizes relativas ao quadril de torso/cabeça/mãos/props diferem no máximo2.28e−13.

Ferramentas `tools/animation-contact-preview.html` e `animation-contact-native.mjs`: substituição explícita de apenas `hero-locomotion.js` por servidor efêmero; as duas bibliotecas usam os mesmos GLBs/takes v2 atuais. Probes materiais reais, não ToeBase. A amostragem nativa segue o witness mínimo anterior entre os probes do controlador; NÃO substitui a cobertura de todos os vértices do auditor independente. Exemplo: vertex8 nativo é um witness diferente do vertex6 reportado pelo auditor, embora reproduza a mesma descontinuidade.

- [Aldric strafe](../../output/playwright/arpg-animation-contact-v3/warrior-strafe.webm),[folha amostrada perto do release](../../output/playwright/arpg-animation-contact-v3/warrior-release-playback.png).
- [Lyra strafe](../../output/playwright/arpg-animation-contact-v3/dwarf-strafe.webm),[folha amostrada](../../output/playwright/arpg-animation-contact-v3/dwarf-release-playback.png).
- [Lyra ré rápida](../../output/playwright/arpg-animation-contact-v3/dwarf-fast-backward.webm).
- [Aldric arrancada/curva/escudo/parada](../../output/playwright/arpg-animation-contact-v3/warrior-turn-cast-stop.webm),[Lyra arrancada/curva/canhão/parada](../../output/playwright/arpg-animation-contact-v3/dwarf-turn-cast-stop.webm).

Inspecionados PNGs próximos de ambas strafes/ré rápida, Idle após a sequência da Lyra, vista de jogo Aldric e folhas de frames dos2playbacks de strafe. A mudança mantém as poses comparáveis e reduz o salto medido na liberação. É inspeção amostrada, não avaliação humana contínua ou nota artística. Câmera distante usa fov48°, altura17m/profundidade20m; viewport dividido e look-ahead2.5m (default do jogo2.6m), sem smoothing/trauma/horda. Portanto representa a escala base, não gameplay real.

Não foram excluídos os primeiros frames: na arrancada instantânea da ré9.1, reach chega a.25144m em ambos. Na sequência de curva/escudo Aldric, reach.23726m e probeY−.03557m em ambos. Lyra curva/canhão/parada: reach.249000→.249036m; rootY difere até8.88mm, apesar do torso/props relativos ao quadril preservados. Esses transientes já eram ruins no baseline e impedem afirmar locomoção resolvida. Precisam revisão da escolha/blend/alcance do driver, separada da correção de release.

## Prova integrada após promoção

Nenhuma alteração em main/server desta frente. Janela concedida e promoção concluída conforme recibo acima. [Prova real pós-colisão/remoto revisada](animation-locomotion-v3-integrated.md) registra fonte estável, Idle contra parede, strafe tangencial e sampler remoto. Também registra alcance excessivo no transiente remoto, incluindo.400868m em Aldric. Testes a60/30Hz e transientes maiores permanecem necessários antes de no-slide, assim como resolver a ré rápida. V2 segue prioritária e os18casts foram preservados; a fixture A/B não substitui essas provas de gameplay.

---

## Histórico do ensaio sem limitação (superado pelo candidato acima)

# Continuidade de apoio — experimento isolado, não promover

Runtime segue `src/assets/hero-locomotion.js` SHA `df93d75c6a98f6ad809678788cbb9151c11a6e2f875715c839307ddb2d27dd60`. Nenhuma escrita durante a janela Combat/corte v3. Candidato isolado: `output/arpg-animation/locomotion-v3/candidate/src/assets/hero-locomotion.js`, SHA `4c452637e0de87faea8e31ca5ac7771e38e29b260c0abc682443f7dd6b983ee6`. **Não promover: ganho no strafe, mas regressão de alcance em casts móveis dwarf.**

Revisão atendida: `review/locomotion-transition-findings.md`. Baseline df93 preservado em `output/arpg-animation/locomotion-v3/before/hero-locomotion.js`; primeiro ensaio só de residual do tornozelo em `before/ankle-residual-candidate.js` (4bca1b9171…). Nenhum GLB, clip, intervalo de contato, threshold de sola ou auditor foi alterado.

## Resultado concreto

O primeiro ensaio conservou `lastSolvedAnkle - lastAuthoredTarget` e dissipou o residual por curva quintic durante swing. Auditor original8casos em `candidate/output/qa/arpg-root-review/2026-09-19T00-43-45-452Z-sole-contact.json`, fonte estável. Guerreiro strafe: pico das liberações16.154→3.231m/s; salto13.46→2.69cm. A rotação autorada ainda deslocava o vértice material mesmo com continuidade do tornozelo.

Segundo ensaio conserva o witness da sola no primeiro frame livre, registra o residual resolvido e o dissipa no swing. Intervalo continua contact=false e a folga vertical permanece real, sem excluir transições. Auditor original8casos com `--transition-detail`: `candidate/output/qa/arpg-root-review/2026-09-19T00-58-14-173Z-sole-contact.json`, fonte estável, acceptedNoSliding:false.

No mesmo HeroBody/vértice6/pé direito, liberações1.125/2.150/3.175s ficaram0.1250/0.1278/0.1306m/s (~1.04–1.09mm por1/120s). P90 de todas as transições elegíveis do strafe.4731m/s, incluindo aterrissagens;15amostras mantidas. P90 de apoio declarado.2951m/s preservado. Não é no-slide nem validação visual/rede.

Ré rápida dwarf segue causa distinta:9.1m/s, rate2.2/stride1.06, mismatch~1.722, reach~.093m. Não houve tentativa de mascarar essa saturação reativando RunBackwardFast.

## Regressões e limite da proposta

`candidate/output/hero-locomotion/controller-cpu.json`: torso preservado, transições finitas/start-stop/turn, revive/Idle, Run real e pernas no básico passaram. Esses checks não aprovam contato dinâmico.

`candidate/output/arpg-animation/skill-v2-cpu.json`:18casos de casts passam protocolo/torso/matrizes finitas. **As métricas físicas impedem promoção:** alcance máximo nos casts móveis dwarf chega a.22408m (contra~.154m observado no runtime anterior). Carregar o residual sem restrição em todos os gaits/mudanças de pose não é seguro visualmente. Ganho localizado do strafe não compensa essa regressão.

Próximo trabalho em cópia: limitar/absorver o residual conforme alcance e mudanças de pose/gait, com traço do mesmo vértice em start/stop/turn/blend/cast. Só depois repetir cobertura de sola e conferir native/input/remote em janela separada. Não promover durante natural60s/classes/rede/JEF do Combat. O corte v3 está liberado independentemente deste experimento.
