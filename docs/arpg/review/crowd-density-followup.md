# Horda densa — broad phase estática em cópia

Root leu o diff literal `baseline/contacts.mjs`→`candidate/contacts.mjs` de `output/physics/crowd-density-20260919` e o replay pareado02:27:26; detalhes/hashes em `crowd-density-followup.json`. Não reexecutou a suíte nem autorizou promoção. Runtime permanece290a.

O candidato indexa somente mundos imutáveis criados pela própria API, com WeakMap privado. Preserva ordem dos colisores, testes exatos AABB/altura/forma e arena. Mundos estrangeiros/pequenos, índices excessivos ou consultas grandes caem no scan integral, sem descartar sólidos. Não altera IA, atores, raios, dt, massas, controle, ordem de movimento ou forças.

Relatório proprietário:4ensaios alternados por população,6612frames comparados120atores/3036frames400atores, hashes de estado idênticos.120P95CPU2.978208→1.762125ms;400P9515.768125→7.948583ms. Totais incluem aquecimento/criação separadamente documentados; perfil e auditor fora do cronômetro. A reconstrução usa posições/dt nativos com saídas simuladas e fase0 assumida: não é novoFPS nem execução de render/áudio/rede.

O próximo A/B nativo precisa declarar cenário comum para baseline/candidato. A composição143 acabou de ser promovida; replay original corresponde ao ambiente138. Gate GPU/desempenho permanece distinto; confirmar também cantos/porta/vigas e limites de alocação sob layout143 antes de promover.
