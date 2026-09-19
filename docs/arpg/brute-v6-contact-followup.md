# Brute v6 — contato lateral e limite de distância, somente staging

**Fechado: focal lateral nativo06:50 concluído e GPU liberada06:50:34 UTC.** Dois clips integrais1,45s a1×, alvos fixos1,89m, quatroGLBs byte-idênticos,87frames Attack por variante, zeroerros. Browser/HTTP/token próprios encerrados;5173/PID5973 preservado. Preparação abaixo é histórica. Próximo trabalho autorizado: nova cópiaCPU v7, semGPU/runtime.

[Report](../../output/brute-motion-v6/contact-followup-v1/native-2026-09-19T06-50-23-248Z/report.json), [parecer](../../output/brute-motion-v6/contact-followup-v1/native-2026-09-19T06-50-23-248Z/visual-review.json), [revisão navegável](../../output/brute-motion-v6/contact-followup-v1/native-2026-09-19T06-50-23-248Z/review.html). A câmera expõe mão/borda superior do escudo e mão/guarda de Lyra; resolve a oclusão anterior. Revisão de seisPNGsexatos e quadros extraídos do playback gravado, sem alegar escuta ou observação perceptual contínua do vídeo. Mão aberta ainda pode ler como pressão/varrida; **peso, contato físico fino, AAA e marker não aprovados**. Alvos Idle0 sem reação; .70 permanece intenção, contactAt=null.

350fontes/provas anteriores preservadas. Toda a preparação e captura focal foi congelada em `contact-delivery-manifest.json` antes da autoria seguinte. Combat recebe este handoff durável, sem retry da fila cheia.

Root leu/reviu [nativo anterior](review/brute-v6-native-review.md) e autorizou preparação focal: mesmo handoff-01 congelado, apenas um ângulo reverso/lateral que exponha mão-guarda, dois clips completos1,45s a1×. Alvos mantidos1,89m, sem editar poses/rig/range ou selecionar marker. As quatro vistas anteriores não serão repetidas nem seus arquivos reescritos.

GPU **não reservada**. Ordem atual: Combat grito e Lich parede/Environment já coordenados antes deste focal. SFX fará CPU e leitura enquanto aguarda encerramento real, depois aquisição mkdir atômica. VFX/Environment notificados; Combat recebe este handoff, sem retry na fila cheia.5173 preservado.

O vídeo anterior será examinado em sequência de quadros mais densa no encontro. A câmera lateral será escolhida em CPU por visibilidade da mão/região da guarda, com todos os meshes presentes e o mesmo enquadramento nas duas variantes. Nenhum ator será movido para revelar ou fabricar contato.

Paralelo CPU: medir clip congelado a1,82/1,89m, incluindo poses reais dos alvos, e propor política para alvo móvel. Isso não autoriza integração: a distância dos atores vem do mundo; não mover raiz, inflar alcance ou comprimir duração. Callers atuais ainda usam fallback Brute com dano imediato/.55s e cooldown.62s; getMeleeTiming('brute')=null. A decisão de evolução desse contrato continua de Combat/Root, após seleção artística.

Pacote novo: `output/brute-motion-v6/contact-followup-v1/`; ferramentas exclusivas `tools/brute-motion-review-v6-contact-*`. Provas anteriores e candidatos267+native83 continuam imutáveis. Estado: preparação em andamento.

## Preparação CPU concluída

Os vídeos antigos não resolvem a oclusão no encontro: doze quadros **consecutivos** de cada close, entre aproximadamente.61–.80s do clip, preservam mão atrás da guarda/cabeça. [Aldric](../../output/brute-motion-v6/contact-followup-v1/previous-video-dense/warrior-dense-sheet.png), [Lyra](../../output/brute-motion-v6/contact-followup-v1/previous-video-dense/dwarf-dense-sheet.png), [índices e PTS](../../output/brute-motion-v6/contact-followup-v1/previous-video-dense/extraction.json). Extração CPU dos WebM existentes; nenhum novo playback/GPU nessa conclusão e nenhuma alegação de revisão perceptual contínua de peso.

**Única câmera nativa proposta:** posição(-5.8,1.4,-.2), mira(0,1.55,-.945), FOV40, viewport1440×900. Mesma câmera fixa nas duas variantes, com todos os meshes e materiais presentes; centros1,89m. [Teste CPU de visibilidade](../../output/brute-motion-v6/contact-followup-v1/camera-cpu.json) usa triângulos deformados e raios até mão/testemunha, sem tornar atores transparentes. Em.70s, os dois witnesses ficam visíveis: distância até primeira interseção difere apenas~8µm/~7µm. No ângulo antigo eram ocultados por escudo~111mm e rifle~413mm. Amostras visíveis da mão no novo ângulo: Aldric18/104, Lyra47/104; região próxima do encontro12pontos em ambos. A maior parte de uma mão volumétrica naturalmente fica no lado oposto; esses counts não são gate de qualidade.

Triagem de câmera inicial mais alta também era ocultada pelo próprio Brute e foi descartada **antes de qualquer GPU**; fonte/report inicial e scan preservados na pasta. A seleção final da câmera não muda endpoint, marker ou pose. Testes.65/.70/.745 mantêm mão dentro do enquadramento; visual nativo ainda necessário.

Harness focal pronto: `tools/brute-motion-review-v6-contact-native.mjs` + `.html`, reutilizando a função de cena congelada do primeiro nativo. Apenas duas execuções integrais1,45s a1×, seis PNGs de poses.65/.70/.745 separados do vídeo. Sem ARPG ou quatro vistas novamente. Runner exige recibos de encerramento Combat grito, Lich parede e Environment; depois reserva atomicamente e fecha somente seu browser/HTTP/token.

[Proposta de distância/pose móvel](brute-v6-contact-policy-proposal.md) entregue com34contraexemplos geométricos,15checks puros e três trajetórias via contacts real. Achado:1,855m também cruza; em1,89m outra faseIdle de Aldric já cruza, e Run muda o encaixe nas duas classes. A família de encontros/gesto de erro é proposta futura, sem novosGLBs/retarget/rootmotion. API somente diagnóstico; nenhum import runtime.

Estado06:38: CPU/harness prontos; grito tem nativo06:31 concluído e integração Combat, mas Lich parede e Environment continuam anteriores na fila. **Sem lock/GPU desta frente.** Próxima escrita prevista: recibo/captura focal/parecer após liberação real, sem novas poses ou ferramentas de runtime.

## Nova direção Root incorporada

[Decisão sobre autoria adaptada](review/brute-v6-contact-policy-review.md) lida integralmente. **Após congelar o parecer deste focal**, continuar autonomamente autoriaCPU em nova cópia: braço com encontro adaptado + recolhimento contínuo ao sair/mudar superfície, primeiro1,82–1,89m/duasguardas. Preservar1,45s, carga, pernas, pelvis, raiz, rig/skin; sem alongar cadeia, mover alvo, inflar alcance ou associar dano/marker. Contraexemplos existentes são condições de teste; poses fora do envelope serão declaradas. Não haverá GPU da adaptação antes do candidatoCPU, novo take/provedor/runtime. Esta autorização supera o encerramento anterior apenas em proposta; o helper diagnóstico não será apresentado como solução visual final.
