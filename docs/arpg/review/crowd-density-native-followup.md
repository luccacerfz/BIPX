# Horda densa143 — revisão independente do Root

Root releu o patch completo290a→912c, o relatório nativo03:11:11 e as duas capturas finais400 baseline/lado pareado. Procedência em `crowd-density-native-followup.json`.

O índice reduz candidatos estáticos e preserva a ordem original, os testes exatos de forma/altura e os retornos ao scan integral. Não altera raios, IA ou poderes. A revisão aceita a integração coordenada **somente de contacts912c**, após as capturas VFX/Environment que usam o snapshot atual; Combat controla a janela e a validação integrada. Root não promoveu o arquivo.

Seis capturas,215 fontes estáveis.400 baseline livre: P95 frame21ms/CPU17,5ms, orçamento20ms reprovado. Candidato livre: P95 frame9,8ms/CPU5,9ms,117,80FPS. Pareado: mesmos790 passos/estados iniciais e finais/dt/planos no Chrome; CPU P956,9ms. Os116,01 de reprodução são throughput, não FPS de uma partida em tempo real.120 mantém P95 frame7,7–7,9ms. Auditoria CPU separada registra2.426.530 segmentos e pico transitório zero; não foi colocada dentro do timer.

Nas duas imagens revisadas, horda, cenário e HUD estão presentes com mesma disposição de atores. Tempo mostrado e sobreposição de números de dano diferem na reprodução acelerada; não alegar igualdade de imagens ou aprovação de animação. O valor de vida elevado pertence à fixture declarada.

Limites mantidos: teste controlado curto, uma ordem serial, sem prova física/mobile, natural prolongada, áudio ou rede. O caso dwarf parado na manutenção continua aberto. O main455 deste A/B precede a correção pontual de ordem ARIA, que foi conferida separadamente no main atual. A melhoria técnica não concede aprovação JEF/AAA.
