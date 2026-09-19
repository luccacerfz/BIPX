# V11 — saída física de apoio, somente staging

**Candidato congelado `4ad67bcf`, sem promoção.** Implementado sobre a v10 `ee6fe0e0`, preservada em `before/`. Mesma história completa de 0–5 s, 6.5 m/s, 30/60 Hz; 452 frames por variante. O ganho v9 anterior à troca e a continuidade de aquisição da v10 permanecem. A v11 prepara o roll antes de esgotar o alcance e conserva o pivô físico no release. CPU e recorte nativo concluídos; [quatroplaybacks/68PNGs e revisão](animation-backward-v11-native-ab.md), fonte congelada e GPU própria liberada05:44. Limites abaixo permanecem; sem promoção.

[Status/hashes](../../output/arpg-animation/backward-v11/status.json), [diff único](../../output/arpg-animation/backward-v11/candidate.diff), [comparação completa](../../output/arpg-animation/backward-v11/candidate-final/comparison.json), [identidades/saída/entrada](../../output/arpg-animation/backward-v11/exit-and-entry.json). `acceptedNoSliding:false`. Esta fonte não substitui o runtime `07952bfc`.

## Causa e implementação

A v10 conserva a orientação do apoio na troca Strafe→ré, mas chega ao fim da perna antes de devolver o pé ao swing. Liberar o anchor nessa pose produz a translação material brusca observada em103/206. Devolver orientação pelo crossfade genérico, já rejeitado, não foi reintroduzido.

A v11 captura a sola **resolvida do frame anterior**, com posições materiais, Foot/Toe e direção tornozelo→antepé. Constrói o roll no plano vertical dessa direção. O pivô atual fica parado até o próximo ponto material tocar seu plano; nesse instante a rotação passa a esse ponto, sem deslocar a sola inteira. Os eventos registram os IDs e posições reais dos pivôs, inclusive o vértice34 agora acrescentado ao diagnóstico. Não há teleporte do anchor para o alvo do take.

O ângulo necessário deriva da distância quadril→tornozelo e do comprimento disponível. Uma previsão curta usa a velocidade real e o tempo restante de apoio. O roll é preparado após45% do intervalo de apoio, com curva contínua, e nunca reduz o ângulo já adquirido. A solução de alcance usa bisseção limitada a60°; não é varredura de poses/takes. No primeiro frame de release, o solver satisfaz a geometria atual, sem projetar outro intervalo futuro e provocar rotação desnecessária. A envelope de swing já existente recebe a pose resultante.

A fase de entrada é mapeada pelo **progresso do pé que suporta**, usando os perfis existentes. StrafeA tem apoio direito de.8 até.25625 do ciclo; o donor de ré, de.73125 até.19375. Copiar só a fase normalizada mistura estados físicos diferentes. Essa sincronização altera15/25 foot-frames de flags em30/60 Hz e desloca passos posteriores: está registrada, não escondida. Nenhum flag é desligado diretamente para retirar amostra do auditor.

Não se adicionou offset do quadril, ajuste de velocidade, retarget, take, rig, skin ou arma. Foot e Toe giram juntos durante este roll; ainda não há flexão independente do antepé. A solução é local ao apoio transferido; não generaliza automaticamente todos os ciclos.

## Prova causal do apoio e da separação

O prefixo até99/199 é exato; instrumentação versus fonte sem hooks tem perturbação zero. A v10 foi executada novamente apenas para acrescentar material34 e o campo diagnóstico, conferindo igualdade de todos os dados anteriores. Predicados intactos: banda piso8 mm, região mínima3 mm, velocidade vertical.05 m/s, peso de skin>.75. Frames/transições continuam incluídos; população vazia continua `count:0/p90:null`.

| Witness direito | V10 | V11 |
|---|---:|---:|
| Release30 Hz |103|103|
| Velocidade XZ do material99 nesse release |4.74211 m/s|.00001264 m/s|
| Altura mínima nesse release |46.485 mm|6.008 mm|
| Próxima entrada30 Hz |108|109|
| Velocidade material99 na entrada |1.76115 m/s|1.46136 m/s|
| Release60 Hz |206|207|
| Velocidade XZ do material99 nesse release |4.98530 m/s|.00000605 m/s|
| Altura mínima nesse release |11.560 mm|4.578 mm|
| Próxima entrada60 Hz |217|219|
| Velocidade material99 na entrada |1.89257 m/s|1.04544 m/s|

São eventos próprios de cada variante, não frames idênticos fingindo equivalência. `exit-and-entry.json` também contém todos os frames intermediários.

Em30 Hz, o pivô percorre120→7→34: ângulos0°/9.47°/26.07° em100/101/102, sem rotação adicional no release103. Em60 Hz:120→2→7→34; ângulos0°/1.32°/5.87°/11.63°/17.06°/20.87° em201–206, conservado em207. O material99 deixa de ser a região baixa ao levantar o calcâneo; sua velocidade posterior não é rotulada como apoio plano. O material34 é rastreado até a separação.

O patch tem20 pontos em100, zero em101 e5 em102; em60 Hz passa20/20/2/0/0/5/5 em200–206. A migração de canto e o movimento vertical retiram amostras segundo o auditor original. Isso **não é aprovação de suporte durante os intervalos sem patch qualificado**. Os frames de release continuam próximos do piso, mas com velocidade vertical que falha o gate; nenhum `null` virou PASS.

## História inteira e limites

| Medida completa0–5 s | V10→V11 a30 Hz | V10→V11 a60 Hz |
|---|---:|---:|
| P90 XZ de apoio |.145978→.225024 m/s|.133031→.140175 m/s|
| Máximo XZ de apoio |.633198→.633198 m/s|.757077→.757077 m/s|
| P90 de transição |8.582013→8.582013 m/s|1.402702→.615557 m/s|
| Foot-frames com patch |49→48 de302|125→124 de602|
| Cobertura |16.225→15.894%|20.764→20.598%|
| Pares materiais comuns / novos / perdidos |125 /35 /59|490 /93 /153|
| Alcance máximo |0→0|0→0|
| Sola mínima |1.97983→1.97983 mm|1.96492→1.96492 mm|

O P90 global de apoio piora e perde-se um foot-frame em cada frequência; há troca importante da população plana por região de roll. Isso não pode ser apresentado como melhora global ou cobertura resolvida. Máximos antigos de startup/Strafe permanecem. A comparação pareada completa e as identidades perdidas/adicionadas estão no JSON.

No foco100–release, apoio P90 fica.026262→.027364 m/s a30 Hz e.027589→.025263 a60. Não há novo alcance ou penetração. Torso/props/root têm diferença matricial zero. O máximo delta local de posição/escala das pernas é2.81e−6/1.00e−5 unidades, decorrente da fase amostrada; não afirmar igualdade bit a bit desses canais. Não foram editados comprimentos ou transforms de bind.

O offset de fase persiste após a troca. Nos ciclos posteriores, P90 de apoio.034141→.053196 a30 e.052118→.055958 a60; transição máxima.326135→.321069 e.366151→.615557. Cobertura posterior.125→.15 e.170886→.177215. Aterrissagens/roll desses ciclos ainda têm regiões sem suporte suficiente; a v11 não resolve todo o take.

## Continuidade de saída, sem condenar swing por velocidade isolada

Todo o foco98–109/198–219 inclui a aproximação, aquisição, roll, release, swing e entrada seguinte. A30 Hz, passo angular máximo Foot32.18→29.16° e Toe46.66→42.26°; velocidade máxima material99 21.67→20.30 m/s. A60 Hz, Foot15.45→16.17° e Toe28.96→26.09°; velocidade máxima99 21.67→23.74 m/s, mas aceleração horizontal máxima676.77→643.08 m/s². Material39 tem aceleração máxima547.53→559.84 a30 e787.70→779.59 a60. Todos os valores e vetores por frame estão preservados.

Os valores anteriores são do pé direito. O [registro dos dois pés](../../output/arpg-animation/backward-v11/both-feet-continuity.json) preserva também o swing esquerdo: no handoff100/200, a velocidade **3D do tornozelo** esquerdo cai29.214→20.344 m/s a30 Hz e35.727→23.579 a60. O passo angular Foot sobe ligeiramente33.923→34.545° e18.882→19.256°. A trajetória aérea antiga continua brusca, embora a translação diminua; o corpo inteiro permanece visível no recorte para não esconder esse limite. Velocidade de tornozelo3D não é a mesma métrica que velocidade XZ da sola.

Há ganho causal na saída apoiada, sem novo alcance/penetração ou grande degrau angular, mas o swing continua rápido. Esses números justificam o **recorte nativo diagnóstico autorizado**, não aprovação de fluidez, nem análise angular indefinida antes de vê-lo. A seleção artística permanece aberta.

## Ablações preservadas

- `variants/phase-roll`, hash987213e0: previa avanço adicional após release, aumentando roll26→36.6° em103 e20.87→24.62° em207. A versão final usa a geometria atual no release.
- `variants/roll-only`, hash9055839a: sem sincronização de apoio, conservava o descompasso entre perfis e começava o roll já em100. Retida com CPU completa; não selecionada.

Não há nova busca de takes, matriz9.1/start-stop/casts ou compensação corporal arbitrária. Estas duas ablações são distintas da devolução genérica de orientação rejeitada na v10.

## Recorte nativo pronto e preservação

[Preflight](../../output/arpg-animation/backward-v11/native-ab-staging/preflight.json):904 frames, posições/reach/flags exatos contra a referência própria de cada variante. Quatro clipes lado a lado,1×,3.667 s com história desde0, lógica30/60 Hz, ARPG e próxima3/4. Todos os frames98–109/198–219 terão PNG:68 imagens, sem esconder touchdown ou swing. Vídeos Playwright são codificados a25 fps; a telemetria distinguirá esse limite da frequência lógica/render real. É fixture nativa isolada com piso, não gameplay natural.

Runner: `tools/animation-backward-v11-native.mjs`; aquisição atômica pelo wrapper existente `tools/animation-with-gpu.mjs`, somente após janela coordenada. Pedido ao VFX `msg_a2f812c482de`; nenhuma GPU Animation adquirida neste checkpoint. Sem repetir quatro capturas v8/v9.

Somente `hero-locomotion.js` difere entre os19 arquivos antes/candidato. Aldric original0e5 e Dwarf e11 permanecem nas cópias; Aldric live5c já promovido separadamente, Dwarf dc não incorporado. Takes/GLBs/auditor históricos preservados. Runtime07952/corte/API e servidor5173 não foram editados; Lich continua sob o lote de Combat. [Plano/hashes protegidos](../../output/arpg-animation/backward-v11/plan.json).
