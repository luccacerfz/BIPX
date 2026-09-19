# V10/V11 — recorte nativo encerrado, v11 retida

**Quatro playbacks1× e68 PNGs concluídos; candidato4ad67bcf congelado, sem promoção.** [Índice com vídeos e todos os frames](../../output/playwright/arpg-animation-backward-v11-ab-1789796528413/index.html), [report bruto](../../output/playwright/arpg-animation-backward-v11-ab-1789796528413/report.json), [revisão/hashes](../../output/playwright/arpg-animation-backward-v11-ab-1789796528413/review.json). CPU completa/implementação/limites em [v11-staging](animation-backward-v11-staging.md).

VFX liberou explicitamente depois do focal05:37. Lock Animation adquirido05:42:08UTC e encerrado com browser/HTTP próprios antes05:44:30; Environment recebeu `msg_d28fe1b0e129` e é a próxima GPU. Nenhuma próxima captura Animation planejada. Runtime07952/auditor/takes/GLBs/5173 preservados durante toda a prova.

## Reprodução e escopo

V10ee6f versus v11 4ad6, mesmo donor d3cd29b3, Dwarf original e11eadb8 e Aldric original0e5 nas cópias. Mesma trajetória6.5m/s, luz, material, escala, câmera e prefixo0–3.667s. Foco contém **cada frame98–109/198–219**, não só o apoio melhorado. Preflight904frames reproduz toda a CPU0–5s de ambas as variantes. Na GPU, cada vídeo executa110/220 passos desde zero sem rebobinar; PNGs exatos são replays separados com todo o histórico.

Chrome/ANGLE Metal Apple M5 Pro,2880×900, dois painéis1440×900. Câmera ARPG usa48°/17,20/follow real; próxima3/4 usa38°/4.8,2.4,−4.8. Piso de diagnóstico, **não gameplay natural**. Vídeos codificados25fps; frequência lógica e render ficam na telemetria.

| Playback | Duração real / simulada | Maior intervalo render |
|---|---:|---:|
|30Hz próxima|3.6741 /3.6667s|16.8ms|
|30Hz ARPG|3.6699 /3.6667s|16.8ms|
|60Hz próxima|3.6716 /3.6667s|33.4ms|
|60Hz ARPG|3.6775 /3.6667s|33.4ms|

Todos os estados simulados1–110/1–220 aparecem na telemetria de render. Fonte estável, zero errosGL/console, posições/reach/flags iguais à referência própria de cada variante; maior diferença material CPU/browser1.34e−13m. Alcance zero nos quatro casos. Bounds do corpo inteiro têm coordenada NDC absoluta máxima.582, dentro de ambos os painéis. Não é benchmark de gameplay ou prova de desempenho móvel.

## Revisão visual delimitada

Foram inspecionados **14 PNGs originais**, enumerados no review.json. A telemetria comprova playback real1×; a inspeção aqui é de stills e não declara julgamento subjetivo contínuo dos vídeos.

- [30Hz102](../../output/playwright/arpg-animation-backward-v11-ab-1789796528413/turn-6.5-30hz-close-frame102.png) e [103](../../output/playwright/arpg-animation-backward-v11-ab-1789796528413/turn-6.5-30hz-close-frame103.png): a v11 já inclina a bota sobre o antepé antes da saída; a v10 conserva uma base mais plana. Em103 a ponta da v11 continua próxima do piso, coerente com6mm de sola e pivô34, enquanto a v10 já elevou a sola46mm. Ausência de patch no release permanece mostrada.
- [60Hz206](../../output/playwright/arpg-animation-backward-v11-ab-1789796528413/turn-6.5-60hz-close-frame206.png), [207](../../output/playwright/arpg-animation-backward-v11-ab-1789796528413/turn-6.5-60hz-close-frame207.png) e208: o roll é legível; a orientação da bota se conserva entre último apoio e primeiro release. Não aparece novo salto grosseiro do torso nesses frames. Isso sustenta a causa geométrica demonstrada na CPU, sem resolver o gate global.
- 30Hz100/104 e60Hz204 mostram uma **base ainda estreita, com as pernas próximas/cruzando a projeção**. A v11 não obteve o ganho abrindo exageradamente as pernas, mas a leitura de peso nessa troca ainda é limitada. O corpo superior firme e o rápido swing inferior não equivalem, por si só, a transferência de peso natural.
- 30Hz106/109 e60Hz219 preservam o swing e a aterrissagem seguinte, com o outro pé elevado. A fase mudou; não se atribui igualdade de poses posteriores. O patch em109 da v11 é zero, apesar do flag de apoio; essa lacuna não foi removida do report.
- [ARPG207](../../output/playwright/arpg-animation-backward-v11-ab-1789796528413/turn-6.5-60hz-game-frame207.png),212 e30Hz103: diferenças de articulação ficam discretas na escala real da câmera. O corpo está inteiro e sem zoom seletivo. Não foi observada quebra grosseira nova nesses stills; isso não prova fluidez contínua/no-slide.

## Decisão e próximo recorte possível

**Reter v11.** Há progresso causal e leitura de toe-off mais plausível no foco, mas P90/cobertura globais continuam falhos, incluindo um foot-frame perdido por frequência. Os dados CPU completos e as regiões sem patch seguem abertos. Não promover por esta prova.

Próxima causa proposta, sem implementar nova variante nesta entrega: suporte/entrada imediatamente seguintes109–113/219–228, onde o flag já voltou mas a região física baixa ainda é insuficiente e o corpo não mostra transferência de peso clara. Preservar os pivôs e a continuidade ganhos; examinar a pose corporal conjunta e o apoio real antes de qualquer expansão9.1/start-stop/casts. Não rejeitar ou aprovar o swing só pelo pico23.74m/s.

O Root autorizou **separadamente** a promoção metadata Dwarf dc0867da após este freeze. Ela não entra nesta prova e não troca a identidade histórica dos GLBs/candidatos. Nenhuma correção VFX, controller ou take está autorizada por essa promoção.
