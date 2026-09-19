# V12 — refresh de tempo zero, correção isolada

**Candidato c402b5ac, sem promoção.** Revisão Root recebida por `msg_9e2fecc4b45b`: o caller Dwarf aceita `frameDt=0`, restaura a pose e chama `motion.update`. A v12 original **5e93437e** escrevia `airMotion.velocity` e `soleVelocity` dividindo por esse zero; o campo `dt` também virava zero, sendo usado depois na extrapolação angular.

Original, GLBs históricos e provas anteriores preservados. Nova cópia: [candidate](../../output/arpg-animation/backward-v12/dt-zero-fix/candidate/src/assets/hero-locomotion.js), SHA256 **c402b5acc9c08214608bf78fec566cdb2a081baed5fa6a2bcc50817be4df21cc**. [Diff mínimo](../../output/arpg-animation/backward-v12/dt-zero-fix/candidate.diff), [status e preservação](../../output/arpg-animation/backward-v12/dt-zero-fix/status.json).

## Reprodução e correção

[Runner focal](../../output/arpg-animation/backward-v12/dt-zero-fix/refresh-zero.mjs) usa o loader/caller real e instrumenta somente outra cópia. Mantém a trajetória existente a6.5m/s, com dois refreshes consecutivos `update(0)` após movimento: frame24/48 e imediatamente antes da troca99/199, a30/60Hz. Registra o histórico dos dois pés, execução do solver e matrizes de todos os bones até depois do pouso.

[Antes](../../output/arpg-animation/backward-v12/dt-zero-fix/reproduction/report.json): quatro casos falham. Nos refreshes, velocidades tornam-se `NaN` e `dt=0`. O caso anterior à troca contamina a pose nos frames100–102/30Hz e200–206/60Hz; no caso mais cedo, uma atualização positiva posterior recupera a amostra antes daquela troca. Os valores não finitos são gravados como strings explícitas, sem serem confundidos com `null`.

[Depois](../../output/arpg-animation/backward-v12/dt-zero-fix/verification/report.json): quatro casos passam. A escrita de uma nova amostra `airMotion` ocorre apenas com **dt>0**. Refreshes continuam executando o solver dos dois pés e reaplicando a pose; preservam exatamente posição/orientações/velocidades/intervalo da última amostra positiva. Todas as matrizes e históricos permanecem finitos até depois da troca. Não há retorno antecipado do controlador nem velocidade artificial obtida com epsilon.

## Controle positivo e limites

Reprodução inteira0–5s: **151+301 frames exatamente iguais** à v12 anterior, incluindo todas as poses, materiais, patches, flags e estágios instrumentados. [Trace positivo](../../output/arpg-animation/backward-v12/dt-zero-fix/positive-history/summary.json). A correção não muda os resultados artísticos/contato já publicados; preserva os160/583 pares da v11 e as ressalvas de aterrissagem30Hz, Toe, altura do swing, peso e cobertura. `acceptedNoSliding:false`.

Somente o controlador da nova cópia mudou. Runtime07952, GLBs live selecionados, takes, auditor, Brute/SFX e servidor5173 intocados. Comparações continuam usando Dwarf e11/Aldric0e5 históricos; não reatribuir à metadata live dc/5c.

## Recorte nativo autorizado

A/B **v11 4ad67bcf versus v12 c402b5ac**, mesmo histórico desde0 e foco97–109/197–219,30/60Hz, próxima3/4 e ARPG. Reutiliza a fixture/runner anteriores, com rótulos/hashes atualizados e material esquerdo14493 incluído na paridade CPU/browser. Quatro playbacks1× e72poses previstos; sem nova matriz.

[Manifesto congelado](../../output/arpg-animation/backward-v12/native-ab-staging/manifest.json), [preflight](../../output/arpg-animation/backward-v12/native-ab-staging/preflight.json):904frames dos dois lados, posições/reach idênticos à referência, zeroGPU. Captura aguarda a liberação VFX peer-oculto, conforme Combat `msg_e63232ca2109`; lock será adquirido atomicamente. Nenhuma promoção autorizada por esse recorte.

**Encerramento06:20UTC:** [native concluído e revisão](animation-backward-v12-native-ab.md), quatroplaybacks1×/72poses, fonte estável/zeroerros. GPU/browser/HTTP próprios encerrados; fonte c402b5ac congelada, sem promoção.
