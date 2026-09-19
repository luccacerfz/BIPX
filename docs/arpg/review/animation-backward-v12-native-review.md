# V12 — revisão Root e próxima junção

Root leu CPU/ablação/diff, reprodução e correção dt0, preflight e report nativo `arpg-animation-backward-v12-ab-1789798650919`. Candidato c402b5ac retido em cópia. Inspecionados sete PNGs originais: próxima30Hz100/102/103; próxima60Hz200/205/207; ARPG30Hz102. Esta seleção é amostrada, não revisão contínua dos quatro vídeos.

A atualização de tempo zero agora preserva a última amostra cinemática positiva e ainda reaplica o solver; quatro casos30/60Hz passam historyPreserved/poseReapplied/allFinite. O diff protege só a escrita de airMotion, sem epsilon nem retorno precoce. Os452frames positivos anteriores são preservados.

O nativo usa v11 4ad67bcf versus v12 c402b5ac, GLBs históricos e piso de diagnóstico, não gameplay live. Quatro playbacks1x de3.667s,904frames de preflight, posição/reach exatos e material<=1.386e-13m, zeroerros/drift. O vídeo codificado25fps não comprova cada amostra60Hz.

Nos originais, a bota aérea muda posição/inclinação na troca, o apoio direito e torso/arma coincidem. A base continua estreita; a pose do pouso volta exatamente à v11. Isso não resolve a diferença de velocidade herdada do quadro anterior. CPU registra a mudança vetorial30Hz no pouso5.519→12.086m/s, além de Toe rápido e cobertura insuficiente. Flags sem patch físico continuam pendentes. Não há aceite no-slide/AAA nem promoção.

**Próxima etapa autorizada: uma correção CPU focada na junção de velocidade/orientação com o pouso103/207**, em nova cópia. Partir de c402b5ac, conservar entrada aérea melhorada, dt0, roll do pé direito e apoios qualificados. Derivar limites de posição/velocidade/orientação da trajetória destino; não apenas empurrar o pico a um frame vizinho, prolongar movimento depois do contato, congelar pé no ar ou relaxar auditor. Medir toda a aproximação e saída do pouso e ambas as frequências, preservar negativo caso não consiga melhorar. Sem nova busca de takes, matriz ampla ou alteração live.
