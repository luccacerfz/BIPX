# Ré v6 — revisão visual root

Inspecionei sete PNGs nativos originais do A/B em `output/playwright/arpg-animation-backward-v6-ab-1789786338180/`, enumerados com hashes em [registro](animation-backward-v6-followup.json). O report do dono contém seis clipes/18poses, fonte estável e runtime sem drift. Minha revisão se limita aos sete frames, não ao playback contínuo.

Os frames de aterrissagem6.5/433 e9.1/359–360 mostram a nova perna de apoio próxima do chão. A comparação conserva rig/material/arma e deslocamento por frame, mas os takes têm fases/poses diferentes: não inferir menor velocidade da sola só por dois stills. O auditor continua mostrando apoio/cobertura piores que07952.

Na curva9.1, frames204 e205 mostram a base elevada e pés suspensos no candidato; o frame206 já retorna próximo ao chão. A pose acompanha o pico de alcance.420730m, não resolve transferência de peso. A câmera ARPG reduz muito o tamanho das pernas; aprovação não deve depender de esconder o defeito pela distância. A vista próxima é necessária para o refinamento.

Mantive66ed1484 em staging. Próxima iteração autorizada ao dono Animation: corrigir captura de apoio durante Strafe→ré e roll do forefoot, preservando desaceleração da aterrissagem, rig/comprimentos e arma. Primeiro resolver witness204–206 e ciclos6.5/9.1; ampliar a matriz depois de melhora causal. Não trocar critério do auditor, retirar frames ou aceitar abertura exagerada de base/salto do quadril para obter contatos. No-slide, fluidez em gameplay e AAA continuam pendentes.
